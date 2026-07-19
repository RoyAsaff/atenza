// Cliente HTTP: agrega el Bearer token y traduce las respuestas de error
// del backend a ApiException (espejo de web/src/core/api/cliente.ts).

import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../errores.dart';

/// Emulador Android: 10.0.2.2 apunta al localhost de la PC.
/// Teléfono físico: flutter run --dart-define=API_URL=http://IP_DE_TU_PC:3000
const String apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://10.0.2.2:3000',
);

class ApiCliente {
  final http.Client _http;

  /// Devuelve el token vigente (lo provee el AuthController).
  String? Function() obtenerToken;

  /// Se invoca cuando la API responde 401 (sesión cerrada o expirada).
  void Function()? alExpirarSesion;

  ApiCliente({http.Client? cliente, required this.obtenerToken})
      : _http = cliente ?? http.Client();

  Future<Map<String, dynamic>> get(String ruta) => _enviar('GET', ruta);

  Future<Map<String, dynamic>> post(String ruta, [Object? cuerpo]) =>
      _enviar('POST', ruta, cuerpo);

  Future<Map<String, dynamic>> _enviar(
    String metodo,
    String ruta, [
    Object? cuerpo,
  ]) async {
    final uri = Uri.parse('$apiUrl$ruta');
    final token = obtenerToken();
    final cabeceras = {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };

    http.Response respuesta;
    try {
      respuesta = switch (metodo) {
        'POST' => await _http.post(uri,
            headers: cabeceras, body: jsonEncode(cuerpo ?? const {})),
        _ => await _http.get(uri, headers: cabeceras),
      };
    } on SocketException {
      throw SinConexionException();
    } on http.ClientException {
      throw SinConexionException();
    }

    if (respuesta.statusCode == 204) return const {};

    final Map<String, dynamic> datos = respuesta.body.isEmpty
        ? const {}
        : jsonDecode(utf8.decode(respuesta.bodyBytes)) as Map<String, dynamic>;

    if (respuesta.statusCode >= 400) {
      final codigo = (datos['error'] as String?) ?? 'ERROR';
      final mensaje = (datos['mensaje'] as String?) ??
          _mensajeDeValidacion(datos) ??
          'Ocurrió un error inesperado';
      final excepcion = ApiException(respuesta.statusCode, codigo, mensaje);
      if (excepcion.esSesionInvalida) alExpirarSesion?.call();
      throw excepcion;
    }

    return datos;
  }

  /// Errores de Zod: {error: DATOS_INVALIDOS, detalles: [{campo, mensaje}]}
  String? _mensajeDeValidacion(Map<String, dynamic> datos) {
    final detalles = datos['detalles'];
    if (detalles is List && detalles.isNotEmpty) {
      final primero = detalles.first;
      if (primero is Map && primero['mensaje'] is String) {
        return primero['mensaje'] as String;
      }
    }
    return null;
  }
}
