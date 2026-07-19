import 'dotenv/config';
import { createServer } from 'http';
import { createApp } from './presentation/app';
import { crearServidorTiempoReal } from './infrastructure/realtime/servidor-tiempo-real';
import {
  claseRepositorio,
  evaluacionRepositorio,
  intentoRepositorio,
  materiaRepositorio,
  sesionRepositorio,
  socketIoEmisor,
  tokenService,
} from './presentation/dependencias';

const PORT = Number(process.env.PORT ?? 3000);

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
});
socketIoEmisor.conectar(io);

httpServer.listen(PORT, () => {
  console.log(`[atenza-api] escuchando en http://localhost:${PORT}`);
});
