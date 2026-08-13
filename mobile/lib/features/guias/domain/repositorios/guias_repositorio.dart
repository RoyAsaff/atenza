import '../entidades/guia.dart';

abstract class GuiasRepositorio {
  /// "Mis guías" de la materia completa (todas las clases, no una puntual)
  /// — mismo espíritu que ResultadosRepositorio.listarPorMateria.
  Future<List<Guia>> listarPorMateria(int materiaId);
}
