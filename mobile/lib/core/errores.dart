/// Error de la API con el código y mensaje que devuelve el backend
/// (espejo de manejar-errores.ts).
class ApiException implements Exception {
  final int status;
  final String codigo; // p. ej. YA_INSCRITO, CODIGO_MATERIA_INVALIDO
  final String mensaje;

  ApiException(this.status, this.codigo, this.mensaje);

  bool get esSesionInvalida => status == 401;

  @override
  String toString() => mensaje;
}

class SinConexionException implements Exception {
  @override
  String toString() => 'No se pudo conectar con el servidor';
}
