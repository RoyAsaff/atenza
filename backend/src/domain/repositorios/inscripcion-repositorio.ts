import {
  Inscripcion,
  InscripcionConEstudiante,
  InscripcionConMateria,
} from '../entidades/inscripcion';

export interface DatosNuevaInscripcion {
  estudiante_id: number;
  materia_id: number;
  codigo_estudiante: string;
}

export interface InscripcionRepositorio {
  buscarPorId(id: number): Promise<Inscripcion | null>;
  buscarPorEstudianteYMateria(
    estudiante_id: number,
    materia_id: number,
  ): Promise<Inscripcion | null>;
  crear(datos: DatosNuevaInscripcion): Promise<Inscripcion>;
  /** HU-10 Esc. 2: quien fue retirado y vuelve a usar el código, se reactiva. */
  reactivar(id: number, codigo_estudiante: string): Promise<Inscripcion>;
  /** HU-12: nómina ordenada por apellidos, con búsqueda; solo inscritos activos. */
  listarPorMateria(
    materia_id: number,
    buscar?: string,
  ): Promise<InscripcionConEstudiante[]>;
  /** HU-10 / HU-03: materias donde el estudiante está inscrito (activas). */
  listarPorEstudiante(estudiante_id: number): Promise<InscripcionConMateria[]>;
  /** HU-12: retiro lógico — conserva el historial. */
  retirar(id: number): Promise<Inscripcion>;
  /**
   * SaaS por cuenta (17/07): cuenta en vivo de estudiantes activos (no
   * retirados) en TODAS las materias del docente — es lo que se compara
   * contra `Plan.limite_estudiantes` al inscribir a alguien nuevo.
   */
  contarActivasPorDocente(docente_id: number): Promise<number>;
}
