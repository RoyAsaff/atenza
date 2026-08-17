// Entidad Promocion (17/08): descuento de temporada (automático, sin
// código, por ventana de fechas) o cupón (con código), configurable por el
// admin. Afecta el monto que el docente debe transferir por QR — ver
// CalcularPrecioPlan.

import { CicloPago } from './plan';

export type TipoDescuento = 'porcentaje' | 'monto_fijo';
export type CicloAplicablePromo = 'mensual' | 'anual' | 'ambos';

export interface Promocion {
  id: number;
  nombre: string;
  codigo: string | null; // null = automática por temporada, sin código
  tipo_descuento: TipoDescuento;
  valor: number;
  ciclo_aplicable: CicloAplicablePromo;
  combinable_con_anual: boolean;
  solo_cuentas_nuevas: boolean;
  fecha_inicio: Date;
  fecha_fin: Date;
  activo: boolean;
  usos_maximos: number | null;
  usos_maximos_por_cuenta: number | null;
  usos_actuales: number;
}

/**
 * Elegibilidad de ciclo = ciclo_aplicable ∩ (combinable_con_anual ?
 * {mensual, anual} : {mensual}). Un pago anual ya trae su propio descuento
 * estructural (10x, 2 meses gratis) — combinable_con_anual decide si el
 * descuento de la promo se suma encima.
 */
export function elegiblePorCiclo(promo: Promocion, ciclo: CicloPago): boolean {
  if (promo.ciclo_aplicable !== 'ambos' && promo.ciclo_aplicable !== ciclo) return false;
  if (ciclo === 'anual' && !promo.combinable_con_anual) return false;
  return true;
}

export function estaVigente(promo: Promocion, ahora: Date): boolean {
  return promo.activo && promo.fecha_inicio <= ahora && ahora <= promo.fecha_fin;
}

/** Redondeo a 2 decimales (misma precisión que Decimal(10,2)); nunca supera montoLista. */
export function calcularDescuento(montoLista: number, promo: Promocion): number {
  const bruto =
    promo.tipo_descuento === 'porcentaje' ? montoLista * (promo.valor / 100) : promo.valor;
  return Math.min(Math.round(bruto * 100) / 100, montoLista);
}

export function montoConDescuento(montoLista: number, promo: Promocion | null): number {
  if (!promo) return montoLista;
  return Math.round((montoLista - calcularDescuento(montoLista, promo)) * 100) / 100;
}
