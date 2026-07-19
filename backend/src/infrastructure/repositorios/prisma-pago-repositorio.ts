import { PrismaClient } from '@prisma/client';
import { EstadoPago, PagoConPlan } from '../../domain/entidades/pago';
import { CicloPago } from '../../domain/entidades/plan';
import {
  DatosNuevoPago,
  PagoRepositorio,
} from '../../domain/repositorios/pago-repositorio';

type PagoConPlanPrisma = NonNullable<
  Awaited<ReturnType<PrismaClient['pago']['findFirst']>>
> & { plan: NonNullable<Awaited<ReturnType<PrismaClient['plan']['findFirst']>>> };

function aDominio(p: PagoConPlanPrisma): PagoConPlan {
  return {
    id: p.id,
    fecha: p.fecha,
    usuario_id: p.usuario_id,
    monto: Number(p.monto),
    comprobante: p.comprobante,
    estado: p.estado as EstadoPago,
    motivo_rechazo: p.motivo_rechazo,
    ciclo: p.ciclo as CicloPago,
    fecha_expira: p.fecha_expira,
    plan_id: p.plan_id,
    plan: {
      id: p.plan.id,
      nombre: p.plan.nombre,
      limite_estudiantes: p.plan.limite_estudiantes,
      monto_mensual: Number(p.plan.monto_mensual),
      orden: p.plan.orden,
      activo: p.plan.activo,
    },
  };
}

export class PrismaPagoRepositorio implements PagoRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async crear(datos: DatosNuevoPago): Promise<PagoConPlan> {
    const p = await this.prisma.pago.create({
      data: datos,
      include: { plan: true },
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

  async buscarPorId(id: number): Promise<PagoConPlan | null> {
    const p = await this.prisma.pago.findUnique({
      where: { id },
      include: { plan: true },
    });
    return p ? aDominio(p as PagoConPlanPrisma) : null;
  }

  async listarPorUsuario(usuario_id: number): Promise<PagoConPlan[]> {
    const pagos = await this.prisma.pago.findMany({
      where: { usuario_id },
      include: { plan: true },
      orderBy: { id: 'desc' },
    });
    return pagos.map((p) => aDominio(p as PagoConPlanPrisma));
  }

  async listar(filtro?: { estado?: EstadoPago }): Promise<PagoConPlan[]> {
    const pagos = await this.prisma.pago.findMany({
      where: filtro?.estado ? { estado: filtro.estado } : undefined,
      include: { plan: true },
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
      include: { plan: true },
    });
    return aDominio(p as PagoConPlanPrisma);
  }

  async expirarVencidos(horasPlazo: number): Promise<PagoConPlan[]> {
    const limite = new Date(Date.now() - horasPlazo * 3600 * 1000);
    const vencidos = await this.prisma.pago.findMany({
      where: { estado: 'pendiente', fecha: { lt: limite } },
      include: { plan: true },
    });
    if (vencidos.length === 0) return [];

    await this.prisma.pago.updateMany({
      where: { id: { in: vencidos.map((p) => p.id) } },
      data: { estado: 'expirada' },
    });
    return vencidos.map((p) => aDominio({ ...p, estado: 'expirada' } as PagoConPlanPrisma));
  }
}
