import '../entidades/sesion.dart';
import '../entidades/usuario.dart';

abstract class AuthRepositorio {
  /// HU-01: login con contexto 'estudiante' explícito (D-03).
  Future<SesionActiva> iniciarSesion({
    required String email,
    required String password,
  });

  /// HU-02: registro self-service (rol dual docente_estudiante).
  Future<Usuario> registrar({
    required String nombres,
    required String apellidos,
    required String email,
    required String password,
    String? whatsapp,
  });
}
