// SaaS por cuenta (17/07) — rutas del docente: estado de la cuenta, planes,
// elegir plan y subir comprobante. Reemplaza a precio-vigente/solicitudes
// de materias-rutas.ts. IMPORTANTE: estas rutas NUNCA llevan el middleware
// `cuentaActiva` — deben seguir accesibles aunque la cuenta esté vencida,
// para que el docente pueda pagar y reactivarse.

import { Router } from 'express';
import { z } from 'zod';
import {
  configuracionPagoRepositorio,
  elegirPlan,
  estadoCuenta,
  pagoRepositorio,
  planRepositorio,
  sesionRepositorio,
  subirComprobanteSuscripcion,
  tokenService,
} from '../dependencias';
import { crearAutenticar } from '../middlewares/autenticar';
import { autorizarContexto } from '../middlewares/autorizar';
import { rutaPublica, subirArchivo } from '../middlewares/subir-archivos';

export const cuentaRouter = Router();

const autenticar = crearAutenticar(tokenService, sesionRepositorio);
const soloDocente = autorizarContexto('docente');

// GET /api/cuenta/estado — banner de vigencia/solo lectura
cuentaRouter.get('/estado', autenticar, soloDocente, async (req, res, next) => {
  try {
    const estado = await estadoCuenta.ejecutar(req.auth!.sub);
    res.json({ estado });
  } catch (error) {
    next(error);
  }
});

// GET /api/cuenta/planes — tramos activos (Institucional se muestra pero sin compra self-service)
cuentaRouter.get('/planes', autenticar, soloDocente, async (_req, res, next) => {
  try {
    const planes = await planRepositorio.listar(true);
    res.json({ planes });
  } catch (error) {
    next(error);
  }
});

const esquemaElegirPlan = z.object({
  plan_id: z.coerce.number().int().positive(),
  ciclo: z.enum(['mensual', 'anual']),
});

// POST /api/cuenta/elegir-plan
cuentaRouter.post('/elegir-plan', autenticar, soloDocente, async (req, res, next) => {
  try {
    const datos = esquemaElegirPlan.parse(req.body);
    const resultado = await elegirPlan.ejecutar({
      ...datos,
      usuario_id: req.auth!.sub,
      ip: req.ip,
      dispositivo: req.headers['user-agent'],
    });
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});

// GET /api/cuenta/qr — QR único global (para volver a mostrarlo si el docente
// navegó fuera de la pantalla de "elegir plan" antes de subir el comprobante)
cuentaRouter.get('/qr', autenticar, soloDocente, async (_req, res, next) => {
  try {
    const url_qr = await configuracionPagoRepositorio.obtenerQr();
    res.json({ url_qr });
  } catch (error) {
    next(error);
  }
});

// GET /api/cuenta/pagos — historial de pagos de la cuenta
cuentaRouter.get('/pagos', autenticar, soloDocente, async (req, res, next) => {
  try {
    const pagos = await pagoRepositorio.listarPorUsuario(req.auth!.sub);
    res.json({ pagos });
  } catch (error) {
    next(error);
  }
});

// POST /api/cuenta/pagos/:id/comprobante — multipart, campo "comprobante"
cuentaRouter.post(
  '/pagos/:id/comprobante',
  autenticar,
  soloDocente,
  subirArchivo.single('comprobante'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'ARCHIVO_REQUERIDO',
          mensaje: 'Adjunta la imagen o PDF del comprobante en el campo "comprobante"',
        });
      }
      const pago = await subirComprobanteSuscripcion.ejecutar({
        pago_id: Number(req.params.id),
        usuario_id: req.auth!.sub,
        rutaComprobante: rutaPublica(req.file.filename),
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ pago });
    } catch (error) {
      next(error);
    }
  },
);
