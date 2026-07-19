// E6 · HU-17 (crear evaluación), HU-18 (preguntas/opciones/imagen/orden),
// HU-19 (guardar → Lista, demostración, bloqueo de edición al lanzar)

import { Router } from 'express';
import { z } from 'zod';
import {
  actualizarEvaluacion,
  actualizarPregunta,
  agregarPregunta,
  cancelarEvaluacion,
  confirmarImportacionPreguntas,
  crearEvaluacion,
  cuentaActiva,
  demostracionEvaluacion,
  eliminarPregunta,
  exportarCentralizador,
  guardarEvaluacion,
  lanzarEvaluacion,
  materiaRepositorio,
  pausarEvaluacion,
  pausarIntento,
  previsualizarImportacionPreguntas,
  publicarNotas,
  reactivarEvaluacion,
  reactivarIntento,
  reordenarPreguntas,
  sesionRepositorio,
  subirImagenPregunta,
  tokenService,
  verCentralizador,
  verDetalleIntento,
  verEvaluacion,
  verEvaluaciones,
  verEvaluacionesMateria,
  verMiDetalleIntento,
  verMonitoreo,
  verResultados,
} from '../dependencias';
import { crearAutenticar } from '../middlewares/autenticar';
import { autorizarContexto } from '../middlewares/autorizar';
import { rutaPublica, subirArchivo, subirDocumento } from '../middlewares/subir-archivos';

export const evaluacionesRouter = Router();

const autenticar = crearAutenticar(tokenService, sesionRepositorio);
const soloDocente = autorizarContexto('docente');
const soloEstudiante = autorizarContexto('estudiante');
const idNumerico = z.coerce.number().int().positive();

const esquemaOpcion = z.object({
  texto: z.string().min(1),
  es_correcta: z.boolean(),
});

// HU-18 Esc. 2: 2-4 opciones y exactamente una marcada correcta
const esquemaPregunta = z
  .object({
    pregunta: z.string().min(1),
    opciones: z.array(esquemaOpcion).min(2).max(4),
  })
  .refine((d) => d.opciones.filter((o) => o.es_correcta).length === 1, {
    message: 'Marca exactamente una opción correcta',
    path: ['opciones'],
  });

// POST /api/materias/:id/clases/:claseId/evaluaciones — HU-17
evaluacionesRouter.post(
  '/:id/clases/:claseId/evaluaciones',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const { tema, nota } = z
        .object({ tema: z.string().min(1), nota: z.number().int().positive() })
        .parse(req.body);
      const evaluacion = await crearEvaluacion.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        clase_id: idNumerico.parse(req.params.claseId),
        docente_id: req.auth!.sub,
        tema,
        nota,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.status(201).json({ evaluacion });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/clases/:claseId/evaluaciones
evaluacionesRouter.get(
  '/:id/clases/:claseId/evaluaciones',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const evaluaciones = await verEvaluaciones.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        clase_id: idNumerico.parse(req.params.claseId),
        docente_id: req.auth!.sub,
      });
      res.json({ evaluaciones });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/evaluaciones — todas las evaluaciones de la materia
// (cualquier clase), para la vista "Evaluaciones" a nivel materia.
evaluacionesRouter.get('/:id/evaluaciones', autenticar, soloDocente, async (req, res, next) => {
  try {
    const evaluaciones = await verEvaluacionesMateria.ejecutar({
      materia_id: idNumerico.parse(req.params.id),
      docente_id: req.auth!.sub,
    });
    res.json({ evaluaciones });
  } catch (error) {
    next(error);
  }
});

// GET /api/materias/:id/evaluaciones/:evalId — detalle con preguntas (editor)
evaluacionesRouter.get(
  '/:id/evaluaciones/:evalId',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const evaluacion = await verEvaluacion.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        docente_id: req.auth!.sub,
      });
      res.json({ evaluacion });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/materias/:id/evaluaciones/:evalId — editar tema/nota
evaluacionesRouter.patch(
  '/:id/evaluaciones/:evalId',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const datos = z
        .object({
          tema: z.string().min(1).optional(),
          nota: z.number().int().positive().optional(),
          // HU-24 (D-07): límite opcional en minutos; null lo quita.
          tiempo_limite_minutos: z.number().int().positive().nullable().optional(),
        })
        .parse(req.body);
      const evaluacion = await actualizarEvaluacion.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        docente_id: req.auth!.sub,
        ...datos,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ evaluacion });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/evaluaciones/:evalId/preguntas — HU-18 Esc. 1
evaluacionesRouter.post(
  '/:id/evaluaciones/:evalId/preguntas',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const datos = esquemaPregunta.parse(req.body);
      const pregunta = await agregarPregunta.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        docente_id: req.auth!.sub,
        ...datos,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.status(201).json({ pregunta });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/evaluaciones/:evalId/preguntas/importar/previsualizar
// Importar preguntas desde Word: parsea el .docx y devuelve lo que entendió,
// sin escribir nada todavía (el docente revisa antes de confirmar).
evaluacionesRouter.post(
  '/:id/evaluaciones/:evalId/preguntas/importar/previsualizar',
  autenticar,
  soloDocente,
  cuentaActiva,
  subirDocumento.single('archivo'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'ARCHIVO_REQUERIDO',
          mensaje: 'Adjunta el archivo .docx en el campo "archivo"',
        });
      }
      const resultado = await previsualizarImportacionPreguntas.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        docente_id: req.auth!.sub,
        archivo: req.file.buffer,
      });
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/evaluaciones/:evalId/preguntas/importar/confirmar
// Crea las preguntas ya parseadas (y revisadas por el docente en el frontend).
evaluacionesRouter.post(
  '/:id/evaluaciones/:evalId/preguntas/importar/confirmar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const { preguntas } = z.object({ preguntas: z.array(esquemaPregunta).min(1) }).parse(req.body);
      const creadas = await confirmarImportacionPreguntas.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        docente_id: req.auth!.sub,
        preguntas,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.status(201).json({ preguntas: creadas });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/materias/:id/evaluaciones/:evalId/preguntas/reordenar — HU-18 Esc. 1
// (ruta estática antes de "/preguntas/:preguntaId" para que Express no la
// confunda con un id de pregunta)
evaluacionesRouter.patch(
  '/:id/evaluaciones/:evalId/preguntas/reordenar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const { orden } = z.object({ orden: z.array(idNumerico).min(1) }).parse(req.body);
      await reordenarPreguntas.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
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

// PATCH /api/materias/:id/evaluaciones/:evalId/preguntas/:preguntaId — editar
evaluacionesRouter.patch(
  '/:id/evaluaciones/:evalId/preguntas/:preguntaId',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const datos = esquemaPregunta.parse(req.body);
      const pregunta = await actualizarPregunta.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        pregunta_id: idNumerico.parse(req.params.preguntaId),
        docente_id: req.auth!.sub,
        ...datos,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ pregunta });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/materias/:id/evaluaciones/:evalId/preguntas/:preguntaId
evaluacionesRouter.delete(
  '/:id/evaluaciones/:evalId/preguntas/:preguntaId',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      await eliminarPregunta.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        pregunta_id: idNumerico.parse(req.params.preguntaId),
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

// POST /api/materias/:id/evaluaciones/:evalId/preguntas/:preguntaId/imagen — HU-18 Esc. 3
evaluacionesRouter.post(
  '/:id/evaluaciones/:evalId/preguntas/:preguntaId/imagen',
  autenticar,
  soloDocente,
  cuentaActiva,
  subirArchivo.single('imagen'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'ARCHIVO_REQUERIDO',
          mensaje: 'Adjunta la imagen en el campo "imagen"',
        });
      }
      const pregunta = await subirImagenPregunta.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        pregunta_id: idNumerico.parse(req.params.preguntaId),
        docente_id: req.auth!.sub,
        url_imagen: rutaPublica(req.file.filename),
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ pregunta });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/evaluaciones/:evalId/guardar — HU-19 Esc. 1 (Borrador → Lista)
evaluacionesRouter.post(
  '/:id/evaluaciones/:evalId/guardar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const evaluacion = await guardarEvaluacion.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        docente_id: req.auth!.sub,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ evaluacion });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/evaluaciones/:evalId/demostracion — HU-19 Esc. 2
evaluacionesRouter.get(
  '/:id/evaluaciones/:evalId/demostracion',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const demostracion = await demostracionEvaluacion.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        docente_id: req.auth!.sub,
      });
      res.json({ demostracion });
    } catch (error) {
      next(error);
    }
  },
);

// ── E7 · HU-20 (lanzar), HU-22 (monitoreo), HU-23 (pausar/reactivar/cancelar) ──

// POST /api/materias/:id/evaluaciones/:evalId/lanzar — HU-20
evaluacionesRouter.post(
  '/:id/evaluaciones/:evalId/lanzar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const evaluacion = await lanzarEvaluacion.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        docente_id: req.auth!.sub,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ evaluacion });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/evaluaciones/:evalId/monitoreo — HU-22
evaluacionesRouter.get(
  '/:id/evaluaciones/:evalId/monitoreo',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const monitoreo = await verMonitoreo.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        docente_id: req.auth!.sub,
      });
      res.json({ monitoreo });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/evaluaciones/:evalId/pausar — HU-23 Esc. 2 (global)
evaluacionesRouter.post(
  '/:id/evaluaciones/:evalId/pausar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      await pausarEvaluacion.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
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

// POST /api/materias/:id/evaluaciones/:evalId/reactivar — reanuda a todos los pausados
evaluacionesRouter.post(
  '/:id/evaluaciones/:evalId/reactivar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      await reactivarEvaluacion.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
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

// POST /api/materias/:id/evaluaciones/:evalId/cancelar — HU-23 Esc. 2
evaluacionesRouter.post(
  '/:id/evaluaciones/:evalId/cancelar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const evaluacion = await cancelarEvaluacion.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        docente_id: req.auth!.sub,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ evaluacion });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/evaluaciones/:evalId/intentos/:intentoId/pausar — HU-23 Esc. 1
evaluacionesRouter.post(
  '/:id/evaluaciones/:evalId/intentos/:intentoId/pausar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      await pausarIntento.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
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

// POST /api/materias/:id/evaluaciones/:evalId/intentos/:intentoId/reactivar — HU-23 Esc. 1
evaluacionesRouter.post(
  '/:id/evaluaciones/:evalId/intentos/:intentoId/reactivar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      await reactivarIntento.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
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

// ── E8 · HU-25 (resultados), HU-26 (publicar), HU-27 (centralizador) ──

// GET /api/materias/:id/evaluaciones/:evalId/resultados — HU-25
// (se autofinaliza acá también, por si no se pasó antes por Monitoreo)
evaluacionesRouter.get(
  '/:id/evaluaciones/:evalId/resultados',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const resultados = await verResultados.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        docente_id: req.auth!.sub,
      });
      res.json({ resultados });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/evaluaciones/:evalId/resultados/:estudianteId — HU-25
// (detalle "Ver examen": qué respondió un estudiante y si acertó)
evaluacionesRouter.get(
  '/:id/evaluaciones/:evalId/resultados/:estudianteId',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const detalle = await verDetalleIntento.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        estudiante_id: idNumerico.parse(req.params.estudianteId),
        docente_id: req.auth!.sub,
      });
      res.json({ detalle });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/evaluaciones/:evalId/mi-detalle — HU-25/26
// (el estudiante revisa su propio examen: qué respondió y si acertó)
evaluacionesRouter.get(
  '/:id/evaluaciones/:evalId/mi-detalle',
  autenticar,
  soloEstudiante,
  async (req, res, next) => {
    try {
      const detalle = await verMiDetalleIntento.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        estudiante_id: req.auth!.sub,
      });
      res.json({ detalle });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/evaluaciones/:evalId/publicar-notas — HU-26
evaluacionesRouter.post(
  '/:id/evaluaciones/:evalId/publicar-notas',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const evaluacion = await publicarNotas.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        evaluacion_id: idNumerico.parse(req.params.evalId),
        docente_id: req.auth!.sub,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ evaluacion });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/centralizador — HU-27
evaluacionesRouter.get('/:id/centralizador', autenticar, soloDocente, async (req, res, next) => {
  try {
    const centralizador = await verCentralizador.ejecutar({
      materia_id: idNumerico.parse(req.params.id),
      docente_id: req.auth!.sub,
    });
    res.json({ centralizador });
  } catch (error) {
    next(error);
  }
});

// GET /api/materias/:id/centralizador/exportar — HU-27 (descarga .xlsx)
evaluacionesRouter.get(
  '/:id/centralizador/exportar',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const materia_id = idNumerico.parse(req.params.id);
      const materia = await materiaRepositorio.buscarPorId(materia_id);
      const buffer = await exportarCentralizador.ejecutar({
        materia_id,
        docente_id: req.auth!.sub,
        nombre_materia: materia?.nombre_materia ?? 'materia',
      });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="centralizador_${materia_id}.xlsx"`,
      );
      res.send(Buffer.from(buffer));
    } catch (error) {
      next(error);
    }
  },
);
