// E7 · Ejecución en vivo (lado docente): HU-20 (lanzar solo a Puntual +
// Atraso), HU-22 (monitoreo en vivo), HU-23 (pausar/reactivar/cancelar
// global e individual). HU-24 (tiempo límite) se configura en
// ActualizarEvaluacion (gestionar-evaluaciones.ts) y se aplica acá al crear
// cada Intento.

import { Evaluacion } from '../../domain/entidades/evaluacion';
import { FilaMonitoreo, Intento } from '../../domain/entidades/intento';
import {
  EstadoInvalidoError,
  NoEncontradoError,
  ProhibidoError,
} from '../../domain/errores';
import { AsistenciaRepositorio } from '../../domain/repositorios/asistencia-repositorio';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';
import { IntentoRepositorio } from '../../domain/repositorios/intento-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { TiempoRealEmisor } from '../../domain/repositorios/tiempo-real';

export interface Auditoria {
  ip?: string;
  dispositivo?: string;
}

export async function exigirMateriaPropia(
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

// ── E8 · Finalización automática (HU-25) ─────────────────────────
// Sin botón nuevo: en cuanto el último Intento convocado llega a un
// estado terminal (finalizado/cancelado), la evaluación pasa sola a
// "finalizada" y se calcula la nota de cada estudiante (D-05). Perezoso,
// mismo espíritu que ExpirarMateriasVencidas: se dispara al leer
// Monitoreo o Resultados, no hace falta un cron aparte.

/** Califica (inserta Nota) a todo intento terminal que todavía no tenga
 * una — sea porque la evaluación se acaba de finalizar automáticamente,
 * o porque llegó a "finalizada" por otra vía (p.ej. CancelarEvaluacion,
 * que solo cambia el estado y nunca calificó a nadie). Idempotente: un
 * intento que ya tiene Nota no se vuelve a calificar (D-12). */
export async function calificarPendientes(
  evaluaciones: EvaluacionRepositorio,
  intentos: IntentoRepositorio,
  evaluacion: Evaluacion,
): Promise<number> {
  const convocados = await intentos.listarPorEvaluacion(evaluacion.id);
  const terminados = convocados.filter(
    (i) => i.estado === 'finalizado' || i.estado === 'cancelado',
  );
  const totalPreguntas = await evaluaciones.contarPreguntas(evaluacion.id);

  let calificados = 0;
  for (const intento of terminados) {
    const notaExistente = await intentos.notaVigentePorIntento(intento.id);
    if (notaExistente) continue;

    const aciertos = await intentos.contarAciertos(intento.id);
    const nota_obtenida =
      totalPreguntas > 0
        ? Math.round((aciertos / totalPreguntas) * evaluacion.nota * 100) / 100
        : 0;
    await intentos.guardarNota({
      intento_id: intento.id,
      evaluacion_id: evaluacion.id,
      estudiante_id: intento.estudiante_id,
      aciertos,
      total_preguntas: totalPreguntas,
      nota_obtenida,
    });
    calificados++;
  }
  return calificados;
}

/** Común a finalizarSiCorresponde (perezoso, disparado por el propio
 * docente al abrir Monitoreo/Resultados) y a BarrerVencimientos
 * (barrer-vencimientos.ts, corre solo en segundo plano): si ya todos los
 * convocados llegaron a un estado terminal, cierra la evaluación sola
 * (E8) y califica lo pendiente. No-op barato si todavía falta alguien. */
export async function cerrarSiTerminaron(
  evaluaciones: EvaluacionRepositorio,
  intentos: IntentoRepositorio,
  bitacora: BitacoraRepositorio,
  tiempoReal: TiempoRealEmisor,
  evaluacion: Evaluacion,
): Promise<Evaluacion> {
  const convocados = await intentos.listarPorEvaluacion(evaluacion.id);
  const todosTerminaron =
    convocados.length > 0 &&
    convocados.every((i) => i.estado === 'finalizado' || i.estado === 'cancelado');
  if (!todosTerminaron) return evaluacion;

  const calificados = await calificarPendientes(evaluaciones, intentos, evaluacion);

  const finalizada = await evaluaciones.cambiarEstado(evaluacion.id, 'finalizada');
  // Evento a nivel evaluación (no de un intento puntual): acá sí vale la
  // pena que el cliente refresque todo, incluida la insignia de estado.
  tiempoReal.emitirAEvaluacion(evaluacion.id, 'estado-actualizado', {});

  await bitacora.registrar({
    rol_contexto: 'sistema',
    accion: 'evaluacion_finalizada_automaticamente',
    entidad: 'evaluacion',
    entidad_id: String(evaluacion.id),
    valor_nuevo: { estudiantes_calificados: calificados },
  });

  return finalizada;
}

export async function finalizarSiCorresponde(
  evaluaciones: EvaluacionRepositorio,
  intentos: IntentoRepositorio,
  bitacora: BitacoraRepositorio,
  tiempoReal: TiempoRealEmisor,
  evaluacion: Evaluacion,
): Promise<Evaluacion> {
  if (evaluacion.estado === 'finalizada') {
    // Backfill: cubre evaluaciones finalizadas por otra vía (Cancelar) o
    // de antes de que existiera este cálculo automático.
    await calificarPendientes(evaluaciones, intentos, evaluacion);
    return evaluacion;
  }
  if (evaluacion.estado !== 'lanzada') return evaluacion;

  // HU-24: aplica vencimientos pendientes sin depender de que cada
  // estudiante vuelva a abrir la app para autofinalizar el suyo. Esto se
  // dispara típicamente desde el propio poll del docente (VerMonitoreo);
  // sin este emit el cambio quedaba solo en la respuesta HTTP de ese poll
  // y otras pestañas/sesiones del panel no se enteraban hasta su propio
  // refetchInterval (15s). BarrerVencimientos (13/08) cubre el caso de
  // que nadie esté mirando esta pantalla en absoluto.
  const vencidos = await intentos.finalizarVencidos(evaluacion.id);
  for (const intento of vencidos) {
    tiempoReal.emitirAEvaluacion(evaluacion.id, 'intento-actualizado', {
      intento_id: intento.id,
      estado: intento.estado,
    });
  }

  return cerrarSiTerminaron(evaluaciones, intentos, bitacora, tiempoReal, evaluacion);
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

// ── HU-20 · Lanzar evaluación a estudiantes presentes ────────────

export class LanzarEvaluacion {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly asistencias: AsistenciaRepositorio,
    private readonly intentos: IntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
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
    if (evaluacion.estado !== 'lista') {
      throw new EstadoInvalidoError('La evaluación debe estar Lista para poder lanzarla');
    }

    // HU-20 Esc. 2: sin asistencia registrada, no se puede lanzar.
    const asistenciasClase = await this.asistencias.listarPorClase(evaluacion.clase_id);
    if (asistenciasClase.length === 0) {
      throw new EstadoInvalidoError(
        'La clase todavía no tiene asistencia registrada; pasa lista antes de lanzar',
      );
    }

    const presentes = asistenciasClase.filter(
      (a) => a.marcaje === 'puntual' || a.marcaje === 'atrasado',
    );
    if (presentes.length === 0) {
      throw new EstadoInvalidoError('No hay estudiantes Puntuales o con Atraso en esta clase');
    }

    const conPreguntas = await this.evaluaciones.buscarConPreguntas(evaluacion.id);
    if (!conPreguntas || conPreguntas.preguntas.length === 0) {
      throw new EstadoInvalidoError('La evaluación no tiene preguntas');
    }

    const fecha_limite = evaluacion.tiempo_limite_minutos
      ? new Date(Date.now() + evaluacion.tiempo_limite_minutos * 60_000)
      : null;

    // HU-20 Esc. 3: orden de preguntas y opciones aleatorio y propio de
    // cada estudiante, fijo desde ahora para poder reanudar igual.
    for (const asistencia of presentes) {
      const orden_preguntas = barajar(conPreguntas.preguntas.map((p) => p.id));
      const orden_opciones: Record<string, number[]> = {};
      for (const pregunta of conPreguntas.preguntas) {
        orden_opciones[String(pregunta.id)] = barajar(pregunta.opciones.map((o) => o.id));
      }

      await this.intentos.crear({
        evaluacion_id: evaluacion.id,
        estudiante_id: asistencia.estudiante_id,
        orden_preguntas,
        orden_opciones,
        fecha_limite,
      });

      // HU-20 Esc. 1: notifica al estudiante (push vía Socket.IO).
      this.tiempoReal.emitirAEstudiante(asistencia.estudiante_id, 'evaluacion-lanzada', {
        evaluacion_id: evaluacion.id,
      });
    }

    const actualizada = await this.evaluaciones.marcarLanzada(evaluacion.id);

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'evaluacion_lanzada',
      entidad: 'evaluacion',
      entidad_id: String(evaluacion.id),
      valor_nuevo: { estudiantes_convocados: presentes.length },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizada;
  }
}

// ── HU-22 · Monitoreo en vivo ─────────────────────────────────────

export class VerMonitoreo {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly intentos: IntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    evaluacion_id: number;
    docente_id: number;
  }): Promise<FilaMonitoreo[]> {
    const evaluacion = await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    // E8: si mientras tanto ya todos terminaron, se cierra sola acá mismo.
    await finalizarSiCorresponde(
      this.evaluaciones,
      this.intentos,
      this.bitacora,
      this.tiempoReal,
      evaluacion,
    );
    return this.intentos.listarPorEvaluacionConDetalle(evaluacion.id);
  }
}

// ── HU-23 · Pausar / reactivar / cancelar global ─────────────────

async function exigirLanzada(
  evaluaciones: EvaluacionRepositorio,
  clases: ClaseRepositorio,
  materias: MateriaRepositorio,
  materia_id: number,
  evaluacion_id: number,
  docente_id: number,
): Promise<Evaluacion> {
  const evaluacion = await exigirEvaluacionPropia(
    evaluaciones,
    clases,
    materias,
    materia_id,
    evaluacion_id,
    docente_id,
  );
  if (evaluacion.estado !== 'lanzada') {
    throw new EstadoInvalidoError('La evaluación no está en curso');
  }
  return evaluacion;
}

abstract class AccionGlobalIntentos {
  constructor(
    protected readonly evaluaciones: EvaluacionRepositorio,
    protected readonly clases: ClaseRepositorio,
    protected readonly materias: MateriaRepositorio,
    protected readonly intentos: IntentoRepositorio,
    protected readonly bitacora: BitacoraRepositorio,
    protected readonly tiempoReal: TiempoRealEmisor,
  ) {}

  protected abstract accion: string;
  protected abstract estadoOrigen: Intento['estado'];
  protected abstract estadoDestino: Intento['estado'];
  protected abstract eventoEstudiante: string;

  async ejecutar(
    entrada: Auditoria & { materia_id: number; evaluacion_id: number; docente_id: number },
  ): Promise<void> {
    const evaluacion = await exigirLanzada(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );

    const intentos = await this.intentos.listarPorEvaluacion(evaluacion.id);
    const afectados = intentos.filter((i) => i.estado === this.estadoOrigen);

    for (const intento of afectados) {
      await this.intentos.cambiarEstado(intento.id, this.estadoDestino);
      this.tiempoReal.emitirAEstudiante(intento.estudiante_id, this.eventoEstudiante, {
        intento_id: intento.id,
      });
      // Un evento por intento en vez de un 'estado-actualizado' genérico:
      // el panel de Monitoreo parchea esa fila puntual sin pedir de vuelta
      // toda la tabla (13/08, aunque sea una acción masiva).
      this.tiempoReal.emitirAEvaluacion(evaluacion.id, 'intento-actualizado', {
        intento_id: intento.id,
        estado: this.estadoDestino,
      });
    }

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: this.accion,
      entidad: 'evaluacion',
      entidad_id: String(evaluacion.id),
      valor_nuevo: { intentos_afectados: afectados.length },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}

export class PausarEvaluacion extends AccionGlobalIntentos {
  protected accion = 'evaluacion_pausada_global';
  protected estadoOrigen: Intento['estado'] = 'en_curso';
  protected estadoDestino: Intento['estado'] = 'pausado';
  protected eventoEstudiante = 'examen-pausado';
}

export class ReactivarEvaluacion extends AccionGlobalIntentos {
  protected accion = 'evaluacion_reactivada_global';
  protected estadoOrigen: Intento['estado'] = 'pausado';
  protected estadoDestino: Intento['estado'] = 'en_curso';
  protected eventoEstudiante = 'examen-reactivado';
}

export class CancelarEvaluacion {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly intentos: IntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(
    entrada: Auditoria & { materia_id: number; evaluacion_id: number; docente_id: number },
  ): Promise<Evaluacion> {
    const evaluacion = await exigirLanzada(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );

    const intentos = await this.intentos.listarPorEvaluacion(evaluacion.id);
    // HU-23 Esc. 2: se conservan las respuestas guardadas; solo cambia el estado.
    const enCurso = intentos.filter(
      (i) => i.estado === 'en_curso' || i.estado === 'pausado' || i.estado === 'desconectado',
    );
    for (const intento of enCurso) {
      await this.intentos.cambiarEstado(intento.id, 'cancelado', { fecha_fin: new Date() });
      this.tiempoReal.emitirAEstudiante(intento.estudiante_id, 'examen-cancelado', {
        intento_id: intento.id,
      });
      this.tiempoReal.emitirAEvaluacion(evaluacion.id, 'intento-actualizado', {
        intento_id: intento.id,
        estado: 'cancelado',
      });
    }

    const actualizada = await this.evaluaciones.cambiarEstado(evaluacion.id, 'finalizada');
    // Acá sí cambió el estado de la EVALUACIÓN (no solo de sus intentos) —
    // vale la pena el refetch completo, incluida la insignia de estado.
    this.tiempoReal.emitirAEvaluacion(evaluacion.id, 'estado-actualizado', {});

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'evaluacion_cancelada',
      entidad: 'evaluacion',
      entidad_id: String(evaluacion.id),
      valor_nuevo: { intentos_cancelados: enCurso.length },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizada;
  }
}

// ── Eliminar evaluación (deshacer, p.ej. lanzada por error) ──────
// No está en el backlog original: lo pidió Roy el 17/08 después de lanzar
// una evaluación equivocada y no querer que quedara en el centralizador
// (que lista toda evaluación "finalizada", sin importar el motivo). A
// diferencia de Cancelar (HU-23, que solo cierra el intento en curso),
// esto borra la evaluación entera — preguntas, intentos, respuestas,
// incidentes y notas van en cascada (ver schema.prisma).

export class EliminarEvaluacion {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly intentos: IntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & { materia_id: number; evaluacion_id: number; docente_id: number },
  ): Promise<void> {
    const evaluacion = await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );

    // Si hay estudiantes rindiendo en este momento, hay que cerrarles el
    // examen primero (Cancelar, HU-23) para que su app se entere por la vía
    // ya soportada — borrar de golpe los dejaría con un intento a medias
    // que de pronto deja de existir.
    const intentos = await this.intentos.listarPorEvaluacion(evaluacion.id);
    const enVivo = intentos.some(
      (i) => i.estado === 'en_curso' || i.estado === 'pausado' || i.estado === 'desconectado',
    );
    if (enVivo) {
      throw new EstadoInvalidoError(
        'Hay estudiantes rindiendo esta evaluación; cancélala antes de eliminarla',
      );
    }

    await this.evaluaciones.eliminar(evaluacion.id);

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'evaluacion_eliminada',
      entidad: 'evaluacion',
      entidad_id: String(evaluacion.id),
      valor_anterior: {
        clase_id: evaluacion.clase_id,
        tema: evaluacion.tema,
        nota: evaluacion.nota,
        estado: evaluacion.estado,
        intentos: intentos.length,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}

// ── HU-23 Esc. 1 · Pausar / reactivar individual ─────────────────

async function exigirIntentoDeEvaluacion(
  intentos: IntentoRepositorio,
  evaluacion: Evaluacion,
  intento_id: number,
): Promise<Intento> {
  const intento = await intentos.buscarPorId(intento_id);
  if (!intento || intento.evaluacion_id !== evaluacion.id) {
    throw new NoEncontradoError('Intento');
  }
  return intento;
}

export class PausarIntento {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly intentos: IntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      evaluacion_id: number;
      intento_id: number;
      docente_id: number;
    },
  ): Promise<void> {
    const evaluacion = await exigirLanzada(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    const intento = await exigirIntentoDeEvaluacion(this.intentos, evaluacion, entrada.intento_id);
    if (intento.estado !== 'en_curso' && intento.estado !== 'desconectado') {
      throw new EstadoInvalidoError('Ese estudiante no está en curso');
    }

    await this.intentos.cambiarEstado(intento.id, 'pausado');
    this.tiempoReal.emitirAEstudiante(intento.estudiante_id, 'examen-pausado', {
      intento_id: intento.id,
    });
    this.tiempoReal.emitirAEvaluacion(evaluacion.id, 'intento-actualizado', {
      intento_id: intento.id,
      estado: 'pausado',
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'intento_pausado',
      entidad: 'intento',
      entidad_id: String(intento.id),
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}

export class ReactivarIntento {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly intentos: IntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      evaluacion_id: number;
      intento_id: number;
      docente_id: number;
    },
  ): Promise<void> {
    const evaluacion = await exigirLanzada(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    const intento = await exigirIntentoDeEvaluacion(this.intentos, evaluacion, entrada.intento_id);
    if (intento.estado !== 'pausado') {
      throw new EstadoInvalidoError('Ese estudiante no está pausado');
    }

    await this.intentos.cambiarEstado(intento.id, 'en_curso');
    this.tiempoReal.emitirAEstudiante(intento.estudiante_id, 'examen-reactivado', {
      intento_id: intento.id,
    });
    this.tiempoReal.emitirAEvaluacion(evaluacion.id, 'intento-actualizado', {
      intento_id: intento.id,
      estado: 'en_curso',
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'intento_reactivado',
      entidad: 'intento',
      entidad_id: String(intento.id),
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}
