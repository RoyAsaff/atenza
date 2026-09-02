// Cliente Socket.IO — calcado de web/src/core/realtime/socket.ts. Escucha
// los mismos eventos que ExamenSocketService en mobile
// (mobile/lib/features/examen/data/examen_socket_service.dart), adaptados
// a la sala `examen-codigo:{id}` (ver servidor-tiempo-real.ts): un solo
// socket para toda la sesión de la app.

import { io, Socket } from 'socket.io-client';
import { API_URL } from '../api/cliente';
import { sesionActual } from '../auth/sesion-store';

let socket: Socket | null = null;

export function obtenerSocket(): Socket {
  if (socket) return socket;
  socket = io(API_URL, {
    path: '/socket.io',
    auth: { token: sesionActual()?.token },
  });
  return socket;
}

export function cerrarSocket(): void {
  socket?.disconnect();
  socket = null;
}
