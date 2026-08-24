// E8 · HU-25 (resultados) + HU-26 (publicar) + HU-27 (centralizador).
// No está en el diagrama — pendiente reflejar (ver schema.prisma).

/** D-12: nunca se sobrescribe, se versiona (insert-only). "Vigente" =
 * mayor `version` por intento_id. Hoy ninguna HU dispara una segunda
 * versión; el campo queda listo para cuando exista un caso de uso de
 * recálculo. */
export interface Nota {
  id: number;
  intento_id: number;
  evaluacion_id: number;
  estudiante_id: number;
  version: number;
  aciertos: number;
  total_preguntas: number;
  nota_obtenida: number;
  calculada_en: Date;
}

/** HU-25: fila de la vista de resultados del docente. */
export interface FilaResultado {
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  aciertos: number;
  total_preguntas: number;
  nota_obtenida: number;
  incidentes: number;
}

export interface EstadisticasResultados {
  promedio: number;
  nota_maxima: number;
  nota_minima: number;
}

export interface Resultados {
  evaluacion_id: number;
  nota_total: number;
  filas: FilaResultado[];
  estadisticas: EstadisticasResultados;
}

/** HU-27 + fusión con guías (24/08): una columna del centralizador — una
 * evaluación finalizada o una guía cerrada. `id` es el evaluacion_id o
 * guia_id según `tipo` (dos secuencias autoincrement separadas, por eso no
 * alcanza un solo número para identificar la columna sin ambigüedad). */
export type TipoColumnaCentralizador = 'evaluacion' | 'guia';

export interface ColumnaCentralizador {
  tipo: TipoColumnaCentralizador;
  id: number;
  tema: string;
  nota_total: number;
}

/** Clave estable de columna para `celdas` y para (de)serializar selecciones
 * — evita colisiones entre un evaluacion_id y un guia_id iguales. */
export function claveColumnaCentralizador(columna: {
  tipo: TipoColumnaCentralizador;
  id: number;
}): string {
  return `${columna.tipo}:${columna.id}`;
}

/** HU-27: fila del centralizador (un estudiante), con su celda por columna
 * (null = no rindió esa evaluación / no tiene nota en esa guía). */
export interface FilaCentralizador {
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  celdas: Record<string, number | null>; // claveColumnaCentralizador(columna) -> nota_obtenida
}

export interface Centralizador {
  columnas: ColumnaCentralizador[];
  filas: FilaCentralizador[];
}

/** HU-26: fila de "mis notas" del estudiante — solo evaluaciones publicadas. */
export interface FilaMiNota {
  evaluacion_id: number;
  tema: string;
  nota_total: number;
  aciertos: number;
  total_preguntas: number;
  nota_obtenida: number;
  fecha_publicacion: Date;
}
