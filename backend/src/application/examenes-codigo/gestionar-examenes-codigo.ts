// E9 · Creación de exámenes de código Python (lado docente, sin ejecución
// en vivo todavía — eso vive en gestionar-examen-codigo.ts, calcado del
// mismo split que Evaluación: gestionar-evaluaciones.ts (CRUD) vs
// gestionar-examen.ts (lanzar/monitorear/pausar/cancelar)).

import {
  Ejercicio,
  ExamenCodigo,
  ExamenCodigoConClase,
  ExamenCodigoConEjercicios,
} from '../../domain/entidades/examen-codigo';
import { EstadoInvalidoError, NoEncontradoError, ProhibidoError } from '../../domain/errores';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import {
  DatosCasoPrueba,
  ExamenCodigoRepositorio,
} from '../../domain/repositorios/examen-codigo-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';

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

export async function exigirExamenCodigoPropio(
  examenes: ExamenCodigoRepositorio,
  clases: ClaseRepositorio,
  materias: MateriaRepositorio,
  materia_id: number,
  examen_codigo_id: number,
  docente_id: number,
): Promise<ExamenCodigo> {
  await exigirMateriaPropia(materias, materia_id, docente_id);

  const examen = await examenes.buscarPorId(examen_codigo_id);
  if (!examen) throw new NoEncontradoError('Examen de código');

  const clase = await clases.buscarPorId(examen.clase_id);
  if (!clase || clase.materia_id !== materia_id) throw new NoEncontradoError('Examen de código');

  return examen;
}

/** Igual HU-19 Esc. 3 de Evaluación: un examen lanzado (o finalizado) ya no se edita. */
export function exigirEditable(examen: ExamenCodigo) {
  if (examen.estado === 'lanzada' || examen.estado === 'finalizada') {
    throw new EstadoInvalidoError('No se puede editar un examen que ya fue lanzado');
  }
}

async function exigirEjercicioDeExamen(
  examenes: ExamenCodigoRepositorio,
  examen: ExamenCodigo,
  ejercicio_id: number,
): Promise<Ejercicio> {
  const ejercicio = await examenes.buscarEjercicio(ejercicio_id);
  if (!ejercicio || ejercicio.examen_codigo_id !== examen.id) {
    throw new NoEncontradoError('Ejercicio');
  }
  return ejercicio;
}

function exigirCasosValidos(casos: DatosCasoPrueba[]) {
  if (casos.length === 0) {
    throw new EstadoInvalidoError('El ejercicio necesita al menos un caso de prueba');
  }
}

// ── Crear examen asociado a una clase ────────────────────────────

export class CrearExamenCodigo {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      clase_id: number;
      docente_id: number;
      tema: string;
      nota: number;
    },
  ): Promise<ExamenCodigo> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);

    const clase = await this.clases.buscarPorId(entrada.clase_id);
    if (!clase || clase.materia_id !== entrada.materia_id) {
      throw new NoEncontradoError('Clase');
    }

    const examen = await this.examenes.crear({
      clase_id: entrada.clase_id,
      tema: entrada.tema,
      nota: entrada.nota,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'examen_codigo_creado',
      entidad: 'examen_codigo',
      entidad_id: String(examen.id),
      valor_nuevo: { clase_id: examen.clase_id, tema: examen.tema, nota: examen.nota },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return examen;
  }
}

// ── Ver exámenes de código de una clase / de la materia / detalle ─

export class VerExamenesCodigo {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    clase_id: number;
    docente_id: number;
  }): Promise<ExamenCodigo[]> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    const clase = await this.clases.buscarPorId(entrada.clase_id);
    if (!clase || clase.materia_id !== entrada.materia_id) {
      throw new NoEncontradoError('Clase');
    }
    return this.examenes.listarPorClase(entrada.clase_id);
  }
}

export class VerExamenesCodigoMateria {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly materias: MateriaRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    docente_id: number;
  }): Promise<ExamenCodigoConClase[]> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    return this.examenes.listarPorMateriaConClase(entrada.materia_id);
  }
}

export class VerExamenCodigo {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    examen_codigo_id: number;
    docente_id: number;
  }): Promise<ExamenCodigoConEjercicios> {
    await exigirExamenCodigoPropio(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );
    const examen = await this.examenes.buscarConEjercicios(entrada.examen_codigo_id);
    if (!examen) throw new NoEncontradoError('Examen de código');
    return examen;
  }
}

// ── Editar tema/nota (bloqueado si ya se lanzó) ──────────────────

export class ActualizarExamenCodigo {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      examen_codigo_id: number;
      docente_id: number;
      tema?: string;
      nota?: number;
      tiempo_limite_minutos?: number | null;
    },
  ): Promise<ExamenCodigo> {
    const examen = await exigirExamenCodigoPropio(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );
    exigirEditable(examen);

    const actualizado = await this.examenes.actualizar(examen.id, {
      tema: entrada.tema,
      nota: entrada.nota,
      tiempo_limite_minutos: entrada.tiempo_limite_minutos,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'examen_codigo_actualizado',
      entidad: 'examen_codigo',
      entidad_id: String(examen.id),
      valor_anterior: {
        tema: examen.tema,
        nota: examen.nota,
        tiempo_limite_minutos: examen.tiempo_limite_minutos,
      },
      valor_nuevo: {
        tema: actualizado.tema,
        nota: actualizado.nota,
        tiempo_limite_minutos: actualizado.tiempo_limite_minutos,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizado;
  }
}

export class EliminarExamenCodigo {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & { materia_id: number; examen_codigo_id: number; docente_id: number },
  ): Promise<void> {
    const examen = await exigirExamenCodigoPropio(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );
    if (examen.estado === 'lanzada') {
      throw new EstadoInvalidoError('Cancela el examen antes de eliminarlo');
    }

    await this.examenes.eliminar(examen.id);

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'examen_codigo_eliminado',
      entidad: 'examen_codigo',
      entidad_id: String(examen.id),
      valor_anterior: { clase_id: examen.clase_id, tema: examen.tema, estado: examen.estado },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}

// ── Ejercicios: crear, editar, eliminar, reordenar ───────────────

export class AgregarEjercicio {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      examen_codigo_id: number;
      docente_id: number;
      enunciado: string;
      plantilla_codigo?: string | null;
      nota: number;
      casos_prueba: DatosCasoPrueba[];
    },
  ): Promise<Ejercicio> {
    const examen = await exigirExamenCodigoPropio(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );
    exigirEditable(examen);
    exigirCasosValidos(entrada.casos_prueba);

    const ejercicio = await this.examenes.agregarEjercicio(examen.id, {
      enunciado: entrada.enunciado,
      plantilla_codigo: entrada.plantilla_codigo,
      nota: entrada.nota,
      casos_prueba: entrada.casos_prueba,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'ejercicio_creado',
      entidad: 'ejercicio',
      entidad_id: String(ejercicio.id),
      valor_nuevo: {
        examen_codigo_id: examen.id,
        nota: ejercicio.nota,
        casos: entrada.casos_prueba.length,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return ejercicio;
  }
}

export class ActualizarEjercicio {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      examen_codigo_id: number;
      ejercicio_id: number;
      docente_id: number;
      enunciado: string;
      plantilla_codigo?: string | null;
      nota: number;
      casos_prueba: DatosCasoPrueba[];
    },
  ): Promise<Ejercicio> {
    const examen = await exigirExamenCodigoPropio(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );
    exigirEditable(examen);
    exigirCasosValidos(entrada.casos_prueba);
    const existente = await exigirEjercicioDeExamen(this.examenes, examen, entrada.ejercicio_id);

    const actualizado = await this.examenes.actualizarEjercicio(existente.id, {
      enunciado: entrada.enunciado,
      plantilla_codigo: entrada.plantilla_codigo,
      nota: entrada.nota,
      casos_prueba: entrada.casos_prueba,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'ejercicio_actualizado',
      entidad: 'ejercicio',
      entidad_id: String(existente.id),
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizado;
  }
}

export class EliminarEjercicio {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      examen_codigo_id: number;
      ejercicio_id: number;
      docente_id: number;
    },
  ): Promise<void> {
    const examen = await exigirExamenCodigoPropio(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );
    exigirEditable(examen);
    const ejercicio = await exigirEjercicioDeExamen(this.examenes, examen, entrada.ejercicio_id);

    await this.examenes.eliminarEjercicio(ejercicio.id);

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'ejercicio_eliminado',
      entidad: 'ejercicio',
      entidad_id: String(ejercicio.id),
      valor_anterior: { examen_codigo_id: examen.id },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}

export class ReordenarEjercicios {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      examen_codigo_id: number;
      docente_id: number;
      orden: number[];
    },
  ): Promise<void> {
    const examen = await exigirExamenCodigoPropio(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );
    exigirEditable(examen);

    const conEjercicios = await this.examenes.buscarConEjercicios(examen.id);
    const idsExistentes = new Set(conEjercicios?.ejercicios.map((e) => e.id) ?? []);
    const idsNuevoOrden = new Set(entrada.orden);
    const mismoConjunto =
      idsExistentes.size === entrada.orden.length &&
      [...idsExistentes].every((id) => idsNuevoOrden.has(id));
    if (!mismoConjunto) {
      throw new EstadoInvalidoError('El orden debe incluir exactamente los ejercicios del examen');
    }

    await this.examenes.reordenarEjercicios(examen.id, entrada.orden);

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'ejercicios_reordenados',
      entidad: 'examen_codigo',
      entidad_id: String(examen.id),
      valor_nuevo: { orden: entrada.orden },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}

// ── Guardar examen (Borrador → Lista) ────────────────────────────

export class GuardarExamenCodigo {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & { materia_id: number; examen_codigo_id: number; docente_id: number },
  ): Promise<ExamenCodigo> {
    const examen = await exigirExamenCodigoPropio(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );
    if (examen.estado !== 'borrador') {
      throw new EstadoInvalidoError('El examen ya fue guardado');
    }
    const totalEjercicios = await this.examenes.contarEjercicios(examen.id);
    if (totalEjercicios === 0) {
      throw new EstadoInvalidoError('Agrega al menos un ejercicio antes de guardar el examen');
    }

    const actualizado = await this.examenes.cambiarEstado(examen.id, 'lista');

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'examen_codigo_guardado',
      entidad: 'examen_codigo',
      entidad_id: String(examen.id),
      valor_anterior: { estado: 'borrador' },
      valor_nuevo: { estado: 'lista' },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizado;
  }
}
