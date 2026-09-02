// E9 · Rutas estudiante para rendir un examen de código (app de escritorio):
// abrir/reanudar, ejecutar (probar contra casos visibles), enviar (corre
// todos los casos y califica), reportar incidentes, finalizar. Calcado de
// intentos-rutas.ts (E7).

import { Router } from 'express';
import { z } from 'zod';
import {
  ejecutarCodigo,
  enviarRespuestaCodigo,
  finalizarIntentoCodigo,
  reportarIncidenteCodigo,
  sesionRepositorio,
  tokenService,
  verIntentoCodigoActual,
} from '../dependencias';
import { crearAutenticar } from '../middlewares/autenticar';
import { autorizarContexto } from '../middlewares/autorizar';
import { limitarEjecucionCodigo } from '../middlewares/limitar-tasa';

export const intentosCodigoRouter = Router();

const autenticar = crearAutenticar(tokenService, sesionRepositorio);
// Mismo criterio que intentos-rutas.ts: una sesión de docente puede estar
// rindiendo como estudiante en otra materia (unificación de identidad,
// 05/08) — cada caso de uso ya re-scopea por `estudiante_id: req.auth!.sub`.
const soloEstudiante = autorizarContexto('docente', 'estudiante');
const idNumerico = z.coerce.number().int().positive();

// GET /api/intentos-codigo/actual — abrir o reanudar el examen vigente (o null)
intentosCodigoRouter.get('/actual', autenticar, soloEstudiante, async (req, res, next) => {
  try {
    const intento = await verIntentoCodigoActual.ejecutar({ estudiante_id: req.auth!.sub });
    res.json({ intento });
  } catch (error) {
    next(error);
  }
});

const esquemaCodigo = z.object({ codigo_fuente: z.string() });

// POST /api/intentos-codigo/:id/ejercicios/:ejercicioId/ejecutar — solo
// casos visibles, no persiste nada (scratchpad de prueba-y-error).
intentosCodigoRouter.post(
  '/:id/ejercicios/:ejercicioId/ejecutar',
  autenticar,
  soloEstudiante,
  limitarEjecucionCodigo,
  async (req, res, next) => {
    try {
      const { codigo_fuente } = esquemaCodigo.parse(req.body);
      const resultados = await ejecutarCodigo.ejecutar({
        intento_id: idNumerico.parse(req.params.id),
        estudiante_id: req.auth!.sub,
        ejercicio_id: idNumerico.parse(req.params.ejercicioId),
        codigo_fuente,
      });
      res.json({ resultados });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/intentos-codigo/:id/ejercicios/:ejercicioId/enviar — todos los
// casos (incluidos ocultos), persiste la respuesta calificable.
intentosCodigoRouter.post(
  '/:id/ejercicios/:ejercicioId/enviar',
  autenticar,
  soloEstudiante,
  limitarEjecucionCodigo,
  async (req, res, next) => {
    try {
      const { codigo_fuente } = esquemaCodigo.parse(req.body);
      const resultado = await enviarRespuestaCodigo.ejecutar({
        intento_id: idNumerico.parse(req.params.id),
        estudiante_id: req.auth!.sub,
        ejercicio_id: idNumerico.parse(req.params.ejercicioId),
        codigo_fuente,
      });
      res.json({ resultado });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/intentos-codigo/:id/incidente — pérdida de foco / minimizado /
// intento de cierre de la ventana (app de escritorio Tauri).
intentosCodigoRouter.post('/:id/incidente', autenticar, soloEstudiante, async (req, res, next) => {
  try {
    const { tipo, detalle } = z
      .object({
        tipo: z.enum(['perdida_foco', 'ventana_minimizada', 'intento_cierre']),
        detalle: z.string().optional(),
      })
      .parse(req.body);
    await reportarIncidenteCodigo.ejecutar({
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

// POST /api/intentos-codigo/:id/finalizar — envío manual del estudiante
intentosCodigoRouter.post('/:id/finalizar', autenticar, soloEstudiante, async (req, res, next) => {
  try {
    await finalizarIntentoCodigo.ejecutar({
      intento_id: idNumerico.parse(req.params.id),
      estudiante_id: req.auth!.sub,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
