// Entidad Pagos — SaaS por cuenta (17/07): el pago ahora se ancla a la
// cuenta del docente (usuario_id) y a un Plan, no a una Materia. Reemplaza
// el patrón "solicitud" (Pago + Materia inactiva) por un pago de cuenta.

import { Plan, CicloPago } from './plan';

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
  monto: number;
  comprobante: string | null;
  estado: EstadoPago;
  motivo_rechazo: string | null;
  ciclo: CicloPago;
  fecha_expira: Date | null; // se fija al aprobar
  plan_id: number;
}

/** Vista completa de un pago con su plan. */
export type PagoConPlan = Pago & { plan: Plan };

export const PLAZO_COMPROBANTE_HORAS = 24; // HU-06, Escenario 2 y 3
