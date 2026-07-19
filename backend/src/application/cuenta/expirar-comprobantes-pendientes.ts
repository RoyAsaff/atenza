// SaaS por cuenta (17/07) · Expiración perezosa de pagos pendientes sin
// comprobante subido a tiempo (24h). Reemplaza la parte de ExpirarMateriasVencidas
// que aplicaba a pagos; ya no hay "materia" que desactivar (ver ObtenerEstadoCuenta).

import { PLAZO_COMPROBANTE_HORAS } from '../../domain/entidades/pago';
import { PagoRepositorio } from '../../domain/repositorios/pago-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';

export class ExpirarComprobantesPendientes {
  constructor(
    private readonly pagos: PagoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(): Promise<number> {
    const vencidos = await this.pagos.expirarVencidos(PLAZO_COMPROBANTE_HORAS);
    for (const pago of vencidos) {
      await this.bitacora.registrar({
        usuario_id: pago.usuario_id,
        rol_contexto: 'sistema',
        accion: 'pago_suscripcion_expirado',
        entidad: 'pago',
        entidad_id: String(pago.id),
        valor_anterior: { estado: 'pendiente' },
        valor_nuevo: { estado: 'expirada' },
      });
    }
    return vencidos.length;
  }
}
