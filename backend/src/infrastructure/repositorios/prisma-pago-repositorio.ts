import { PrismaClient } from '@prisma/client';
import { EstadoPago, PagoConPlan } from '../../domain/entidades/pago';
import { CicloPago, TipoPlan } from '../../domain/entidades/plan';
import { CicloAplicablePromo, TipoDescuento } from '../../domain/entidades/promocion';
import {
  DatosNuevoPago,
  PagoRepositorio,
} from '../../domain/repositorios/pago-repositorio';

const includePagoConPlan = { plan: true, promocion: true } as const;

type PagoConPlanPrisma = NonNullable<
  Awaited<ReturnType<PrismaClient['pago']['findFirst']>>
> & {
  plan: NonNullable<Awaited<ReturnType<PrismaClient['plan']['findFirst']>>>;
  promocion: Awaited<ReturnType<PrismaClient['promocion']['findFirst']>> | null;
};

function aDominio(p: PagoConPlanPrisma): PagoConPlan {
  return {
    id: p.id,
    fecha: p.fecha,
    usuario_id: p.usuario_id,
    monto_lista: Number(p.monto_lista),
    monto: Number(p.monto),
    comprobante: p.comprobante,
    estado: p.estado as EstadoPago,
    motivo_rechazo: p.motivo_rechazo,
    ciclo: p.ciclo as CicloPago,
    fecha_expira: p.fecha_expira,
    plan_id: p.plan_id,
    promocion_id: p.promocion_id,
    plan: {
      id: p.plan.id,
      nombre: p.plan.nombre,
      tipo: p.plan.tipo as TipoPlan,
      limite_estudiantes: p.plan.limite_estudiantes,
      limite_materias: p.plan.limite_materias,
      permite_import_word: p.plan.permite_import_word,
      permite_guias: p.plan.permite_guias,
      monto_mensual: Number(p.plan.monto_mensual),
      orden: p.plan.orden,
      activo: p.plan.activo,
    },
    promocion: p.promocion
      ? {
          id: p.promocion.id,
          nombre: p.promocion.nombre,
          codigo: p.promocion.codigo,
          tipo_descuento: p.promocion.tipo_descuento as TipoDescuento,
          valor: Number(p.promocion.valor),
          ciclo_aplicable: p.promocion.ciclo_aplicable as CicloAplicablePromo,
          combinable_con_anual: p.promocion.combinable_con_anual,
          solo_cuentas_nuevas: p.promocion.solo_cuentas_nuevas,
          fecha_inicio: p.promocion.fecha_inicio,
          fecha_fin: p.promocion.fecha_fin,
          activo: p.promocion.activo,
          usos_maximos: p.promocion.usos_maximos,
          usos_maximos_por_cuenta: p.promocion.usos_maximos_por_cuenta,
          usos_actuales: p.promocion.usos_actuales,
        }
      : null,
  };
}

export class PrismaPagoRepositorio implements PagoRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async crear(datos: DatosNuevoPago): Promise<PagoConPlan> {
    const p = await this.prisma.pago.create({
      data: {
        usuario_id: datos.usuario_id,
        plan_id: datos.plan_id,
        monto_lista: datos.monto_lista,
        monto: datos.monto,
        ciclo: datos.ciclo,
        promocion_id: datos.promocion_id ?? null,
      },
      include: includePagoConPlan,
    });
    return aDominio(p as PagoConPlanPrisma);
  }

  async tieneTramiteAbierto(usuario_id: number): Promise<boolean> {
    const abierto = await this.prisma.pago.findFirst({
      where: { usuario_id, estado: { in: ['pendiente', 'en_verificacion'] } },
      select: { id: true },
    });
    return abierto !== null;
  }

  async vigenciaActual(usuario_id: number): Promise<Date | null> {
    const agregado = await this.prisma.pago.aggregate({
      where: { usuario_id, estado: 'aprobada' },
      _max: { fecha_expira: true },
    });
    return agregado._max.fecha_expira;
  }

  async tieneAlgunPagoAprobado(usuario_id: number): Promise<boolean> {
    const aprobado = await this.prisma.pago.findFirst({
      where: { usuario_id, estado: 'aprobada' },
      select: { id: true },
    });
    return aprobado !== null;
  }

  async buscarPorId(id: number): Promise<PagoConPlan | null> {
    const p = await this.prisma.pago.findUnique({
      where: { id },
      include: includePagoConPlan,
    });
    return p ? aDominio(p as PagoConPlanPrisma) : null;
  }

  async listarPorUsuario(usuario_id: number): Promise<PagoConPlan[]> {
    const pagos = await this.prisma.pago.findMany({
      where: { usuario_id },
      include: includePagoConPlan,
      orderBy: { id: 'desc' },
    });
    return pagos.map((p) => aDominio(p as PagoConPlanPrisma));
  }

  async listar(filtro?: { estado?: EstadoPago }): Promise<PagoConPlan[]> {
    const pagos = await this.prisma.pago.findMany({
      where: filtro?.estado ? { estado: filtro.estado } : undefined,
      include: includePagoConPlan,
      orderBy: { id: 'desc' },
    });
    return pagos.map((p) => aDominio(p as PagoConPlanPrisma));
  }

  async actualizar(
    id: number,
    datos: {
      estado?: EstadoPago;
      comprobante?: string;
      motivo_rechazo?: string;
      fecha_expira?: Date;
    },
  ): Promise<PagoConPlan> {
    const p = await this.prisma.pago.update({
      where: { id },
      data: datos,
      include: includePagoConPlan,
    });
    return aDominio(p as PagoConPlanPrisma);
  }

  async expirarVencidos(horasPlazo: number): Promise<PagoConPlan[]> {
    const limite = new Date(Date.now() - horasPlazo * 3600 * 1000);
    const vencidos = await this.prisma.pago.findMany({
      where: { estado: 'pendiente', fecha: { lt: limite } },
      include: includePagoConPlan,
    });
    if (vencidos.length === 0) return [];

    await this.prisma.pago.updateMany({
      where: { id: { in: vencidos.map((p) => p.id) } },
      data: { estado: 'expirada' },
    });
    return vencidos.map((p) => aDominio({ ...p, estado: 'expirada' } as PagoConPlanPrisma));
  }
}
