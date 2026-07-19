import { Materia } from '../entidades/materia';

export interface DatosNuevaMateria {
  nombre_materia: string;
  sigla?: string;
  carrera: string;
  semestre: string;
  universidad: string;
  docente_id: number;
}

export interface MateriaRepositorio {
  listarPorDocente(docente_id: number): Promise<Materia[]>;
  buscarPorId(id: number): Promise<Materia | null>;
  /** HU-10: localizar la materia por su código de inscripción. */
  buscarPorCodigo(codigo: string): Promise<Materia | null>;
  /** SaaS por cuenta (17/07): crea la materia directamente, sin pago propio. */
  crear(datos: DatosNuevaMateria): Promise<Materia>;
  /** HU-11: genera un código nuevo (invalida el anterior) y lo devuelve. */
  regenerarCodigo(id: number): Promise<string>;
  /** HU-11: abre o cierra las inscripciones sin cambiar el código. */
  establecerCodigoActivo(id: number, activo: boolean): Promise<void>;
  listar(buscar?: string): Promise<Materia[]>;
}
