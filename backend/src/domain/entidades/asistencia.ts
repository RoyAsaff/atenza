// Entidad Asistencia según el diagrama de clases (E5)

export type MarcajeAsistencia = 'puntual' | 'atrasado' | 'licencia' | 'falta';

export interface Asistencia {
  id: number;
  clase_id: number;
  estudiante_id: number;
  marcaje: MarcajeAsistencia;
}

/** Fila de la lista para pasar asistencia (HU-15): estudiante de la nómina
 * y su marcaje actual, o null si esa clase aún no se guardó. */
export interface FilaListaAsistencia {
  inscripcion_id: number;
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  marcaje: MarcajeAsistencia | null;
}

/** Fila del consolidado por materia (HU-16). */
export interface FilaConsolidadoAsistencia {
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  puntual: number;
  atrasado: number;
  licencia: number;
  falta: number;
  total_clases: number; // clases de la materia con asistencia ya registrada
  porcentaje_asistencia: number; // (puntual + atrasado) / total_clases * 100
}

/** Fila del historial propio del estudiante (diagrama, actor Estudiante: Ver Asistencias). */
export interface FilaMiAsistencia {
  clase_id: number;
  fecha: Date;
  hora: string;
  tema: string;
  marcaje: MarcajeAsistencia;
}
