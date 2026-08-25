import '../entidades/guia.dart';

abstract class GuiasRepositorio {
  /// "Mis guías" de la materia completa (todas las clases, no una puntual)
  /// — mismo espíritu que ResultadosRepositorio.listarPorMateria.
  Future<List<Guia>> listarPorMateria(int materiaId);

  /// Inicia o reanuda el intento y devuelve la url_acceso real, con el
  /// token firmado — espejo de POST .../tomar en TomarGuiaPage.tsx (web).
  /// El listado de listarPorMateria trae url_acceso vacío a propósito
  /// para guías nativas (ver gestionar-guias.ts, armarEstadoNativa): el
  /// link real solo se pide acá, recién cuando el estudiante va a entrar.
  Future<String> tomar(int materiaId, int guiaId);
}
