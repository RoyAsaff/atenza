import '../entidades/detalle_intento.dart';
import '../entidades/mi_nota.dart';

abstract class ResultadosRepositorio {
  /// HU-26 Esc. 1/2: solo evaluaciones ya publicadas por el docente.
  Future<List<MiNota>> listarPorMateria(int materiaId);

  /// HU-25/26 (detalle) · "Ver examen": qué respondió el estudiante
  /// en cada pregunta y si acertó.
  Future<DetalleIntento> verDetalle(int materiaId, int evaluacionId);
}
