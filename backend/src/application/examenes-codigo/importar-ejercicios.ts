// E9 · Importar ejercicios desde Markdown: plantilla fija + parser simple.
// Mismo patrón de dos pasos que evaluaciones/importar-preguntas.ts: previsualizar
// (parsea, no escribe nada) y confirmar (recién ahí crea los ejercicios) — el
// docente revisa antes.

import { Ejercicio } from '../../domain/entidades/examen-codigo';
import { EstadoInvalidoError } from '../../domain/errores';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { ExamenCodigoRepositorio } from '../../domain/repositorios/examen-codigo-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import {
  EjercicioParseado,
  ErrorParseoEjercicio,
  parsearPlantillaMarkdown,
} from '../../infrastructure/parsers/plantilla-examen-codigo-parser';
import { exigirEditable, exigirExamenCodigoPropio } from './gestionar-examenes-codigo';

interface Auditoria {
  ip?: string;
  dispositivo?: string;
}

export class PrevisualizarImportacionEjercicios {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly extraerTexto: (buffer: Buffer) => Promise<string>,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    examen_codigo_id: number;
    docente_id: number;
    archivo: Buffer;
  }): Promise<{ ejercicios: EjercicioParseado[]; errores: ErrorParseoEjercicio[] }> {
    const examen = await exigirExamenCodigoPropio(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );
    exigirEditable(examen);

    const texto = await this.extraerTexto(entrada.archivo);
    return parsearPlantillaMarkdown(texto);
  }
}

export class ConfirmarImportacionEjercicios {
  constructor(
    private readonly examenes: ExamenCodigoRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      examen_codigo_id: number;
      docente_id: number;
      ejercicios: EjercicioParseado[];
    },
  ): Promise<Ejercicio[]> {
    const examen = await exigirExamenCodigoPropio(
      this.examenes,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.examen_codigo_id,
      entrada.docente_id,
    );
    exigirEditable(examen);

    const creados: Ejercicio[] = [];
    for (const ej of entrada.ejercicios) {
      if (ej.casos_prueba.length === 0) {
        throw new EstadoInvalidoError('Cada ejercicio necesita al menos un caso de prueba');
      }
      creados.push(
        await this.examenes.agregarEjercicio(examen.id, {
          enunciado: ej.enunciado,
          plantilla_codigo: ej.plantilla_codigo,
          nota: ej.nota,
          casos_prueba: ej.casos_prueba,
        }),
      );
    }

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'ejercicios_importados',
      entidad: 'examen_codigo',
      entidad_id: String(examen.id),
      valor_nuevo: { cantidad: creados.length },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return creados;
  }
}
