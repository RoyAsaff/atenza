// Entidad Guía de pre-clase (fusión con PaginaGuias, 05/08) — no está en
// el diagrama. Vive sobre una Clase, igual que Asistencia/Evaluación.
// `url` apunta a una página autocontenida en el sitio del propio docente
// (GitHub Pages u otro) — ATENZA solo referencia el link, no aloja el
// contenido (teoría/slides), ni antes ni con guías nativas.
//
// Guías nativas (16/08): "publicada" nace lista para lanzar (sin ciclo
// borrador/lista de Evaluación); "externa_legacy" son las creadas antes de
// este cambio — siguen con el modelo de siempre (booleano vía
// GuiaCompletada, sin intento/nota/pantalla completa). `nota` es null solo
// en esas legacy; es el marcador que usa el código para distinguirlas.
export type EstadoGuia = 'publicada' | 'lanzada' | 'cerrada' | 'externa_legacy';

export interface Guia {
  id: number;
  clase_id: number;
  tema: string;
  url: string;
  orden: number;
  nota: number | null;
  estado: EstadoGuia;
  tiempo_limite_minutos: number | null;
  /** Nivel 1 de detección de integración (17/08): resultado de la última
   * corrida de "Analizar link" contra la página del docente — null =
   * nunca se analizó (distinto de "no se detectó"). Ver AnalizarGuiaExterna. */
  integracion_detectada: boolean | null;
  integracion_verificada_en: Date | null;
}

// ── Guías nativas (16/08): manifest de preguntas ──────────────────
// GuiaPregunta NO aloja enunciado ni opciones (eso sigue en el HTML del
// docente) — solo la referencia (el data-quiz-id que ya usa su página) y
// el tipo, para poder validar reportes entrantes y calcular la nota.

export type TipoGuiaPregunta = 'automatica' | 'abierta';

export interface GuiaPregunta {
  id: number;
  guia_id: number;
  referencia: string;
  tipo: TipoGuiaPregunta;
  /** Solo si tipo = abierta — el docente la carga al publicar, para revisar
   * rápido (lado a lado con lo que escribió el estudiante). */
  respuesta_modelo: string | null;
  orden: number;
}

/** Fila para el docente: la guía + quién de la nómina ya la completó
 * (siempre, incluso en guías nativas — GuiaCompletada sigue vigente como
 * señal "abrió el link" en paralelo al nuevo GuiaIntento) + su manifest de
 * preguntas si es nativa. */
export interface FilaGuiaDocente extends Guia {
  completados: FilaEstudianteCompletoGuia[];
  preguntas: GuiaPregunta[];
}

export interface FilaEstudianteCompletoGuia {
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  completado_en: Date;
}

/** Fila para el estudiante. En guías "externa_legacy": `url_acceso` trae el
 * link ya armado (con token) y `completado` es el booleano de siempre —
 * comportamiento sin cambios. En guías nativas, `url_acceso` viene vacío
 * (el link real se pide en el momento con "Tomar la guía", acotado a un
 * intento puntual — ver RendirGuia) y en cambio importan `estado`/`nota`/
 * `nota_obtenida`. */
export interface FilaGuiaEstudiante {
  id: number;
  tema: string;
  orden: number;
  url_acceso: string;
  completado: boolean;
  estado: EstadoGuia;
  nota: number | null;
  /** Nota del intento oficial, si ya se calculó (null = no lanzada
   * todavía, no tomada, o pendiente de revisión). */
  nota_obtenida: number | null;
}

/** Fila de "Mis guías" (materia completa, no una clase puntual) — para el
 * tab "Guías" de mobile/web, mismo espíritu que "Mis notas" (VerMisNotas). */
export interface FilaMiGuia extends FilaGuiaEstudiante {
  clase_id: number;
  clase_tema: string;
  clase_fecha: Date;
}

// ── Guías nativas (16/08): ejecución en vivo ──────────────────────
// Calca Intento/Respuesta/Incidente de exámenes (rendir-examen.ts) — mismo
// tipo EstadoIntento y TipoIncidente, reusados tal cual desde intento.ts.

import { EstadoIntento, TipoIncidente } from './intento';

export interface GuiaIntento {
  id: number;
  guia_id: number;
  estudiante_id: number;
  estado: EstadoIntento;
  /** true solo en el intento creado al lanzar la guía a la clase — el
   * único que califica para el curso. */
  es_oficial: boolean;
  /** 1, 2, 3… por estudiante — señal de "volvió a estudiar" en los repasos. */
  numero_intento: number;
  fecha_inicio: Date;
  fecha_limite: Date | null;
  fecha_fin: Date | null;
  /** Cacheada acá (no versionada aparte como Nota de exámenes, D-12): cada
   * GuiaIntento ya es su propia fila inmutable. null = sin calcular
   * (pendiente de revisión de abiertas, o no es el oficial). */
  aciertos: number | null;
  nota_obtenida: number | null;
}

export interface GuiaRespuesta {
  id: number;
  guia_intento_id: number;
  guia_pregunta_id: number;
  /** null = pendiente de revisión (solo posible en preguntas abiertas). */
  correcta: boolean | null;
  texto_libre: string | null;
  respondida_en: Date;
  revisada_en: Date | null;
  revisada_por_id: number | null;
}

export interface GuiaIncidente {
  id: number;
  guia_intento_id: number;
  tipo: TipoIncidente;
  detalle: string | null;
  fecha_hora: Date;
}

/** Lo que recibe el estudiante al "tomar" la guía — a diferencia del examen,
 * acá no hay preguntas que mandar: el cuestionario vive en la página
 * externa. Solo el link con el token acotado a ESE intento. */
export interface GuiaIntentoParaRendir {
  intento_id: number;
  guia_id: number;
  tema: string;
  url_acceso: string;
  estado: EstadoIntento;
  fecha_limite: Date | null;
}

/** Fila del panel de monitoreo en vivo del docente, mientras una guía está
 * lanzada — mismo espíritu que FilaMonitoreo de exámenes. */
export interface FilaMonitoreoGuia {
  intento_id: number;
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  estado: EstadoIntento;
  respondidas: number;
  total_preguntas: number;
  incidentes: number;
  fecha_inicio: Date;
  fecha_limite: Date | null;
}

/** Fila de resultados: nota oficial por estudiante (o pendiente de
 * revisión) + cuántos intentos totales hizo (oficial + repasos). */
export interface FilaResultadoGuia {
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  /** El intento oficial de este estudiante, si ya lo tiene (se crea al
   * lanzar) — para poder pausar/reactivar desde la misma pantalla. */
  intento_id: number | null;
  estado_oficial: EstadoIntento | null;
  /** Cuántas de las preguntas contestó bien el oficial — null si todavía
   * no tiene intento oficial, o si tiene abiertas sin revisar (mismo
   * momento en que nota_obtenida también es null). */
  aciertos: number | null;
  total_preguntas: number;
  /** null si el oficial todavía tiene preguntas abiertas sin revisar. */
  nota_obtenida: number | null;
  nota_total: number;
  total_intentos: number;
  incidentes: number;
}

/** Fila de la pantalla de revisión: una respuesta abierta pendiente,
 * junto a la respuesta modelo, para que el docente la califique. */
export interface FilaRevisionGuia {
  guia_respuesta_id: number;
  guia_intento_id: number;
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  pregunta_referencia: string;
  respuesta_modelo: string | null;
  texto_libre: string | null;
}

/** Inicio (17/08) · panel "Requiere tu atención": conteo de respuestas
 * abiertas pendientes por guía, cruzando todas las materias del docente
 * (a diferencia de FilaRevisionGuia, que es fila a fila de UNA guía). */
export interface FilaRevisionPendienteDocente {
  guia_id: number;
  guia_tema: string;
  materia_id: number;
  materia_nombre: string;
  pendientes: number;
}
