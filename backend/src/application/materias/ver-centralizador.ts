// E8 · HU-27 · Centralizador de notas por materia: matriz estudiantes ×
// evaluaciones finalizadas (publicadas o no — es una vista del docente,
// no del estudiante) con el acumulado (Σ nota_obtenida / Σ nota_total).
// Un estudiante no convocado a una evaluación (HU-20: solo Puntual/
// Atraso, o faltó) cuenta como 0 en esa evaluación (decisión de Roy).

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
      let acumuladoObtenido = 0;
      let acumuladoTotal = 0;
      for (const columna of columnas) {
        const nota = notasEstudiante?.get(columna.evaluacion_id);
        celdas[columna.evaluacion_id] = nota ?? null;
        // Estudiante no convocado a esa evaluación (HU-20: solo Puntual/
        // Atraso, o faltó): cuenta como 0 en el acumulado (decisión de Roy).
        acumuladoObtenido += nota ?? 0;
        acumuladoTotal += columna.nota_total;
      }
      return {
        estudiante_id: inscripcion.estudiante.id,
        nombres: inscripcion.estudiante.nombres,
        apellidos: inscripcion.estudiante.apellidos,
        celdas,
        acumulado_obtenido: Math.round(acumuladoObtenido * 100) / 100,
        acumulado_total: acumuladoTotal,
      };
    });

    return { columnas, filas };
  }
}

export class ExportarCentralizador {
  constructor(private readonly verCentralizador: VerCentralizador) {}

  async ejecutar(entrada: {
    materia_id: number;
    docente_id: number;
    nombre_materia: string;
  }): Promise<ExcelJS.Buffer> {
    const centralizador = await this.verCentralizador.ejecutar(entrada);

    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Centralizador');

    hoja.columns = [
      { header: 'Estudiante', key: 'estudiante', width: 32 },
      ...centralizador.columnas.map((c) => ({
        header: `${c.tema} (/${c.nota_total})`,
        key: `evaluacion_${c.evaluacion_id}`,
        width: 20,
      })),
      { header: 'Acumulado', key: 'acumulado', width: 18 },
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
      registro.acumulado =
        fila.acumulado_total > 0
          ? `${fila.acumulado_obtenido}/${fila.acumulado_total}`
          : '—';
      hoja.addRow(registro);
    }

    return libro.xlsx.writeBuffer();
  }
}
