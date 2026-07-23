// E6 · Creación de evaluaciones de selección múltiple
// HU-17 (crear asociada a una clase, nota total), HU-18 (preguntas con
// 2-4 opciones, una correcta, imágenes, reordenar) y HU-19 (guardar →
// Lista, demostración aleatorizada, bloqueo de edición si ya se lanzó).

import {
  Demostracion,
  Evaluacion,
  EvaluacionConClase,
  EvaluacionConMateria,
  EvaluacionConPreguntas,
  Pregunta,
} from '../../domain/entidades/evaluacion';
import {
  EstadoInvalidoError,
  NoEncontradoError,
  ProhibidoError,
} from '../../domain/errores';
import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';

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

export async function exigirEvaluacionPropia(
  evaluaciones: EvaluacionRepositorio,
  clases: ClaseRepositorio,
  materias: MateriaRepositorio,
  materia_id: number,
  evaluacion_id: number,
  docente_id: number,
): Promise<Evaluacion> {
  await exigirMateriaPropia(materias, materia_id, docente_id);

  const evaluacion = await evaluaciones.buscarPorId(evaluacion_id);
  if (!evaluacion) throw new NoEncontradoError('Evaluación');

  const clase = await clases.buscarPorId(evaluacion.clase_id);
  if (!clase || clase.materia_id !== materia_id) throw new NoEncontradoError('Evaluación');

  return evaluacion;
}

/** HU-19 Esc. 3: una evaluación lanzada (o finalizada) ya no se edita. */
export function exigirEditable(evaluacion: Evaluacion) {
  if (evaluacion.estado === 'lanzada' || evaluacion.estado === 'finalizada') {
    throw new EstadoInvalidoError('No se puede editar una evaluación que ya fue lanzada');
  }
}

async function exigirPreguntaDeEvaluacion(
  evaluaciones: EvaluacionRepositorio,
  evaluacion: Evaluacion,
  pregunta_id: number,
): Promise<Pregunta> {
  const pregunta = await evaluaciones.buscarPregunta(pregunta_id);
  if (!pregunta || pregunta.evaluacion_id !== evaluacion.id) {
    throw new NoEncontradoError('Pregunta');
  }
  return pregunta;
}

/** Baraja el arreglo (Fisher-Yates) sin mutar el original. */
function barajar<T>(items: T[]): T[] {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// ── HU-17 · Crear evaluación asociada a una clase ────────────────

export class CrearEvaluacion {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
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
  ): Promise<Evaluacion> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);

    const clase = await this.clases.buscarPorId(entrada.clase_id);
    if (!clase || clase.materia_id !== entrada.materia_id) {
      throw new NoEncontradoError('Clase');
    }

    const evaluacion = await this.evaluaciones.crear({
      clase_id: entrada.clase_id,
      tema: entrada.tema,
      nota: entrada.nota,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'evaluacion_creada',
      entidad: 'evaluacion',
      entidad_id: String(evaluacion.id),
      valor_nuevo: { clase_id: evaluacion.clase_id, tema: evaluacion.tema, nota: evaluacion.nota },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return evaluacion;
  }
}

// ── Reutilizar evaluación: clona tema/nota/preguntas/opciones en otra clase ─

export class DuplicarEvaluacion {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      clase_id: number;
      evaluacion_origen_id: number;
      docente_id: number;
    },
  ): Promise<Evaluacion> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);

    const claseDestino = await this.clases.buscarPorId(entrada.clase_id);
    if (!claseDestino || claseDestino.materia_id !== entrada.materia_id) {
      throw new NoEncontradoError('Clase');
    }

    const origen = await this.evaluaciones.buscarConPreguntas(entrada.evaluacion_origen_id);
    if (!origen) throw new NoEncontradoError('Evaluación');

    // La evaluación origen puede ser de cualquier materia del docente, no
    // necesariamente la materia destino — se valida dueño vía su propia clase.
    const claseOrigen = await this.clases.buscarPorId(origen.clase_id);
    if (!claseOrigen) throw new NoEncontradoError('Evaluación');
    await exigirMateriaPropia(this.materias, claseOrigen.materia_id, entrada.docente_id);

    const nueva = await this.evaluaciones.crear({
      clase_id: entrada.clase_id,
      tema: origen.tema,
      nota: origen.nota,
    });

    for (const pregunta of origen.preguntas) {
      const creada = await this.evaluaciones.agregarPregunta(nueva.id, {
        pregunta: pregunta.pregunta,
        opciones: pregunta.opciones.map(({ texto, es_correcta }) => ({ texto, es_correcta })),
      });
      if (pregunta.url_imagen) {
        await this.evaluaciones.actualizarImagenPregunta(creada.id, pregunta.url_imagen);
      }
    }

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'evaluacion_duplicada',
      entidad: 'evaluacion',
      entidad_id: String(nueva.id),
      valor_nuevo: {
        origen_id: origen.id,
        clase_id: nueva.clase_id,
        tema: nueva.tema,
        nota: nueva.nota,
        preguntas: origen.preguntas.length,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return nueva;
  }
}

// ── Ver evaluaciones de una clase / detalle con preguntas ────────

export class VerEvaluaciones {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    clase_id: number;
    docente_id: number;
  }): Promise<Evaluacion[]> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    const clase = await this.clases.buscarPorId(entrada.clase_id);
    if (!clase || clase.materia_id !== entrada.materia_id) {
      throw new NoEncontradoError('Clase');
    }
    return this.evaluaciones.listarPorClase(entrada.clase_id);
  }
}

/** Vista "Evaluaciones" a nivel materia (junto a "Código y nómina"): todas
 * las evaluaciones de todas las clases, para no tener que entrar clase por
 * clase a buscarlas. */
export class VerEvaluacionesMateria {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly materias: MateriaRepositorio,
  ) {}

  async ejecutar(entrada: { materia_id: number; docente_id: number }): Promise<EvaluacionConClase[]> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    return this.evaluaciones.listarPorMateriaConClase(entrada.materia_id);
  }
}

/** "Reutilizar evaluación": todas las evaluaciones del docente en cualquiera
 * de sus materias, para elegir cuál clonar al crear una nueva. */
export class VerEvaluacionesDocente {
  constructor(private readonly evaluaciones: EvaluacionRepositorio) {}

  async ejecutar(entrada: { docente_id: number }): Promise<EvaluacionConMateria[]> {
    return this.evaluaciones.listarPorDocente(entrada.docente_id);
  }
}

export class VerEvaluacion {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    evaluacion_id: number;
    docente_id: number;
  }): Promise<EvaluacionConPreguntas> {
    await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    const evaluacion = await this.evaluaciones.buscarConPreguntas(entrada.evaluacion_id);
    if (!evaluacion) throw new NoEncontradoError('Evaluación');
    return evaluacion;
  }
}

// ── Editar tema/nota (bloqueado si ya se lanzó) ──────────────────

export class ActualizarEvaluacion {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      evaluacion_id: number;
      docente_id: number;
      tema?: string;
      nota?: number;
      // HU-24 (D-07): límite de tiempo opcional; null = quitar el límite.
      tiempo_limite_minutos?: number | null;
    },
  ): Promise<Evaluacion> {
    const evaluacion = await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    exigirEditable(evaluacion);

    const actualizada = await this.evaluaciones.actualizar(evaluacion.id, {
      tema: entrada.tema,
      nota: entrada.nota,
      tiempo_limite_minutos: entrada.tiempo_limite_minutos,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'evaluacion_actualizada',
      entidad: 'evaluacion',
      entidad_id: String(evaluacion.id),
      valor_anterior: {
        tema: evaluacion.tema,
        nota: evaluacion.nota,
        tiempo_limite_minutos: evaluacion.tiempo_limite_minutos,
      },
      valor_nuevo: {
        tema: actualizada.tema,
        nota: actualizada.nota,
        tiempo_limite_minutos: actualizada.tiempo_limite_minutos,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizada;
  }
}

// ── HU-18 · Preguntas: crear, editar, eliminar, reordenar, imagen ─

export class AgregarPregunta {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      evaluacion_id: number;
      docente_id: number;
      pregunta: string;
      opciones: { texto: string; es_correcta: boolean }[];
    },
  ): Promise<Pregunta> {
    const evaluacion = await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    exigirEditable(evaluacion);

    const pregunta = await this.evaluaciones.agregarPregunta(evaluacion.id, {
      pregunta: entrada.pregunta,
      opciones: entrada.opciones,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'pregunta_creada',
      entidad: 'pregunta',
      entidad_id: String(pregunta.id),
      valor_nuevo: {
        evaluacion_id: evaluacion.id,
        pregunta: pregunta.pregunta,
        opciones: entrada.opciones.length,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return pregunta;
  }
}

export class ActualizarPregunta {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      evaluacion_id: number;
      pregunta_id: number;
      docente_id: number;
      pregunta: string;
      opciones: { texto: string; es_correcta: boolean }[];
    },
  ): Promise<Pregunta> {
    const evaluacion = await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    exigirEditable(evaluacion);
    const preguntaExistente = await exigirPreguntaDeEvaluacion(
      this.evaluaciones,
      evaluacion,
      entrada.pregunta_id,
    );

    const actualizada = await this.evaluaciones.actualizarPregunta(preguntaExistente.id, {
      pregunta: entrada.pregunta,
      opciones: entrada.opciones,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'pregunta_actualizada',
      entidad: 'pregunta',
      entidad_id: String(preguntaExistente.id),
      valor_anterior: { pregunta: preguntaExistente.pregunta },
      valor_nuevo: { pregunta: actualizada.pregunta },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizada;
  }
}

export class EliminarPregunta {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      evaluacion_id: number;
      pregunta_id: number;
      docente_id: number;
    },
  ): Promise<void> {
    const evaluacion = await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    exigirEditable(evaluacion);
    const pregunta = await exigirPreguntaDeEvaluacion(
      this.evaluaciones,
      evaluacion,
      entrada.pregunta_id,
    );

    await this.evaluaciones.eliminarPregunta(pregunta.id);

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'pregunta_eliminada',
      entidad: 'pregunta',
      entidad_id: String(pregunta.id),
      valor_anterior: { evaluacion_id: evaluacion.id, pregunta: pregunta.pregunta },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}

export class ReordenarPreguntas {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      evaluacion_id: number;
      docente_id: number;
      orden: number[];
    },
  ): Promise<void> {
    const evaluacion = await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    exigirEditable(evaluacion);

    const conPreguntas = await this.evaluaciones.buscarConPreguntas(evaluacion.id);
    const idsExistentes = new Set(conPreguntas?.preguntas.map((p) => p.id) ?? []);
    const idsNuevoOrden = new Set(entrada.orden);
    const mismoConjunto =
      idsExistentes.size === entrada.orden.length &&
      [...idsExistentes].every((id) => idsNuevoOrden.has(id));
    if (!mismoConjunto) {
      throw new EstadoInvalidoError('El orden debe incluir exactamente las preguntas de la evaluación');
    }

    await this.evaluaciones.reordenarPreguntas(evaluacion.id, entrada.orden);

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'preguntas_reordenadas',
      entidad: 'evaluacion',
      entidad_id: String(evaluacion.id),
      valor_nuevo: { orden: entrada.orden },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}

// ── HU-18 Esc. 3 · Imagen de una pregunta ─────────────────────────

export class SubirImagenPregunta {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      evaluacion_id: number;
      pregunta_id: number;
      docente_id: number;
      url_imagen: string;
    },
  ): Promise<Pregunta> {
    const evaluacion = await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    exigirEditable(evaluacion);
    const pregunta = await exigirPreguntaDeEvaluacion(
      this.evaluaciones,
      evaluacion,
      entrada.pregunta_id,
    );

    const actualizada = await this.evaluaciones.actualizarImagenPregunta(
      pregunta.id,
      entrada.url_imagen,
    );

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'pregunta_imagen_subida',
      entidad: 'pregunta',
      entidad_id: String(pregunta.id),
      valor_nuevo: { url_imagen: entrada.url_imagen },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizada;
  }
}

// ── HU-19 Esc. 1 · Guardar evaluación (Borrador → Lista) ─────────

export class GuardarEvaluacion {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & { materia_id: number; evaluacion_id: number; docente_id: number },
  ): Promise<Evaluacion> {
    const evaluacion = await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    if (evaluacion.estado !== 'borrador') {
      throw new EstadoInvalidoError('La evaluación ya fue guardada');
    }
    const totalPreguntas = await this.evaluaciones.contarPreguntas(evaluacion.id);
    if (totalPreguntas === 0) {
      throw new EstadoInvalidoError('Agrega al menos una pregunta antes de guardar la evaluación');
    }

    const actualizada = await this.evaluaciones.cambiarEstado(evaluacion.id, 'lista');

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'evaluacion_guardada',
      entidad: 'evaluacion',
      entidad_id: String(evaluacion.id),
      valor_anterior: { estado: 'borrador' },
      valor_nuevo: { estado: 'lista' },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizada;
  }
}

// ── HU-19 Esc. 2 · Realizar demostración (aleatorizada, sin nota) ─

export class DemostracionEvaluacion {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    evaluacion_id: number;
    docente_id: number;
  }): Promise<Demostracion> {
    const evaluacion = await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    if (evaluacion.estado === 'borrador') {
      throw new EstadoInvalidoError('Guarda la evaluación antes de hacer una demostración');
    }

    const conPreguntas = await this.evaluaciones.buscarConPreguntas(evaluacion.id);
    if (!conPreguntas) throw new NoEncontradoError('Evaluación');

    return {
      tema: conPreguntas.tema,
      nota: conPreguntas.nota,
      preguntas: barajar(conPreguntas.preguntas).map((p) => ({
        id: p.id,
        pregunta: p.pregunta,
        url_imagen: p.url_imagen,
        opciones: barajar(p.opciones).map((o) => ({ id: o.id, texto: o.texto })),
      })),
    };
  }
}
