// Rutas del administrador: planes SaaS + QR de cobro, verificación de
// pagos de suscripción (17/07) y panel general (HU-09)

import { Router } from 'express';
import { z } from 'zod';
import {
  configuracionPagoRepositorio,
  expirarComprobantesPendientes,
  materiaRepositorio,
  pagoRepositorio,
  planRepositorio,
  resolverSuscripcion,
  sesionRepositorio,
  tokenService,
  usuarioRepositorio,
} from '../dependencias';
import { crearAutenticar } from '../middlewares/autenticar';
import { autorizarContexto } from '../middlewares/autorizar';
import { rutaPublica, subirArchivo } from '../middlewares/subir-archivos';
import { aPublico } from '../../domain/entidades/usuario';

export const adminRouter = Router();

adminRouter.use(
  crearAutenticar(tokenService, sesionRepositorio),
  autorizarContexto('admin'),
);

// GET /api/admin/planes — los 4 tramos (incluye inactivos, para editarlos)
adminRouter.get('/planes', async (_req, res, next) => {
  try {
    const planes = await planRepositorio.listar(false);
    res.json({ planes });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/planes/:id — editar nombre/límite/monto
adminRouter.patch('/planes/:id', async (req, res, next) => {
  try {
    const datos = z
      .object({
        nombre: z.string().min(1).optional(),
        limite_estudiantes: z.number().int().positive().nullable().optional(),
        monto_mensual: z.number().nonnegative().optional(),
      })
      .parse(req.body);
    const plan = await planRepositorio.actualizar(Number(req.params.id), datos);
    res.json({ plan });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/configuracion-pago — QR único global vigente
adminRouter.get('/configuracion-pago', async (_req, res, next) => {
  try {
    const url_qr = await configuracionPagoRepositorio.obtenerQr();
    res.json({ url_qr });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/configuracion-pago/qr — multipart, campo "qr"
adminRouter.post(
  '/configuracion-pago/qr',
  subirArchivo.single('qr'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'ARCHIVO_REQUERIDO',
          mensaje: 'Adjunta la imagen del QR en el campo "qr"',
        });
      }
      const url_qr = rutaPublica(req.file.filename);
      await configuracionPagoRepositorio.establecerQr(url_qr);
      res.status(201).json({ url_qr });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/admin/solicitudes?estado=en_verificacion — verificación de pagos de suscripción
adminRouter.get('/solicitudes', async (req, res, next) => {
  try {
    await expirarComprobantesPendientes.ejecutar();
    const filtro = z
      .object({
        estado: z
          .enum(['pendiente', 'en_verificacion', 'aprobada', 'rechazada', 'expirada'])
          .optional(),
      })
      .parse(req.query);
    const solicitudes = await pagoRepositorio.listar(filtro);
    res.json({ solicitudes });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/solicitudes/:id/aprobar
adminRouter.post('/solicitudes/:id/aprobar', async (req, res, next) => {
  try {
    const solicitud = await resolverSuscripcion.aprobar({
      pago_id: Number(req.params.id),
      admin_id: req.auth!.sub,
      ip: req.ip,
      dispositivo: req.headers['user-agent'],
    });
    res.json({ solicitud });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/solicitudes/:id/rechazar
adminRouter.post('/solicitudes/:id/rechazar', async (req, res, next) => {
  try {
    const { motivo } = z.object({ motivo: z.string().min(1) }).parse(req.body);
    const solicitud = await resolverSuscripcion.rechazar({
      pago_id: Number(req.params.id),
      admin_id: req.auth!.sub,
      motivo,
      ip: req.ip,
      dispositivo: req.headers['user-agent'],
    });
    res.json({ solicitud });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/usuarios?buscar= — HU-09
adminRouter.get('/usuarios', async (req, res, next) => {
  try {
    const { buscar } = z.object({ buscar: z.string().optional() }).parse(req.query);
    const usuarios = await usuarioRepositorio.listar(buscar);
    res.json({ usuarios: usuarios.map(aPublico) });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/materias?buscar= — HU-09
adminRouter.get('/materias', async (req, res, next) => {
  try {
    const { buscar } = z.object({ buscar: z.string().optional() }).parse(req.query);
    const materias = await materiaRepositorio.listar(buscar);
    res.json({ materias });
  } catch (error) {
    next(error);
  }
});
