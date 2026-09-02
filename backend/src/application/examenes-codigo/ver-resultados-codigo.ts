// E9 · Resultados, publicación de notas y "mis notas" para exámenes de
// código — calcado de evaluaciones/ver-resultados.ts.

import { ExamenCodigo } from '../../domain/entidades/examen-codigo';
import {
  DetalleIntentoCodigo,
  EjercicioConRespuesta,
  EstadisticasResultadosCodigo,
  FilaMiNotaCodigo,
  ResultadosCodigo,
} from '../../domain/entidades/intento-codigo';
import { EstadoInvalidoError, NoEncontradoError } from '../../domain/errores';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { ExamenCodigoRepositorio } from '../../domain/repositorios/examen-codigo-repositorio';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';
import { IntentoCodigoRepositorio } from '../../domain/repositorios/intento-codigo-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { TiempoRealEmisor } from '../../domain/repositorios/tiempo-real';
import {
  Auditoria,
  calificarPendientes,
  finalizarSiCorresponde,
} from './gestionar-examen-codigo';
import { exigirExamenCodigoPropio } from './gestionar-examenes-codigo';

// ── Ver resultados ────────────────────────────────────────────────

export class VerResultadosCodigo {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly intentos: IntentoCodigoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    examen_codigo_id: number;
    docente_id: number;
  }): Promise<ResultadosCodigo> {
    const examen = await exigirExamenCodigoPropio(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );
    if (examen.estado === 'borrador' || examen.estado === 'lista') {
      throw new EstadoInvalidoError('El examen todavía no se ha lanzado');
    }

    const actualizado = await finalizarSiCorresponde(
      this.examenes,
      this.intentos,
      this.bitacora,
      this.tiempoReal,
      examen,
    );
    if (actualizado.estado !== 'finalizada') {
      throw new EstadoInvalidoError(
        'El examen todavía está en curso: algunos estudiantes no han terminado',
      );
    }

    const filas = await this.intentos.listarResultados(actualizado.id);
    const notas = filas.map((f) => f.nota_obtenida);
    const estadisticas: EstadisticasResultadosCodigo =
      notas.length > 0
        ? {
            promedio: Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100,
            nota_maxima: Math.max(...notas),
            nota_minima: Math.min(...notas),
          }
        : { promedio: 0, nota_maxima: 0, nota_minima: 0 };

    return { examen_codigo_id: actualizado.id, nota_total: actualizado.nota, filas, estadisticas };
  }
}

// ── Ver examen de un estudiante (código entregado + detalle por caso) ───

export class VerDetalleIntentoCodigo {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly intentos: IntentoCodigoRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    examen_codigo_id: number;
    estudiante_id: number;
    docente_id: number;
  }): Promise<DetalleIntentoCodigo> {
    await exigirExamenCodigoPropio(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );

    const conEjercicios = await this.examenes.buscarConEjercicios(entrada.examen_codigo_id);
    if (!conEjercicios) throw new NoEncontradoError('Examen de código');

    const intento = await this.intentos.buscarPorExamenYEstudiante(
      entrada.examen_codigo_id,
      entrada.estudiante_id,
    );
    if (!intento) throw new NoEncontradoError('Intento');

    const respuestas = await this.intentos.respuestasDe(intento.id);
    const porEjercicio = new Map(respuestas.map((r) => [r.ejercicio_id, r]));

    const ejercicios: EjercicioConRespuesta[] = conEjercicios.ejercicios.map((e) => {
      const respuesta = porEjercicio.get(e.id);
      return {
        id: e.id,
        enunciado: e.enunciado,
        orden: e.orden,
        codigo_fuente: respuesta?.codigo_fuente ?? null,
        casos_acertados: respuesta?.casos_acertados ?? 0,
        casos_totales: respuesta?.casos_totales ?? 0,
        resultado_json: respuesta?.resultado_json ?? null,
      };
    });

    return {
      intento_id: intento.id,
      examen_codigo_id: entrada.examen_codigo_id,
      estudiante_id: entrada.estudiante_id,
      ejercicios,
    };
  }
}

// ── Publicar notas a los estudiantes ─────────────────────────────

export class PublicarNotasCodigo {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly intentos: IntentoCodigoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & { materia_id: number; examen_codigo_id: number; docente_id: number },
  ): Promise<ExamenCodigo> {
    const examen = await exigirExamenCodigoPropio(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );
    if (examen.estado !== 'finalizada') {
      throw new EstadoInvalidoError('El examen debe estar finalizado para publicar notas');
    }
    if (examen.publicada) {
      throw new EstadoInvalidoError('Las notas de este examen ya están publicadas');
    }

    await calificarPendientes(this.examenes, this.intentos, examen);

    const actualizado = await this.examenes.marcarPublicada(examen.id);

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'notas_codigo_publicadas',
      entidad: 'examen_codigo',
      entidad_id: String(examen.id),
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizado;
  }
}

// ── "Mis notas" (estudiante) ─────────────────────────────────────

export class VerMisNotasCodigo {
  constructor(
    private readonly materias: MateriaRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly intentos: IntentoCodigoRepositorio,
  ) {}

  async ejecutar(entrada: { materia_id: number; estudiante_id: number }): Promise<FilaMiNotaCodigo[]> {
    const materia = await this.materias.buscarPorId(entrada.materia_id);
    if (!materia) throw new NoEncontradoError('Materia');

    const inscripcion = await this.inscripciones.buscarPorEstudianteYMateria(
      entrada.estudiante_id,
      entrada.materia_id,
    );
    if (!inscripcion || inscripcion.retirado) {
      throw new NoEncontradoError('Materia');
    }

    const publicados = await this.examenes.listarPublicadosPorMateria(entrada.materia_id);
    const filas: FilaMiNotaCodigo[] = [];
    for (const examen of publicados) {
      const intento = await this.intentos.buscarPorExamenYEstudiante(examen.id, entrada.estudiante_id);
      if (!intento) continue;

      await calificarPendientes(this.examenes, this.intentos, examen);

      const nota = await this.intentos.notaVigentePorIntento(intento.id);
      if (!nota) continue;

      filas.push({
        examen_codigo_id: examen.id,
        tema: examen.tema,
        nota_total: examen.nota,
        casos_acertados: nota.casos_acertados,
        casos_totales: nota.casos_totales,
        nota_obtenida: nota.nota_obtenida,
        fecha_publicacion: examen.fecha_publicacion!,
      });
    }
    return filas;
  }
}
