// E8 · HU-27 · Centralizador de notas por materia: matriz estudiantes ×
// evaluaciones finalizadas + guías cerradas (fusión 24/08 — antes solo
// evaluaciones; el docente pidió verlas juntas en vez de un centralizador
// aparte para guías, ver CONTEXTO.md) + exámenes de código finalizados
// (tercer grupo, con su propio peso). Todos son publicados o no: es una
// vista del docente, no del estudiante. El acumulado (Σ nota_obtenida / Σ
// nota_total) se quitó (ya no se usa) — la nota agregada ahora se calcula
// en pantalla vía "Nota final" (ver CentralizadorPage / calcularNotaFinal
// más abajo).

import ExcelJS from 'exceljs';
import {
  ColumnaCentralizador,
  Centralizador,
  FilaCentralizador,
  TipoColumnaCentralizador,
  claveColumnaCentralizador,
} from '../../domain/entidades/nota';
import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';
import { ExamenCodigoRepositorio } from '../../domain/repositorios/examen-codigo-repositorio';
import { GuiaRepositorio } from '../../domain/repositorios/guia-repositorio';
import { GuiaIntentoRepositorio } from '../../domain/repositorios/guia-intento-repositorio';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';
import { IntentoCodigoRepositorio } from '../../domain/repositorios/intento-codigo-repositorio';
import { IntentoRepositorio } from '../../domain/repositorios/intento-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { exigirMateriaPropia } from '../evaluaciones/gestionar-examen';

export class VerCentralizador {
  constructor(
    private readonly materias: MateriaRepositorio,
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly guias: GuiaRepositorio,
    private readonly examenesCodigo: ExamenCodigoRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly intentos: IntentoRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
    private readonly intentosCodigo: IntentoCodigoRepositorio,
  ) {}

  async ejecutar(entrada: { materia_id: number; docente_id: number }): Promise<Centralizador> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);

    const [evaluacionesFinalizadas, guiasCerradas, examenesFinalizados, inscripcionesActivas] =
      await Promise.all([
        this.evaluaciones.listarFinalizadasPorMateria(entrada.materia_id),
        this.guias.listarCerradasPorMateria(entrada.materia_id),
        this.examenesCodigo.listarFinalizadosPorMateria(entrada.materia_id),
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
    const columnasExamenCodigo: ColumnaCentralizador[] = examenesFinalizados.map((x) => ({
      tipo: 'examen_codigo',
      id: x.id,
      tema: x.tema,
      nota_total: x.nota,
    }));
    const columnas = [...columnasEvaluacion, ...columnasGuia, ...columnasExamenCodigo];

    const [notasPorEvaluacion, notasPorGuia, notasPorExamenCodigo] = await Promise.all([
      Promise.all(evaluacionesFinalizadas.map((e) => this.intentos.notasVigentesPorEvaluacion(e.id))),
      Promise.all(guiasCerradas.map((g) => this.guiaIntentos.notasOficialesPorGuia(g.id))),
      Promise.all(examenesFinalizados.map((x) => this.intentosCodigo.notasVigentesPorExamen(x.id))),
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
    examenesFinalizados.forEach((examen, indice) => {
      const clave = claveColumnaCentralizador({ tipo: 'examen_codigo', id: examen.id });
      for (const nota of notasPorExamenCodigo[indice]) {
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

/** Pesos relativos (%) de cada grupo, tal como quedaron en pantalla. */
interface PesosGrupos {
  evaluacion?: number;
  guia?: number;
  examen_codigo?: number;
}

const TIPOS_GRUPO: TipoColumnaCentralizador[] = ['evaluacion', 'guia', 'examen_codigo'];

/** Prefijo del encabezado en el Excel (las evaluaciones van sin prefijo). */
const ETIQUETA_TIPO: Record<TipoColumnaCentralizador, string> = {
  evaluacion: '',
  guia: 'Guía · ',
  examen_codigo: 'Código · ',
};

/** Misma fórmula que el frontend (CentralizadorPage): promedia el % de
 * cada columna seleccionada dentro de su grupo (evaluación/guía/examen de
 * código; 0 si no tiene nota) y combina los grupos según su peso antes de
 * multiplicar por la nota base. Si solo hay un grupo marcado, ese pesa
 * 100 % (los otros pesos, si vienen, se ignoran). */
function calcularNotaFinal(
  fila: FilaCentralizador,
  columnas: ColumnaCentralizador[],
  notaBase: number,
  pesos: PesosGrupos,
): number {
  function promedioGrupo(grupo: ColumnaCentralizador[]): number {
    if (grupo.length === 0) return 0;
    const suma = grupo.reduce((acc, c) => {
      if (c.nota_total <= 0) return acc;
      const obtenida = fila.celdas[claveColumnaCentralizador(c)] ?? 0;
      return acc + obtenida / c.nota_total;
    }, 0);
    return suma / grupo.length;
  }

  const presentes = TIPOS_GRUPO.map((tipo) => ({
    grupo: columnas.filter((c) => c.tipo === tipo),
    // Sin peso explícito (llamada sin pesos): las evaluaciones pesan todo y
    // los demás nada, igual que antes de las guías.
    peso: pesos[tipo] ?? (tipo === 'evaluacion' ? 100 : 0),
  })).filter(({ grupo }) => grupo.length > 0);

  const soloUno = presentes.length === 1;
  const pesoTotal = presentes.reduce((acc, { peso }) => acc + (soloUno ? 100 : peso), 0) || 100;
  const suma = presentes.reduce(
    (acc, { grupo, peso }) => acc + promedioGrupo(grupo) * (soloUno ? 100 : peso),
    0,
  );

  return Math.round((suma / pesoTotal) * notaBase * 100) / 100;
}

export class ExportarCentralizador {
  constructor(private readonly verCentralizador: VerCentralizador) {}

  async ejecutar(entrada: {
    materia_id: number;
    docente_id: number;
    nombre_materia: string;
    // Columnas marcadas en pantalla (CentralizadorPage): solo esas se
    // exportan; con `nota_base` además se agrega la columna "Nota final"
    // calculada sobre ellas. Opcional — sin esto exporta todas las columnas.
    // Claves con formato claveColumnaCentralizador ("evaluacion:3", "guia:5").
    columna_claves?: string[];
    nota_base?: number;
    // Pesos de cada grupo (%) tal como quedaron en pantalla — solo importan
    // cuando hay columnas marcadas de MÁS de un tipo; con uno solo, ese pesa
    // 100 % sin importar lo que venga acá (ver calcularNotaFinal).
    peso_evaluaciones?: number;
    peso_guias?: number;
    peso_examenes_codigo?: number;
  }): Promise<ExcelJS.Buffer> {
    const centralizador = await this.verCentralizador.ejecutar(entrada);

    // Solo se exportan las columnas marcadas en pantalla; sin
    // `columna_claves` (llamada sin filtro) salen todas, como antes.
    const columnasExportadas = entrada.columna_claves
      ? centralizador.columnas.filter((c) =>
          entrada.columna_claves!.includes(claveColumnaCentralizador(c)),
        )
      : centralizador.columnas;
    const columnasNotaFinal = entrada.columna_claves ? columnasExportadas : [];
    const incluirNotaFinal =
      !!entrada.nota_base && entrada.nota_base > 0 && columnasNotaFinal.length > 0;

    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Centralizador');

    hoja.columns = [
      { header: 'Estudiante', key: 'estudiante', width: 32 },
      ...columnasExportadas.map((c) => ({
        header: `${ETIQUETA_TIPO[c.tipo]}${c.tema} (/${c.nota_total})`,
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
      for (const columna of columnasExportadas) {
        const nota = fila.celdas[claveColumnaCentralizador(columna)];
        registro[claveColumnaCentralizador(columna)] = nota ?? '—';
      }
      if (incluirNotaFinal) {
        registro.nota_final = calcularNotaFinal(
          fila,
          columnasNotaFinal,
          entrada.nota_base!,
          {
            evaluacion: entrada.peso_evaluaciones,
            guia: entrada.peso_guias,
            examen_codigo: entrada.peso_examenes_codigo,
          },
        );
      }
      hoja.addRow(registro);
    }

    return libro.xlsx.writeBuffer();
  }
}
