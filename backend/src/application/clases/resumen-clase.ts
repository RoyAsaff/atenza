// Cómputo de estado de una clase (asistencia registrada, evaluación
// abierta) compartido entre VerClasesDeHoy (Inicio) y VerClases (detalle
// de materia) — mismo shape, misma regla, un solo lugar.

import { Asistencia } from '../../domain/entidades/asistencia';
import { Evaluacion } from '../../domain/entidades/evaluacion';

const PRESENTES: readonly string[] = ['puntual', 'atrasado'];

export function resumenAsistencia(
  asistencias: Asistencia[],
): { presentes: number; total: number } | null {
  if (asistencias.length === 0) return null;
  return {
    presentes: asistencias.filter((a) => PRESENTES.includes(a.marcaje)).length,
    total: asistencias.length,
  };
}

export function tieneEvaluacionAbierta(evaluaciones: Evaluacion[]): boolean {
  return evaluaciones.some((e) => e.estado === 'lanzada');
}
