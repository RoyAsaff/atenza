// E3 — rutas del estudiante (app Flutter): unirse a una materia con código

import { Router } from 'express';
import { z } from 'zod';
import {
  deslindarseDeMateria,
  sesionRepositorio,
  tokenService,
  unirseAMateria,
} from '../dependencias';
import { crearAutenticar } from '../middlewares/autenticar';
import { autorizarContexto } from '../middlewares/autorizar';

export const inscripcionesRouter = Router();

const autenticar = crearAutenticar(tokenService, sesionRepositorio);
const soloEstudiante = autorizarContexto('estudiante');

const esquemaUnirse = z.object({
  codigo_materia: z.string().min(1),
  codigo_estudiante: z.string().min(1),
});

// POST /api/inscripciones/:id/deslindar — caso de uso "Deslindar Materia"
// (diagrama E3): el estudiante se retira a sí mismo, conservando historial.
inscripcionesRouter.post(
  '/:id/deslindar',
  autenticar,
  soloEstudiante,
  async (req, res, next) => {
    try {
      await deslindarseDeMateria.ejecutar({
        inscripcion_id: z.coerce.number().int().positive().parse(req.params.id),
        estudiante_id: req.auth!.sub,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/inscripciones — HU-10
inscripcionesRouter.post('/', autenticar, soloEstudiante, async (req, res, next) => {
  try {
    const datos = esquemaUnirse.parse(req.body);
    const resultado = await unirseAMateria.ejecutar({
      estudiante_id: req.auth!.sub,
      codigo_materia: datos.codigo_materia,
      codigo_estudiante: datos.codigo_estudiante,
      ip: req.ip,
      dispositivo: req.headers['user-agent'],
    });
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});
