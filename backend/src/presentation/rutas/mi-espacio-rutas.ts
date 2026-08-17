// HU-03 · Rol dual: una misma cuenta ve separadas las materias que dicta
// y aquellas donde está inscrita (E3).

import { Router } from 'express';
import {
  inscripcionRepositorio,
  materiaRepositorio,
  sesionRepositorio,
  tokenService,
  verClasesDeHoy,
  verEvaluacionesDocente,
  verPendientesDocente,
} from '../dependencias';
import { crearAutenticar } from '../middlewares/autenticar';
import { autorizarContexto } from '../middlewares/autorizar';

export const miEspacioRouter = Router();

const autenticar = crearAutenticar(tokenService, sesionRepositorio);
const soloDocente = autorizarContexto('docente');

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

// GET /api/mi-espacio/clases-hoy — "Inicio" (13/08): clases de HOY,
// dictadas e inscritas, para pasar lista/evaluaciones/guías al toque.
miEspacioRouter.get('/clases-hoy', autenticar, async (req, res, next) => {
  try {
    const clases = await verClasesDeHoy.ejecutar({ usuario_id: req.auth!.sub });
    res.json(clases);
  } catch (error) {
    next(error);
  }
});

// GET /api/mi-espacio/evaluaciones — todas las evaluaciones del docente en
// cualquiera de sus materias, para el selector de "Reutilizar evaluación".
miEspacioRouter.get('/evaluaciones', autenticar, soloDocente, async (req, res, next) => {
  try {
    const evaluaciones = await verEvaluacionesDocente.ejecutar({ docente_id: req.auth!.sub });
    res.json({ evaluaciones });
  } catch (error) {
    next(error);
  }
});

// GET /api/mi-espacio/pendientes — Inicio (17/08): panel "Requiere tu atención".
miEspacioRouter.get('/pendientes', autenticar, soloDocente, async (req, res, next) => {
  try {
    const pendientes = await verPendientesDocente.ejecutar({ docente_id: req.auth!.sub });
    res.json({ pendientes });
  } catch (error) {
    next(error);
  }
});
