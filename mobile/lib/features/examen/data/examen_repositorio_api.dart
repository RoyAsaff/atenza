import '../../../core/api/api_cliente.dart';
import '../domain/entidades/intento.dart';
import '../domain/repositorios/examen_repositorio.dart';

class ExamenRepositorioApi implements ExamenRepositorio {
  final ApiCliente api;

  ExamenRepositorioApi(this.api);

  @override
  Future<IntentoParaRendir?> obtenerIntentoActual() async {
    final datos = await api.get('/api/intentos/actual');
    final intento = datos['intento'];
    if (intento == null) return null;
    return IntentoParaRendir.fromJson(intento as Map<String, dynamic>);
  }

  @override
  Future<void> guardarRespuesta(int intentoId, int preguntaId, int opcionId) {
    return api.post('/api/intentos/$intentoId/respuestas', {
      'pregunta_id': preguntaId,
      'opcion_id': opcionId,
    });
  }

  @override
  Future<void> reportarIncidente(int intentoId, {String? detalle}) {
    return api.post('/api/intentos/$intentoId/incidente', {
      'tipo': 'salida_pantalla',
      if (detalle != null) 'detalle': detalle,
    });
  }

  @override
  Future<void> finalizar(int intentoId) {
    return api.post('/api/intentos/$intentoId/finalizar');
  }
}
