import '../../../core/api/api_cliente.dart';
import '../domain/entidades/mi_asistencia.dart';
import '../domain/repositorios/asistencia_repositorio.dart';

class AsistenciaRepositorioApi implements AsistenciaRepositorio {
  final ApiCliente api;

  AsistenciaRepositorioApi(this.api);

  @override
  Future<List<MiAsistencia>> listarPorMateria(int materiaId) async {
    final datos = await api.get('/api/materias/$materiaId/mi-asistencia');
    final lista = (datos['lista'] as List<dynamic>? ?? const []);
    return lista
        .map((e) => MiAsistencia.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
