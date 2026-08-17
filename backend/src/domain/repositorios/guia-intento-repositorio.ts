import {
  FilaMonitoreoGuia,
  FilaResultadoGuia,
  FilaRevisionGuia,
  GuiaIncidente,
  GuiaIntento,
  GuiaRespuesta,
} from '../entidades/guia';
import { TipoIncidente } from '../entidades/intento';

export interface DatosNuevoGuiaIntento {
  guia_id: number;
  estudiante_id: number;
  es_oficial: boolean;
  numero_intento: number;
  fecha_limite: Date | null;
}

export interface GuiaIntentoRepositorio {
  buscarPorId(id: number): Promise<GuiaIntento | null>;
  /** El intento vigente (en_curso, pausado o desconectado) de ese estudiante
   * en esa guía, sea oficial o de repaso — para reanudar en vez de duplicar. */
  buscarActivoPorEstudianteYGuia(
    guia_id: number,
    estudiante_id: number,
  ): Promise<GuiaIntento | null>;
  /** El intento oficial de ese estudiante en esa guía, cualquiera sea su
   * estado — "tomar" lo reanuda en vez de crear uno nuevo mientras exista. */
  buscarOficialPorEstudianteYGuia(
    guia_id: number,
    estudiante_id: number,
  ): Promise<GuiaIntento | null>;
  /** Para calcular el próximo numero_intento (repaso). */
  contarPorEstudianteYGuia(guia_id: number, estudiante_id: number): Promise<number>;
  listarPorGuia(guia_id: number): Promise<GuiaIntento[]>;
  /** Solo intentos oficiales — el monitoreo en vivo es del lanzamiento. */
  listarMonitoreo(guia_id: number): Promise<FilaMonitoreoGuia[]>;
  listarResultados(guia_id: number): Promise<FilaResultadoGuia[]>;
  /** Respuestas abiertas (correcta = null) de intentos oficiales, listas
   * para que el docente las califique. */
  listarRevisionPendiente(guia_id: number): Promise<FilaRevisionGuia[]>;
  crear(datos: DatosNuevoGuiaIntento): Promise<GuiaIntento>;
  cambiarEstado(
    id: number,
    estado: GuiaIntento['estado'],
    datos?: { fecha_fin?: Date },
  ): Promise<GuiaIntento>;
  guardarNota(id: number, aciertos: number, nota_obtenida: number): Promise<GuiaIntento>;

  respuestasDe(guia_intento_id: number): Promise<GuiaRespuesta[]>;
  /** Crea la respuesta o la corrige si ya existía para esa pregunta —
   * mismo criterio que Respuesta.guardarRespuesta en exámenes. Reabrir una
   * abierta ya revisada resetea la revisión (cambió el texto). */
  guardarRespuesta(
    guia_intento_id: number,
    guia_pregunta_id: number,
    datos: { correcta?: boolean; texto_libre?: string },
  ): Promise<GuiaRespuesta>;
  contarRespuestas(guia_intento_id: number): Promise<number>;
  contarRespuestasCorrectas(guia_intento_id: number): Promise<number>;
  /** Respuestas abiertas de ese intento todavía sin calificar. */
  respuestasAbiertasPendientes(guia_intento_id: number): Promise<GuiaRespuesta[]>;
  revisarRespuesta(
    guia_respuesta_id: number,
    correcta: boolean,
    revisada_por_id: number,
  ): Promise<GuiaRespuesta>;

  registrarIncidente(
    guia_intento_id: number,
    tipo: TipoIncidente,
    detalle?: string,
  ): Promise<GuiaIncidente>;
  contarIncidentes(guia_intento_id: number): Promise<number>;

  /** Barrido en segundo plano (BarrerVencimientos): intentos con
   * fecha_limite vencida, de cualquier guía. No califica — eso lo decide
   * la capa de aplicación según haya o no abiertas pendientes. */
  finalizarVencidosGlobal(): Promise<GuiaIntento[]>;
}
