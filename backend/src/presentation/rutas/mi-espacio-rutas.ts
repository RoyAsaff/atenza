// HU-03 · Rol dual: una misma cuenta ve separadas las materias que dicta
// y aquellas donde está inscrita (E3).

import { Router } from 'express';
import {
  inscripcionRepositorio,
  materiaRepositorio,
  sesionRepositorio,
  tokenService,
} from '../dependencias';
import { crearAutenticar } from '../middlewares/autenticar';

export const miEspacioRouter = Router();

const autenticar = crearAutenticar(tokenService, sesionRepositorio);

// GET /api/mi-espacio
miEspacioRouter.get('/', autenticar, async (req, res, next) => {
  try {
    const materias = await materiaRepositorio.listarPorDocente(req.auth!.sub);
    const inscripciones = await inscripcionRepositorio.listarPorEstudiante(req.auth!.sub);

    res.json({
      // SaaS por cuenta (17/07): la vigencia ya no es por materia, ver
      // GET /api/cuenta/estado para el banner de prueba/plan de la cuenta.
      materias_que_dicto: materias,
      // E3 (HU-10): materias donde la cuenta está inscrita como estudiante
      materias_inscrito: inscripciones.map((i) => ({
        inscripcion_id: i.id,
        codigo_estudiante: i.codigo_estudiante,
        fecha_inscripcion: i.fecha_inscripcion,
        materia: i.materia,
      })),
    });
  } catch (error) {
    next(error);
  }
});
