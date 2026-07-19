// SaaS por cuenta (17/07) · Subir comprobante de pago (docente)
// Mismo patrón que la vieja SubirComprobante (HU-07), ahora escopeado al
// usuario en vez de a una materia.

import { PagoConPlan, PLAZO_COMPROBANTE_HORAS } from '../../domain/entidades/pago';
import {
  EstadoInvalidoError,
  NoEncontradoError,
  ProhibidoError,
} from '../../domain/errores';
import { PagoRepositorio } from '../../domain/repositorios/pago-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';

export class SubirComprobanteSuscripcion {
  constructor(
    private readonly pagos: PagoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(entrada: {
    pago_id: number;
    usuario_id: number;
    rutaComprobante: string;
    ip?: string;
    dispositivo?: string;
  }): Promise<PagoConPlan> {
    const pago = await this.pagos.buscarPorId(entrada.pago_id);
    if (!pago) throw new NoEncontradoError('Pago');
    if (pago.usuario_id !== entrada.usuario_id) {
      throw new ProhibidoError('El pago no te pertenece');
    }
    if (pago.estado !== 'pendiente') {
      throw new EstadoInvalidoError(`El pago está en estado ${pago.estado}`);
    }

    // HU-06 Esc. 3: si el plazo venció, expira en este momento
    const vencimiento = pago.fecha.getTime() + PLAZO_COMPROBANTE_HORAS * 3600 * 1000;
    if (Date.now() > vencimiento) {
      await this.pagos.actualizar(pago.id, { estado: 'expirada' });
      await this.bitacora.registrar({
        usuario_id: entrada.usuario_id,
        rol_contexto: 'sistema',
        accion: 'pago_suscripcion_expirado',
        entidad: 'pago',
        entidad_id: String(pago.id),
        valor_anterior: { estado: 'pendiente' },
        valor_nuevo: { estado: 'expirada' },
      });
      throw new EstadoInvalidoError(
        'El plazo de 24 horas venció; elige un plan de nuevo para generar otro pago',
      );
    }

    const actualizado = await this.pagos.actualizar(pago.id, {
      estado: 'en_verificacion',
      comprobante: entrada.rutaComprobante,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.usuario_id,
      rol_contexto: 'docente',
      accion: 'comprobante_suscripcion_subido',
      entidad: 'pago',
      entidad_id: String(pago.id),
      valor_anterior: { estado: 'pendiente' },
      valor_nuevo: { estado: 'en_verificacion', comprobante: entrada.rutaComprobante },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return actualizado;
  }
}
