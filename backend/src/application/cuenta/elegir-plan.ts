// SaaS por cuenta (17/07, rediseñado 17/08) · Elegir plan y ciclo (docente)
// Reemplaza a SolicitarMateria/RenovarMateria: ya no hay distinción entre
// alta y renovación a nivel de datos, es solo un pago más de la cuenta.
// 17/08: el precio (con o sin promoción) se resuelve en CalcularPrecioPlan,
// compartido con el endpoint de previsualización — nunca se confía en un
// monto calculado por el cliente.

import { PagoConPlan, PLAZO_COMPROBANTE_HORAS } from '../../domain/entidades/pago';
import { CicloPago } from '../../domain/entidades/plan';
import { EstadoInvalidoError } from '../../domain/errores';
import { PagoRepositorio } from '../../domain/repositorios/pago-repositorio';
import { ConfiguracionPagoRepositorio } from '../../domain/repositorios/configuracion-pago-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { CalcularPrecioPlan } from './calcular-precio-plan';

export interface EntradaElegirPlan {
  usuario_id: number;
  plan_id: number;
  ciclo: CicloPago;
  codigo_promocion?: string;
  ip?: string;
  dispositivo?: string;
}

export class ElegirPlan {
  constructor(
    private readonly pagos: PagoRepositorio,
    private readonly configuracionPago: ConfiguracionPagoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly calcularPrecio: CalcularPrecioPlan,
  ) {}

  async ejecutar(entrada: EntradaElegirPlan): Promise<{
    pago: PagoConPlan;
    qr_pago: string;
    plazo_horas: number;
  }> {
    if (await this.pagos.tieneTramiteAbierto(entrada.usuario_id)) {
      throw new EstadoInvalidoError(
        'Ya existe un pago pendiente o en verificación para esta cuenta',
      );
    }

    const url_qr = await this.configuracionPago.obtenerQr();
    if (!url_qr) {
      throw new EstadoInvalidoError('El administrador aún no configuró el QR de cobro');
    }

    const { plan, monto_lista, monto, promocion } = await this.calcularPrecio.ejecutar({
      usuario_id: entrada.usuario_id,
      plan_id: entrada.plan_id,
      ciclo: entrada.ciclo,
      codigo_promocion: entrada.codigo_promocion,
    });

    const pago = await this.pagos.crear({
      usuario_id: entrada.usuario_id,
      plan_id: plan.id,
      monto_lista,
      monto,
      ciclo: entrada.ciclo,
      promocion_id: promocion?.id ?? null,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.usuario_id,
      rol_contexto: 'docente',
      accion: 'pago_suscripcion_creado',
      entidad: 'pago',
      entidad_id: String(pago.id),
      valor_nuevo: {
        plan: plan.nombre,
        monto: pago.monto,
        monto_lista: pago.monto_lista,
        ciclo: pago.ciclo,
        promocion: promocion?.nombre ?? null,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return { pago, qr_pago: url_qr, plazo_horas: PLAZO_COMPROBANTE_HORAS };
  }
}
