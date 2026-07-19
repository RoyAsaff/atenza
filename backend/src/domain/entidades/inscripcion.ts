// Entidad Inscripcion — en el diagrama de clases: estudiante_materia (E3)
// Campos extra acordados con Roy el 12/07 (pendiente reflejar en diagrama):
//   - codigo_estudiante pertenece a la inscripción, no a la cuenta (D-04)
//   - retirado + fecha_retiro: el retiro conserva el historial (HU-12)

export interface Inscripcion {
  id: number;
  estudiante_id: number;
  materia_id: number;
  codigo_estudiante: string;
  fecha_inscripcion: Date;
  retirado: boolean;
  fecha_retiro: Date | null;
}

/** Fila de la nómina del docente (HU-12): inscripción + datos del estudiante. */
export interface InscripcionConEstudiante extends Inscripcion {
  estudiante: {
    id: number;
    nombres: string;
    apellidos: string;
    email: string;
  };
}

/** Materia vista por el estudiante inscrito (HU-10, mi-espacio). */
export interface InscripcionConMateria extends Inscripcion {
  materia: {
    id: number;
    nombre_materia: string;
    sigla: string | null;
    carrera: string;
    semestre: string;
    universidad: string;
    docente: { nombres: string; apellidos: string };
  };
}
