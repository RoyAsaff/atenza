import '../../../core/api/api_cliente.dart';
import '../domain/entidades/sesion.dart';
import '../domain/entidades/usuario.dart';
import '../domain/repositorios/auth_repositorio.dart';

class AuthRepositorioApi implements AuthRepositorio {
  final ApiCliente api;

  AuthRepositorioApi(this.api);

  @override
  Future<SesionActiva> iniciarSesion({
    required String email,
    required String password,
  }) async {
    final datos = await api.post('/api/auth/login', {
      'email': email,
      'password': password,
      'contexto': 'estudiante', // D-03: sesión persistente de estudiante
    });
    return SesionActiva.fromJson(datos);
  }

  @override
  Future<Usuario> registrar({
    required String nombres,
    required String apellidos,
    required String email,
    required String password,
    String? whatsapp,
  }) async {
    final datos = await api.post('/api/auth/registro', {
      'nombres': nombres,
      'apellidos': apellidos,
      'email': email,
      'password': password,
      if (whatsapp != null && whatsapp.isNotEmpty) 'whatsapp': whatsapp,
    });
    return Usuario.fromJson(datos['usuario'] as Map<String, dynamic>);
  }
}
