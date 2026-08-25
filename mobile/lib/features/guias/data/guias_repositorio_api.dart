import '../../../core/api/api_cliente.dart';
import '../domain/entidades/guia.dart';
import '../domain/repositorios/guias_repositorio.dart';

class GuiasRepositorioApi implements GuiasRepositorio {
  final ApiCliente api;

  GuiasRepositorioApi(this.api);

  @override
  Future<List<Guia>> listarPorMateria(int materiaId) async {
    final datos = await api.get('/api/materias/$materiaId/guias');
    final guias = (datos['guias'] as List<dynamic>? ?? const []);
    return guias.map((e) => Guia.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<String> tomar(int materiaId, int guiaId) async {
    final datos = await api.post('/api/materias/$materiaId/guias/$guiaId/tomar');
    final intento = datos['intento'] as Map<String, dynamic>;
    return intento['url_acceso'] as String;
  }
}
