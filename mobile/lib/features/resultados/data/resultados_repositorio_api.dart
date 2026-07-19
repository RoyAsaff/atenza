import '../../../core/api/api_cliente.dart';
import '../domain/entidades/detalle_intento.dart';
import '../domain/entidades/mi_nota.dart';
import '../domain/repositorios/resultados_repositorio.dart';

class ResultadosRepositorioApi implements ResultadosRepositorio {
  final ApiCliente api;

  ResultadosRepositorioApi(this.api);

  @override
  Future<List<MiNota>> listarPorMateria(int materiaId) async {
    final datos = await api.get('/api/materias/$materiaId/mis-notas');
    final notas = (datos['notas'] as List<dynamic>? ?? const []);
    return notas.map((e) => MiNota.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<DetalleIntento> verDetalle(int materiaId, int evaluacionId) async {
    final datos = await api
        .get('/api/materias/$materiaId/evaluaciones/$evaluacionId/mi-detalle');
    return DetalleIntento.fromJson(datos['detalle'] as Map<String, dynamic>);
  }
}
