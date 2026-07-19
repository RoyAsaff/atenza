// Entidad Plan — SaaS por cuenta (17/07): tramos de precio por cantidad
// de estudiantes activos en toda la cuenta del docente, no por materia.
// Reemplaza al viejo Precio (que era por materia, mensual/anual).

export type CicloPago = 'mensual' | 'anual';

export const DIAS_PLAN: Record<CicloPago, number> = {
  mensual: 30,
  anual: 365,
};

export interface Plan {
  id: number;
  nombre: string;
  limite_estudiantes: number | null; // null = sin límite / "a medida" (Institucional)
  monto_mensual: number;
  orden: number;
  activo: boolean;
}

/** Precio anual = 10x el mensual (2 meses gratis, estilo Claude/Anthropic). */
export function montoParaCiclo(plan: Plan, ciclo: CicloPago): number {
  return ciclo === 'anual' ? plan.monto_mensual * 10 : plan.monto_mensual;
}
