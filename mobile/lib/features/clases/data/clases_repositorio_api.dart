import '../../../core/api/api_cliente.dart';
import '../domain/entidades/clase.dart';
import '../domain/repositorios/clases_repositorio.dart';

class ClasesRepositorioApi implements ClasesRepositorio {
  final ApiCliente api;

  ClasesRepositorioApi(this.api);

  @override
  Future<List<Clase>> listarPorMateria(int materiaId) async {
    final datos = await api.get('/api/materias/$materiaId/clases');
    final lista = (datos['clases'] as List<dynamic>? ?? const []);
    return lista.map((e) => Clase.fromJson(e as Map<String, dynamic>)).toList();
  }
}
