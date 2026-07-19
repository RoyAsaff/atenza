import { Clase } from '../entidades/clase';

export interface DatosNuevaClase {
  materia_id: number;
  fecha: Date;
  hora: string; // "HH:MM"
  tema: string;
}

export interface ClaseRepositorio {
  buscarPorId(id: number): Promise<Clase | null>;
  /** Para validar el choque materia+fecha+hora antes de crear/editar. */
  buscarPorMateriaFechaHora(
    materia_id: number,
    fecha: Date,
    hora: string,
  ): Promise<Clase | null>;
  listarPorMateria(materia_id: number): Promise<Clase[]>; // orden fecha, hora
  crear(datos: DatosNuevaClase): Promise<Clase>;
  /**
   * HU-14: creación masiva del calendario. Omite las que colisionan con
   * una clase existente (misma materia, fecha y hora) y devuelve solo
   * las realmente creadas.
   */
  crearVarias(datos: DatosNuevaClase[]): Promise<Clase[]>;
  actualizar(
    id: number,
    datos: { fecha?: Date; hora?: string; tema?: string },
  ): Promise<Clase>;
  eliminar(id: number): Promise<void>;
}
