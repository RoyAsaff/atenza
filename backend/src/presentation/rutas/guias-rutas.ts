// Guías de pre-clase (fusión con PaginaGuias, 05/08; guías nativas 16/08).
// `guiasRouter` sigue el patrón de evaluaciones-rutas.ts, montado en
// /api/materias. `guiasCompletarRouter` es aparte: lo llama la propia
// página externa de la guía (dominio ajeno, sin sesión de ATENZA), así que
// va con `verificarTokenGuia`/`verificarTokenGuiaIntento` en vez de
// `autenticar`, montado en /api/guias (ver dependencias.ts).

import { Router } from 'express';
import { z } from 'zod';
import {
  actualizarGuia,
  analizarGuiaExterna,
  cancelarGuiaLanzamiento,
  crearGuia,
  cuentaActiva,
  eliminarGuia,
  finalizarGuiaIntento,
  guardarRespuestaGuia,
  iniciarOReanudarGuiaIntento,
  lanzarGuia,
  pausarGuiaIntento,
  reactivarGuiaIntento,
  registrarCompletado,
  reportarIncidenteGuia,
  revisarRespuestaGuia,
  sesionRepositorio,
  tokenService,
  verGuiaDetalle,
  verGuias,
  verificarTokenGuia,
  verificarTokenGuiaIntento,
  verMisGuias,
  verMonitoreoGuia,
  verResultadosGuia,
  verRevisionGuia,
} from '../dependencias';
import { crearAutenticar } from '../middlewares/autenticar';
import { autorizarContexto } from '../middlewares/autorizar';

export const guiasRouter = Router();
export const guiasCompletarRouter = Router();

const autenticar = crearAutenticar(tokenService, sesionRepositorio);
const soloDocente = autorizarContexto('docente');
const idNumerico = z.coerce.number().int().positive();

const esquemaGuiaPregunta = z.object({
  referencia: z.string().min(1),
  tipo: z.enum(['automatica', 'abierta']),
  respuesta_modelo: z.string().min(1).optional(),
  orden: z.number().int().nonnegative(),
});

// POST /api/materias/:id/clases/:claseId/guias
guiasRouter.post(
  '/:id/clases/:claseId/guias',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const datos = z
        .object({
          tema: z.string().min(1),
          url: z.string().url(),
          orden: z.number().int().nonnegative().default(0),
          nota: z.number().positive(),
          tiempo_limite_minutos: z.number().int().positive().optional(),
          preguntas: z.array(esquemaGuiaPregunta).min(1, 'Cargá al menos una pregunta'),
        })
        .parse(req.body);
      const guia = await crearGuia.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        clase_id: idNumerico.parse(req.params.claseId),
        docente_id: req.auth!.sub,
        ...datos,
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
          nota: z.number().positive().optional(),
          tiempo_limite_minutos: z.number().int().positive().nullable().optional(),
          preguntas: z.array(esquemaGuiaPregunta).min(1).optional(),
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

// POST /api/materias/:id/guias/analizar — pre-llena el manifest de
// preguntas bajando y parseando el HTML del link (mismo espíritu que
// Importar de Word en evaluaciones).
guiasRouter.post('/:id/guias/analizar', autenticar, soloDocente, async (req, res, next) => {
  try {
    const { url } = z.object({ url: z.string().url() }).parse(req.body);
    const preguntas = await analizarGuiaExterna.ejecutar({ url });
    res.json({ preguntas });
  } catch (error) {
    next(error);
  }
});

// GET /api/materias/:id/guias/:guiaId — detalle de una guía puntual
// (Resultados/Revisión/Lanzamiento no tienen el clase_id a mano).
guiasRouter.get('/:id/guias/:guiaId', autenticar, soloDocente, async (req, res, next) => {
  try {
    const guia = await verGuiaDetalle.ejecutar({
      materia_id: idNumerico.parse(req.params.id),
      guia_id: idNumerico.parse(req.params.guiaId),
      docente_id: req.auth!.sub,
    });
    res.json({ guia });
  } catch (error) {
    next(error);
  }
});

// ── Lanzamiento (docente) ──────────────────────────────────────────

// POST /api/materias/:id/guias/:guiaId/lanzar
guiasRouter.post(
  '/:id/guias/:guiaId/lanzar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const guia = await lanzarGuia.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        guia_id: idNumerico.parse(req.params.guiaId),
        docente_id: req.auth!.sub,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ guia });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/guias/:guiaId/cancelar
guiasRouter.post(
  '/:id/guias/:guiaId/cancelar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const guia = await cancelarGuiaLanzamiento.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        guia_id: idNumerico.parse(req.params.guiaId),
        docente_id: req.auth!.sub,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ guia });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/guias/:guiaId/intentos/:intentoId/pausar
guiasRouter.post(
  '/:id/guias/:guiaId/intentos/:intentoId/pausar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      await pausarGuiaIntento.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        guia_id: idNumerico.parse(req.params.guiaId),
        intento_id: idNumerico.parse(req.params.intentoId),
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

// POST /api/materias/:id/guias/:guiaId/intentos/:intentoId/reactivar
guiasRouter.post(
  '/:id/guias/:guiaId/intentos/:intentoId/reactivar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      await reactivarGuiaIntento.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        guia_id: idNumerico.parse(req.params.guiaId),
        intento_id: idNumerico.parse(req.params.intentoId),
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

// ── Monitoreo / resultados / revisión (docente) ────────────────────

// GET /api/materias/:id/guias/:guiaId/monitoreo
guiasRouter.get(
  '/:id/guias/:guiaId/monitoreo',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const monitoreo = await verMonitoreoGuia.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        guia_id: idNumerico.parse(req.params.guiaId),
        docente_id: req.auth!.sub,
      });
      res.json({ monitoreo });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/guias/:guiaId/resultados
guiasRouter.get(
  '/:id/guias/:guiaId/resultados',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const resultados = await verResultadosGuia.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        guia_id: idNumerico.parse(req.params.guiaId),
        docente_id: req.auth!.sub,
      });
      res.json({ resultados });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/guias/:guiaId/revision — respuestas abiertas pendientes
guiasRouter.get(
  '/:id/guias/:guiaId/revision',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const pendientes = await verRevisionGuia.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        guia_id: idNumerico.parse(req.params.guiaId),
        docente_id: req.auth!.sub,
      });
      res.json({ pendientes });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/guias/:guiaId/revision/:guiaRespuestaId
guiasRouter.post(
  '/:id/guias/:guiaId/revision/:guiaRespuestaId',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const { correcta } = z.object({ correcta: z.boolean() }).parse(req.body);
      await revisarRespuestaGuia.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        guia_id: idNumerico.parse(req.params.guiaId),
        guia_respuesta_id: idNumerico.parse(req.params.guiaRespuestaId),
        correcta,
        docente_id: req.auth!.sub,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

// ── Tomar la guía (estudiante) ──────────────────────────────────────

// POST /api/materias/:id/guias/:guiaId/tomar — inicia o reanuda el
// intento vigente (oficial, o uno nuevo de repaso) y devuelve el link con
// el token acotado a ese intento puntual.
guiasRouter.post(
  '/:id/guias/:guiaId/tomar',
  autenticar,
  autorizarContexto('docente', 'estudiante'),
  async (req, res, next) => {
    try {
      const intento = await iniciarOReanudarGuiaIntento.ejecutar({
        guia_id: idNumerico.parse(req.params.guiaId),
        estudiante_id: req.auth!.sub,
      });
      res.json({ intento });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/guias/:id/completar — llamado desde la propia guía externa
// (fetch fire-and-forget, sin sesión de ATENZA). Legacy — guías nativas
// usan /intentos/:intentoId/finalizar, más abajo.
guiasCompletarRouter.post('/:id/completar', verificarTokenGuia, async (req, res, next) => {
  try {
    await registrarCompletado.ejecutar({
      guia_id: idNumerico.parse(req.params.id),
      estudiante_id: req.auth!.sub,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ── Reportes en vivo desde la página externa (guías nativas) ────────
// Mismo espíritu que /completar: sin sesión de ATENZA, con el token
// acotado a un intento puntual (verificarTokenGuiaIntento).

// POST /api/guias/intentos/:intentoId/respuesta
guiasCompletarRouter.post(
  '/intentos/:intentoId/respuesta',
  verificarTokenGuiaIntento,
  async (req, res, next) => {
    try {
      const { referencia, correcta, texto_libre } = z
        .object({
          referencia: z.string().min(1),
          correcta: z.boolean().optional(),
          texto_libre: z.string().max(5000).optional(),
        })
        .parse(req.body);
      await guardarRespuestaGuia.ejecutar({
        guia_intento_id: idNumerico.parse(req.params.intentoId),
        referencia,
        correcta,
        texto_libre,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/guias/intentos/:intentoId/incidente
guiasCompletarRouter.post(
  '/intentos/:intentoId/incidente',
  verificarTokenGuiaIntento,
  async (req, res, next) => {
    try {
      const { detalle } = z.object({ detalle: z.string().max(500).optional() }).parse(req.body);
      await reportarIncidenteGuia.ejecutar({
        guia_intento_id: idNumerico.parse(req.params.intentoId),
        detalle,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/guias/intentos/:intentoId/finalizar
guiasCompletarRouter.post(
  '/intentos/:intentoId/finalizar',
  verificarTokenGuiaIntento,
  async (req, res, next) => {
    try {
      await finalizarGuiaIntento.ejecutar({
        guia_intento_id: idNumerico.parse(req.params.intentoId),
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);
