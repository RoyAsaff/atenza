// E8 · HU-27 · Centralizador de notas por materia: matriz estudiantes ×
// evaluaciones finalizadas + guías cerradas (fusión 24/08 — antes solo
// evaluaciones; el docente pidió verlas juntas en vez de un centralizador
// aparte para guías, ver CONTEXTO.md). Ambas son publicadas o no: es una
// vista del docente, no del estudiante. El acumulado (Σ nota_obtenida / Σ
// nota_total) se quitó (ya no se usa) — la nota agregada ahora se calcula
// en pantalla vía "Nota final" (ver CentralizadorPage / calcularNotaFinal
// más abajo).

import ExcelJS from 'exceljs';
import {
  ColumnaCentralizador,
  Centralizador,
  FilaCentralizador,
  claveColumnaCentralizador,
} from '../../domain/entidades/nota';
import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';
import { GuiaRepositorio } from '../../domain/repositorios/guia-repositorio';
import { GuiaIntentoRepositorio } from '../../domain/repositorios/guia-intento-repositorio';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';
import { IntentoRepositorio } from '../../domain/repositorios/intento-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { exigirMateriaPropia } from '../evaluaciones/gestionar-examen';

export class VerCentralizador {
  constructor(
    private readonly materias: MateriaRepositorio,
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly guias: GuiaRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly intentos: IntentoRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
  ) {}

  async ejecutar(entrada: { materia_id: number; docente_id: number }): Promise<Centralizador> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);

    const [evaluacionesFinalizadas, guiasCerradas, inscripcionesActivas] = await Promise.all([
      this.evaluaciones.listarFinalizadasPorMateria(entrada.materia_id),
      this.guias.listarCerradasPorMateria(entrada.materia_id),
      this.inscripciones.listarPorMateria(entrada.materia_id),
    ]);

    const columnasEvaluacion: ColumnaCentralizador[] = evaluacionesFinalizadas.map((e) => ({
      tipo: 'evaluacion',
      id: e.id,
      tema: e.tema,
      nota_total: e.nota,
    }));
    const columnasGuia: ColumnaCentralizador[] = guiasCerradas.map((g) => ({
      tipo: 'guia',
      id: g.id,
      tema: g.tema,
      nota_total: g.nota ?? 0,
    }));
    const columnas = [...columnasEvaluacion, ...columnasGuia];

    const [notasPorEvaluacion, notasPorGuia] = await Promise.all([
      Promise.all(evaluacionesFinalizadas.map((e) => this.intentos.notasVigentesPorEvaluacion(e.id))),
      Promise.all(guiasCerradas.map((g) => this.guiaIntentos.notasOficialesPorGuia(g.id))),
    ]);

    // estudiante_id -> clave de columna -> nota_obtenida
    const mapa = new Map<number, Map<string, number>>();
    evaluacionesFinalizadas.forEach((evaluacion, indice) => {
      const clave = claveColumnaCentralizador({ tipo: 'evaluacion', id: evaluacion.id });
      for (const nota of notasPorEvaluacion[indice]) {
        if (!mapa.has(nota.estudiante_id)) mapa.set(nota.estudiante_id, new Map());
        mapa.get(nota.estudiante_id)!.set(clave, nota.nota_obtenida);
      }
    });
    guiasCerradas.forEach((guia, indice) => {
      const clave = claveColumnaCentralizador({ tipo: 'guia', id: guia.id });
      for (const nota of notasPorGuia[indice]) {
        if (!mapa.has(nota.estudiante_id)) mapa.set(nota.estudiante_id, new Map());
        mapa.get(nota.estudiante_id)!.set(clave, nota.nota_obtenida);
      }
    });

    const filas: FilaCentralizador[] = inscripcionesActivas.map((inscripcion) => {
      const notasEstudiante = mapa.get(inscripcion.estudiante.id);
      const celdas: Record<string, number | null> = {};
      for (const columna of columnas) {
        celdas[claveColumnaCentralizador(columna)] = notasEstudiante?.get(claveColumnaCentralizador(columna)) ?? null;
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
 * cada columna seleccionada dentro de su grupo (evaluación/guía; 0 si no
 * tiene nota) y combina ambos grupos según su peso antes de multiplicar
 * por la nota base. Si solo hay un grupo marcado, ese pesa 100 % (el otro
 * peso, si viene, se ignora). */
function calcularNotaFinal(
  fila: FilaCentralizador,
  columnas: ColumnaCentralizador[],
  notaBase: number,
  pesoEvaluaciones?: number,
  pesoGuias?: number,
): number {
  const grupos = {
    evaluacion: columnas.filter((c) => c.tipo === 'evaluacion'),
    guia: columnas.filter((c) => c.tipo === 'guia'),
  };

  function promedioGrupo(grupo: ColumnaCentralizador[]): number {
    if (grupo.length === 0) return 0;
    const suma = grupo.reduce((acc, c) => {
      if (c.nota_total <= 0) return acc;
      const obtenida = fila.celdas[claveColumnaCentralizador(c)] ?? 0;
      return acc + obtenida / c.nota_total;
    }, 0);
    return suma / grupo.length;
  }

  const hayEval = grupos.evaluacion.length > 0;
  const hayGuia = grupos.guia.length > 0;
  let wEval = hayEval ? (pesoEvaluaciones ?? 100) : 0;
  let wGuia = hayGuia ? (pesoGuias ?? 0) : 0;
  if (hayEval && !hayGuia) wEval = 100;
  if (hayGuia && !hayEval) wGuia = 100;
  const wTotal = wEval + wGuia || 100;

  const porcentaje = (promedioGrupo(grupos.evaluacion) * wEval + promedioGrupo(grupos.guia) * wGuia) / wTotal;
  return Math.round(porcentaje * notaBase * 100) / 100;
}

export class ExportarCentralizador {
  constructor(private readonly verCentralizador: VerCentralizador) {}

  async ejecutar(entrada: {
    materia_id: number;
    docente_id: number;
    nombre_materia: string;
    // Último cálculo de "Nota final" hecho en pantalla (CentralizadorPage):
    // si vienen y hay intersección con las columnas reales, se agrega esa
    // columna extra al Excel. Opcional — sin esto exporta como siempre.
    // Claves con formato claveColumnaCentralizador ("evaluacion:3", "guia:5").
    columna_claves?: string[];
    nota_base?: number;
    // Pesos de cada grupo (%) tal como quedaron en pantalla — solo importan
    // cuando hay columnas marcadas de AMBOS tipos; con uno solo, ese pesa
    // 100 % sin importar lo que venga acá (ver calcularNotaFinal).
    peso_evaluaciones?: number;
    peso_guias?: number;
  }): Promise<ExcelJS.Buffer> {
    const centralizador = await this.verCentralizador.ejecutar(entrada);

    const columnasNotaFinal = entrada.columna_claves
      ? centralizador.columnas.filter((c) =>
          entrada.columna_claves!.includes(claveColumnaCentralizador(c)),
        )
      : [];
    const incluirNotaFinal =
      !!entrada.nota_base && entrada.nota_base > 0 && columnasNotaFinal.length > 0;

    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Centralizador');

    hoja.columns = [
      { header: 'Estudiante', key: 'estudiante', width: 32 },
      ...centralizador.columnas.map((c) => ({
        header: `${c.tipo === 'guia' ? 'Guía · ' : ''}${c.tema} (/${c.nota_total})`,
        key: claveColumnaCentralizador(c),
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
        const nota = fila.celdas[claveColumnaCentralizador(columna)];
        registro[claveColumnaCentralizador(columna)] = nota ?? '—';
      }
      if (incluirNotaFinal) {
        registro.nota_final = calcularNotaFinal(
          fila,
          columnasNotaFinal,
          entrada.nota_base!,
          entrada.peso_evaluaciones,
          entrada.peso_guias,
        );
      }
      hoja.addRow(registro);
    }

    return libro.xlsx.writeBuffer();
  }
}
