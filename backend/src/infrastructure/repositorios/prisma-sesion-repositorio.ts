import { PrismaClient } from '@prisma/client';
import { ContextoSesion, Sesion } from '../../domain/entidades/sesion';
import {
  DatosNuevaSesion,
  SesionRepositorio,
} from '../../domain/repositorios/sesion-repositorio';

export class PrismaSesionRepositorio implements SesionRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async crear(datos: DatosNuevaSesion): Promise<Sesion> {
    return this.prisma.sesion.create({
      data: {
        usuario_id: datos.usuario_id,
        contexto: datos.contexto,
        jti: datos.jti,
        dispositivo: datos.dispositivo ?? null,
        ip: datos.ip ?? null,
        expira_en: datos.expira_en,
      },
    });
  }

  async buscarPorJti(jti: string): Promise<Sesion | null> {
    return this.prisma.sesion.findUnique({ where: { jti } });
  }

  async cerrarActivas(
    usuario_id: number,
    contexto: ContextoSesion,
    motivo: string,
  ): Promise<Sesion[]> {
    const activas = await this.prisma.sesion.findMany({
      where: { usuario_id, contexto, cerrada_en: null },
    });
    if (activas.length === 0) return [];

    await this.prisma.sesion.updateMany({
      where: { id: { in: activas.map((s) => s.id) } },
      data: { cerrada_en: new Date(), motivo_cierre: motivo },
    });
    return activas;
  }

  async cerrarTodas(usuario_id: number, motivo: string): Promise<Sesion[]> {
    const activas = await this.prisma.sesion.findMany({
      where: { usuario_id, cerrada_en: null },
    });
    if (activas.length === 0) return [];

    await this.prisma.sesion.updateMany({
      where: { id: { in: activas.map((s) => s.id) } },
      data: { cerrada_en: new Date(), motivo_cierre: motivo },
    });
    return activas;
  }
}
