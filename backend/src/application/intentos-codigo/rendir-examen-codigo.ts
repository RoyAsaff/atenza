// E9 · Ejecución en vivo de exámenes de código (lado estudiante) — calcado
// de intentos/rendir-examen.ts: abrir/reanudar, guardar respuesta de
// inmediato, reportar incidentes, autofinalizar al agotar el tiempo.
//
// Diferencia central con Evaluación: acá "guardar respuesta" corre código
// real en un sandbox (EjecutorCodigo). Hay dos acciones separadas:
//   - Ejecutar: prueba contra los casos VISIBLES únicamente, nunca toca
//     los ocultos, y NO se persiste como respuesta — es un scratchpad.
//   - Enviar: corre TODOS los casos (visibles + ocultos), persiste la
//     RespuestaCodigo (lo que se usa para calificar) y devuelve al
//     estudiante el conteo real pero solo el detalle de los visibles.

import {
  EjercicioParaRendir,
  IntentoCodigo,
  IntentoCodigoParaRendir,
  ResultadoCaso,
  ResultadoEnvio,
  TipoIncidenteCodigo,
} from '../../domain/entidades/intento-codigo';
import { EstadoInvalidoError, NoEncontradoError, ProhibidoError } from '../../domain/errores';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { ExamenCodigoRepositorio } from '../../domain/repositorios/examen-codigo-repositorio';
import { IntentoCodigoRepositorio } from '../../domain/repositorios/intento-codigo-repositorio';
import { TiempoRealEmisor } from '../../domain/repositorios/tiempo-real';
import { EjecutorCodigo } from '../../domain/servicios/ejecutor-codigo';

/** Igual aplicarExpiracionSiToca de Evaluación: autofinaliza si ya venció,
 * sin depender de que nadie esté mirando el panel de monitoreo. */
async function aplicarExpiracionSiToca(
  intentos: IntentoCodigoRepositorio,
  tiempoReal: TiempoRealEmisor,
  intento: IntentoCodigo,
): Promise<IntentoCodigo> {
  const sigueActivo = intento.estado === 'en_curso' || intento.estado === 'desconectado';
  if (sigueActivo && intento.fecha_limite && intento.fecha_limite.getTime() <= Date.now()) {
    const actualizado = await intentos.cambiarEstado(intento.id, 'finalizado', {
      fecha_fin: new Date(),
    });
    tiempoReal.emitirAExamenCodigo(actualizado.examen_codigo_id, 'intento-actualizado', {
      intento_id: actualizado.id,
      estado: actualizado.estado,
    });
    return actualizado;
  }
  return intento;
}

async function exigirIntentoPropio(
  intentos: IntentoCodigoRepositorio,
  intento_id: number,
  estudiante_id: number,
): Promise<IntentoCodigo> {
  const intento = await intentos.buscarPorId(intento_id);
  if (!intento) throw new NoEncontradoError('Intento');
  if (intento.estudiante_id !== estudiante_id) {
    throw new ProhibidoError('Este examen no te pertenece');
  }
  return intento;
}

/** Solo las entradas de `resultado_json` cuyo caso_id sigue siendo un caso
 * visible del ejercicio — así un examen ya enviado nunca reexpone el
 * detalle de un caso oculto al reabrir/reanudar. */
function filtrarResultadosVisibles(
  resultado: ResultadoCaso[] | null,
  idsVisibles: Set<number>,
): ResultadoCaso[] | null {
  if (!resultado) return null;
  const visibles = resultado.filter((r) => idsVisibles.has(r.caso_id));
  return visibles.length > 0 ? visibles : null;
}

// ── Abrir / reanudar el examen vigente ───────────────────────────

export class VerIntentoCodigoActual {
  constructor(
    private readonly intentos: IntentoCodigoRepositorio,
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: { estudiante_id: number }): Promise<IntentoCodigoParaRendir | null> {
    const activo = await this.intentos.buscarActivoPorEstudiante(entrada.estudiante_id);
    if (!activo) return null;

    const intento = await aplicarExpiracionSiToca(this.intentos, this.tiempoReal, activo);

    const conEjercicios = await this.examenes.buscarConEjercicios(intento.examen_codigo_id);
    if (!conEjercicios) throw new NoEncontradoError('Examen de código');

    const respuestas = await this.intentos.respuestasDe(intento.id);
    const respuestaPorEjercicio = new Map(respuestas.map((r) => [r.ejercicio_id, r]));
    const mapaEjercicios = new Map(conEjercicios.ejercicios.map((e) => [e.id, e]));

    const ejercicios: EjercicioParaRendir[] = intento.orden_ejercicios
      .map((id) => mapaEjercicios.get(id))
      .filter((e): e is NonNullable<typeof e> => Boolean(e))
      .map((ejercicio) => {
        const visibles = ejercicio.casos_prueba.filter((c) => !c.es_oculto);
        const respuesta = respuestaPorEjercicio.get(ejercicio.id);
        const idsVisibles = new Set(visibles.map((c) => c.id));
        return {
          id: ejercicio.id,
          enunciado: ejercicio.enunciado,
          plantilla_codigo: ejercicio.plantilla_codigo,
          orden: ejercicio.orden,
          casos_visibles: visibles.map((c) => ({
            id: c.id,
            entrada: c.entrada,
            salida_esperada: c.salida_esperada,
          })),
          total_casos: ejercicio.casos_prueba.length,
          ultimo_codigo: respuesta?.codigo_fuente ?? null,
          ultimo_resultado: filtrarResultadosVisibles(respuesta?.resultado_json ?? null, idsVisibles),
          enviado_en: respuesta?.respondida_en ?? null,
        };
      });

    return {
      intento_id: intento.id,
      examen_codigo_id: intento.examen_codigo_id,
      tema: conEjercicios.tema,
      nota: conEjercicios.nota,
      estado: intento.estado,
      fecha_inicio: intento.fecha_inicio,
      fecha_limite: intento.fecha_limite,
      ejercicios,
    };
  }
}

// ── Ejecutar: probar contra los casos visibles (scratchpad, no persiste) ─

export class EjecutarCodigo {
  constructor(
    private readonly intentos: IntentoCodigoRepositorio,
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly ejecutor: EjecutorCodigo,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: {
    intento_id: number;
    estudiante_id: number;
    ejercicio_id: number;
    codigo_fuente: string;
  }): Promise<ResultadoCaso[]> {
    const propio = await exigirIntentoPropio(this.intentos, entrada.intento_id, entrada.estudiante_id);
    const intento = await aplicarExpiracionSiToca(this.intentos, this.tiempoReal, propio);
    if (intento.estado !== 'en_curso' && intento.estado !== 'desconectado') {
      throw new EstadoInvalidoError('El examen no está en curso');
    }

    const ejercicio = await this.examenes.buscarEjercicio(entrada.ejercicio_id);
    if (!ejercicio || ejercicio.examen_codigo_id !== intento.examen_codigo_id) {
      throw new NoEncontradoError('Ejercicio');
    }

    const casosVisibles = ejercicio.casos_prueba.filter((c) => !c.es_oculto);
    if (casosVisibles.length === 0) return [];

    return this.ejecutor.ejecutar(entrada.codigo_fuente, casosVisibles);
  }
}

// ── Enviar: corre todos los casos, persiste la respuesta calificable ────

export class EnviarRespuestaCodigo {
  constructor(
    private readonly intentos: IntentoCodigoRepositorio,
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly ejecutor: EjecutorCodigo,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: {
    intento_id: number;
    estudiante_id: number;
    ejercicio_id: number;
    codigo_fuente: string;
  }): Promise<ResultadoEnvio> {
    const propio = await exigirIntentoPropio(this.intentos, entrada.intento_id, entrada.estudiante_id);
    const intento = await aplicarExpiracionSiToca(this.intentos, this.tiempoReal, propio);
    if (intento.estado !== 'en_curso' && intento.estado !== 'desconectado') {
      throw new EstadoInvalidoError('El examen no está en curso');
    }

    const ejercicio = await this.examenes.buscarEjercicio(entrada.ejercicio_id);
    if (!ejercicio || ejercicio.examen_codigo_id !== intento.examen_codigo_id) {
      throw new NoEncontradoError('Ejercicio');
    }

    const resultado_json =
      ejercicio.casos_prueba.length > 0
        ? await this.ejecutor.ejecutar(entrada.codigo_fuente, ejercicio.casos_prueba)
        : [];
    const casos_acertados = resultado_json.filter((r) => r.paso).length;
    const casos_totales = ejercicio.casos_prueba.length;

    const guardada = await this.intentos.guardarRespuesta({
      intento_id: intento.id,
      ejercicio_id: ejercicio.id,
      codigo_fuente: entrada.codigo_fuente,
      casos_acertados,
      casos_totales,
      resultado_json,
    });

    const ejerciciosEnviados = await this.intentos.contarEjerciciosEnviados(intento.id);
    this.tiempoReal.emitirAExamenCodigo(intento.examen_codigo_id, 'progreso', {
      intento_id: intento.id,
      ejercicios_enviados: ejerciciosEnviados,
    });

    const idsVisibles = new Set(ejercicio.casos_prueba.filter((c) => !c.es_oculto).map((c) => c.id));
    return {
      casos_acertados,
      casos_totales,
      resultados_visibles: resultado_json.filter((r) => idsVisibles.has(r.caso_id)),
      enviado_en: guardada.respondida_en,
    };
  }
}

// ── Reportar incidente (pérdida de foco / minimizado / intento de cierre) ─

export class ReportarIncidenteCodigo {
  constructor(
    private readonly intentos: IntentoCodigoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: {
    intento_id: number;
    estudiante_id: number;
    tipo: TipoIncidenteCodigo;
    detalle?: string;
  }): Promise<void> {
    const intento = await exigirIntentoPropio(this.intentos, entrada.intento_id, entrada.estudiante_id);

    const incidente = await this.intentos.registrarIncidente(intento.id, entrada.tipo, entrada.detalle);
    const incidentes = await this.intentos.contarIncidentes(intento.id);

    // Igual E7: la decisión de pausar/cancelar es siempre manual del
    // docente — acá solo se notifica en vivo, nada se bloquea solo.
    this.tiempoReal.emitirAExamenCodigo(intento.examen_codigo_id, 'incidente', {
      intento_id: intento.id,
      tipo: incidente.tipo,
      fecha_hora: incidente.fecha_hora,
      incidentes,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.estudiante_id,
      rol_contexto: 'estudiante',
      accion: 'incidente_examen_codigo',
      entidad: 'intento_codigo',
      entidad_id: String(intento.id),
      valor_nuevo: { tipo: entrada.tipo, detalle: entrada.detalle ?? null },
    });
  }
}

// ── Finalizar (envío manual del estudiante) ──────────────────────

export class FinalizarIntentoCodigo {
  constructor(
    private readonly intentos: IntentoCodigoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: { intento_id: number; estudiante_id: number }): Promise<void> {
    const propio = await exigirIntentoPropio(this.intentos, entrada.intento_id, entrada.estudiante_id);
    const intento = await aplicarExpiracionSiToca(this.intentos, this.tiempoReal, propio);
    if (intento.estado !== 'en_curso' && intento.estado !== 'desconectado') {
      throw new EstadoInvalidoError('El examen ya no está en curso');
    }

    await this.intentos.cambiarEstado(intento.id, 'finalizado', { fecha_fin: new Date() });
    this.tiempoReal.emitirAExamenCodigo(intento.examen_codigo_id, 'intento-actualizado', {
      intento_id: intento.id,
      estado: 'finalizado',
    });

    await this.bitacora.registrar({
      usuario_id: entrada.estudiante_id,
      rol_contexto: 'estudiante',
      accion: 'intento_codigo_finalizado',
      entidad: 'intento_codigo',
      entidad_id: String(intento.id),
    });
  }
}
