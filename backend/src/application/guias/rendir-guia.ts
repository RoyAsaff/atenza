// Guías nativas (16/08) · Ejecución en vivo — calca rendir-examen.ts, pero
// sin preguntas que mandar (el cuestionario vive en la página externa del
// docente): "iniciar" solo arma/reanuda el intento y firma un token
// acotado a ESE intento puntual. La página externa reporta cada pregunta
// contestada y cada incidencia con ese token — ver verificar-token-guia.ts.

import { Guia, GuiaIntento, GuiaIntentoParaRendir } from '../../domain/entidades/guia';
import { EstadoInvalidoError, NoEncontradoError } from '../../domain/errores';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { GuiaIntentoRepositorio } from '../../domain/repositorios/guia-intento-repositorio';
import { GuiaRepositorio } from '../../domain/repositorios/guia-repositorio';
import { TiempoRealEmisor } from '../../domain/repositorios/tiempo-real';
import { TokenService } from '../../domain/servicios/token-service';

// Vigencia del token de acceso a un intento — generosa: cubre una clase
// entera o un repaso tranquilo sin que expire a mitad de camino.
const ACCESO_INTENTO_SEGUNDOS = 6 * 3600;

/** Arma el token acotado al intento + la url_acceso final — compartido por
 * IniciarOReanudarGuiaIntento (el estudiante pide entrar) y
 * VerGuiaOficialActivo (el Layout empuja el aviso solo). */
function armarParaRendir(
  guia: Guia,
  intento: GuiaIntento,
  tokens: TokenService,
): GuiaIntentoParaRendir {
  const token = tokens.firmar(
    {
      sub: intento.estudiante_id,
      contexto: 'estudiante',
      guia_id: guia.id,
      guia_intento_id: intento.id,
      jti: `guia-intento-${intento.id}`,
    },
    ACCESO_INTENTO_SEGUNDOS,
  );
  const separador = guia.url.includes('?') ? '&' : '?';
  const url_acceso = `${guia.url}${separador}atenza_token=${token}&guia=${guia.id}&guia_intento=${intento.id}`;

  return {
    intento_id: intento.id,
    guia_id: guia.id,
    tema: guia.tema,
    url_acceso,
    estado: intento.estado,
    fecha_limite: intento.fecha_limite,
  };
}

/** Calcula la nota del intento OFICIAL si ya se puede: sin preguntas
 * abiertas pendientes de revisión. Idempotente — no recalcula si ya tiene
 * nota_obtenida. Reusada por FinalizarGuiaIntento, RevisarRespuestasGuia,
 * CancelarGuiaLanzamiento y el barrido de vencimientos. */
export async function calcularNotaSiCorresponde(
  guias: GuiaRepositorio,
  guiaIntentos: GuiaIntentoRepositorio,
  intento: GuiaIntento,
): Promise<void> {
  if (!intento.es_oficial || intento.nota_obtenida !== null) return;

  const pendientes = await guiaIntentos.respuestasAbiertasPendientes(intento.id);
  if (pendientes.length > 0) return;

  const [guia, preguntas, aciertos] = await Promise.all([
    guias.buscarPorId(intento.guia_id),
    guias.listarPreguntas(intento.guia_id),
    guiaIntentos.contarRespuestasCorrectas(intento.id),
  ]);
  if (!guia || guia.nota === null || preguntas.length === 0) return;

  const nota_obtenida = Math.round((aciertos / preguntas.length) * guia.nota * 100) / 100;
  await guiaIntentos.guardarNota(intento.id, aciertos, nota_obtenida);
}

// ── Iniciar / reanudar (estudiante, sesión normal de Atenza) ─────

export class IniciarOReanudarGuiaIntento {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
    private readonly tokens: TokenService,
  ) {}

  async ejecutar(entrada: {
    guia_id: number;
    estudiante_id: number;
  }): Promise<GuiaIntentoParaRendir> {
    const guia = await this.guias.buscarPorId(entrada.guia_id);
    if (!guia) throw new NoEncontradoError('Guía');
    if (guia.estado === 'externa_legacy' || guia.estado === 'publicada') {
      throw new EstadoInvalidoError('Esta guía todavía no está lanzada');
    }

    let intento = await this.guiaIntentos.buscarActivoPorEstudianteYGuia(
      guia.id,
      entrada.estudiante_id,
    );

    if (!intento) {
      // Sin intento activo: si ya tiene un oficial (terminal), esto es un
      // repaso nuevo. Sin oficial, todavía no fue convocado a esta guía.
      const oficial = await this.guiaIntentos.buscarOficialPorEstudianteYGuia(
        guia.id,
        entrada.estudiante_id,
      );
      if (!oficial) {
        throw new EstadoInvalidoError('Todavía no te convocaron a esta guía');
      }
      const numero_intento =
        (await this.guiaIntentos.contarPorEstudianteYGuia(guia.id, entrada.estudiante_id)) + 1;
      const fecha_limite = guia.tiempo_limite_minutos
        ? new Date(Date.now() + guia.tiempo_limite_minutos * 60_000)
        : null;
      intento = await this.guiaIntentos.crear({
        guia_id: guia.id,
        estudiante_id: entrada.estudiante_id,
        es_oficial: false, // el oficial solo lo crea LanzarGuia
        numero_intento,
        fecha_limite,
      });
    }

    return armarParaRendir(guia, intento, this.tokens);
  }
}

// ── Auto-push (Layout): ¿hay un lanzamiento oficial esperándome AHORA
// mismo, en cualquier materia? Mismo espíritu que VerIntentoActual de
// exámenes — un repaso (es_oficial: false) nunca dispara esto, porque ya
// lo inició el propio estudiante a mano. ────────────────────────────

export class VerGuiaOficialActivo {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
    private readonly tokens: TokenService,
  ) {}

  async ejecutar(entrada: { estudiante_id: number }): Promise<GuiaIntentoParaRendir | null> {
    const intento = await this.guiaIntentos.buscarOficialActivoPorEstudiante(
      entrada.estudiante_id,
    );
    if (!intento) return null;

    const guia = await this.guias.buscarPorId(intento.guia_id);
    if (!guia) return null; // no debería pasar — intento huérfano, ignorar en vez de tirar 500

    return armarParaRendir(guia, intento, this.tokens);
  }
}

// ── Reportado desde la página externa (sin sesión, verificarTokenGuiaIntento) ─

export class GuardarRespuestaGuia {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: {
    guia_intento_id: number;
    referencia: string;
    correcta?: boolean;
    texto_libre?: string;
  }): Promise<void> {
    const intento = await this.guiaIntentos.buscarPorId(entrada.guia_intento_id);
    if (!intento) throw new NoEncontradoError('Intento');
    if (intento.estado !== 'en_curso' && intento.estado !== 'desconectado') {
      throw new EstadoInvalidoError('La guía no está en curso');
    }

    const pregunta = await this.guias.buscarPreguntaPorReferencia(
      intento.guia_id,
      entrada.referencia,
    );
    if (!pregunta) throw new NoEncontradoError('Pregunta');

    // Automáticas: la corrección ya la calculó la propia página contra su
    // data-correct — Atenza confía en ese reporte, mismo nivel de
    // confianza que ya existía con el booleano "completado" de antes.
    // Abiertas: nunca llega correcta desde afuera, queda pendiente de
    // revisión del docente siempre.
    const datos =
      pregunta.tipo === 'abierta'
        ? { texto_libre: entrada.texto_libre ?? '' }
        : { correcta: entrada.correcta ?? false };

    await this.guiaIntentos.guardarRespuesta(intento.id, pregunta.id, datos);
    const respondidas = await this.guiaIntentos.contarRespuestas(intento.id);

    this.tiempoReal.emitirAGuia(intento.guia_id, 'progreso', {
      intento_id: intento.id,
      respondidas,
    });
  }
}

export class ReportarIncidenteGuia {
  constructor(
    private readonly guiaIntentos: GuiaIntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: { guia_intento_id: number; detalle?: string }): Promise<void> {
    const intento = await this.guiaIntentos.buscarPorId(entrada.guia_intento_id);
    if (!intento) throw new NoEncontradoError('Intento');

    const incidente = await this.guiaIntentos.registrarIncidente(
      intento.id,
      'salida_pantalla',
      entrada.detalle,
    );
    const incidentes = await this.guiaIntentos.contarIncidentes(intento.id);

    // Misma decisión que en exámenes: la consecuencia siempre la decide el
    // docente a mano, acá solo se notifica en vivo.
    this.tiempoReal.emitirAGuia(intento.guia_id, 'incidente', {
      intento_id: intento.id,
      tipo: incidente.tipo,
      fecha_hora: incidente.fecha_hora,
      incidentes,
    });

    await this.bitacora.registrar({
      usuario_id: intento.estudiante_id,
      rol_contexto: 'estudiante',
      accion: 'incidente_guia',
      entidad: 'guia_intento',
      entidad_id: String(intento.id),
      valor_nuevo: { tipo: 'salida_pantalla', detalle: entrada.detalle ?? null },
    });
  }
}

export class FinalizarGuiaIntento {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: { guia_intento_id: number }): Promise<void> {
    const intento = await this.guiaIntentos.buscarPorId(entrada.guia_intento_id);
    if (!intento) throw new NoEncontradoError('Intento');
    if (intento.estado !== 'en_curso' && intento.estado !== 'desconectado') {
      throw new EstadoInvalidoError('La guía ya no está en curso');
    }

    const finalizado = await this.guiaIntentos.cambiarEstado(intento.id, 'finalizado', {
      fecha_fin: new Date(),
    });
    await calcularNotaSiCorresponde(this.guias, this.guiaIntentos, finalizado);

    this.tiempoReal.emitirAGuia(intento.guia_id, 'intento-actualizado', {
      intento_id: intento.id,
      estado: 'finalizado',
    });
  }
}
