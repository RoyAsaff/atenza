// Importar preguntas desde Word (.docx): plantilla fija + parser simple.
// Dos pasos separados a propósito: previsualizar (parsea, no escribe nada)
// y confirmar (recién ahí crea las preguntas) — el docente revisa antes.

import { Pregunta } from '../../domain/entidades/evaluacion';
import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import {
  ErrorParseoPregunta,
  parsearPlantillaHtml,
  PreguntaParseada,
} from '../../infrastructure/parsers/plantilla-examen-parser';
import { exigirEditable, exigirEvaluacionPropia } from './gestionar-evaluaciones';

interface Auditoria {
  ip?: string;
  dispositivo?: string;
}

export class PrevisualizarImportacionPreguntas {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly extraerHtml: (buffer: Buffer) => Promise<string>,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    evaluacion_id: number;
    docente_id: number;
    archivo: Buffer;
  }): Promise<{ preguntas: PreguntaParseada[]; errores: ErrorParseoPregunta[] }> {
    const evaluacion = await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    exigirEditable(evaluacion);

    const html = await this.extraerHtml(entrada.archivo);
    return parsearPlantillaHtml(html);
  }
}

export class ConfirmarImportacionPreguntas {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      evaluacion_id: number;
      docente_id: number;
      preguntas: PreguntaParseada[];
    },
  ): Promise<Pregunta[]> {
    const evaluacion = await exigirEvaluacionPropia(
      this.evaluaciones,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.evaluacion_id,
      entrada.docente_id,
    );
    exigirEditable(evaluacion);

    const creadas: Pregunta[] = [];
    for (const p of entrada.preguntas) {
      creadas.push(
        await this.evaluaciones.agregarPregunta(evaluacion.id, {
          pregunta: p.pregunta,
          opciones: p.opciones,
        }),
      );
    }

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'preguntas_importadas',
      entidad: 'evaluacion',
      entidad_id: String(evaluacion.id),
      valor_nuevo: { cantidad: creadas.length },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return creadas;
  }
}
