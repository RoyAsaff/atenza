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

// SaaS por cuenta (17/07): reemplaza el pago por materia (E2) por una
// suscripción de cuenta con tramos por cantidad de estudiantes.

export type CicloPago = 'mensual' | 'anual';

export type EstadoPago =
  | 'pendiente'
  | 'en_verificacion'
  | 'aprobada'
  | 'rechazada'
  | 'expirada';

export interface Plan {
  id: number;
  nombre: string;
  limite_estudiantes: number | null; // null = Institucional, "a medida"
  monto_mensual: number;
  orden: number;
  activo: boolean;
}

export interface Pago {
  id: number;
  fecha: string;
  usuario_id: number;
  monto: number;
  comprobante: string | null;
  estado: EstadoPago;
  motivo_rechazo: string | null;
  ciclo: CicloPago;
  fecha_expira: string | null;
  plan_id: number;
  plan: Plan;
}

export interface EstadoCuenta {
  plan: Plan | null;
  vigente_hasta: string;
  dias_restantes: number;
  en_aviso: boolean;
  solo_lectura: boolean;
  limite_estudiantes: number | null;
  estudiantes_activos: number;
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

export interface ColumnaCentralizador {
  evaluacion_id: number;
  tema: string;
  nota_total: number;
}

export interface FilaCentralizador {
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  celdas: Record<number, number | null>;
  acumulado_obtenido: number;
  acumulado_total: number;
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
