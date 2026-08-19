// E8 · HU-27 · Centralizador de notas por materia: matriz estudiantes ×
// evaluaciones finalizadas (publicadas o no — es una vista del docente,
// no del estudiante). El acumulado (Σ nota_obtenida / Σ nota_total) se
// quitó (ya no se usa) — la nota agregada ahora se calcula en pantalla
// vía "Nota final" (ver CentralizadorPage / calcularNotaFinal más abajo).

import ExcelJS from 'exceljs';
import { ColumnaCentralizador, Centralizador, FilaCentralizador } from '../../domain/entidades/nota';
import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';
import { IntentoRepositorio } from '../../domain/repositorios/intento-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { exigirMateriaPropia } from '../evaluaciones/gestionar-examen';

export class VerCentralizador {
  constructor(
    private readonly materias: MateriaRepositorio,
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly intentos: IntentoRepositorio,
  ) {}

  async ejecutar(entrada: { materia_id: number; docente_id: number }): Promise<Centralizador> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);

    const [evaluacionesFinalizadas, inscripcionesActivas] = await Promise.all([
      this.evaluaciones.listarFinalizadasPorMateria(entrada.materia_id),
      this.inscripciones.listarPorMateria(entrada.materia_id),
    ]);

    const columnas: ColumnaCentralizador[] = evaluacionesFinalizadas.map((e) => ({
      evaluacion_id: e.id,
      tema: e.tema,
      nota_total: e.nota,
    }));

    const notasPorEvaluacion = await Promise.all(
      evaluacionesFinalizadas.map((e) => this.intentos.notasVigentesPorEvaluacion(e.id)),
    );
    // estudiante_id -> evaluacion_id -> nota_obtenida
    const mapa = new Map<number, Map<number, number>>();
    evaluacionesFinalizadas.forEach((evaluacion, indice) => {
      for (const nota of notasPorEvaluacion[indice]) {
        if (!mapa.has(nota.estudiante_id)) mapa.set(nota.estudiante_id, new Map());
        mapa.get(nota.estudiante_id)!.set(evaluacion.id, nota.nota_obtenida);
      }
    });

    const filas: FilaCentralizador[] = inscripcionesActivas.map((inscripcion) => {
      const notasEstudiante = mapa.get(inscripcion.estudiante.id);
      const celdas: Record<number, number | null> = {};
      for (const columna of columnas) {
        celdas[columna.evaluacion_id] = notasEstudiante?.get(columna.evaluacion_id) ?? null;
      }
      return {
        estudiante_id: inscripcion.estudiante.id,
        nombres: inscripcion.estudiante.nombres,
        apellidos: inscripcion.estudiante.apellidos,
        celdas,
      };
    });

    return { columnas, filas };
  }
}

/** Misma fórmula que el frontend (CentralizadorPage): promedia el % de
 * cada evaluación seleccionada (nota_obtenida/nota_total, 0 si no rindió)
 * y recién ahí multiplica una sola vez por la nota base. */
function calcularNotaFinal(
  fila: FilaCentralizador,
  columnas: ColumnaCentralizador[],
  notaBase: number,
): number {
  const sumaPorcentajes = columnas.reduce((acc, c) => {
    if (c.nota_total <= 0) return acc;
    const obtenida = fila.celdas[c.evaluacion_id] ?? 0;
    return acc + obtenida / c.nota_total;
  }, 0);
  return Math.round((sumaPorcentajes / columnas.length) * notaBase * 100) / 100;
}

export class ExportarCentralizador {
  constructor(private readonly verCentralizador: VerCentralizador) {}

  async ejecutar(entrada: {
    materia_id: number;
    docente_id: number;
    nombre_materia: string;
    // Último cálculo de "Nota final" hecho en pantalla (CentralizadorPage):
    // si vienen ambos y hay intersección con las columnas reales, se agrega
    // esa columna extra al Excel. Opcional — sin esto exporta como siempre.
    evaluacion_ids?: number[];
    nota_base?: number;
  }): Promise<ExcelJS.Buffer> {
    const centralizador = await this.verCentralizador.ejecutar(entrada);

    const columnasNotaFinal = entrada.evaluacion_ids
      ? centralizador.columnas.filter((c) => entrada.evaluacion_ids!.includes(c.evaluacion_id))
      : [];
    const incluirNotaFinal =
      !!entrada.nota_base && entrada.nota_base > 0 && columnasNotaFinal.length > 0;

    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Centralizador');

    hoja.columns = [
      { header: 'Estudiante', key: 'estudiante', width: 32 },
      ...centralizador.columnas.map((c) => ({
        header: `${c.tema} (/${c.nota_total})`,
        key: `evaluacion_${c.evaluacion_id}`,
        width: 20,
      })),
      ...(incluirNotaFinal
        ? [{ header: `Nota final (/${entrada.nota_base})`, key: 'nota_final', width: 18 }]
        : []),
    ];
    hoja.getRow(1).font = { bold: true };

    for (const fila of centralizador.filas) {
      const registro: Record<string, string | number> = {
        estudiante: `${fila.apellidos} ${fila.nombres}`,
      };
      for (const columna of centralizador.columnas) {
        const nota = fila.celdas[columna.evaluacion_id];
        registro[`evaluacion_${columna.evaluacion_id}`] = nota ?? '—';
      }
      if (incluirNotaFinal) {
        registro.nota_final = calcularNotaFinal(fila, columnasNotaFinal, entrada.nota_base!);
      }
      hoja.addRow(registro);
    }

    return libro.xlsx.writeBuffer();
  }
}
