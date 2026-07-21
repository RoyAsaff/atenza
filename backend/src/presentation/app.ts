import express from 'express';
import cors from 'cors';
import { authRouter } from './rutas/auth-rutas';
import { miEspacioRouter } from './rutas/mi-espacio-rutas';
import { cuentaRouter } from './rutas/cuenta-rutas';
import { materiasRouter } from './rutas/materias-rutas';
import { adminRouter } from './rutas/admin-rutas';
import { inscripcionesRouter } from './rutas/inscripciones-rutas';
import { evaluacionesRouter } from './rutas/evaluaciones-rutas';
import { intentosRouter } from './rutas/intentos-rutas';
import { manejarErrores } from './middlewares/manejar-errores';
import { CARPETA_UPLOADS } from './middlewares/subir-archivos';

export function createApp() {
  const app = express();

  // Detrás de un proxy (Railway/Coolify): sin esto, req.ip es la IP del
  // proxy para todos los clientes — rompe el rate-limit por IP y la IP
  // que se guarda en la bitácora de auditoría.
  app.set('trust proxy', 1);

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'atenza-api' });
  });

  app.use('/api/auth', authRouter); // E1: HU-01, HU-02, HU-04
  app.use('/api/mi-espacio', miEspacioRouter); // E1: HU-03
  app.use('/api/cuenta', cuentaRouter); // SaaS por cuenta (17/07): plan, estado, pagos
  app.use('/api/materias', materiasRouter); // E3: HU-11, HU-12 · E4 · E5
  app.use('/api/materias', evaluacionesRouter); // E6: HU-17, HU-18, HU-19
  app.use('/api/admin', adminRouter); // planes/QR, verificación de pagos, HU-09
  app.use('/api/inscripciones', inscripcionesRouter); // E3: HU-10
  app.use('/api/intentos', intentosRouter); // E7: HU-21

  // Archivos subidos (comprobantes, QR de cobro)
  app.use('/uploads', express.static(CARPETA_UPLOADS));

  app.use(manejarErrores);

  return app;
}
