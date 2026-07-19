import {
  FilaMonitoreo,
  Incidente,
  Intento,
  Respuesta,
  TipoIncidente,
} from '../entidades/intento';
import { FilaResultado, Nota } from '../entidades/nota';

export interface DatosNuevoIntento {
  evaluacion_id: number;
  estudiante_id: number;
  orden_preguntas: number[];
  orden_opciones: Record<string, number[]>;
  fecha_limite: Date | null;
}

export interface DatosNuevaNota {
  intento_id: number;
  evaluacion_id: number;
  estudiante_id: number;
  aciertos: number;
  total_preguntas: number;
  nota_obtenida: number;
}

export interface IntentoRepositorio {
  buscarPorId(id: number): Promise<Intento | null>;
  /** El intento vigente del estudiante (en_curso, pausado o desconectado), si tiene uno. */
  buscarActivoPorEstudiante(estudiante_id: number): Promise<Intento | null>;
  buscarPorEvaluacionYEstudiante(
    evaluacion_id: number,
    estudiante_id: number,
  ): Promise<Intento | null>;
  listarPorEvaluacion(evaluacion_id: number): Promise<Intento[]>;
  /** HU-22: fila lista para el panel de monitoreo (con nombre, progreso e incidentes). */
  listarPorEvaluacionConDetalle(evaluacion_id: number): Promise<FilaMonitoreo[]>;
  crear(datos: DatosNuevoIntento): Promise<Intento>;
  cambiarEstado(
    id: number,
    estado: Intento['estado'],
    datos?: { fecha_fin?: Date },
  ): Promise<Intento>;
  /** Marca conectado/desconectado los intentos activos de ese estudiante; devuelve los afectados. */
  marcarConexion(estudiante_id: number, conectado: boolean): Promise<Intento[]>;
  respuestasDe(intento_id: number): Promise<Respuesta[]>;
  /** Crea la respuesta o la corrige si ya existía para esa pregunta (D-06). */
  guardarRespuesta(intento_id: number, pregunta_id: number, opcion_id: number): Promise<Respuesta>;
  registrarIncidente(
    intento_id: number,
    tipo: TipoIncidente,
    detalle?: string,
  ): Promise<Incidente>;

  /** E8: autofinaliza (perezoso, como ExpirarMateriasVencidas) los intentos
   * en_curso/desconectado de la evaluación cuyo tiempo límite ya pasó. */
  finalizarVencidos(evaluacion_id: number): Promise<Intento[]>;
  /** E8 (HU-25): respuestas correctas guardadas en el intento. */
  contarAciertos(intento_id: number): Promise<number>;
  /** E8 (D-12): inserta una nueva versión, nunca actualiza una existente. */
  guardarNota(datos: DatosNuevaNota): Promise<Nota>;
  /** E8: última versión de la nota de ese intento, si ya se calculó. */
  notaVigentePorIntento(intento_id: number): Promise<Nota | null>;
  /** E8: última versión por estudiante, de todos los intentos de la evaluación. */
  notasVigentesPorEvaluacion(evaluacion_id: number): Promise<Nota[]>;
  /** E8 (HU-25): fila lista para la vista de resultados (nombre, nota vigente, incidentes). */
  listarResultados(evaluacion_id: number): Promise<FilaResultado[]>;
}
