// Guías de pre-clase (fusión con PaginaGuias, 05/08) — no está en el
// diagrama. `guiasRouter` sigue el patrón de evaluaciones-rutas.ts,
// montado en /api/materias. `guiasCompletarRouter` es aparte: el POST de
// completar lo llama la propia página de la guía (dominio externo, sin
// sesión de ATENZA), así que va con `verificarTokenGuia` en vez de
// `autenticar`, montado en /api/guias (ver dependencias.ts).

import { Router } from 'express';
import { z } from 'zod';
import {
  actualizarGuia,
  crearGuia,
  cuentaActiva,
  eliminarGuia,
  registrarCompletado,
  sesionRepositorio,
  tokenService,
  verGuias,
  verificarTokenGuia,
  verMisGuias,
} from '../dependencias';
import { crearAutenticar } from '../middlewares/autenticar';
import { autorizarContexto } from '../middlewares/autorizar';

export const guiasRouter = Router();
export const guiasCompletarRouter = Router();

const autenticar = crearAutenticar(tokenService, sesionRepositorio);
const soloDocente = autorizarContexto('docente');
const idNumerico = z.coerce.number().int().positive();

// POST /api/materias/:id/clases/:claseId/guias
guiasRouter.post(
  '/:id/clases/:claseId/guias',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const { tema, url, orden } = z
        .object({
          tema: z.string().min(1),
          url: z.string().url(),
          orden: z.number().int().nonnegative().default(0),
        })
        .parse(req.body);
      const guia = await crearGuia.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        clase_id: idNumerico.parse(req.params.claseId),
        docente_id: req.auth!.sub,
        tema,
        url,
        orden,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.status(201).json({ guia });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/clases/:claseId/guias — docente dueño o estudiante inscrito
guiasRouter.get(
  '/:id/clases/:claseId/guias',
  autenticar,
  autorizarContexto('docente', 'estudiante'),
  async (req, res, next) => {
    try {
      const guias = await verGuias.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        clase_id: idNumerico.parse(req.params.claseId),
        usuario_id: req.auth!.sub,
      });
      res.json({ guias });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/guias — "Mis guías" (estudiante, toda la materia,
// no una clase puntual — mismo espíritu que GET /:id/mis-notas)
guiasRouter.get(
  '/:id/guias',
  autenticar,
  // Ampliado (05/08, unificación de identidad en web): VerMisGuias ya
  // scopea por inscripción del `sub`, no por contexto.
  autorizarContexto('docente', 'estudiante'),
  async (req, res, next) => {
    try {
      const guias = await verMisGuias.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        estudiante_id: req.auth!.sub,
      });
      res.json({ guias });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/materias/:id/guias/:guiaId
guiasRouter.patch(
  '/:id/guias/:guiaId',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const datos = z
        .object({
          tema: z.string().min(1).optional(),
          url: z.string().url().optional(),
          orden: z.number().int().nonnegative().optional(),
        })
        .parse(req.body);
      const guia = await actualizarGuia.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        guia_id: idNumerico.parse(req.params.guiaId),
        docente_id: req.auth!.sub,
        ...datos,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ guia });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/materias/:id/guias/:guiaId
guiasRouter.delete(
  '/:id/guias/:guiaId',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      await eliminarGuia.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        guia_id: idNumerico.parse(req.params.guiaId),
        docente_id: req.auth!.sub,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/guias/:id/completar — llamado desde la propia guía en
// PaginaGuias (fetch fire-and-forget, sin sesión de ATENZA).
guiasCompletarRouter.post(
  '/:id/completar',
  verificarTokenGuia,
  async (req, res, next) => {
    try {
      await registrarCompletado.ejecutar({
        guia_id: idNumerico.parse(req.params.id),
        estudiante_id: req.auth!.sub,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);
