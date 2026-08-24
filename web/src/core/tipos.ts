// Tipos espejo de las entidades del backend

export type Contexto = 'docente' | 'admin' | 'estudiante';

export interface Usuario {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  whatsapp: string | null;
  rol_nombre: 'admin' | 'docente_estudiante';
  activo: boolean;
  email_verificado: boolean;
}

export interface Materia {
  id: number;
  nombre_materia: string;
  sigla: string | null;
  codigo: string;
  codigo_activo: boolean; // E3 (HU-11): inscripciones abiertas/cerradas
  carrera: string;
  semestre: string;
  universidad: string;
  docente_id: number;
}

// E4: clase de una materia
export interface Clase {
  id: number;
  fecha: string; // ISO; solo interesa AAAA-MM-DD
  hora: string; // "HH:MM"
  tema: string;
  materia_id: number;
}

// E3 (HU-12): fila de la nómina
export interface InscripcionNomina {
  id: number;
  codigo_estudiante: string;
  fecha_inscripcion: string;
  estudiante: {
    id: number;
    nombres: string;
    apellidos: string;
    email: string;
  };
}

// SaaS por cuenta (17/07, rediseñado 17/08): de 4 tramos por cantidad de
// estudiantes a 3 roles fijos — Gratis (permanente) / Pro (único plan
// pago) / Institucional (a medida) — más Promociones (descuentos).

export type CicloPago = 'mensual' | 'anual';

export type EstadoPago =
  | 'pendiente'
  | 'en_verificacion'
  | 'aprobada'
  | 'rechazada'
  | 'expirada';

export type TipoPlan = 'gratuito' | 'pago' | 'institucional';

export interface Plan {
  id: number;
  nombre: string;
  tipo: TipoPlan;
  limite_estudiantes: number | null; // null = ilimitado (Pro) / "a medida" (Institucional)
  limite_materias: number | null; // null = ilimitado; Gratis = 1
  permite_import_word: boolean;
  permite_guias: boolean;
  monto_mensual: number;
  orden: number;
  activo: boolean;
}

export type TipoDescuentoPromocion = 'porcentaje' | 'monto_fijo';
export type CicloAplicablePromocion = 'mensual' | 'anual' | 'ambos';

export interface Promocion {
  id: number;
  nombre: string;
  codigo: string | null; // null = automática por temporada
  tipo_descuento: TipoDescuentoPromocion;
  valor: number;
  ciclo_aplicable: CicloAplicablePromocion;
  combinable_con_anual: boolean;
  solo_cuentas_nuevas: boolean;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
  usos_maximos: number | null;
  usos_maximos_por_cuenta: number | null;
  usos_actuales: number;
}

export interface Pago {
  id: number;
  fecha: string;
  usuario_id: number;
  monto_lista: number; // precio de plan sin descuento, para mostrar tachado
  monto: number; // lo que realmente se debe/se transfirió
  comprobante: string | null;
  estado: EstadoPago;
  motivo_rechazo: string | null;
  ciclo: CicloPago;
  fecha_expira: string | null;
  plan_id: number;
  plan: Plan;
  promocion_id: number | null;
  promocion: Promocion | null;
}

// Resultado de GET /api/cuenta/promociones/validar (también usado internamente
// por elegir-plan) — precio final ya calculado por el backend.
export interface PrecioPlan {
  plan: Plan;
  monto_lista: number;
  monto: number;
  promocion: Promocion | null;
}

export interface EstadoCuenta {
  plan: Plan | null;
  vigente_hasta: string | null; // null = plan gratuito, sin vencimiento
  dias_restantes: number | null;
  en_aviso: boolean;
  solo_lectura: boolean;
  limite_estudiantes: number | null;
  estudiantes_activos: number;
  limite_materias: number | null;
  materias_activas: number;
}

// E5: asistencia (HU-15/HU-16)
export type MarcajeAsistencia = 'puntual' | 'atrasado' | 'licencia' | 'falta';

export interface FilaListaAsistencia {
  inscripcion_id: number;
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  marcaje: MarcajeAsistencia | null;
}

export interface FilaConsolidadoAsistencia {
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  puntual: number;
  atrasado: number;
  licencia: number;
  falta: number;
  total_clases: number;
  porcentaje_asistencia: number;
}

// E6: evaluaciones de selección múltiple (HU-17/18/19)
export type EstadoEvaluacion = 'borrador' | 'lista' | 'lanzada' | 'finalizada';

export interface Evaluacion {
  id: number;
  tema: string;
  clase_id: number;
  nota: number;
  estado: EstadoEvaluacion;
  tiempo_limite_minutos: number | null;
  fecha_lanzamiento: string | null;
  publicada: boolean;
  fecha_publicacion: string | null;
  creado_en: string;
}

export interface Opcion {
  id: number;
  texto: string;
  pregunta_id: number;
  es_correcta: boolean;
}

export interface Pregunta {
  id: number;
  pregunta: string;
  url_imagen: string | null;
  evaluacion_id: number;
  orden: number;
  opciones: Opcion[];
}

export interface EvaluacionConPreguntas extends Evaluacion {
  preguntas: Pregunta[];
}

// Vista "Evaluaciones" a nivel materia (junto a "Código y nómina"): mezcla
// evaluaciones de todas las clases, así que cada una trae su clase.
export interface EvaluacionConClase extends Evaluacion {
  clase: {
    id: number;
    fecha: string;
    hora: string;
    tema: string;
  };
}

// "Reutilizar evaluación": todas las evaluaciones del docente en cualquiera
// de sus materias, con el dato de la materia — para el selector cross-materia.
export interface EvaluacionConMateria extends Evaluacion {
  clase: {
    id: number;
    fecha: string;
    hora: string;
    tema: string;
  };
  materia: {
    id: number;
    nombre_materia: string;
  };
}

export interface OpcionDemostracion {
  id: number;
  texto: string;
}

export interface PreguntaDemostracion {
  id: number;
  pregunta: string;
  url_imagen: string | null;
  opciones: OpcionDemostracion[];
}

export interface Demostracion {
  tema: string;
  nota: number;
  preguntas: PreguntaDemostracion[];
}

// Importar preguntas desde Word (.docx): plantilla fija + parser simple.
export interface PreguntaParseada {
  pregunta: string;
  opciones: { texto: string; es_correcta: boolean }[];
}

export interface ErrorParseoPregunta {
  bloque: string;
  motivo: string;
}

// E7: ejecución en vivo (HU-20 a HU-24)
export type EstadoIntento = 'en_curso' | 'pausado' | 'finalizado' | 'desconectado' | 'cancelado';

// E7 (lado estudiante) · "Rendir examen" — mismo shape que
// backend/src/domain/entidades/intento.ts (IntentoParaRendir): sin exponer
// es_correcta, orden ya barajado y propio del intento.
export interface OpcionParaRendir {
  id: number;
  texto: string;
}

export interface PreguntaParaRendir {
  id: number;
  pregunta: string;
  url_imagen: string | null;
  opciones: OpcionParaRendir[];
  opcion_elegida_id: number | null;
}

export interface IntentoParaRendir {
  intento_id: number;
  evaluacion_id: number;
  tema: string;
  nota: number;
  estado: EstadoIntento;
  fecha_limite: string | null;
  preguntas: PreguntaParaRendir[];
}

export interface FilaMonitoreo {
  intento_id: number;
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  estado: EstadoIntento;
  respondidas: number;
  total_preguntas: number;
  incidentes: number;
  fecha_inicio: string;
  fecha_limite: string | null;
}

// E8: resultados (HU-25), publicar notas (HU-26), centralizador (HU-27)
export interface FilaResultado {
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  aciertos: number;
  total_preguntas: number;
  nota_obtenida: number;
  incidentes: number;
}

export interface EstadisticasResultados {
  promedio: number;
  nota_maxima: number;
  nota_minima: number;
}

export interface Resultados {
  evaluacion_id: number;
  nota_total: number;
  filas: FilaResultado[];
  estadisticas: EstadisticasResultados;
}

// E8 (HU-25 detalle): "Ver examen" de un estudiante, para el docente.
export interface OpcionDetalle {
  id: number;
  texto: string;
  es_correcta: boolean;
}

export interface PreguntaDetalleIntento {
  id: number;
  pregunta: string;
  url_imagen: string | null;
  orden: number;
  opciones: OpcionDetalle[];
  opcion_elegida_id: number | null;
  acerto: boolean;
}

export interface DetalleIntento {
  intento_id: number;
  evaluacion_id: number;
  estudiante_id: number;
  preguntas: PreguntaDetalleIntento[];
}

// Fusión con guías (24/08): una columna es una evaluación finalizada o una
// guía cerrada — `id` es el evaluacion_id o guia_id según `tipo` (dos
// secuencias separadas, por eso la celda se indexa por clave compuesta,
// no por `id` solo). Ver claveColumnaCentralizador.
export type TipoColumnaCentralizador = 'evaluacion' | 'guia';

export interface ColumnaCentralizador {
  tipo: TipoColumnaCentralizador;
  id: number;
  tema: string;
  nota_total: number;
}

export function claveColumnaCentralizador(columna: {
  tipo: TipoColumnaCentralizador;
  id: number;
}): string {
  return `${columna.tipo}:${columna.id}`;
}

export interface FilaCentralizador {
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  celdas: Record<string, number | null>; // claveColumnaCentralizador(columna) -> nota_obtenida
}

export interface Centralizador {
  columnas: ColumnaCentralizador[];
  filas: FilaCentralizador[];
}

export interface SesionActiva {
  token: string;
  expira_en: string;
  contexto: Contexto;
  usuario: Usuario;
}

// Materia donde el estudiante está inscrito (GET /api/mi-espacio, contexto
// estudiante) — espejo de mobile/lib/features/materias/domain/entidades/materia_inscrita.dart
export interface MateriaInscrita {
  inscripcion_id: number;
  codigo_estudiante: string;
  fecha_inscripcion: string;
  materia: {
    id: number;
    nombre_materia: string;
    sigla: string | null;
    carrera: string;
    semestre: string;
    universidad: string;
    docente: { nombres: string; apellidos: string } | null;
  };
}

// Clases de HOY (13/08, GET /api/mi-espacio/clases-hoy) — dictadas e
// inscritas. Rediseño de Inicio (17/08, handoff 1b): se agregan los campos
// para el bloque "en curso"/"Resto del día"/"Ya pasó". `duracion_minutos`
// es un valor FIJO en el backend (Clase no tiene duración real todavía).
export interface ClaseDeHoy {
  clase_id: number;
  materia_id: number;
  nombre_materia: string;
  hora: string;
  tema: string;
  duracion_minutos: number;
  rol: 'dictada' | 'inscrita';
  total_estudiantes: number;
  asistencia_tomada: boolean;
  asistencia_resumen: { presentes: number; total: number } | null;
  tiene_evaluacion_abierta: boolean;
}

export interface ClasesDeHoy {
  dictadas: ClaseDeHoy[];
  inscritas: ClaseDeHoy[];
}

// Inicio (17/08) · panel "Requiere tu atención" (GET /api/mi-espacio/pendientes).
// Sin categoría "asistencia" en esta pasada (ver CONTEXTO.md).
export type TipoPendiente = 'evaluacion_abierta' | 'por_revisar';

export interface Pendiente {
  tipo: TipoPendiente;
  titulo: string;
  detalle: string;
  url: string;
}

// Guías de pre-clase (fusión con PaginaGuias, 05/08; guías nativas 16/08).
// "externa_legacy" = el modelo de siempre (link + booleano, sin nota ni
// intentos). Las demás son nativas: nacen "publicada", pasan a "lanzada"
// al lanzarse en clase, y a "cerrada" solo cuando todos los intentos
// oficiales terminan (no bloquea repasos, solo apaga el monitoreo en vivo).
export type EstadoGuia = 'publicada' | 'lanzada' | 'cerrada' | 'externa_legacy';

// Vista del estudiante. En "externa_legacy": `url_acceso` trae el link de
// siempre y `completado` es el booleano de siempre. En guías nativas,
// `url_acceso` viene vacío — el link real se pide con "Tomar la guía"
// (POST .../tomar), acotado a un intento puntual.
export interface Guia {
  id: number;
  tema: string;
  orden: number;
  url_acceso: string;
  completado: boolean;
  estado: EstadoGuia;
  nota: number | null;
  nota_obtenida: number | null;
  clase_id: number;
  clase_tema: string;
  clase_fecha: string;
}

// Vista del docente (GET /:id/clases/:claseId/guias, contexto docente): la
// guía + quién de la nómina abrió/completó (siempre) + su manifest de
// preguntas (nativas).
export interface FilaCompletadoGuia {
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  completado_en: string;
}

export type TipoGuiaPregunta = 'automatica' | 'abierta';

export interface GuiaPregunta {
  id: number;
  guia_id: number;
  referencia: string;
  tipo: TipoGuiaPregunta;
  respuesta_modelo: string | null;
  orden: number;
}

export interface GuiaDocente {
  id: number;
  clase_id: number;
  tema: string;
  url: string;
  orden: number;
  nota: number | null;
  estado: EstadoGuia;
  tiempo_limite_minutos: number | null;
  completados: FilaCompletadoGuia[];
  preguntas: GuiaPregunta[];
  /** Nivel 1 de detección de integración (17/08): resultado de la última
   * corrida de "Analizar link" — null = nunca se corrió (distinto de "no
   * se detectó"). Ver AnalizarGuiaExterna en el backend. */
  integracion_detectada: boolean | null;
  integracion_verificada_en: string | null;
}

// ── Guías nativas: ejecución en vivo ──────────────────────────────

export interface GuiaIntentoParaRendir {
  intento_id: number;
  guia_id: number;
  tema: string;
  url_acceso: string;
  estado: EstadoIntento;
  fecha_limite: string | null;
}

/** Fila del panel de monitoreo en vivo de una guía lanzada — mismo
 * espíritu que FilaMonitoreo de exámenes. */
export interface FilaMonitoreoGuia {
  intento_id: number;
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  estado: EstadoIntento;
  respondidas: number;
  total_preguntas: number;
  incidentes: number;
  fecha_inicio: string;
  fecha_limite: string | null;
}

/** Fila de resultados: nota oficial por estudiante (o pendiente de
 * revisión) + cuántos intentos totales hizo (oficial + repasos). */
export interface FilaResultadoGuia {
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  intento_id: number | null;
  estado_oficial: EstadoIntento | null;
  /** Cuántas de las preguntas contestó bien el oficial — null si todavía
   * no tiene intento oficial, o tiene abiertas sin revisar. */
  aciertos: number | null;
  total_preguntas: number;
  nota_obtenida: number | null;
  nota_total: number;
  total_intentos: number;
  incidentes: number;
}

/** Fila de la pantalla de revisión: una respuesta abierta pendiente. */
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
