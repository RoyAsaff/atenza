// E4 · Clases y calendario del semestre
// HU-13 (crear clase), HU-14 (generar calendario + editar/eliminar
// individual) y "Ver Clase" del estudiante (diagrama E4).
// "Modificar Clase" aprobado por Roy el 12/07 — pendiente en diagrama.

import { Clase } from '../../domain/entidades/clase';
import {
  EstadoInvalidoError,
  NoEncontradoError,
  ProhibidoError,
} from '../../domain/errores';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { AsistenciaRepositorio } from '../../domain/repositorios/asistencia-repositorio';
import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';
import { ExamenCodigoRepositorio } from '../../domain/repositorios/examen-codigo-repositorio';
import { GuiaRepositorio } from '../../domain/repositorios/guia-repositorio';
import { resumenAsistencia, tieneEvaluacionAbierta } from './resumen-clase';

// Detalle de materia (handoff 1b, 18/09): la lista de clases ahora
// distingue "sin asistencia" de "34 de 36" y marca evaluación abierta —
// mismos 4 campos calculados que ya expone VerClasesDeHoy para Inicio,
// reutilizados acá vía resumen-clase.ts.
export interface ClaseConEstado extends Clase {
  total_estudiantes: number;
  asistencia_tomada: boolean;
  asistencia_resumen: { presentes: number; total: number } | null;
  tiene_evaluacion_abierta: boolean;
}

interface Auditoria {
  ip?: string;
  dispositivo?: string;
}

async function exigirMateriaPropia(
  materias: MateriaRepositorio,
  materia_id: number,
  docente_id: number,
) {
  const materia = await materias.buscarPorId(materia_id);
  if (!materia) throw new NoEncontradoError('Materia');
  if (materia.docente_id !== docente_id) {
    throw new ProhibidoError('La materia no te pertenece');
  }
  return materia;
}

// ── Ver Clase (docente dueño o estudiante inscrito) ──────────────

export class VerClases {
  constructor(
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly asistencias: AsistenciaRepositorio,
    private readonly evaluaciones: EvaluacionRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    usuario_id: number;
  }): Promise<ClaseConEstado[]> {
    const materia = await this.materias.buscarPorId(entrada.materia_id);
    if (!materia) throw new NoEncontradoError('Materia');

    const esDueno = materia.docente_id === entrada.usuario_id;
    if (!esDueno) {
      const inscripcion = await this.inscripciones.buscarPorEstudianteYMateria(
        entrada.usuario_id,
        entrada.materia_id,
      );
      if (!inscripcion || inscripcion.retirado) {
        // Mismo 404 para no revelar materias ajenas (patrón de E3)
        throw new NoEncontradoError('Materia');
      }
    }

    const [clases, totalEstudiantes] = await Promise.all([
      this.clases.listarPorMateria(entrada.materia_id),
      this.inscripciones.contarActivosPorMateria(entrada.materia_id),
    ]);

    return Promise.all(
      clases.map(async (c): Promise<ClaseConEstado> => {
        const [asistenciasClase, evaluacionesClase] = await Promise.all([
          this.asistencias.listarPorClase(c.id),
          this.evaluaciones.listarPorClase(c.id),
        ]);
        return {
          ...c,
          total_estudiantes: totalEstudiantes,
          asistencia_tomada: asistenciasClase.length > 0,
          asistencia_resumen: resumenAsistencia(asistenciasClase),
          tiene_evaluacion_abierta: tieneEvaluacionAbierta(evaluacionesClase),
        };
      }),
    );
  }
}

// ── HU-13 · Crear clase individual ───────────────────────────────

export class CrearClase {
  constructor(
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      docente_id: number;
      fecha: Date;
      hora: string;
      tema: string;
    },
  ): Promise<Clase> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);

    const choque = await this.clases.buscarPorMateriaFechaHora(
      entrada.materia_id,
      entrada.fecha,
      entrada.hora,
    );
    if (choque) {
      throw new EstadoInvalidoError('Ya existe una clase en esa fecha y hora');
    }

    const clase = await this.clases.crear({
      materia_id: entrada.materia_id,
      fecha: entrada.fecha,
      hora: entrada.hora,
      tema: entrada.tema,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'clase_creada',
      entidad: 'clase',
      entidad_id: String(clase.id),
      valor_nuevo: {
        materia_id: clase.materia_id,
        fecha: clase.fecha,
        hora: clase.hora,
        tema: clase.tema,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return clase;
  }
}

// ── HU-14 · Generar calendario del semestre ──────────────────────

/** Días ISO: 1=lunes … 7=domingo (Date.getUTCDay(): 0=domingo). */
const DIA_ISO_DESDE_GETDAY = [7, 1, 2, 3, 4, 5, 6] as const;

export class GenerarCalendario {
  constructor(
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      docente_id: number;
      dias_semana: number[]; // ISO 1-7, p. ej. [2, 4] = martes y jueves
      hora: string;
      fecha_inicio: Date;
      fecha_fin: Date;
      tema: string; // tema por defecto; se edita clase por clase después
    },
  ): Promise<{ creadas: Clase[]; omitidas: number }> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);

    if (entrada.fecha_fin < entrada.fecha_inicio) {
      throw new EstadoInvalidoError('La fecha fin debe ser posterior a la fecha inicio');
    }
    const dias = [...new Set(entrada.dias_semana)];
    if (dias.length === 0) {
      throw new EstadoInvalidoError('Selecciona al menos un día de la semana');
    }

    const fechas: Date[] = [];
    const DIA_MS = 24 * 3600 * 1000;
    for (
      let t = entrada.fecha_inicio.getTime();
      t <= entrada.fecha_fin.getTime();
      t += DIA_MS
    ) {
      const dia = new Date(t);
      if (dias.includes(DIA_ISO_DESDE_GETDAY[dia.getUTCDay()])) fechas.push(dia);
    }
    if (fechas.length === 0) {
      throw new EstadoInvalidoError('El rango no contiene ninguno de los días elegidos');
    }
    if (fechas.length > 200) {
      throw new EstadoInvalidoError(
        `El rango generaría ${fechas.length} clases (máximo 200); revisa las fechas`,
      );
    }

    const creadas = await this.clases.crearVarias(
      fechas.map((fecha) => ({
        materia_id: entrada.materia_id,
        fecha,
        hora: entrada.hora,
        tema: entrada.tema,
      })),
    );

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'calendario_generado',
      entidad: 'materia',
      entidad_id: String(entrada.materia_id),
      valor_nuevo: {
        dias_semana: dias,
        hora: entrada.hora,
        fecha_inicio: entrada.fecha_inicio,
        fecha_fin: entrada.fecha_fin,
        clases_creadas: creadas.length,
        clases_omitidas: fechas.length - creadas.length,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return { creadas, omitidas: fechas.length - creadas.length };
  }
}

// ── HU-14 Esc. 2 · Editar y eliminar clase individual ────────────

export class ActualizarClase {
  constructor(
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      clase_id: number;
      docente_id: number;
      fecha?: Date;
      hora?: string;
      tema?: string;
    },
  ): Promise<Clase> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);

    const clase = await this.clases.buscarPorId(entrada.clase_id);
    if (!clase || clase.materia_id !== entrada.materia_id) {
      throw new NoEncontradoError('Clase');
    }

    const fecha = entrada.fecha ?? clase.fecha;
    const hora = entrada.hora ?? clase.hora;
    const choque = await this.clases.buscarPorMateriaFechaHora(
      entrada.materia_id,
      fecha,
      hora,
    );
    if (choque && choque.id !== clase.id) {
      throw new EstadoInvalidoError('Ya existe otra clase en esa fecha y hora');
    }

    const actualizada = await this.clases.actualizar(clase.id, {
      fecha: entrada.fecha,
      hora: entrada.hora,
      tema: entrada.tema,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'clase_actualizada',
      entidad: 'clase',
      entidad_id: String(clase.id),
      valor_anterior: { fecha: clase.fecha, hora: clase.hora, tema: clase.tema },
      valor_nuevo: {
        fecha: actualizada.fecha,
        hora: actualizada.hora,
        tema: actualizada.tema,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizada;
  }
}

export class EliminarClase {
  constructor(
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly asistencias: AsistenciaRepositorio,
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly examenesCodigo: ExamenCodigoRepositorio,
    private readonly guias: GuiaRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      clase_id: number;
      docente_id: number;
    },
  ): Promise<void> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);

    const clase = await this.clases.buscarPorId(entrada.clase_id);
    if (!clase || clase.materia_id !== entrada.materia_id) {
      throw new NoEncontradoError('Clase');
    }

    // Cascada real (18/09): las FK de asistencias/evaluaciones/exámenes de
    // código/guías hacia clases son ON DELETE RESTRICT, así que hay que
    // borrar cada dependiente a mano antes de la clase — eliminar()
    // de evaluaciones/exámenes/guías ya cascadea sus propios hijos
    // (preguntas, intentos, notas, etc.), asistencias no tiene hijos.
    const [evaluacionesClase, examenesClase, guiasClase] = await Promise.all([
      this.evaluaciones.listarPorClase(clase.id),
      this.examenesCodigo.listarPorClase(clase.id),
      this.guias.listarPorClase(clase.id),
    ]);
    await Promise.all([
      ...evaluacionesClase.map((e) => this.evaluaciones.eliminar(e.id)),
      ...examenesClase.map((e) => this.examenesCodigo.eliminar(e.id)),
      ...guiasClase.map((g) => this.guias.eliminar(g.id)),
    ]);
    await this.asistencias.eliminarPorClase(clase.id);

    await this.clases.eliminar(clase.id);

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'clase_eliminada',
      entidad: 'clase',
      entidad_id: String(clase.id),
      valor_anterior: {
        materia_id: clase.materia_id,
        fecha: clase.fecha,
        hora: clase.hora,
        tema: clase.tema,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}
