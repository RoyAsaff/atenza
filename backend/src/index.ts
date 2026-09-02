import 'dotenv/config';
import { createServer } from 'http';
import { createApp } from './presentation/app';
import { crearServidorTiempoReal } from './infrastructure/realtime/servidor-tiempo-real';
import {
  barrerVencimientos,
  claseRepositorio,
  evaluacionRepositorio,
  examenCodigoRepositorio,
  guiaRepositorio,
  intentoCodigoRepositorio,
  intentoRepositorio,
  materiaRepositorio,
  sesionRepositorio,
  socketIoEmisor,
  tokenService,
} from './presentation/dependencias';

const PORT = Number(process.env.PORT ?? 3000);
// Monitoreo en vivo (13/08): cada cuánto se barre por vencimientos por
// tiempo límite y cierres automáticos, sin depender de que el docente
// esté mirando la pantalla — ver barrer-vencimientos.ts.
const INTERVALO_BARRIDO_MS = 8000;

const app = createApp();
const httpServer = createServer(app);

// E7: Socket.IO comparte el mismo servidor HTTP que la API REST.
const io = crearServidorTiempoReal(httpServer, {
  tokenService,
  sesionRepositorio,
  intentoRepositorio,
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  guiaRepositorio,
  examenCodigoRepositorio,
  intentoCodigoRepositorio,
});
socketIoEmisor.conectar(io);

setInterval(() => {
  barrerVencimientos.ejecutar().catch((error) => {
    console.error('[atenza-api] error en el barrido de vencimientos:', error);
  });
}, INTERVALO_BARRIDO_MS);

httpServer.listen(PORT, () => {
  console.log(`[atenza-api] escuchando en http://localhost:${PORT}`);
});
