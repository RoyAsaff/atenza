// E7 — rutas del estudiante (app Flutter): rendir el examen lanzado
// HU-21: abrir/reanudar, guardar respuesta a respuesta (D-06),
// reportar incidentes de salida de pantalla, finalizar.

import { Router } from 'express';
import { z } from 'zod';
import {
  finalizarIntento,
  guardarRespuesta,
  reportarIncidente,
  sesionRepositorio,
  tokenService,
  verIntentoActual,
} from '../dependencias';
import { crearAutenticar } from '../middlewares/autenticar';
import { autorizarContexto } from '../middlewares/autorizar';

export const intentosRouter = Router();

const autenticar = crearAutenticar(tokenService, sesionRepositorio);
const soloEstudiante = autorizarContexto('estudiante');
const idNumerico = z.coerce.number().int().positive();

// GET /api/intentos/actual — abrir o reanudar el examen vigente (o null)
intentosRouter.get('/actual', autenticar, soloEstudiante, async (req, res, next) => {
  try {
    const intento = await verIntentoActual.ejecutar({ estudiante_id: req.auth!.sub });
    res.json({ intento });
  } catch (error) {
    next(error);
  }
});

// POST /api/intentos/:id/respuestas — HU-21 Esc. 3 (D-06)
intentosRouter.post('/:id/respuestas', autenticar, soloEstudiante, async (req, res, next) => {
  try {
    const { pregunta_id, opcion_id } = z
      .object({ pregunta_id: idNumerico, opcion_id: idNumerico })
      .parse(req.body);
    await guardarRespuesta.ejecutar({
      intento_id: idNumerico.parse(req.params.id),
      estudiante_id: req.auth!.sub,
      pregunta_id,
      opcion_id,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /api/intentos/:id/incidente — HU-21 Esc. 2
intentosRouter.post('/:id/incidente', autenticar, soloEstudiante, async (req, res, next) => {
  try {
    const { tipo, detalle } = z
      .object({ tipo: z.enum(['salida_pantalla']), detalle: z.string().optional() })
      .parse(req.body);
    await reportarIncidente.ejecutar({
      intento_id: idNumerico.parse(req.params.id),
      estudiante_id: req.auth!.sub,
      tipo,
      detalle,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /api/intentos/:id/finalizar — envío manual del estudiante
intentosRouter.post('/:id/finalizar', autenticar, soloEstudiante, async (req, res, next) => {
  try {
    await finalizarIntento.ejecutar({
      intento_id: idNumerico.parse(req.params.id),
      estudiante_id: req.auth!.sub,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
