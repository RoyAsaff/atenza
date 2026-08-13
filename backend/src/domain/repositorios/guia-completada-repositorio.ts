export interface DatosGuiaCompletada {
  guia_id: number;
  estudiante_id: number;
}

export interface FilaGuiaCompletada {
  guia_id: number;
  estudiante_id: number;
  completado_en: Date;
}

export interface GuiaCompletadaRepositorio {
  /** Idempotente: completar dos veces no duplica ni cambia la fecha de la primera vez. */
  marcarCompletada(datos: DatosGuiaCompletada): Promise<void>;
  /** Para armar la nómina del docente sobre varias guías de una clase a la vez. */
  listarPorGuias(guia_ids: number[]): Promise<FilaGuiaCompletada[]>;
  /** Para saber si el propio estudiante ya completó una guía puntual. */
  buscar(guia_id: number, estudiante_id: number): Promise<FilaGuiaCompletada | null>;
}
