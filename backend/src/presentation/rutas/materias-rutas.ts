// E3/E4/E5 — rutas del docente sobre sus materias (código, nómina, clases,
// asistencia). El pago/plan de la cuenta vive en cuenta-rutas.ts (17/07).

import { Router } from 'express';
import { z } from 'zod';
import {
  actualizarClase,
  crearClase,
  crearMateria,
  cuentaActiva,
  eliminarClase,
  generarCalendario,
  gestionarCodigoMateria,
  guardarAsistencia,
  materiaRepositorio,
  retirarEstudiante,
  sesionRepositorio,
  tokenService,
  verClases,
  verConsolidadoAsistencia,
  verListaAsistencia,
  verMiAsistencia,
  verMisNotas,
  verNomina,
} from '../dependencias';
import { crearAutenticar } from '../middlewares/autenticar';
import { autorizarContexto } from '../middlewares/autorizar';

export const materiasRouter = Router();

const autenticar = crearAutenticar(tokenService, sesionRepositorio);
const soloDocente = autorizarContexto('docente');

const idNumerico = z.coerce.number().int().positive();

const esquemaMateria = z.object({
  nombre_materia: z.string().min(1),
  sigla: z.string().optional(),
  carrera: z.string().min(1),
  semestre: z.string().min(1),
  universidad: z.string().min(1),
});

// POST /api/materias — crear materia (SaaS por cuenta: no requiere pago propio)
materiasRouter.post('/', autenticar, soloDocente, cuentaActiva, async (req, res, next) => {
  try {
    const datos = esquemaMateria.parse(req.body);
    const materia = await crearMateria.ejecutar({
      ...datos,
      usuario_id: req.auth!.sub,
      ip: req.ip,
      dispositivo: req.headers['user-agent'],
    });
    res.status(201).json({ materia });
  } catch (error) {
    next(error);
  }
});

// GET /api/materias — materias del docente (reemplaza el detalle de /precio-vigente)
materiasRouter.get('/', autenticar, soloDocente, async (req, res, next) => {
  try {
    const materias = await materiaRepositorio.listarPorDocente(req.auth!.sub);
    res.json({ materias });
  } catch (error) {
    next(error);
  }
});

// ── E3 · HU-11 y HU-12 (docente dueño de la materia) ─────────────
// Nota: estas rutas con :id van después de las rutas estáticas de arriba
// para que Express no las capture como parámetro.

// GET /api/materias/:id — detalle para la web (código, estado)
materiasRouter.get('/:id', autenticar, soloDocente, async (req, res, next) => {
  try {
    const id = idNumerico.parse(req.params.id);
    const materia = await materiaRepositorio.buscarPorId(id);
    if (!materia || materia.docente_id !== req.auth!.sub) {
      return res
        .status(404)
        .json({ error: 'NO_ENCONTRADO', mensaje: 'Materia no encontrada' });
    }
    res.json({ materia });
  } catch (error) {
    next(error);
  }
});

// GET /api/materias/:id/nomina — HU-12 (orden por apellidos + búsqueda)
materiasRouter.get('/:id/nomina', autenticar, soloDocente, async (req, res, next) => {
  try {
    const nomina = await verNomina.ejecutar({
      materia_id: idNumerico.parse(req.params.id),
      docente_id: req.auth!.sub,
      buscar: typeof req.query.buscar === 'string' ? req.query.buscar : undefined,
    });
    res.json({ nomina });
  } catch (error) {
    next(error);
  }
});

// POST /api/materias/:id/codigo/regenerar — HU-11 (invalida el anterior)
materiasRouter.post(
  '/:id/codigo/regenerar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const resultado = await gestionarCodigoMateria.regenerar({
        materia_id: idNumerico.parse(req.params.id),
        docente_id: req.auth!.sub,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/materias/:id/codigo — HU-11 (desactivar/activar el código)
materiasRouter.patch(
  '/:id/codigo',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const { activo } = z.object({ activo: z.boolean() }).parse(req.body);
      const resultado = await gestionarCodigoMateria.cambiarEstado({
        materia_id: idNumerico.parse(req.params.id),
        docente_id: req.auth!.sub,
        activo,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },
);

// ── E4 · HU-13 y HU-14 (clases y calendario) ─────────────────────

const esquemaFecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (usa AAAA-MM-DD)')
  .transform((v) => new Date(`${v}T00:00:00.000Z`));
const esquemaHora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (usa HH:MM)');

// GET /api/materias/:id/clases — docente dueño o estudiante inscrito
materiasRouter.get(
  '/:id/clases',
  autenticar,
  autorizarContexto('docente', 'estudiante'),
  async (req, res, next) => {
    try {
      const clases = await verClases.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        usuario_id: req.auth!.sub,
      });
      res.json({ clases });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/clases — HU-13
materiasRouter.post(
  '/:id/clases',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const datos = z
        .object({ fecha: esquemaFecha, hora: esquemaHora, tema: z.string().min(1) })
        .parse(req.body);
      const clase = await crearClase.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        docente_id: req.auth!.sub,
        ...datos,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.status(201).json({ clase });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/clases/generar — HU-14
materiasRouter.post(
  '/:id/clases/generar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const datos = z
        .object({
          dias_semana: z.array(z.number().int().min(1).max(7)).min(1), // 1=lunes … 7=domingo
          hora: esquemaHora,
          fecha_inicio: esquemaFecha,
          fecha_fin: esquemaFecha,
          tema: z.string().min(1).default('Clase'),
        })
        .parse(req.body);
      const resultado = await generarCalendario.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        docente_id: req.auth!.sub,
        ...datos,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.status(201).json({
        total_creadas: resultado.creadas.length,
        omitidas: resultado.omitidas,
        clases: resultado.creadas,
      });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/materias/:id/clases/:claseId — editar clase individual (HU-14 Esc. 2)
materiasRouter.patch(
  '/:id/clases/:claseId',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const datos = z
        .object({
          fecha: esquemaFecha.optional(),
          hora: esquemaHora.optional(),
          tema: z.string().min(1).optional(),
        })
        .parse(req.body);
      const clase = await actualizarClase.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        clase_id: idNumerico.parse(req.params.claseId),
        docente_id: req.auth!.sub,
        ...datos,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ clase });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/materias/:id/clases/:claseId — eliminar clase (feriado, suspensión)
materiasRouter.delete(
  '/:id/clases/:claseId',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      await eliminarClase.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        clase_id: idNumerico.parse(req.params.claseId),
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

// POST /api/materias/:id/inscripciones/:inscripcionId/retirar — HU-12
materiasRouter.post(
  '/:id/inscripciones/:inscripcionId/retirar',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      await retirarEstudiante.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        inscripcion_id: idNumerico.parse(req.params.inscripcionId),
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

// ── E5 · HU-15 y HU-16 (asistencia manual) ───────────────────────

const esquemaMarcaje = z.object({
  estudiante_id: idNumerico,
  marcaje: z.enum(['puntual', 'atrasado', 'licencia', 'falta']),
});

// GET /api/materias/:id/clases/:claseId/asistencia — HU-15: nómina para pasar lista
materiasRouter.get(
  '/:id/clases/:claseId/asistencia',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const lista = await verListaAsistencia.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        clase_id: idNumerico.parse(req.params.claseId),
        docente_id: req.auth!.sub,
      });
      res.json({ lista });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/materias/:id/clases/:claseId/asistencia — HU-15: guardar/corregir
materiasRouter.post(
  '/:id/clases/:claseId/asistencia',
  autenticar,
  soloDocente,
  cuentaActiva,
  async (req, res, next) => {
    try {
      const { marcajes } = z
        .object({ marcajes: z.array(esquemaMarcaje) })
        .parse(req.body);
      const asistencias = await guardarAsistencia.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        clase_id: idNumerico.parse(req.params.claseId),
        docente_id: req.auth!.sub,
        marcajes,
        ip: req.ip,
        dispositivo: req.headers['user-agent'],
      });
      res.json({ asistencias });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/asistencia/consolidado — HU-16
materiasRouter.get(
  '/:id/asistencia/consolidado',
  autenticar,
  soloDocente,
  async (req, res, next) => {
    try {
      const consolidado = await verConsolidadoAsistencia.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        docente_id: req.auth!.sub,
      });
      res.json({ consolidado });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/mi-asistencia — diagrama E5 (actor Estudiante): Ver Asistencias
materiasRouter.get(
  '/:id/mi-asistencia',
  autenticar,
  autorizarContexto('estudiante'),
  async (req, res, next) => {
    try {
      const lista = await verMiAsistencia.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        estudiante_id: req.auth!.sub,
      });
      res.json({ lista });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/materias/:id/mis-notas — E8 · HU-26 Esc. 1/2 (estudiante)
materiasRouter.get(
  '/:id/mis-notas',
  autenticar,
  autorizarContexto('estudiante'),
  async (req, res, next) => {
    try {
      const notas = await verMisNotas.ejecutar({
        materia_id: idNumerico.parse(req.params.id),
        estudiante_id: req.auth!.sub,
      });
      res.json({ notas });
    } catch (error) {
      next(error);
    }
  },
);
