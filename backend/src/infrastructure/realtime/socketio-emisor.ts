import { Server as SocketIOServer } from 'socket.io';
import { TiempoRealEmisor } from '../../domain/repositorios/tiempo-real';

/**
 * Implementación de TiempoRealEmisor sobre Socket.IO. Se instancia sin
 * `io` (composición raíz en dependencias.ts) y se conecta después,
 * cuando index.ts crea el servidor HTTP + Socket.IO — evita el ciclo
 * "dependencias necesita io, io necesita el app que depende de rutas
 * que dependen de dependencias".
 */
export class SocketIoEmisor implements TiempoRealEmisor {
  private io: SocketIOServer | null = null;

  conectar(io: SocketIOServer): void {
    this.io = io;
  }

  emitirAEstudiante(estudianteId: number, evento: string, datos: unknown): void {
    this.io?.to(`estudiante:${estudianteId}`).emit(evento, datos);
  }

  emitirAEvaluacion(evaluacionId: number, evento: string, datos: unknown): void {
    this.io?.to(`evaluacion:${evaluacionId}`).emit(evento, datos);
  }
}
