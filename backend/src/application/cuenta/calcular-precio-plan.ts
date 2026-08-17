// SaaS por cuenta (17/08) · Calcular precio de un plan (con promoción, si
// aplica). Compartido entre ElegirPlan (crea el pago) y el endpoint de
// previsualización (GET /api/cuenta/promociones/validar), para que el
// docente vea el monto con descuento ANTES de transferir por QR.

import { CicloPago, Plan, montoParaCiclo } from '../../domain/entidades/plan';
import {
  Promocion,
  calcularDescuento,
  elegiblePorCiclo,
  estaVigente,
  montoConDescuento,
} from '../../domain/entidades/promocion';
import { EstadoInvalidoError, NoEncontradoError, PromocionInvalidaError } from '../../domain/errores';
import { PagoRepositorio } from '../../domain/repositorios/pago-repositorio';
import { PlanRepositorio } from '../../domain/repositorios/plan-repositorio';
import { PromocionRepositorio } from '../../domain/repositorios/promocion-repositorio';

export interface EntradaCalcularPrecio {
  usuario_id: number;
  plan_id: number;
  ciclo: CicloPago;
  codigo_promocion?: string;
}

export interface ResultadoCalculoPrecio {
  plan: Plan;
  monto_lista: number;
  monto: number;
  promocion: Promocion | null;
}

export class CalcularPrecioPlan {
  constructor(
    private readonly planes: PlanRepositorio,
    private readonly pagos: PagoRepositorio,
    private readonly promociones: PromocionRepositorio,
  ) {}

  async ejecutar(entrada: EntradaCalcularPrecio): Promise<ResultadoCalculoPrecio> {
    const plan = await this.planes.buscarPorId(entrada.plan_id);
    if (!plan || !plan.activo) throw new NoEncontradoError('Plan');
    if (plan.tipo === 'institucional') {
      throw new EstadoInvalidoError(
        'El plan Institucional se contrata directamente con el administrador',
      );
    }
    if (plan.tipo === 'gratuito') {
      throw new EstadoInvalidoError('El plan Gratis no requiere pago');
    }

    const monto_lista = montoParaCiclo(plan, entrada.ciclo);
    const esCuentaNueva = !(await this.pagos.tieneAlgunPagoAprobado(entrada.usuario_id));
    const promocion = await this.resolverPromocion(entrada, monto_lista, esCuentaNueva);
    const monto = montoConDescuento(monto_lista, promocion);

    return { plan, monto_lista, monto, promocion };
  }

  private async resolverPromocion(
    entrada: EntradaCalcularPrecio,
    montoLista: number,
    esCuentaNueva: boolean,
  ): Promise<Promocion | null> {
    const ahora = new Date();
    const esExplicita = !!entrada.codigo_promocion?.trim();
    let candidata: Promocion | null = null;

    if (esExplicita) {
      candidata = await this.promociones.buscarPorCodigo(entrada.codigo_promocion!.trim().toUpperCase());
      if (!candidata) throw new PromocionInvalidaError('El código ingresado no existe');
      if (!estaVigente(candidata, ahora)) {
        throw new PromocionInvalidaError('El código no está vigente');
      }
      if (!elegiblePorCiclo(candidata, entrada.ciclo)) {
        throw new PromocionInvalidaError('Este código no aplica al ciclo elegido');
      }
      if (candidata.solo_cuentas_nuevas && !esCuentaNueva) {
        throw new PromocionInvalidaError('Este código es solo para cuentas nuevas');
      }
    } else {
      const automaticas = await this.promociones.listarAutomaticasVigentes(ahora);
      const elegibles = automaticas.filter(
        (p) => elegiblePorCiclo(p, entrada.ciclo) && (!p.solo_cuentas_nuevas || esCuentaNueva),
      );
      if (elegibles.length > 0) {
        // Más de una automática vigente a la vez: gana la de mayor
        // descuento en Bs para este plan+ciclo; empate → id menor (más antigua).
        candidata = elegibles
          .map((p) => ({ p, descuento: calcularDescuento(montoLista, p) }))
          .sort((a, b) => b.descuento - a.descuento || a.p.id - b.p.id)[0].p;
      }
    }

    if (!candidata) return null;

    const usosPorCuenta = await this.promociones.contarUsosPorCuenta(candidata.id, entrada.usuario_id);
    if (
      candidata.usos_maximos_por_cuenta !== null &&
      usosPorCuenta >= candidata.usos_maximos_por_cuenta
    ) {
      if (esExplicita) throw new PromocionInvalidaError('Ya usaste este código el máximo de veces permitido');
      return null; // automática: se ignora en silencio, el usuario no la pidió
    }
    if (candidata.usos_maximos !== null && candidata.usos_actuales >= candidata.usos_maximos) {
      if (esExplicita) throw new PromocionInvalidaError('Este código ya alcanzó su límite de usos');
      return null;
    }

    return candidata;
  }
}
