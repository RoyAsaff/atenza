// E9 · Ejecución en vivo de exámenes de código (lado docente) — calcado de
// evaluaciones/gestionar-examen.ts: lanzar solo a Puntual/Atraso, monitoreo
// en vivo, pausar/reactivar/cancelar global e individual, y la misma
// finalización automática perezosa (D-12: nota versionada, insert-only).

import { ExamenCodigo } from '../../domain/entidades/examen-codigo';
import { FilaMonitoreoCodigo, IntentoCodigo } from '../../domain/entidades/intento-codigo';
import { EstadoInvalidoError, NoEncontradoError } from '../../domain/errores';
import { AsistenciaRepositorio } from '../../domain/repositorios/asistencia-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { ExamenCodigoRepositorio } from '../../domain/repositorios/examen-codigo-repositorio';
import { IntentoCodigoRepositorio } from '../../domain/repositorios/intento-codigo-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { TiempoRealEmisor } from '../../domain/repositorios/tiempo-real';
import { exigirExamenCodigoPropio } from './gestionar-examenes-codigo';

export interface Auditoria {
  ip?: string;
  dispositivo?: string;
}

// ── Finalización automática (igual E8: perezosa, sin botón nuevo) ───

/** Califica (inserta NotaCodigo) a todo intento terminal que todavía no
 * tenga una. Idempotente (D-12). La nota por ejercicio pesa
 * (casos_acertados/casos_totales) * ejercicio.nota — a diferencia de
 * Evaluación (una pregunta es correcta o no), acá cada ejercicio da
 * puntaje parcial según cuántos casos de prueba pasó. */
export async function calificarPendientes(
  examenes: ExamenCodigoRepositorio,
  intentos: IntentoCodigoRepositorio,
  examen: ExamenCodigo,
): Promise<number> {
  const convocados = await intentos.listarPorExamen(examen.id);
  const terminados = convocados.filter((i) => i.estado === 'finalizado' || i.estado === 'cancelado');
  if (terminados.length === 0) return 0;

  const conEjercicios = await examenes.buscarConEjercicios(examen.id);
  const ejercicios = conEjercicios?.ejercicios ?? [];

  let calificados = 0;
  for (const intento of terminados) {
    const notaExistente = await intentos.notaVigentePorIntento(intento.id);
    if (notaExistente) continue;

    const respuestas = await intentos.respuestasDe(intento.id);
    const porEjercicio = new Map(respuestas.map((r) => [r.ejercicio_id, r]));

    let casos_acertados = 0;
    let casos_totales = 0;
    let nota_obtenida = 0;
    for (const ejercicio of ejercicios) {
      const respuesta = porEjercicio.get(ejercicio.id);
      if (!respuesta) continue; // no lo intentó: 0 puntos en ese ejercicio
      casos_acertados += respuesta.casos_acertados;
      casos_totales += respuesta.casos_totales;
      if (respuesta.casos_totales > 0) {
        nota_obtenida += (respuesta.casos_acertados / respuesta.casos_totales) * ejercicio.nota;
      }
    }
    nota_obtenida = Math.round(nota_obtenida * 100) / 100;

    await intentos.guardarNota({
      intento_id: intento.id,
      examen_codigo_id: examen.id,
      estudiante_id: intento.estudiante_id,
      casos_acertados,
      casos_totales,
      nota_obtenida,
    });
    calificados++;
  }
  return calificados;
}

/** Igual cerrarSiTerminaron de Evaluación: si ya todos los convocados
 * llegaron a un estado terminal, cierra el examen solo y califica. */
export async function cerrarSiTerminaron(
  examenes: ExamenCodigoRepositorio,
  intentos: IntentoCodigoRepositorio,
  bitacora: BitacoraRepositorio,
  tiempoReal: TiempoRealEmisor,
  examen: ExamenCodigo,
): Promise<ExamenCodigo> {
  const convocados = await intentos.listarPorExamen(examen.id);
  const todosTerminaron =
    convocados.length > 0 &&
    convocados.every((i) => i.estado === 'finalizado' || i.estado === 'cancelado');
  if (!todosTerminaron) return examen;

  const calificados = await calificarPendientes(examenes, intentos, examen);

  const finalizado = await examenes.cambiarEstado(examen.id, 'finalizada');
  tiempoReal.emitirAExamenCodigo(examen.id, 'estado-actualizado', {});

  await bitacora.registrar({
    rol_contexto: 'sistema',
    accion: 'examen_codigo_finalizado_automaticamente',
    entidad: 'examen_codigo',
    entidad_id: String(examen.id),
    valor_nuevo: { estudiantes_calificados: calificados },
  });

  return finalizado;
}

export async function finalizarSiCorresponde(
  examenes: ExamenCodigoRepositorio,
  intentos: IntentoCodigoRepositorio,
  bitacora: BitacoraRepositorio,
  tiempoReal: TiempoRealEmisor,
  examen: ExamenCodigo,
): Promise<ExamenCodigo> {
  if (examen.estado === 'finalizada') {
    await calificarPendientes(examenes, intentos, examen);
    return examen;
  }
  if (examen.estado !== 'lanzada') return examen;

  const vencidos = await intentos.finalizarVencidos(examen.id);
  for (const intento of vencidos) {
    tiempoReal.emitirAExamenCodigo(examen.id, 'intento-actualizado', {
      intento_id: intento.id,
      estado: intento.estado,
    });
  }

  return cerrarSiTerminaron(examenes, intentos, bitacora, tiempoReal, examen);
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

// ── Lanzar examen a estudiantes presentes ────────────────────────

export class LanzarExamenCodigo {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly asistencias: AsistenciaRepositorio,
    private readonly intentos: IntentoCodigoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      examen_codigo_id: number;
      docente_id: number;
      estudiante_ids?: number[];
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
    if (examen.estado !== 'lista') {
      throw new EstadoInvalidoError('El examen debe estar Listo para poder lanzarlo');
    }

    const asistenciasClase = await this.asistencias.listarPorClase(examen.clase_id);
    if (asistenciasClase.length === 0) {
      throw new EstadoInvalidoError(
        'La clase todavía no tiene asistencia registrada; pasa lista antes de lanzar',
      );
    }

    let presentes = asistenciasClase.filter(
      (a) => a.marcaje === 'puntual' || a.marcaje === 'atrasado',
    );
    if (presentes.length === 0) {
      throw new EstadoInvalidoError('No hay estudiantes Puntuales o con Atraso en esta clase');
    }

    if (entrada.estudiante_ids) {
      const seleccionados = new Set(entrada.estudiante_ids);
      presentes = presentes.filter((a) => seleccionados.has(a.estudiante_id));
      if (presentes.length === 0) {
        throw new EstadoInvalidoError('Selecciona al menos un estudiante presente');
      }
    }

    const conEjercicios = await this.examenes.buscarConEjercicios(examen.id);
    if (!conEjercicios || conEjercicios.ejercicios.length === 0) {
      throw new EstadoInvalidoError('El examen no tiene ejercicios');
    }

    // Anti-hardcodeo: un ejercicio sin ningún caso oculto expone TODA su
    // entrada/salida_esperada al estudiante (ver EjercicioParaRendir) — le
    // alcanzaría con un print() del valor esperado para pasar todos los
    // casos. Exigir al menos un caso oculto por ejercicio antes de lanzar.
    const sinOcultos = conEjercicios.ejercicios.filter(
      (e) => !e.casos_prueba.some((c) => c.es_oculto),
    );
    if (sinOcultos.length > 0) {
      throw new EstadoInvalidoError(
        `Cada ejercicio necesita al menos un caso de prueba oculto antes de lanzar (falta en: ${sinOcultos
          .map((e) => `#${e.orden + 1}`)
          .join(', ')})`,
      );
    }

    const fecha_limite = examen.tiempo_limite_minutos
      ? new Date(Date.now() + examen.tiempo_limite_minutos * 60_000)
      : null;

    const ordenBase = conEjercicios.ejercicios.map((e) => e.id);

    for (const asistencia of presentes) {
      await this.intentos.crear({
        examen_codigo_id: examen.id,
        estudiante_id: asistencia.estudiante_id,
        orden_ejercicios: barajar(ordenBase),
        fecha_limite,
      });

      this.tiempoReal.emitirAEstudiante(asistencia.estudiante_id, 'examen-codigo-lanzado', {
        examen_codigo_id: examen.id,
      });
    }

    const actualizado = await this.examenes.marcarLanzada(examen.id);

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'examen_codigo_lanzado',
      entidad: 'examen_codigo',
      entidad_id: String(examen.id),
      valor_nuevo: { estudiantes_convocados: presentes.length },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizado;
  }
}

// ── Monitoreo en vivo ─────────────────────────────────────────────

export class VerMonitoreoCodigo {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly intentos: IntentoCodigoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    examen_codigo_id: number;
    docente_id: number;
  }): Promise<FilaMonitoreoCodigo[]> {
    const examen = await exigirExamenCodigoPropio(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );
    await finalizarSiCorresponde(this.examenes, this.intentos, this.bitacora, this.tiempoReal, examen);
    return this.intentos.listarPorExamenConDetalle(examen.id);
  }
}

// ── Pausar / reactivar / cancelar global ─────────────────────────

async function exigirLanzado(
  examenes: ExamenCodigoRepositorio,
  clases: ClaseRepositorio,
  materias: MateriaRepositorio,
  materia_id: number,
  examen_codigo_id: number,
  docente_id: number,
): Promise<ExamenCodigo> {
  const examen = await exigirExamenCodigoPropio(
    examenes,
    clases,
    materias,
    materia_id,
    examen_codigo_id,
    docente_id,
  );
  if (examen.estado !== 'lanzada') {
    throw new EstadoInvalidoError('El examen no está en curso');
  }
  return examen;
}

abstract class AccionGlobalIntentosCodigo {
  constructor(
    protected readonly examenes: ExamenCodigoRepositorio,
    protected readonly clases: ClaseRepositorio,
    protected readonly materias: MateriaRepositorio,
    protected readonly intentos: IntentoCodigoRepositorio,
    protected readonly bitacora: BitacoraRepositorio,
    protected readonly tiempoReal: TiempoRealEmisor,
  ) {}

  protected abstract accion: string;
  protected abstract estadoOrigen: IntentoCodigo['estado'];
  protected abstract estadoDestino: IntentoCodigo['estado'];
  protected abstract eventoEstudiante: string;

  async ejecutar(
    entrada: Auditoria & { materia_id: number; examen_codigo_id: number; docente_id: number },
  ): Promise<void> {
    const examen = await exigirLanzado(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );

    const intentos = await this.intentos.listarPorExamen(examen.id);
    const afectados = intentos.filter((i) => i.estado === this.estadoOrigen);

    for (const intento of afectados) {
      await this.intentos.cambiarEstado(intento.id, this.estadoDestino);
      this.tiempoReal.emitirAEstudiante(intento.estudiante_id, this.eventoEstudiante, {
        intento_id: intento.id,
      });
      this.tiempoReal.emitirAExamenCodigo(examen.id, 'intento-actualizado', {
        intento_id: intento.id,
        estado: this.estadoDestino,
      });
    }

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: this.accion,
      entidad: 'examen_codigo',
      entidad_id: String(examen.id),
      valor_nuevo: { intentos_afectados: afectados.length },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}

export class PausarExamenCodigo extends AccionGlobalIntentosCodigo {
  protected accion = 'examen_codigo_pausado_global';
  protected estadoOrigen: IntentoCodigo['estado'] = 'en_curso';
  protected estadoDestino: IntentoCodigo['estado'] = 'pausado';
  protected eventoEstudiante = 'examen-codigo-pausado';
}

export class ReactivarExamenCodigo extends AccionGlobalIntentosCodigo {
  protected accion = 'examen_codigo_reactivado_global';
  protected estadoOrigen: IntentoCodigo['estado'] = 'pausado';
  protected estadoDestino: IntentoCodigo['estado'] = 'en_curso';
  protected eventoEstudiante = 'examen-codigo-reactivado';
}

export class CancelarExamenCodigo {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly intentos: IntentoCodigoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(
    entrada: Auditoria & { materia_id: number; examen_codigo_id: number; docente_id: number },
  ): Promise<ExamenCodigo> {
    const examen = await exigirLanzado(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );

    const intentos = await this.intentos.listarPorExamen(examen.id);
    const enCurso = intentos.filter(
      (i) => i.estado === 'en_curso' || i.estado === 'pausado' || i.estado === 'desconectado',
    );
    for (const intento of enCurso) {
      await this.intentos.cambiarEstado(intento.id, 'cancelado', { fecha_fin: new Date() });
      this.tiempoReal.emitirAEstudiante(intento.estudiante_id, 'examen-codigo-cancelado', {
        intento_id: intento.id,
      });
      this.tiempoReal.emitirAExamenCodigo(examen.id, 'intento-actualizado', {
        intento_id: intento.id,
        estado: 'cancelado',
      });
    }

    const actualizado = await this.examenes.cambiarEstado(examen.id, 'finalizada');
    this.tiempoReal.emitirAExamenCodigo(examen.id, 'estado-actualizado', {});

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'examen_codigo_cancelado',
      entidad: 'examen_codigo',
      entidad_id: String(examen.id),
      valor_nuevo: { intentos_cancelados: enCurso.length },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizado;
  }
}

// ── Pausar / reactivar individual ────────────────────────────────

async function exigirIntentoDeExamen(
  intentos: IntentoCodigoRepositorio,
  examen: ExamenCodigo,
  intento_id: number,
): Promise<IntentoCodigo> {
  const intento = await intentos.buscarPorId(intento_id);
  if (!intento || intento.examen_codigo_id !== examen.id) {
    throw new NoEncontradoError('Intento');
  }
  return intento;
}

export class PausarIntentoCodigo {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly intentos: IntentoCodigoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      examen_codigo_id: number;
      intento_id: number;
      docente_id: number;
    },
  ): Promise<void> {
    const examen = await exigirLanzado(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );
    const intento = await exigirIntentoDeExamen(this.intentos, examen, entrada.intento_id);
    if (intento.estado !== 'en_curso' && intento.estado !== 'desconectado') {
      throw new EstadoInvalidoError('Ese estudiante no está en curso');
    }

    await this.intentos.cambiarEstado(intento.id, 'pausado');
    this.tiempoReal.emitirAEstudiante(intento.estudiante_id, 'examen-codigo-pausado', {
      intento_id: intento.id,
    });
    this.tiempoReal.emitirAExamenCodigo(examen.id, 'intento-actualizado', {
      intento_id: intento.id,
      estado: 'pausado',
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'intento_codigo_pausado',
      entidad: 'intento_codigo',
      entidad_id: String(intento.id),
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}

export class ReactivarIntentoCodigo {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly intentos: IntentoCodigoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      examen_codigo_id: number;
      intento_id: number;
      docente_id: number;
    },
  ): Promise<void> {
    const examen = await exigirLanzado(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );
    const intento = await exigirIntentoDeExamen(this.intentos, examen, entrada.intento_id);
    if (intento.estado !== 'pausado') {
      throw new EstadoInvalidoError('Ese estudiante no está pausado');
    }

    await this.intentos.cambiarEstado(intento.id, 'en_curso');
    this.tiempoReal.emitirAEstudiante(intento.estudiante_id, 'examen-codigo-reactivado', {
      intento_id: intento.id,
    });
    this.tiempoReal.emitirAExamenCodigo(examen.id, 'intento-actualizado', {
      intento_id: intento.id,
      estado: 'en_curso',
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'intento_codigo_reactivado',
      entidad: 'intento_codigo',
      entidad_id: String(intento.id),
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}
