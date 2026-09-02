// E9 (01/09) · Ejecución en vivo de exámenes de código. Calcado de
// intento.ts (E7) + nota.ts (E8) — reusa el enum EstadoIntento (mismo
// ciclo de vida en_curso/pausado/finalizado/desconectado/cancelado).

import { EstadoIntento } from './intento';

export type TipoIncidenteCodigo = 'perdida_foco' | 'ventana_minimizada' | 'intento_cierre';

export interface IntentoCodigo {
  id: number;
  examen_codigo_id: number;
  estudiante_id: number;
  estado: EstadoIntento;
  /** Orden barajado de Ejercicio.id, fijo desde que se lanza. */
  orden_ejercicios: number[];
  fecha_inicio: Date;
  fecha_limite: Date | null;
  fecha_fin: Date | null;
}

/** Detalle por caso de prueba de una corrida (Ejecutar o Enviar) — lo que
 * vive en RespuestaCodigo.resultado_json. `stdout`/`stderr` truncados por
 * el ejecutor antes de guardar (ver ejecutor-codigo.ts). */
export interface ResultadoCaso {
  caso_id: number;
  paso: boolean;
  stdout: string;
  stderr: string;
  tiempo_ms: number;
}

export interface RespuestaCodigo {
  id: number;
  intento_id: number;
  ejercicio_id: number;
  codigo_fuente: string;
  casos_acertados: number;
  casos_totales: number;
  resultado_json: ResultadoCaso[];
  respondida_en: Date;
}

export interface IncidenteCodigo {
  id: number;
  intento_id: number;
  tipo: TipoIncidenteCodigo;
  detalle: string | null;
  fecha_hora: Date;
}

/** Fila del panel de monitoreo en vivo del docente. */
export interface FilaMonitoreoCodigo {
  intento_id: number;
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  estado: EstadoIntento;
  ejercicios_enviados: number;
  total_ejercicios: number;
  incidentes: number;
  fecha_inicio: Date;
  fecha_limite: Date | null;
}

// ── Vista del estudiante rindiendo (desktop) ────────────────────────

/** Caso de prueba visible: el estudiante puede probar contra él en
 * "Ejecutar" antes de enviar — nunca se exponen los ocultos. */
export interface CasoParaRendir {
  id: number;
  entrada: string;
  salida_esperada: string;
}

export interface EjercicioParaRendir {
  id: number;
  enunciado: string;
  plantilla_codigo: string | null;
  orden: number;
  casos_visibles: CasoParaRendir[];
  /** Incluye los ocultos — el estudiante sabe cuántos casos corren al
   * enviar, aunque no vea su contenido. */
  total_casos: number;
  /** Último código guardado (por "Ejecutar" o "Enviar"), para reanudar. */
  ultimo_codigo: string | null;
  /** Resultado de la última corrida, si la hay (para repintar el panel de
   * pruebas al reanudar sin que el estudiante tenga que volver a correr). */
  ultimo_resultado: ResultadoCaso[] | null;
}

export interface IntentoCodigoParaRendir {
  intento_id: number;
  examen_codigo_id: number;
  tema: string;
  nota: number;
  estado: EstadoIntento;
  fecha_limite: Date | null;
  ejercicios: EjercicioParaRendir[];
}

/** Respuesta de "Enviar" (POST .../enviar): cuenta real de casos acertados/
 * totales (incluye ocultos, para que el estudiante sepa su avance), pero el
 * detalle caso por caso solo trae los visibles — nunca se expone stdin/
 * stdout/stderr de un caso oculto, ni siquiera al estudiante dueño del intento. */
export interface ResultadoEnvio {
  casos_acertados: number;
  casos_totales: number;
  resultados_visibles: ResultadoCaso[];
}

// ── HU-25-equivalente · "Ver examen" del docente ────────────────────

export interface EjercicioConRespuesta {
  id: number;
  enunciado: string;
  orden: number;
  codigo_fuente: string | null;
  casos_acertados: number;
  casos_totales: number;
  resultado_json: ResultadoCaso[] | null;
}

export interface DetalleIntentoCodigo {
  intento_id: number;
  examen_codigo_id: number;
  estudiante_id: number;
  ejercicios: EjercicioConRespuesta[];
}

// ── Nota (D-12: insert-only, versionado — igual Nota de E8) ─────────

export interface NotaCodigo {
  id: number;
  intento_id: number;
  examen_codigo_id: number;
  estudiante_id: number;
  version: number;
  casos_acertados: number;
  casos_totales: number;
  nota_obtenida: number;
  calculada_en: Date;
}

export interface FilaResultadoCodigo {
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  casos_acertados: number;
  casos_totales: number;
  nota_obtenida: number;
  incidentes: number;
}

export interface EstadisticasResultadosCodigo {
  promedio: number;
  nota_maxima: number;
  nota_minima: number;
}

export interface ResultadosCodigo {
  examen_codigo_id: number;
  nota_total: number;
  filas: FilaResultadoCodigo[];
  estadisticas: EstadisticasResultadosCodigo;
}

/** "Mis notas" del estudiante — solo exámenes de código publicados. */
export interface FilaMiNotaCodigo {
  examen_codigo_id: number;
  tema: string;
  nota_total: number;
  casos_acertados: number;
  casos_totales: number;
  nota_obtenida: number;
  fecha_publicacion: Date;
}
