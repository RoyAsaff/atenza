import { EstadoPago, PagoConPlan } from '../entidades/pago';
import { CicloPago } from '../entidades/plan';

export interface DatosNuevoPago {
  usuario_id: number;
  plan_id: number;
  monto: number;
  ciclo: CicloPago;
}

export interface PagoRepositorio {
  /** Crea un pago de cuenta (pendiente): alta o renovación, es el mismo dato. */
  crear(datos: DatosNuevoPago): Promise<PagoConPlan>;
  buscarPorId(id: number): Promise<PagoConPlan | null>;
  listarPorUsuario(usuario_id: number): Promise<PagoConPlan[]>;
  listar(filtro?: { estado?: EstadoPago }): Promise<PagoConPlan[]>;
  actualizar(
    id: number,
    datos: {
      estado?: EstadoPago;
      comprobante?: string;
      motivo_rechazo?: string;
      fecha_expira?: Date;
    },
  ): Promise<PagoConPlan>;
  /** Marca como expirados los pagos pendientes cuyo plazo venció. Devuelve los afectados. */
  expirarVencidos(horasPlazo: number): Promise<PagoConPlan[]>;
  /** ¿El usuario ya tiene un pago pendiente o en verificación? (evita duplicar trámites) */
  tieneTramiteAbierto(usuario_id: number): Promise<boolean>;
  /** Vigencia actual de la cuenta: el mayor fecha_expira de sus pagos aprobados. */
  vigenciaActual(usuario_id: number): Promise<Date | null>;
}
