// E7 · Servidor Socket.IO: autenticación con el mismo JWT de la API.
// Sala `estudiante:{id}` para push personal (evaluación lanzada,
// pausada, reactivada, cancelada) y sala `evaluacion:{id}` para el
// monitoreo en vivo del docente (progreso, incidentes, cambios de estado).

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { TokenService } from '../../domain/servicios/token-service';
import { SesionRepositorio } from '../../domain/repositorios/sesion-repositorio';
import { IntentoRepositorio } from '../../domain/repositorios/intento-repositorio';
import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { GuiaRepositorio } from '../../domain/repositorios/guia-repositorio';
import { ExamenCodigoRepositorio } from '../../domain/repositorios/examen-codigo-repositorio';
import { IntentoCodigoRepositorio } from '../../domain/repositorios/intento-codigo-repositorio';

interface Dependencias {
  tokenService: TokenService;
  sesionRepositorio: SesionRepositorio;
  intentoRepositorio: IntentoRepositorio;
  evaluacionRepositorio: EvaluacionRepositorio;
  claseRepositorio: ClaseRepositorio;
  materiaRepositorio: MateriaRepositorio;
  guiaRepositorio: GuiaRepositorio;
  examenCodigoRepositorio: ExamenCodigoRepositorio;
  intentoCodigoRepositorio: IntentoCodigoRepositorio;
}

export function crearServidorTiempoReal(
  httpServer: HttpServer,
  deps: Dependencias,
): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
    // Defaults de Socket.IO (25s/20s) tardaban hasta ~45s en notar una
    // desconexión real (sin evento `disconnect` limpio); lo bajamos para
    // que el panel de monitoreo del docente refleje el corte antes.
    pingInterval: 10000,
    pingTimeout: 8000,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('Falta token');

      const payload = deps.tokenService.verificar(token);
      const sesion = await deps.sesionRepositorio.buscarPorJti(payload.jti);
      if (!sesion || sesion.cerrada_en !== null || sesion.expira_en < new Date()) {
        throw new Error('Sesión inválida');
      }

      socket.data.auth = payload;
      next();
    } catch {
      next(new Error('No autorizado'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const auth = socket.data.auth as { sub: number; contexto: string };

    if (auth.contexto === 'estudiante') {
      socket.join(`estudiante:${auth.sub}`);

      // Reconexión (HU-21 Esc. 4): si estaba "desconectado", vuelve a en_curso.
      deps.intentoRepositorio.marcarConexion(auth.sub, true).then((intentos) => {
        for (const intento of intentos) {
          io.to(`evaluacion:${intento.evaluacion_id}`).emit('intento-actualizado', {
            intento_id: intento.id,
            estado: intento.estado,
          });
        }
      });
      // E9: mismo criterio para exámenes de código.
      deps.intentoCodigoRepositorio.marcarConexion(auth.sub, true).then((intentos) => {
        for (const intento of intentos) {
          io.to(`examen-codigo:${intento.examen_codigo_id}`).emit('intento-actualizado', {
            intento_id: intento.id,
            estado: intento.estado,
          });
        }
      });

      socket.on('disconnect', () => {
        deps.intentoRepositorio.marcarConexion(auth.sub, false).then((intentos) => {
          for (const intento of intentos) {
            io.to(`evaluacion:${intento.evaluacion_id}`).emit('intento-actualizado', {
              intento_id: intento.id,
              estado: intento.estado,
            });
          }
        });
        deps.intentoCodigoRepositorio.marcarConexion(auth.sub, false).then((intentos) => {
          for (const intento of intentos) {
            io.to(`examen-codigo:${intento.examen_codigo_id}`).emit('intento-actualizado', {
              intento_id: intento.id,
              estado: intento.estado,
            });
          }
        });
      });
    }

    if (auth.contexto === 'docente') {
      // El docente se une explícitamente a la sala de la evaluación que
      // está monitoreando, solo si de verdad le pertenece.
      socket.on('monitorear-evaluacion', async (evaluacionId: number) => {
        try {
          const evaluacion = await deps.evaluacionRepositorio.buscarPorId(Number(evaluacionId));
          if (!evaluacion) return;
          const clase = await deps.claseRepositorio.buscarPorId(evaluacion.clase_id);
          if (!clase) return;
          const materia = await deps.materiaRepositorio.buscarPorId(clase.materia_id);
          if (materia && materia.docente_id === auth.sub) {
            socket.join(`evaluacion:${evaluacionId}`);
          }
        } catch {
          // el docente simplemente no se une a la sala
        }
      });

      // Igual criterio, para quién va completando las guías de pre-clase
      // de una clase puntual (13/08).
      socket.on('monitorear-guias-clase', async (claseId: number) => {
        try {
          const clase = await deps.claseRepositorio.buscarPorId(Number(claseId));
          if (!clase) return;
          const materia = await deps.materiaRepositorio.buscarPorId(clase.materia_id);
          if (materia && materia.docente_id === auth.sub) {
            socket.join(`clase:${claseId}`);
          }
        } catch {
          // el docente simplemente no se une a la sala
        }
      });

      // Guías nativas (16/08): monitoreo en vivo de UNA guía lanzada
      // (progreso/incidentes por intento) — sala aparte de "clase:*"
      // arriba, que es solo el aviso liviano de "alguien completó".
      socket.on('monitorear-guia', async (guiaId: number) => {
        try {
          const guia = await deps.guiaRepositorio.buscarPorId(Number(guiaId));
          if (!guia) return;
          const clase = await deps.claseRepositorio.buscarPorId(guia.clase_id);
          if (!clase) return;
          const materia = await deps.materiaRepositorio.buscarPorId(clase.materia_id);
          if (materia && materia.docente_id === auth.sub) {
            socket.join(`guia:${guiaId}`);
          }
        } catch {
          // el docente simplemente no se une a la sala
        }
      });

      // E9: monitoreo en vivo de UN examen de código lanzado — mismo
      // criterio que 'monitorear-evaluacion'/'monitorear-guia'.
      socket.on('monitorear-examen-codigo', async (examenCodigoId: number) => {
        try {
          const examen = await deps.examenCodigoRepositorio.buscarPorId(Number(examenCodigoId));
          if (!examen) return;
          const clase = await deps.claseRepositorio.buscarPorId(examen.clase_id);
          if (!clase) return;
          const materia = await deps.materiaRepositorio.buscarPorId(clase.materia_id);
          if (materia && materia.docente_id === auth.sub) {
            socket.join(`examen-codigo:${examenCodigoId}`);
          }
        } catch {
          // el docente simplemente no se une a la sala
        }
      });
    }
  });

  return io;
}
