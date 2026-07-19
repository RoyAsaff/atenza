// E7 · Ejecución en vivo. No están en el diagrama (que solo trae
// Respuesta) — Intento e Incidente se acordaron con Roy el 13/07 para
// poder pausar/reanudar individualmente y registrar salidas de pantalla.

export type EstadoIntento = 'en_curso' | 'pausado' | 'finalizado' | 'desconectado' | 'cancelado';

export type TipoIncidente = 'salida_pantalla';

export interface Intento {
  id: number;
  evaluacion_id: number;
  estudiante_id: number;
  estado: EstadoIntento;
  /** Orden barajado de Pregunta.id, fijo desde que se lanza (HU-20 Esc. 3). */
  orden_preguntas: number[];
  /** Por pregunta (clave = Pregunta.id como string): orden barajado de Opcion.id. */
  orden_opciones: Record<string, number[]>;
  fecha_inicio: Date;
  fecha_limite: Date | null;
  fecha_fin: Date | null;
}

export interface Respuesta {
  id: number;
  intento_id: number;
  pregunta_id: number;
  opcion_id: number;
  respondida_en: Date;
}

export interface Incidente {
  id: number;
  intento_id: number;
  tipo: TipoIncidente;
  detalle: string | null;
  fecha_hora: Date;
}

/** Fila del panel de monitoreo en vivo del docente (HU-22). */
export interface FilaMonitoreo {
  intento_id: number;
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  estado: EstadoIntento;
  respondidas: number;
  total_preguntas: number;
  incidentes: number;
}

/** Pregunta tal como la ve el estudiante rindiendo el examen: sin
 * exponer es_correcta, en el orden barajado propio de su Intento. */
export interface OpcionParaRendir {
  id: number;
  texto: string;
}

export interface PreguntaParaRendir {
  id: number;
  pregunta: string;
  url_imagen: string | null;
  opciones: OpcionParaRendir[];
  /** Opción ya guardada por el estudiante para esta pregunta, si la hay. */
  opcion_elegida_id: number | null;
}

export interface IntentoParaRendir {
  intento_id: number;
  evaluacion_id: number;
  tema: string;
  nota: number;
  estado: EstadoIntento;
  fecha_limite: Date | null;
  preguntas: PreguntaParaRendir[];
}

// ── HU-25 (detalle) · "Ver examen" — el docente revisa cómo respondió
// un estudiante particular, con la opción correcta visible (a
// diferencia de PreguntaParaRendir, que la oculta). ──────────────────

export interface OpcionConCorreccion {
  id: number;
  texto: string;
  es_correcta: boolean;
}

export interface PreguntaConRespuesta {
  id: number;
  pregunta: string;
  url_imagen: string | null;
  orden: number;
  opciones: OpcionConCorreccion[];
  /** Opción que eligió el estudiante en esa pregunta; null si no la respondió. */
  opcion_elegida_id: number | null;
  acerto: boolean;
}

export interface DetalleIntento {
  intento_id: number;
  evaluacion_id: number;
  estudiante_id: number;
  preguntas: PreguntaConRespuesta[];
}
