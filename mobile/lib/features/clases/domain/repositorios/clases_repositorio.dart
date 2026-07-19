import '../entidades/clase.dart';

abstract class ClasesRepositorio {
  /// "Ver Clase" (diagrama E4, actor Estudiante): clases de una materia
  /// en la que el estudiante está inscrito. Orden: fecha, hora.
  Future<List<Clase>> listarPorMateria(int materiaId);
}
