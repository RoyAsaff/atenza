import '../../../core/api/api_cliente.dart';
import '../domain/entidades/materia_inscrita.dart';
import '../domain/repositorios/materias_repositorio.dart';

class MateriasRepositorioApi implements MateriasRepositorio {
  final ApiCliente api;

  MateriasRepositorioApi(this.api);

  @override
  Future<List<MateriaInscrita>> misMateriasInscritas() async {
    final datos = await api.get('/api/mi-espacio');
    final lista = (datos['materias_inscrito'] as List<dynamic>? ?? const []);
    return lista
        .map((e) => MateriaInscrita.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<String> unirse({
    required String codigoMateria,
    required String codigoEstudiante,
  }) async {
    final datos = await api.post('/api/inscripciones', {
      'codigo_materia': codigoMateria,
      'codigo_estudiante': codigoEstudiante,
    });
    final materia = datos['materia'] as Map<String, dynamic>;
    return materia['nombre_materia'] as String;
  }

  @override
  Future<void> deslindarse(int inscripcionId) async {
    await api.post('/api/inscripciones/$inscripcionId/deslindar');
  }
}
