// E7 · Ejecución en vivo (lado estudiante): HU-21 (abrir/reanudar el
// examen, guardar cada respuesta de inmediato — D-06, reportar
// incidentes de salida de pantalla) y HU-24 (autofinalizar al agotar
// el tiempo límite, si se configuró uno).

import {
  Intento,
  IntentoParaRendir,
  PreguntaParaRendir,
  TipoIncidente,
} from '../../domain/entidades/intento';
import { EstadoInvalidoError, NoEncontradoError, ProhibidoError } from '../../domain/errores';
import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';
import { IntentoRepositorio } from '../../domain/repositorios/intento-repositorio';
import { TiempoRealEmisor } from '../../domain/repositorios/tiempo-real';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';

/** HU-24 Esc. 1: si ya pasó fecha_limite y el intento sigue activo, se autofinaliza. */
async function aplicarExpiracionSiToca(
  intentos: IntentoRepositorio,
  intento: Intento,
): Promise<Intento> {
  const sigueActivo = intento.estado === 'en_curso' || intento.estado === 'desconectado';
  if (sigueActivo && intento.fecha_limite && intento.fecha_limite.getTime() <= Date.now()) {
    return intentos.cambiarEstado(intento.id, 'finalizado', { fecha_fin: new Date() });
  }
  return intento;
}

async function exigirIntentoPropio(
  intentos: IntentoRepositorio,
  intento_id: number,
  estudiante_id: number,
): Promise<Intento> {
  const intento = await intentos.buscarPorId(intento_id);
  if (!intento) throw new NoEncontradoError('Intento');
  if (intento.estudiante_id !== estudiante_id) {
    throw new ProhibidoError('Este examen no te pertenece');
  }
  return intento;
}

// ── Abrir / reanudar el examen vigente (HU-21 Esc. 1 y 4) ────────

export class VerIntentoActual {
  constructor(
    private readonly intentos: IntentoRepositorio,
    private readonly evaluaciones: EvaluacionRepositorio,
  ) {}

  async ejecutar(entrada: { estudiante_id: number }): Promise<IntentoParaRendir | null> {
    const activo = await this.intentos.buscarActivoPorEstudiante(entrada.estudiante_id);
    if (!activo) return null;

    const intento = await aplicarExpiracionSiToca(this.intentos, activo);

    const conPreguntas = await this.evaluaciones.buscarConPreguntas(intento.evaluacion_id);
    if (!conPreguntas) throw new NoEncontradoError('Evaluación');

    const respuestas = await this.intentos.respuestasDe(intento.id);
    const respondida = new Map(respuestas.map((r) => [r.pregunta_id, r.opcion_id]));
    const mapaPreguntas = new Map(conPreguntas.preguntas.map((p) => [p.id, p]));

    const preguntas: PreguntaParaRendir[] = intento.orden_preguntas
      .map((preguntaId) => mapaPreguntas.get(preguntaId))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((pregunta) => {
        const ordenOpciones =
          intento.orden_opciones[String(pregunta.id)] ?? pregunta.opciones.map((o) => o.id);
        const mapaOpciones = new Map(pregunta.opciones.map((o) => [o.id, o]));
        return {
          id: pregunta.id,
          pregunta: pregunta.pregunta,
          url_imagen: pregunta.url_imagen,
          opciones: ordenOpciones
            .map((opcionId) => mapaOpciones.get(opcionId))
            .filter((o): o is NonNullable<typeof o> => Boolean(o))
            .map((o) => ({ id: o.id, texto: o.texto })),
          opcion_elegida_id: respondida.get(pregunta.id) ?? null,
        };
      });

    return {
      intento_id: intento.id,
      evaluacion_id: intento.evaluacion_id,
      tema: conPreguntas.tema,
      nota: conPreguntas.nota,
      estado: intento.estado,
      fecha_limite: intento.fecha_limite,
      preguntas,
    };
  }
}

// ── HU-21 Esc. 3 · Guardar cada respuesta de inmediato (D-06) ────

export class GuardarRespuesta {
  constructor(
    private readonly intentos: IntentoRepositorio,
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: {
    intento_id: number;
    estudiante_id: number;
    pregunta_id: number;
    opcion_id: number;
  }): Promise<void> {
    const propio = await exigirIntentoPropio(
      this.intentos,
      entrada.intento_id,
      entrada.estudiante_id,
    );
    const intento = await aplicarExpiracionSiToca(this.intentos, propio);
    if (intento.estado !== 'en_curso' && intento.estado !== 'desconectado') {
      throw new EstadoInvalidoError('El examen no está en curso');
    }

    const conPreguntas = await this.evaluaciones.buscarConPreguntas(intento.evaluacion_id);
    const pregunta = conPreguntas?.preguntas.find((p) => p.id === entrada.pregunta_id);
    if (!pregunta) throw new NoEncontradoError('Pregunta');
    const opcionValida = pregunta.opciones.some((o) => o.id === entrada.opcion_id);
    if (!opcionValida) throw new NoEncontradoError('Opción');

    await this.intentos.guardarRespuesta(intento.id, entrada.pregunta_id, entrada.opcion_id);

    this.tiempoReal.emitirAEvaluacion(intento.evaluacion_id, 'progreso', {
      intento_id: intento.id,
    });
  }
}

// ── HU-21 Esc. 2 · Reportar incidente (salida de pantalla) ───────

export class ReportarIncidente {
  constructor(
    private readonly intentos: IntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: {
    intento_id: number;
    estudiante_id: number;
    tipo: TipoIncidente;
    detalle?: string;
  }): Promise<void> {
    const intento = await exigirIntentoPropio(
      this.intentos,
      entrada.intento_id,
      entrada.estudiante_id,
    );

    const incidente = await this.intentos.registrarIncidente(
      intento.id,
      entrada.tipo,
      entrada.detalle,
    );

    // La decisión sobre consecuencias siempre es manual del docente
    // (HU-21 Esc. 2): acá solo se notifica en vivo, nada se bloquea solo.
    this.tiempoReal.emitirAEvaluacion(intento.evaluacion_id, 'incidente', {
      intento_id: intento.id,
      tipo: incidente.tipo,
      fecha_hora: incidente.fecha_hora,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.estudiante_id,
      rol_contexto: 'estudiante',
      accion: 'incidente_examen',
      entidad: 'intento',
      entidad_id: String(intento.id),
      valor_nuevo: { tipo: entrada.tipo, detalle: entrada.detalle ?? null },
    });
  }
}

// ── Finalizar (envío manual del estudiante) ──────────────────────

export class FinalizarIntento {
  constructor(
    private readonly intentos: IntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: { intento_id: number; estudiante_id: number }): Promise<void> {
    const propio = await exigirIntentoPropio(
      this.intentos,
      entrada.intento_id,
      entrada.estudiante_id,
    );
    const intento = await aplicarExpiracionSiToca(this.intentos, propio);
    if (intento.estado !== 'en_curso' && intento.estado !== 'desconectado') {
      throw new EstadoInvalidoError('El examen ya no está en curso');
    }

    await this.intentos.cambiarEstado(intento.id, 'finalizado', { fecha_fin: new Date() });
    this.tiempoReal.emitirAEvaluacion(intento.evaluacion_id, 'estado-actualizado', {
      intento_id: intento.id,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.estudiante_id,
      rol_contexto: 'estudiante',
      accion: 'intento_finalizado',
      entidad: 'intento',
      entidad_id: String(intento.id),
    });
  }
}
