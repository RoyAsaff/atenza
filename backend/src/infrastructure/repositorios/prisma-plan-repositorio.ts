import { PrismaClient } from '@prisma/client';
import { Plan } from '../../domain/entidades/plan';
import { PlanRepositorio } from '../../domain/repositorios/plan-repositorio';

function aDominio(p: {
  id: number;
  nombre: string;
  limite_estudiantes: number | null;
  monto_mensual: unknown;
  orden: number;
  activo: boolean;
}): Plan {
  return {
    id: p.id,
    nombre: p.nombre,
    limite_estudiantes: p.limite_estudiantes,
    monto_mensual: Number(p.monto_mensual),
    orden: p.orden,
    activo: p.activo,
  };
}

export class PrismaPlanRepositorio implements PlanRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async listar(soloActivos = true): Promise<Plan[]> {
    const planes = await this.prisma.plan.findMany({
      where: soloActivos ? { activo: true } : undefined,
      orderBy: { orden: 'asc' },
    });
    return planes.map(aDominio);
  }

  async buscarPorId(id: number): Promise<Plan | null> {
    const p = await this.prisma.plan.findUnique({ where: { id } });
    return p ? aDominio(p) : null;
  }

  async buscarPorDefecto(): Promise<Plan | null> {
    const p = await this.prisma.plan.findFirst({
      where: { activo: true },
      orderBy: { orden: 'asc' },
    });
    return p ? aDominio(p) : null;
  }

  async actualizar(
    id: number,
    datos: { nombre?: string; limite_estudiantes?: number | null; monto_mensual?: number },
  ): Promise<Plan> {
    const p = await this.prisma.plan.update({ where: { id }, data: datos });
    return aDominio(p);
  }
}
