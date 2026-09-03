// E9 · Rutas docente para exámenes de código Python — calcado de
// evaluaciones-rutas.ts (creación, ejecución en vivo, resultados).

import { Router } from 'express';
import { z } from 'zod';
import {
  actualizarEjercicio,
  actualizarExamenCodigo,
  agregarEjercicio,
  cancelarExamenCodigo,
  confirmarImportacionEjercicios,
  crearExamenCodigo,
  cuentaActiva,
  eliminarEjercicio,
  eliminarExamenCodigo,
  exigirExamenesCodigo,
  exigirImportarWord,
  guardarExamenCodigo,
  lanzarExamenCodigo,
  pausarExamenCodigo,
  pausarIntentoCodigo,
  previsualizarImportacionEjercicios,
  publicarNotasCodigo,
  reactivarExamenCodigo,
  reactivarIntentoCodigo,
  reordenarEjercicios,
  sesionRepositorio,
  tokenService,
  verDetalleIntentoCodigo,
  verExamenCodigo,
  verExamenesCodigo,
  verExamenesCodigoMateria,
  verMonitoreoCodigo,
  verResultadosCodigo,
} from '../dependencias';
import { crearAutenticar } from '../middlewares/autenticar';
import { autorizarContexto } from '../middlewares/autorizar';
import { subirDocumentoMd } from '../middlewares/subir-archivos';

export const examenesCodigoRouter = Router();

const autenticar = crearAutenticar(tokenService, sesionRepositorio);
const soloDocente = autorizarContexto('docente');
const idNumerico = z.coerce.number().int().positive();

const esquemaCasoPrueba = z.object({
  entrada: z.string(),
  salida_esperada: z.string(),
  es_oculto: z.boolean(),
});

const esquemaEjercicio = z.object({
  enunciado: z.string().min(1),
  plantilla_codigo: z.string().nullable().optional(),
  nota: z.number().int().positive(),
  casos_prueba: z.array(esquemaCasoPrueba).min(1),
});

// POST /api/materias/:id/clases/:claseId/examenes-codigo
examenesCodigoRouter.post(
  '/:id/clases/:claseId/examenes-codigo',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirExamenesCodigo,
  async (req, res, next) => {
    try {
      const { tema, nota } = z
        .object({ tema: z.string().min(1), nota: z.number().int().positive() })
        .parse(req.body);
      const examen = await crearExamenCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        clase_id: idNumerico.parse(req.params.claseId),
        docente_id: req.auth!.sub,
        tema,
        nota,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.status(201).json({ examen });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/clases/:claseId/examenes-codigo
examenesCodigoRouter.get(
  '/:id/clases/:claseId/examenes-codigo',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const examenes = await verExamenesCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        clase_id: idNumerico.parse(req.params.claseId),
        docente_id: req.auth!.sub,
      });
      res.json({ examenes });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/examenes-codigo — todos los de la materia (cualquier clase)
examenesCodigoRouter.get('/:id/examenes-codigo', autenticar, soloDocente, async (req, res, next) => {
  try {
    const examenes = await verExamenesCodigoMateria.ejecutar({
      materia_id: idNumerico.parse(req.params.id),
      docente_id: req.auth!.sub,
    });
    res.json({ examenes });
  } catch (error) {
    next(error);
  }
});

// GET /api/materias/:id/examenes-codigo/:examenId — detalle con ejercicios (editor)
examenesCodigoRouter.get(
  '/:id/examenes-codigo/:examenId',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const examen = await verExamenCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
        docente_id: req.auth!.sub,
      });
      res.json({ examen });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/materias/:id/examenes-codigo/:examenId — editar tema/nota/tiempo límite
examenesCodigoRouter.patch(
  '/:id/examenes-codigo/:examenId',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirExamenesCodigo,
  async (req, res, next) => {
    try {
      const datos = z
        .object({
          tema: z.string().min(1).optional(),
          nota: z.number().int().positive().optional(),
          tiempo_limite_minutos: z.number().int().positive().nullable().optional(),
        })
        .parse(req.body);
      const examen = await actualizarExamenCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
        docente_id: req.auth!.sub,
        ...datos,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ examen });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/materias/:id/examenes-codigo/:examenId
examenesCodigoRouter.delete(
  '/:id/examenes-codigo/:examenId',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirExamenesCodigo,
  async (req, res, next) => {
    try {
      await eliminarExamenCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
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

// POST /api/materias/:id/examenes-codigo/:examenId/ejercicios
examenesCodigoRouter.post(
  '/:id/examenes-codigo/:examenId/ejercicios',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirExamenesCodigo,
  async (req, res, next) => {
    try {
      const datos = esquemaEjercicio.parse(req.body);
      const ejercicio = await agregarEjercicio.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
        docente_id: req.auth!.sub,
        ...datos,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.status(201).json({ ejercicio });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/examenes-codigo/:examenId/ejercicios/importar/previsualizar
// Importar ejercicios desde Markdown: parsea el .md y devuelve lo que
// entendió, sin escribir nada todavía (el docente revisa antes de confirmar).
examenesCodigoRouter.post(
  '/:id/examenes-codigo/:examenId/ejercicios/importar/previsualizar',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirImportarWord,
  subirDocumentoMd.single('archivo'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'ARCHIVO_REQUERIDO',
          mensaje: 'Adjunta el archivo .md en el campo "archivo"',
        });
      }
      const resultado = await previsualizarImportacionEjercicios.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
        docente_id: req.auth!.sub,
        archivo: req.file.buffer,
      });
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/examenes-codigo/:examenId/ejercicios/importar/confirmar
// Crea los ejercicios ya parseados (y revisados por el docente en el frontend).
examenesCodigoRouter.post(
  '/:id/examenes-codigo/:examenId/ejercicios/importar/confirmar',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirImportarWord,
  async (req, res, next) => {
    try {
      const { ejercicios } = z.object({ ejercicios: z.array(esquemaEjercicio).min(1) }).parse(req.body);
      const creados = await confirmarImportacionEjercicios.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
        docente_id: req.auth!.sub,
        ejercicios: ejercicios.map((e) => ({ ...e, plantilla_codigo: e.plantilla_codigo ?? null })),
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.status(201).json({ ejercicios: creados });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/materias/:id/examenes-codigo/:examenId/ejercicios/reordenar
// (ruta estática antes de "/ejercicios/:ejercicioId" — mismo motivo que
// evaluaciones/preguntas/reordenar: evita que Express la confunda con un id)
examenesCodigoRouter.patch(
  '/:id/examenes-codigo/:examenId/ejercicios/reordenar',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirExamenesCodigo,
  async (req, res, next) => {
    try {
      const { orden } = z.object({ orden: z.array(idNumerico).min(1) }).parse(req.body);
      await reordenarEjercicios.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
        docente_id: req.auth!.sub,
        orden,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/materias/:id/examenes-codigo/:examenId/ejercicios/:ejercicioId
examenesCodigoRouter.patch(
  '/:id/examenes-codigo/:examenId/ejercicios/:ejercicioId',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirExamenesCodigo,
  async (req, res, next) => {
    try {
      const datos = esquemaEjercicio.parse(req.body);
      const ejercicio = await actualizarEjercicio.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
        ejercicio_id: idNumerico.parse(req.params.ejercicioId),
        docente_id: req.auth!.sub,
        ...datos,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ ejercicio });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/materias/:id/examenes-codigo/:examenId/ejercicios/:ejercicioId
examenesCodigoRouter.delete(
  '/:id/examenes-codigo/:examenId/ejercicios/:ejercicioId',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirExamenesCodigo,
  async (req, res, next) => {
    try {
      await eliminarEjercicio.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
        ejercicio_id: idNumerico.parse(req.params.ejercicioId),
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

// POST /api/materias/:id/examenes-codigo/:examenId/guardar — Borrador → Lista
examenesCodigoRouter.post(
  '/:id/examenes-codigo/:examenId/guardar',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirExamenesCodigo,
  async (req, res, next) => {
    try {
      const examen = await guardarExamenCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
        docente_id: req.auth!.sub,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ examen });
    } catch (error) {
      next(error);
    }
  },
);

// ── Ejecución en vivo ─────────────────────────────────────────────

const esquemaLanzar = z.object({
  estudiante_ids: z.array(idNumerico).min(1).optional(),
});

// POST /api/materias/:id/examenes-codigo/:examenId/lanzar
examenesCodigoRouter.post(
  '/:id/examenes-codigo/:examenId/lanzar',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirExamenesCodigo,
  async (req, res, next) => {
    try {
      const { estudiante_ids } = esquemaLanzar.parse(req.body ?? {});
      const examen = await lanzarExamenCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
        docente_id: req.auth!.sub,
        estudiante_ids,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ examen });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/examenes-codigo/:examenId/monitoreo
examenesCodigoRouter.get(
  '/:id/examenes-codigo/:examenId/monitoreo',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const monitoreo = await verMonitoreoCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
        docente_id: req.auth!.sub,
      });
      res.json({ monitoreo });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/examenes-codigo/:examenId/pausar (global)
examenesCodigoRouter.post(
  '/:id/examenes-codigo/:examenId/pausar',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirExamenesCodigo,
  async (req, res, next) => {
    try {
      await pausarExamenCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
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

// POST /api/materias/:id/examenes-codigo/:examenId/reactivar (global)
examenesCodigoRouter.post(
  '/:id/examenes-codigo/:examenId/reactivar',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirExamenesCodigo,
  async (req, res, next) => {
    try {
      await reactivarExamenCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
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

// POST /api/materias/:id/examenes-codigo/:examenId/cancelar
examenesCodigoRouter.post(
  '/:id/examenes-codigo/:examenId/cancelar',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirExamenesCodigo,
  async (req, res, next) => {
    try {
      const examen = await cancelarExamenCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
        docente_id: req.auth!.sub,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ examen });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/examenes-codigo/:examenId/intentos/:intentoId/pausar
examenesCodigoRouter.post(
  '/:id/examenes-codigo/:examenId/intentos/:intentoId/pausar',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirExamenesCodigo,
  async (req, res, next) => {
    try {
      await pausarIntentoCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
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

// POST /api/materias/:id/examenes-codigo/:examenId/intentos/:intentoId/reactivar
examenesCodigoRouter.post(
  '/:id/examenes-codigo/:examenId/intentos/:intentoId/reactivar',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirExamenesCodigo,
  async (req, res, next) => {
    try {
      await reactivarIntentoCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
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

// ── Resultados ────────────────────────────────────────────────────

// GET /api/materias/:id/examenes-codigo/:examenId/resultados
examenesCodigoRouter.get(
  '/:id/examenes-codigo/:examenId/resultados',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const resultados = await verResultadosCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
        docente_id: req.auth!.sub,
      });
      res.json({ resultados });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/examenes-codigo/:examenId/resultados/:estudianteId
// (detalle: código entregado + resultado por caso de un estudiante)
examenesCodigoRouter.get(
  '/:id/examenes-codigo/:examenId/resultados/:estudianteId',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const detalle = await verDetalleIntentoCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
        estudiante_id: idNumerico.parse(req.params.estudianteId),
        docente_id: req.auth!.sub,
      });
      res.json({ detalle });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/examenes-codigo/:examenId/publicar-notas
examenesCodigoRouter.post(
  '/:id/examenes-codigo/:examenId/publicar-notas',
  autenticar,
  soloDocente,
  cuentaActiva,
  exigirExamenesCodigo,
  async (req, res, next) => {
    try {
      const examen = await publicarNotasCodigo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        examen_codigo_id: idNumerico.parse(req.params.examenId),
        docente_id: req.auth!.sub,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ examen });
    } catch (error) {
      next(error);
    }
  },
);
