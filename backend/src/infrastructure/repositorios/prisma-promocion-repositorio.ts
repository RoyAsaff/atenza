import { PrismaClient } from '@prisma/client';
import { CicloAplicablePromo, Promocion, TipoDescuento } from '../../domain/entidades/promocion';
import {
  DatosPromocion,
  PromocionRepositorio,
} from '../../domain/repositorios/promocion-repositorio';

function aDominio(p: {
  id: number;
  nombre: string;
  codigo: string | null;
  tipo_descuento: string;
  valor: unknown;
  ciclo_aplicable: string;
  combinable_con_anual: boolean;
  solo_cuentas_nuevas: boolean;
  fecha_inicio: Date;
  fecha_fin: Date;
  activo: boolean;
  usos_maximos: number | null;
  usos_maximos_por_cuenta: number | null;
  usos_actuales: number;
}): Promocion {
  return {
    id: p.id,
    nombre: p.nombre,
    codigo: p.codigo,
    tipo_descuento: p.tipo_descuento as TipoDescuento,
    valor: Number(p.valor),
    ciclo_aplicable: p.ciclo_aplicable as CicloAplicablePromo,
    combinable_con_anual: p.combinable_con_anual,
    solo_cuentas_nuevas: p.solo_cuentas_nuevas,
    fecha_inicio: p.fecha_inicio,
    fecha_fin: p.fecha_fin,
    activo: p.activo,
    usos_maximos: p.usos_maximos,
    usos_maximos_por_cuenta: p.usos_maximos_por_cuenta,
    usos_actuales: p.usos_actuales,
  };
}

export class PrismaPromocionRepositorio implements PromocionRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorId(id: number): Promise<Promocion | null> {
    const p = await this.prisma.promocion.findUnique({ where: { id } });
    return p ? aDominio(p) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<Promocion | null> {
    const p = await this.prisma.promocion.findUnique({ where: { codigo } });
    return p ? aDominio(p) : null;
  }

  async listarAutomaticasVigentes(ahora: Date): Promise<Promocion[]> {
    const promos = await this.prisma.promocion.findMany({
      where: { codigo: null, activo: true, fecha_inicio: { lte: ahora }, fecha_fin: { gte: ahora } },
    });
    return promos.map(aDominio);
  }

  async listar(): Promise<Promocion[]> {
    const promos = await this.prisma.promocion.findMany({ orderBy: { id: 'desc' } });
    return promos.map(aDominio);
  }

  async crear(datos: DatosPromocion): Promise<Promocion> {
    const p = await this.prisma.promocion.create({
      data: {
        nombre: datos.nombre,
        codigo: datos.codigo ?? null,
        tipo_descuento: datos.tipo_descuento,
        valor: datos.valor,
        ciclo_aplicable: datos.ciclo_aplicable,
        combinable_con_anual: datos.combinable_con_anual,
        solo_cuentas_nuevas: datos.solo_cuentas_nuevas,
        fecha_inicio: datos.fecha_inicio,
        fecha_fin: datos.fecha_fin,
        usos_maximos: datos.usos_maximos ?? null,
        usos_maximos_por_cuenta: datos.usos_maximos_por_cuenta ?? null,
      },
    });
    return aDominio(p);
  }

  async actualizar(
    id: number,
    datos: Partial<DatosPromocion> & { activo?: boolean },
  ): Promise<Promocion> {
    const p = await this.prisma.promocion.update({ where: { id }, data: datos });
    return aDominio(p);
  }

  async contarUsosPorCuenta(promocion_id: number, usuario_id: number): Promise<number> {
    return this.prisma.pago.count({
      where: { promocion_id, usuario_id, estado: { notIn: ['rechazada', 'expirada'] } },
    });
  }

  async incrementarUsos(promocion_id: number): Promise<void> {
    await this.prisma.promocion.update({
      where: { id: promocion_id },
      data: { usos_actuales: { increment: 1 } },
    });
  }
}
