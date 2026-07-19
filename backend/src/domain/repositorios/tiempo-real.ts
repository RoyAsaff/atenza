// E7 · Puerto de salida hacia el servidor de tiempo real (Socket.IO en
// infrastructure/realtime). Los casos de uso dependen de esta interfaz,
// no de la librería, igual que con los demás repositorios.

export interface TiempoRealEmisor {
  /** A un estudiante puntual (evaluación lanzada, pausada, reactivada, cancelada). */
  emitirAEstudiante(estudianteId: number, evento: string, datos: unknown): void;
  /** A quienes monitorean una evaluación (docente): progreso, incidentes, cambios de estado. */
  emitirAEvaluacion(evaluacionId: number, evento: string, datos: unknown): void;
}
