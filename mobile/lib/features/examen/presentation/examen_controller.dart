// E7 · Controla si hay un examen lanzado/en curso para este estudiante.
// Mientras `intento` no sea null, main.dart muestra ExamenPage en modo
// kiosco en vez de la app normal (bloqueo hasta enviar, HU-21 Esc. 1).

import 'package:flutter/foundation.dart';

import '../data/examen_socket_service.dart';
import '../domain/entidades/intento.dart';
import '../domain/repositorios/examen_repositorio.dart';

class ExamenController extends ChangeNotifier {
  final ExamenRepositorio _repo;
  final ExamenSocketService _socket;

  ExamenController(this._repo, this._socket);

  IntentoParaRendir? intento;
  bool _conectado = false;

  Future<void> conectar(String token) async {
    if (_conectado) return;
    _conectado = true;
    _socket.conectar(token: token, alEvento: (_) => refrescar());
    await refrescar();
  }

  void desconectar() {
    _conectado = false;
    _socket.desconectar();
    intento = null;
    notifyListeners();
  }

  Future<void> refrescar() async {
    try {
      intento = await _repo.obtenerIntentoActual();
    } catch (_) {
      // Sin conexión momentánea: se reintenta en el próximo evento/refresh.
    }
    notifyListeners();
  }

  /// El estudiante ya vio la pantalla de cierre (finalizado/cancelado):
  /// vuelve a la app normal.
  void cerrarVistaFinal() {
    intento = null;
    notifyListeners();
  }
}
