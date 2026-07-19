// E7 · Cliente Socket.IO (monitoreo en vivo del docente). Un solo socket
// por pestaña, autenticado con el mismo JWT de la sesión.

import { io, Socket } from 'socket.io-client';
import { obtenerSesion } from '../auth/almacen-sesion';

let socket: Socket | null = null;

export function obtenerSocket(): Socket {
  if (socket) return socket;
  const sesion = obtenerSesion();
  socket = io({
    path: '/socket.io',
    auth: { token: sesion?.token },
  });
  return socket;
}
