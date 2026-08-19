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

  // Rediseño de "rendir examen" (ver design_handoff_rendir_examen):
  // `/api/intentos/actual` deja de devolver el intento en cuanto termina
  // (finalizado/cancelado) — si main.dart decidiera mostrar ExamenPage
  // solo mientras `intento != null`, la pantalla de cierre (enviado/
  // cancelado) nunca llegaría a verse, igual que pasaba en la web antes
  // del rediseño. Este flag mantiene ExamenPage montada hasta que el
  // propio estudiante acepte esa pantalla — ver
  // ExamenPage._marcarEnviado/_marcarCancelado y main.dart::_Raiz.
  bool mostrarPantallaFinal = false;

  // Señal para que ExamenPage detecte 'examen-cancelado' sin depender de
  // releer `intento.estado` (puede llegar null antes de que le dé tiempo
  // a leerlo, por la misma exclusión de arriba).
  int _senalCancelado = 0;
  int get senalCancelado => _senalCancelado;

  Future<void> conectar(String token) async {
    if (_conectado) return;
    _conectado = true;
    _socket.conectar(
      token: token,
      alEvento: (evento) {
        if (evento == 'examen-cancelado') _senalCancelado++;
        refrescar();
      },
    );
    await refrescar();
  }

  void desconectar() {
    _conectado = false;
    _socket.desconectar();
    intento = null;
    mostrarPantallaFinal = false;
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

  /// ExamenPage ya sabe localmente que el examen terminó (enviado o
  /// cancelado), antes de que el próximo refresco lo confirme del lado del
  /// servidor. Sin esto, en cuanto `intento` volviera a null la app
  /// saltaría directo a MisMateriasPage sin mostrar el cierre.
  void marcarPantallaFinal() {
    if (mostrarPantallaFinal) return;
    mostrarPantallaFinal = true;
    notifyListeners();
  }

  /// El estudiante ya vio la pantalla de cierre (finalizado/cancelado):
  /// vuelve a la app normal.
  void cerrarVistaFinal() {
    intento = null;
    mostrarPantallaFinal = false;
    notifyListeners();
  }
}
