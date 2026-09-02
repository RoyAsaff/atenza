// Entidad Plan — SaaS por cuenta (17/07, rediseñado 17/08). Reemplaza al
// viejo Precio (que era por materia, mensual/anual). 17/08: de 4 tramos
// pagos por cantidad de estudiantes a 3 roles fijos (Gratis/Pro/Institucional).

export type CicloPago = 'mensual' | 'anual';

export const DIAS_PLAN: Record<CicloPago, number> = {
  mensual: 30,
  anual: 365,
};

// 17/08: reemplaza la señal vieja "limite_estudiantes === null" para
// detectar el plan Institucional (no autoservicio) — ya no sirve porque
// Pro también es ilimitado. También gobierna el bypass de vigencia del
// plan gratuito (ver ObtenerEstadoCuenta).
export type TipoPlan = 'gratuito' | 'pago' | 'institucional';

export interface Plan {
  id: number;
  nombre: string;
  tipo: TipoPlan;
  limite_estudiantes: number | null; // null = sin límite (Pro) / "a medida" (Institucional)
  limite_materias: number | null; // null = sin límite; Gratis = 1 (17/08)
  permite_import_word: boolean; // 17/08: feature premium (Pro/Institucional)
  permite_guias: boolean; // 17/08: feature premium (Pro/Institucional)
  permite_examenes_codigo: boolean; // E9 (01/09): feature premium (Pro/Institucional)
  monto_mensual: number;
  orden: number;
  activo: boolean;
}

/** Precio anual = 10x el mensual (2 meses gratis, estilo Claude/Anthropic). */
export function montoParaCiclo(plan: Plan, ciclo: CicloPago): number {
  return ciclo === 'anual' ? plan.monto_mensual * 10 : plan.monto_mensual;
}
