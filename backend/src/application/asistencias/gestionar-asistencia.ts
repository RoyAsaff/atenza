// E5 · Control de asistencia manual
// HU-15 (llamado de lista, con Falta por defecto y auditoría de
// correcciones) y HU-16 (consolidado por materia).

import {
  Asistencia,
  ConvocatoriaTardia,
  FilaConsolidadoAsistencia,
  FilaListaAsistencia,
  FilaMiAsistencia,
  MarcajeAsistencia,
} from '../../domain/entidades/asistencia';
import { NoEncontradoError, ProhibidoError } from '../../domain/errores';
import { AsistenciaRepositorio } from '../../domain/repositorios/asistencia-repositorio';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { HabilitarLanzamientosTardios } from './habilitar-tardios';

// Puntual y Atrasado cuentan como "presente" en todo E5/E7/E8/E9 — mismo
// filtro que LanzarEvaluacion/LanzarGuia/LanzarExamenCodigo.
const PRESENTE: ReadonlySet<MarcajeAsistencia> = new Set(['puntual', 'atrasado']);

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

async function exigirClaseDeMateria(
  clases: ClaseRepositorio,
  materia_id: number,
  clase_id: number,
) {
  const clase = await clases.buscarPorId(clase_id);
  if (!clase || clase.materia_id !== materia_id) {
    throw new NoEncontradoError('Clase');
  }
  return clase;
}

// ── HU-15 · Ver la nómina de una clase para pasar lista ──────────

export class VerListaAsistencia {
  constructor(
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly asistencias: AsistenciaRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    clase_id: number;
    docente_id: number;
  }): Promise<FilaListaAsistencia[]> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    await exigirClaseDeMateria(this.clases, entrada.materia_id, entrada.clase_id);

    const nomina = await this.inscripciones.listarPorMateria(entrada.materia_id);
    const registradas = await this.asistencias.listarPorClase(entrada.clase_id);
    const mapaMarcaje = new Map(registradas.map((a) => [a.estudiante_id, a.marcaje]));

    return nomina.map((i) => ({
      inscripcion_id: i.id,
      estudiante_id: i.estudiante_id,
      nombres: i.estudiante.nombres,
      apellidos: i.estudiante.apellidos,
      marcaje: mapaMarcaje.get(i.estudiante_id) ?? null,
    }));
  }
}

// ── HU-15 · Guardar/corregir la asistencia de una clase ──────────

export class GuardarAsistencia {
  constructor(
    private readonly asistencias: AsistenciaRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    // 02/09: quien llega tarde y se corrige a Puntual/Atrasado se suma acá
    // mismo a lo que ya esté lanzado en la clase — ver habilitar-tardios.ts.
    private readonly habilitarTardios: HabilitarLanzamientosTardios,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      clase_id: number;
      docente_id: number;
      // Solo los estudiantes que el docente marcó explícitamente;
      // el resto de la nómina queda en Falta (HU-15 Esc. 1).
      marcajes: { estudiante_id: number; marcaje: MarcajeAsistencia }[];
    },
  ): Promise<{ asistencias: Asistencia[]; convocados: ConvocatoriaTardia[] }> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    await exigirClaseDeMateria(this.clases, entrada.materia_id, entrada.clase_id);

    const nomina = await this.inscripciones.listarPorMateria(entrada.materia_id);
    const idsInscritos = new Set(nomina.map((i) => i.estudiante_id));

    const explicitos = new Map(entrada.marcajes.map((m) => [m.estudiante_id, m.marcaje]));
    for (const estudiante_id of explicitos.keys()) {
      if (!idsInscritos.has(estudiante_id)) {
        throw new NoEncontradoError('Estudiante inscrito');
      }
    }

    const anteriores = await this.asistencias.listarPorClase(entrada.clase_id);
    const mapaAnterior = new Map(anteriores.map((a) => [a.estudiante_id, a]));

    const datos = nomina.map((i) => ({
      clase_id: entrada.clase_id,
      estudiante_id: i.estudiante_id,
      marcaje: explicitos.get(i.estudiante_id) ?? ('falta' as MarcajeAsistencia),
    }));

    const guardadas = await this.asistencias.guardarVarias(datos);

    // HU-15 (extendido, 02/09): quien pasa a Puntual/Atrasado por primera
    // vez en esta clase —nuevo o corregido desde Falta/Licencia— se suma a
    // lo que ya esté lanzado (evaluación/guía/examen de código en curso).
    const idsRecienPresentes: number[] = [];

    for (const asistencia of guardadas) {
      const anterior = mapaAnterior.get(asistencia.estudiante_id);
      if (!anterior) {
        await this.bitacora.registrar({
          usuario_id: entrada.docente_id,
          rol_contexto: 'docente',
          accion: 'asistencia_creada',
          entidad: 'asistencia',
          entidad_id: String(asistencia.id),
          valor_nuevo: {
            clase_id: asistencia.clase_id,
            estudiante_id: asistencia.estudiante_id,
            marcaje: asistencia.marcaje,
          },
          ip: entrada.ip,
          dispositivo: entrada.dispositivo,
        });
      } else if (anterior.marcaje !== asistencia.marcaje) {
        // HU-15 Esc. 2: la corrección queda en auditoría con anterior y nuevo
        await this.bitacora.registrar({
          usuario_id: entrada.docente_id,
          rol_contexto: 'docente',
          accion: 'asistencia_corregida',
          entidad: 'asistencia',
          entidad_id: String(asistencia.id),
          valor_anterior: { marcaje: anterior.marcaje },
          valor_nuevo: { marcaje: asistencia.marcaje },
          ip: entrada.ip,
          dispositivo: entrada.dispositivo,
        });
      }

      const eraPresente = anterior ? PRESENTE.has(anterior.marcaje) : false;
      if (!eraPresente && PRESENTE.has(asistencia.marcaje)) {
        idsRecienPresentes.push(asistencia.estudiante_id);
      }
    }

    const convocados = await this.habilitarTardios.ejecutar({
      clase_id: entrada.clase_id,
      estudiante_ids: idsRecienPresentes,
      docente_id: entrada.docente_id,
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return { asistencias: guardadas, convocados };
  }
}

// ── HU-16 · Consolidado de asistencia por materia ────────────────

export class VerConsolidadoAsistencia {
  constructor(
    private readonly materias: MateriaRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly asistencias: AsistenciaRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    docente_id: number;
  }): Promise<FilaConsolidadoAsistencia[]> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);

    const nomina = await this.inscripciones.listarPorMateria(entrada.materia_id);
    const registros = await this.asistencias.listarPorMateria(entrada.materia_id);

    const porEstudiante = new Map<number, Asistencia[]>();
    for (const registro of registros) {
      const lista = porEstudiante.get(registro.estudiante_id) ?? [];
      lista.push(registro);
      porEstudiante.set(registro.estudiante_id, lista);
    }

    return nomina.map((i) => {
      const registrosEstudiante = porEstudiante.get(i.estudiante_id) ?? [];
      const conteo = { puntual: 0, atrasado: 0, licencia: 0, falta: 0 };
      for (const registro of registrosEstudiante) conteo[registro.marcaje]++;

      const total = registrosEstudiante.length;
      const porcentaje = total === 0 ? 0 : ((conteo.puntual + conteo.atrasado) / total) * 100;
      const puntualidad = total === 0 ? 0 : (conteo.puntual / total) * 100;

      return {
        estudiante_id: i.estudiante_id,
        nombres: i.estudiante.nombres,
        apellidos: i.estudiante.apellidos,
        ...conteo,
        total_clases: total,
        porcentaje_asistencia: Math.round(porcentaje * 10) / 10,
        porcentaje_puntualidad: Math.round(puntualidad * 10) / 10,
      };
    });
  }
}

// ── Diagrama E5 (actor Estudiante) · Ver Asistencias ──────────────

export class VerMiAsistencia {
  constructor(
    private readonly materias: MateriaRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly asistencias: AsistenciaRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    estudiante_id: number;
  }): Promise<FilaMiAsistencia[]> {
    const materia = await this.materias.buscarPorId(entrada.materia_id);
    if (!materia) throw new NoEncontradoError('Materia');

    const inscripcion = await this.inscripciones.buscarPorEstudianteYMateria(
      entrada.estudiante_id,
      entrada.materia_id,
    );
    if (!inscripcion || inscripcion.retirado) {
      // Mismo 404 para no revelar materias ajenas (patrón de E3/E4)
      throw new NoEncontradoError('Materia');
    }

    const clases = await this.clases.listarPorMateria(entrada.materia_id);
    const registros = await this.asistencias.listarPorMateria(entrada.materia_id);
    const mapaMarcaje = new Map(
      registros
        .filter((r) => r.estudiante_id === entrada.estudiante_id)
        .map((r) => [r.clase_id, r.marcaje]),
    );

    return clases
      .filter((c) => mapaMarcaje.has(c.id))
      .map((c) => ({
        clase_id: c.id,
        fecha: c.fecha,
        hora: c.hora,
        tema: c.tema,
        marcaje: mapaMarcaje.get(c.id)!,
      }));
  }
}
