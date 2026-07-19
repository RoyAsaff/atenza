// E8 · HU-25 (resultados calculados automáticamente) + HU-26 (el docente
// decide cuándo publicarlos). La finalización automática vive en
// gestionar-examen.ts (finalizarSiCorresponde) y se dispara acá también,
// por si el docente entra a Resultados sin haber pasado antes por
// Monitoreo. calificarPendientes (misma función) también se usa como red
// de seguridad para evaluaciones finalizadas por otra vía (Cancelar), que
// nunca calificaron a nadie.

import { Evaluacion } from '../../domain/entidades/evaluacion';
import { DetalleIntento, PreguntaConRespuesta } from '../../domain/entidades/intento';
import { EstadisticasResultados, FilaMiNota, Resultados } from '../../domain/entidades/nota';
import { EstadoInvalidoError, NoEncontradoError } from '../../domain/errores';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';
import { IntentoRepositorio } from '../../domain/repositorios/intento-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { TiempoRealEmisor } from '../../domain/repositorios/tiempo-real';
import {
  Auditoria,
  calificarPendientes,
  exigirEvaluacionPropia,
  finalizarSiCorresponde,
} from './gestionar-examen';

// ── HU-25 · Ver resultados ────────────────────────────────────────

export class VerResultados {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly intentos: IntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    evaluacion_id: number;
    docente_id: number;
  }): Promise<Resultados> {
    const evaluacion = await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    if (evaluacion.estado === 'borrador' || evaluacion.estado === 'lista') {
      throw new EstadoInvalidoError('La evaluación todavía no se ha lanzado');
    }

    const actualizada = await finalizarSiCorresponde(
      this.evaluaciones,
      this.intentos,
      this.bitacora,
      this.tiempoReal,
      evaluacion,
    );
    if (actualizada.estado !== 'finalizada') {
      throw new EstadoInvalidoError(
        'La evaluación todavía está en curso: algunos estudiantes no han terminado',
      );
    }

    const filas = await this.intentos.listarResultados(actualizada.id);
    const notas = filas.map((f) => f.nota_obtenida);
    const estadisticas: EstadisticasResultados =
      notas.length > 0
        ? {
            promedio: Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100,
            nota_maxima: Math.max(...notas),
            nota_minima: Math.min(...notas),
          }
        : { promedio: 0, nota_maxima: 0, nota_minima: 0 };

    return {
      evaluacion_id: actualizada.id,
      nota_total: actualizada.nota,
      filas,
      estadisticas,
    };
  }
}

// ── HU-25 (detalle) · Ver examen de un estudiante ─────────────────

export class VerDetalleIntento {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly intentos: IntentoRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    evaluacion_id: number;
    estudiante_id: number;
    docente_id: number;
  }): Promise<DetalleIntento> {
    await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );

    const conPreguntas = await this.evaluaciones.buscarConPreguntas(entrada.evaluacion_id);
    if (!conPreguntas) throw new NoEncontradoError('Evaluación');

    const intento = await this.intentos.buscarPorEvaluacionYEstudiante(
      entrada.evaluacion_id,
      entrada.estudiante_id,
    );
    if (!intento) throw new NoEncontradoError('Intento');

    const respuestas = await this.intentos.respuestasDe(intento.id);
    const elegidaPorPregunta = new Map(respuestas.map((r) => [r.pregunta_id, r.opcion_id]));

    // buscarConPreguntas ya devuelve `preguntas` ordenadas por `orden asc`
    // (orden canónico de la evaluación, no el orden barajado del Intento
    // del estudiante) — es lo correcto acá: se compara la misma secuencia
    // de preguntas entre distintos estudiantes.
    const preguntas: PreguntaConRespuesta[] = conPreguntas.preguntas.map((p) => {
      const opcion_elegida_id = elegidaPorPregunta.get(p.id) ?? null;
      const elegida = p.opciones.find((o) => o.id === opcion_elegida_id);
      return {
        id: p.id,
        pregunta: p.pregunta,
        url_imagen: p.url_imagen,
        orden: p.orden,
        opciones: p.opciones.map((o) => ({ id: o.id, texto: o.texto, es_correcta: o.es_correcta })),
        opcion_elegida_id,
        acerto: elegida?.es_correcta ?? false,
      };
    });

    return {
      intento_id: intento.id,
      evaluacion_id: entrada.evaluacion_id,
      estudiante_id: entrada.estudiante_id,
      preguntas,
    };
  }
}

// ── HU-26 · Publicar notas a los estudiantes ─────────────────────

export class PublicarNotas {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly intentos: IntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & { materia_id: number; evaluacion_id: number; docente_id: number },
  ): Promise<Evaluacion> {
    const evaluacion = await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    if (evaluacion.estado !== 'finalizada') {
      throw new EstadoInvalidoError('La evaluación debe estar finalizada para publicar notas');
    }
    if (evaluacion.publicada) {
      throw new EstadoInvalidoError('Las notas de esta evaluación ya están publicadas');
    }

    // Red de seguridad: si llegó a "finalizada" por otra vía (Cancelar)
    // y nunca se calificó a nadie, no publicar notas vacías.
    await calificarPendientes(this.evaluaciones, this.intentos, evaluacion);

    const actualizada = await this.evaluaciones.marcarPublicada(evaluacion.id);

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'notas_publicadas',
      entidad: 'evaluacion',
      entidad_id: String(evaluacion.id),
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizada;
  }
}

// ── HU-26 Esc. 1/2 · "Mis notas" (estudiante) ────────────────────
// Solo evaluaciones publicadas por el docente; si el estudiante no fue
// convocado (no le corresponde una nota) o el docente aún no publicó,
// esa evaluación simplemente no aparece en la lista.

export class VerMisNotas {
  constructor(
    private readonly materias: MateriaRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly intentos: IntentoRepositorio,
  ) {}

  async ejecutar(entrada: { materia_id: number; estudiante_id: number }): Promise<FilaMiNota[]> {
    const materia = await this.materias.buscarPorId(entrada.materia_id);
    if (!materia) throw new NoEncontradoError('Materia');

    const inscripcion = await this.inscripciones.buscarPorEstudianteYMateria(
      entrada.estudiante_id,
      entrada.materia_id,
    );
    if (!inscripcion || inscripcion.retirado) {
      // Mismo 404 para no revelar materias ajenas (patrón de E3/E4/E5).
      throw new NoEncontradoError('Materia');
    }

    const publicadas = await this.evaluaciones.listarPublicadasPorMateria(entrada.materia_id);
    const filas: FilaMiNota[] = [];
    for (const evaluacion of publicadas) {
      const intento = await this.intentos.buscarPorEvaluacionYEstudiante(
        evaluacion.id,
        entrada.estudiante_id,
      );
      if (!intento) continue; // no fue convocado a esta evaluación (HU-20)

      // Red de seguridad: evaluaciones finalizadas por otra vía (Cancelar)
      // o publicadas antes de este cálculo pueden no tener Nota todavía.
      // No depende de que el docente vuelva a abrir Resultados/Monitoreo.
      await calificarPendientes(this.evaluaciones, this.intentos, evaluacion);

      const nota = await this.intentos.notaVigentePorIntento(intento.id);
      if (!nota) continue;

      filas.push({
        evaluacion_id: evaluacion.id,
        tema: evaluacion.tema,
        nota_total: evaluacion.nota,
        aciertos: nota.aciertos,
        total_preguntas: nota.total_preguntas,
        nota_obtenida: nota.nota_obtenida,
        fecha_publicacion: evaluacion.fecha_publicacion!,
      });
    }
    return filas;
  }
}

// ── HU-25/26 (detalle) · "Ver examen" — el propio estudiante revisa
// cómo respondió, con la opción correcta visible (evaluación ya
// finalizada y publicada, sin riesgo de fuga). Mismo shape que
// VerDetalleIntento (docente), distinta autorización (estudiante
// dueño del intento, no docente dueño de la materia). ──────────────

export class VerMiDetalleIntento {
  constructor(
    private readonly materias: MateriaRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly intentos: IntentoRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    evaluacion_id: number;
    estudiante_id: number;
  }): Promise<DetalleIntento> {
    const materia = await this.materias.buscarPorId(entrada.materia_id);
    if (!materia) throw new NoEncontradoError('Materia');

    const inscripcion = await this.inscripciones.buscarPorEstudianteYMateria(
      entrada.estudiante_id,
      entrada.materia_id,
    );
    if (!inscripcion || inscripcion.retirado) {
      throw new NoEncontradoError('Materia');
    }

    const publicadas = await this.evaluaciones.listarPublicadasPorMateria(entrada.materia_id);
    if (!publicadas.some((e) => e.id === entrada.evaluacion_id)) {
      throw new NoEncontradoError('Evaluación');
    }

    const conPreguntas = await this.evaluaciones.buscarConPreguntas(entrada.evaluacion_id);
    if (!conPreguntas) throw new NoEncontradoError('Evaluación');

    const intento = await this.intentos.buscarPorEvaluacionYEstudiante(
      entrada.evaluacion_id,
      entrada.estudiante_id,
    );
    if (!intento) throw new NoEncontradoError('Intento');

    const respuestas = await this.intentos.respuestasDe(intento.id);
    const elegidaPorPregunta = new Map(respuestas.map((r) => [r.pregunta_id, r.opcion_id]));

    const preguntas: PreguntaConRespuesta[] = conPreguntas.preguntas.map((p) => {
      const opcion_elegida_id = elegidaPorPregunta.get(p.id) ?? null;
      const elegida = p.opciones.find((o) => o.id === opcion_elegida_id);
      return {
        id: p.id,
        pregunta: p.pregunta,
        url_imagen: p.url_imagen,
        orden: p.orden,
        opciones: p.opciones.map((o) => ({ id: o.id, texto: o.texto, es_correcta: o.es_correcta })),
        opcion_elegida_id,
        acerto: elegida?.es_correcta ?? false,
      };
    });

    return {
      intento_id: intento.id,
      evaluacion_id: entrada.evaluacion_id,
      estudiante_id: entrada.estudiante_id,
      preguntas,
    };
  }
}
