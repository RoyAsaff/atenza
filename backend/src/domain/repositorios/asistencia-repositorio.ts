import { Asistencia, MarcajeAsistencia } from '../entidades/asistencia';

export interface DatosMarcaje {
  clase_id: number;
  estudiante_id: number;
  marcaje: MarcajeAsistencia;
}

export interface AsistenciaRepositorio {
  listarPorClase(clase_id: number): Promise<Asistencia[]>;
  /** Todas las asistencias de la materia (recorriendo sus clases), para el consolidado (HU-16). */
  listarPorMateria(materia_id: number): Promise<Asistencia[]>;
  /** Crea el registro si no existe o actualiza el marcaje si ya existía (HU-15 Esc. 2). */
  guardarVarias(datos: DatosMarcaje[]): Promise<Asistencia[]>;
}
