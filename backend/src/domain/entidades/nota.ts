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

/** HU-27: una columna del centralizador (una evaluación finalizada). */
export interface ColumnaCentralizador {
  evaluacion_id: number;
  tema: string;
  nota_total: number;
}

/** HU-27: fila del centralizador (un estudiante), con su celda por
 * evaluación (null = no rindió esa evaluación) y su acumulado. */
export interface FilaCentralizador {
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  celdas: Record<number, number | null>; // evaluacion_id -> nota_obtenida
  acumulado_obtenido: number;
  acumulado_total: number;
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
