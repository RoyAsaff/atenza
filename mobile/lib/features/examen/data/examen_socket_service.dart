// E7 · Cliente Socket.IO (push de "evaluación lanzada", pausada,
// reactivada o cancelada). Un solo socket para toda la sesión.

import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/api/api_cliente.dart';

const _eventosEscuchados = [
  'evaluacion-lanzada',
  'examen-pausado',
  'examen-reactivado',
  'examen-cancelado',
  'intento-actualizado',
];

class ExamenSocketService {
  io.Socket? _socket;

  void conectar({required String token, required void Function(String evento) alEvento}) {
    _socket?.dispose();
    _socket = io.io(
      apiUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setPath('/socket.io')
          .setAuth({'token': token})
          .enableForceNew()
          .build(),
    );
    for (final evento in _eventosEscuchados) {
      _socket!.on(evento, (_) => alEvento(evento));
    }
    _socket!.connect();
  }

  void desconectar() {
    _socket?.dispose();
    _socket = null;
  }
}
