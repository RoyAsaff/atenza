// Entidad Pagos — SaaS por cuenta (17/07): el pago ahora se ancla a la
// cuenta del docente (usuario_id) y a un Plan, no a una Materia. Reemplaza
// el patrón "solicitud" (Pago + Materia inactiva) por un pago de cuenta.

import { Plan, CicloPago } from './plan';
import { Promocion } from './promocion';

export type EstadoPago =
  | 'pendiente' // esperando comprobante (plazo 24 h)
  | 'en_verificacion' // comprobante subido, esperando al admin
  | 'aprobada'
  | 'rechazada'
  | 'expirada';

export interface Pago {
  id: number;
  fecha: Date;
  usuario_id: number;
  // 17/08: monto_lista es el precio de plan sin descuento (para mostrarlo
  // tachado); monto sigue significando lo mismo de siempre — lo que
  // realmente hay que transferir/se transfirió (con descuento aplicado,
  // si hubo promo) — el admin valida el comprobante contra `monto`.
  monto_lista: number;
  monto: number;
  comprobante: string | null;
  estado: EstadoPago;
  motivo_rechazo: string | null;
  ciclo: CicloPago;
  fecha_expira: Date | null; // se fija al aprobar
  plan_id: number;
  promocion_id: number | null; // 17/08: promo aplicada al elegir el plan, si hubo alguna
}

/** Vista completa de un pago con su plan y, si aplica, la promoción usada. */
export type PagoConPlan = Pago & { plan: Plan; promocion: Promocion | null };

export const PLAZO_COMPROBANTE_HORAS = 24; // HU-06, Escenario 2 y 3
