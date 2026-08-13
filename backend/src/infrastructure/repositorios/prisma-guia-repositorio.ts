import { PrismaClient } from '@prisma/client';
import { Guia } from '../../domain/entidades/guia';
import { DatosNuevaGuia, GuiaRepositorio } from '../../domain/repositorios/guia-repositorio';

export class PrismaGuiaRepositorio implements GuiaRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorId(id: number): Promise<Guia | null> {
    return this.prisma.guia.findUnique({ where: { id } });
  }

  async listarPorClase(clase_id: number): Promise<Guia[]> {
    return this.prisma.guia.findMany({ where: { clase_id }, orderBy: { orden: 'asc' } });
  }

  async crear(datos: DatosNuevaGuia): Promise<Guia> {
    return this.prisma.guia.create({ data: datos });
  }

  async actualizar(
    id: number,
    datos: { tema?: string; url?: string; orden?: number },
  ): Promise<Guia> {
    return this.prisma.guia.update({ where: { id }, data: datos });
  }

  async eliminar(id: number): Promise<void> {
    await this.prisma.guia.delete({ where: { id } });
  }
}
