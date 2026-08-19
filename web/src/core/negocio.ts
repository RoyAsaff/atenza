// Reglas de negocio compartidas que no tienen un lugar más específico
// (no son un tipo de dato de `tipos.ts` ni un componente de UI).

/** Umbral de aprobación (HU-27 · design_handoff_centralizador, dirección
 * 2b): no existía en el sistema y hace falta para dos cosas en el
 * Centralizador — colorear las celdas de la matriz (% sobre la
 * nota_total de cada evaluación) y contar cuántos estudiantes aprueban
 * la nota final (% sobre la nota base). Confirmado por Roy en 51 % para
 * ambos casos (18/08). */
export const UMBRAL_APROBACION = 0.51;
