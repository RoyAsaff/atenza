import '../entidades/mi_asistencia.dart';

abstract class AsistenciaRepositorio {
  /// Diagrama E5 (actor Estudiante): Ver Asistencias — historial propio
  /// por materia (solo clases donde el docente ya pasó lista).
  Future<List<MiAsistencia>> listarPorMateria(int materiaId);
}
