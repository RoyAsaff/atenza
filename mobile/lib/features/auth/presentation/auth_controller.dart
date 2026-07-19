// Estado de autenticación: restaura la sesión persistida al arrancar
// (HU-01 Esc. 4) y la guarda tras cada login.

import 'package:flutter/foundation.dart';

import '../../../core/sesion/almacen_sesion.dart';
import '../domain/entidades/sesion.dart';
import '../domain/repositorios/auth_repositorio.dart';

enum EstadoAuth { cargando, sinSesion, autenticado }

class AuthController extends ChangeNotifier {
  final AuthRepositorio _auth;
  final AlmacenSesion _almacen;

  EstadoAuth estado = EstadoAuth.cargando;
  SesionActiva? sesion;

  AuthController(this._auth, this._almacen);

  String? get token => sesion?.token;

  Future<void> restaurarSesion() async {
    sesion = await _almacen.leer();
    estado = sesion == null ? EstadoAuth.sinSesion : EstadoAuth.autenticado;
    notifyListeners();
  }

  Future<void> iniciarSesion(String email, String password) async {
    final nueva = await _auth.iniciarSesion(email: email, password: password);
    sesion = nueva;
    estado = EstadoAuth.autenticado;
    await _almacen.guardar(nueva);
    notifyListeners();
  }

  Future<void> registrar({
    required String nombres,
    required String apellidos,
    required String email,
    required String password,
    String? whatsapp,
  }) async {
    await _auth.registrar(
      nombres: nombres,
      apellidos: apellidos,
      email: email,
      password: password,
      whatsapp: whatsapp,
    );
    // HU-02 Esc. 1: la cuenta queda lista para iniciar sesión de inmediato
    await iniciarSesion(email, password);
  }

  Future<void> cerrarSesion() async {
    sesion = null;
    estado = EstadoAuth.sinSesion;
    await _almacen.borrar();
    notifyListeners();
  }

  /// Invocado por el ApiCliente ante un 401 (sesión cerrada o expirada).
  void sesionExpirada() {
    if (estado == EstadoAuth.autenticado) {
      cerrarSesion();
    }
  }
}
