import '../entidades/materia_inscrita.dart';

abstract class MateriasRepositorio {
  /// HU-03/HU-10: materias donde la cuenta está inscrita como estudiante.
  Future<List<MateriaInscrita>> misMateriasInscritas();

  /// HU-10: unirse con el código de la materia + código de estudiante (D-04).
  Future<String> unirse({
    required String codigoMateria,
    required String codigoEstudiante,
  });

  /// Deslindar Materia (diagrama E3): salirse de la materia por cuenta
  /// propia. Retiro lógico: el historial se conserva.
  Future<void> deslindarse(int inscripcionId);
}
