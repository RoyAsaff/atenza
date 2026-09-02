import {
  FilaMonitoreoCodigo,
  IncidenteCodigo,
  IntentoCodigo,
  RespuestaCodigo,
  ResultadoCaso,
  TipoIncidenteCodigo,
} from '../entidades/intento-codigo';
import { FilaResultadoCodigo, NotaCodigo } from '../entidades/intento-codigo';

export interface DatosNuevoIntentoCodigo {
  examen_codigo_id: number;
  estudiante_id: number;
  orden_ejercicios: number[];
  fecha_limite: Date | null;
}

export interface DatosGuardarRespuestaCodigo {
  intento_id: number;
  ejercicio_id: number;
  codigo_fuente: string;
  casos_acertados: number;
  casos_totales: number;
  resultado_json: ResultadoCaso[];
}

export interface DatosNuevaNotaCodigo {
  intento_id: number;
  examen_codigo_id: number;
  estudiante_id: number;
  casos_acertados: number;
  casos_totales: number;
  nota_obtenida: number;
}

export interface IntentoCodigoRepositorio {
  buscarPorId(id: number): Promise<IntentoCodigo | null>;
  /** El intento vigente del estudiante (en_curso, pausado o desconectado), si tiene uno. */
  buscarActivoPorEstudiante(estudiante_id: number): Promise<IntentoCodigo | null>;
  buscarPorExamenYEstudiante(
    examen_codigo_id: number,
    estudiante_id: number,
  ): Promise<IntentoCodigo | null>;
  listarPorExamen(examen_codigo_id: number): Promise<IntentoCodigo[]>;
  listarPorExamenConDetalle(examen_codigo_id: number): Promise<FilaMonitoreoCodigo[]>;
  crear(datos: DatosNuevoIntentoCodigo): Promise<IntentoCodigo>;
  cambiarEstado(
    id: number,
    estado: IntentoCodigo['estado'],
    datos?: { fecha_fin?: Date },
  ): Promise<IntentoCodigo>;
  marcarConexion(estudiante_id: number, conectado: boolean): Promise<IntentoCodigo[]>;
  respuestasDe(intento_id: number): Promise<RespuestaCodigo[]>;
  /** Crea la respuesta o la corrige si ya existía para ese ejercicio (reenviar sobrescribe). */
  guardarRespuesta(datos: DatosGuardarRespuestaCodigo): Promise<RespuestaCodigo>;
  /** Monitoreo en vivo: conteo para el payload del evento 'progreso'. */
  contarEjerciciosEnviados(intento_id: number): Promise<number>;
  registrarIncidente(
    intento_id: number,
    tipo: TipoIncidenteCodigo,
    detalle?: string,
  ): Promise<IncidenteCodigo>;
  contarIncidentes(intento_id: number): Promise<number>;

  /** Autofinaliza (perezoso) los intentos en_curso/desconectado del examen cuyo tiempo límite ya pasó. */
  finalizarVencidos(examen_codigo_id: number): Promise<IntentoCodigo[]>;
  /** Barrido en segundo plano: igual que finalizarVencidos pero de todos los exámenes a la vez. */
  finalizarVencidosGlobal(): Promise<IntentoCodigo[]>;
  /** Suma de casos acertados/totales guardados en el intento (todas las respuestas). */
  contarCasos(intento_id: number): Promise<{ acertados: number; totales: number }>;
  /** D-12: inserta una nueva versión, nunca actualiza una existente. */
  guardarNota(datos: DatosNuevaNotaCodigo): Promise<NotaCodigo>;
  notaVigentePorIntento(intento_id: number): Promise<NotaCodigo | null>;
  notasVigentesPorExamen(examen_codigo_id: number): Promise<NotaCodigo[]>;
  listarResultados(examen_codigo_id: number): Promise<FilaResultadoCodigo[]>;
}
