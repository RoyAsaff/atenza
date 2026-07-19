// Materia donde el estudiante está inscrito (GET /api/mi-espacio, E3)

class MateriaInscrita {
  final int inscripcionId;
  final String codigoEstudiante; // D-04: pertenece a la inscripción
  final DateTime fechaInscripcion;
  final int materiaId;
  final String nombreMateria;
  final String? sigla;
  final String carrera;
  final String semestre;
  final String universidad;
  final String docente;

  const MateriaInscrita({
    required this.inscripcionId,
    required this.codigoEstudiante,
    required this.fechaInscripcion,
    required this.materiaId,
    required this.nombreMateria,
    this.sigla,
    required this.carrera,
    required this.semestre,
    required this.universidad,
    required this.docente,
  });

  factory MateriaInscrita.fromJson(Map<String, dynamic> json) {
    final materia = json['materia'] as Map<String, dynamic>;
    final docente = materia['docente'] as Map<String, dynamic>?;
    return MateriaInscrita(
      inscripcionId: json['inscripcion_id'] as int,
      codigoEstudiante: json['codigo_estudiante'] as String,
      fechaInscripcion: DateTime.parse(json['fecha_inscripcion'] as String),
      materiaId: materia['id'] as int,
      nombreMateria: materia['nombre_materia'] as String,
      sigla: materia['sigla'] as String?,
      carrera: materia['carrera'] as String,
      semestre: materia['semestre'] as String,
      universidad: materia['universidad'] as String,
      docente: docente == null
          ? ''
          : '${docente['nombres']} ${docente['apellidos']}',
    );
  }
}
