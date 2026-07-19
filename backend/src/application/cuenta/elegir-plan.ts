// SaaS por cuenta (17/07) · Elegir plan y ciclo (docente)
// Reemplaza a SolicitarMateria/RenovarMateria: ya no hay distinción entre
// alta y renovación a nivel de datos, es solo un pago más de la cuenta.

import { PagoConPlan, PLAZO_COMPROBANTE_HORAS } from '../../domain/entidades/pago';
import { CicloPago, montoParaCiclo } from '../../domain/entidades/plan';
import { EstadoInvalidoError, NoEncontradoError } from '../../domain/errores';
import { PagoRepositorio } from '../../domain/repositorios/pago-repositorio';
import { PlanRepositorio } from '../../domain/repositorios/plan-repositorio';
import { ConfiguracionPagoRepositorio } from '../../domain/repositorios/configuracion-pago-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';

export interface EntradaElegirPlan {
  usuario_id: number;
  plan_id: number;
  ciclo: CicloPago;
  ip?: string;
  dispositivo?: string;
}

export class ElegirPlan {
  constructor(
    private readonly pagos: PagoRepositorio,
    private readonly planes: PlanRepositorio,
    private readonly configuracionPago: ConfiguracionPagoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
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

    const plan = await this.planes.buscarPorId(entrada.plan_id);
    if (!plan || !plan.activo) throw new NoEncontradoError('Plan');
    if (plan.limite_estudiantes === null) {
      throw new EstadoInvalidoError(
        'El plan Institucional se contrata directamente con el administrador',
      );
    }

    const url_qr = await this.configuracionPago.obtenerQr();
    if (!url_qr) {
      throw new EstadoInvalidoError('El administrador aún no configuró el QR de cobro');
    }

    const pago = await this.pagos.crear({
      usuario_id: entrada.usuario_id,
      plan_id: plan.id,
      monto: montoParaCiclo(plan, entrada.ciclo),
      ciclo: entrada.ciclo,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.usuario_id,
      rol_contexto: 'docente',
      accion: 'pago_suscripcion_creado',
      entidad: 'pago',
      entidad_id: String(pago.id),
      valor_nuevo: { plan: plan.nombre, monto: pago.monto, ciclo: pago.ciclo },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return { pago, qr_pago: url_qr, plazo_horas: PLAZO_COMPROBANTE_HORAS };
  }
}
