// SaaS por cuenta (17/07) · Verificar pago de suscripción (admin)
// Aprobar: fija fecha_expira de la CUENTA y actualiza el plan contratado
// (permite upgrade/downgrade). Rechazar: motivo obligatorio.

import { PagoConPlan } from '../../domain/entidades/pago';
import { DIAS_PLAN } from '../../domain/entidades/plan';
import { EstadoInvalidoError, NoEncontradoError } from '../../domain/errores';
import { PagoRepositorio } from '../../domain/repositorios/pago-repositorio';
import { UsuarioRepositorio } from '../../domain/repositorios/usuario-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';

const DIAS_PRUEBA_GRATIS = 30;

export class ResolverSuscripcion {
  constructor(
    private readonly pagos: PagoRepositorio,
    private readonly usuarios: UsuarioRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async aprobar(entrada: {
    pago_id: number;
    admin_id: number;
    ip?: string;
    dispositivo?: string;
  }): Promise<PagoConPlan> {
    const pago = await this.exigirEnVerificacion(entrada.pago_id);
    const usuario = await this.usuarios.buscarPorId(pago.usuario_id);
    if (!usuario) throw new NoEncontradoError('Usuario');

    // Vigencia de la CUENTA (no de una materia): 30/365 días desde la
    // activación; si es renovación anticipada, desde el vencimiento
    // vigente (no pierde días). La prueba gratis cuenta como primer período.
    const finPrueba = new Date(
      usuario.trial_inicio.getTime() + DIAS_PRUEBA_GRATIS * 24 * 3600 * 1000,
    );
    const vigenciaPago = await this.pagos.vigenciaActual(pago.usuario_id);
    const vigenciaActual = vigenciaPago && vigenciaPago > finPrueba ? vigenciaPago : finPrueba;

    const ahora = new Date();
    const base = vigenciaActual > ahora ? vigenciaActual : ahora;
    const fecha_expira = new Date(base.getTime() + DIAS_PLAN[pago.ciclo] * 24 * 3600 * 1000);

    const actualizado = await this.pagos.actualizar(pago.id, {
      estado: 'aprobada',
      fecha_expira,
    });
    await this.usuarios.actualizarPlan(pago.usuario_id, pago.plan_id);

    await this.bitacora.registrar({
      usuario_id: entrada.admin_id,
      rol_contexto: 'admin',
      accion: 'pago_suscripcion_aprobado',
      entidad: 'pago',
      entidad_id: String(pago.id),
      valor_anterior: { estado: 'en_verificacion' },
      valor_nuevo: {
        estado: 'aprobada',
        usuario_id: pago.usuario_id,
        plan: pago.plan.nombre,
        ciclo: pago.ciclo,
        comprobante: pago.comprobante,
        fecha_expira,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizado;
  }

  async rechazar(entrada: {
    pago_id: number;
    admin_id: number;
    motivo: string;
    ip?: string;
    dispositivo?: string;
  }): Promise<PagoConPlan> {
    const pago = await this.exigirEnVerificacion(entrada.pago_id);

    const actualizado = await this.pagos.actualizar(pago.id, {
      estado: 'rechazada',
      motivo_rechazo: entrada.motivo,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.admin_id,
      rol_contexto: 'admin',
      accion: 'pago_suscripcion_rechazado',
      entidad: 'pago',
      entidad_id: String(pago.id),
      valor_anterior: { estado: 'en_verificacion' },
      valor_nuevo: {
        estado: 'rechazada',
        motivo: entrada.motivo,
        comprobante: pago.comprobante,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizado;
  }

  private async exigirEnVerificacion(id: number): Promise<PagoConPlan> {
    const pago = await this.pagos.buscarPorId(id);
    if (!pago) throw new NoEncontradoError('Pago');
    if (pago.estado !== 'en_verificacion') {
      throw new EstadoInvalidoError(
        `Solo se resuelven pagos en verificación (actual: ${pago.estado})`,
      );
    }
    return pago;
  }
}
