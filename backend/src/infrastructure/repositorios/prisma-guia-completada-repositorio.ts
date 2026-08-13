import { PrismaClient } from '@prisma/client';
import {
  DatosGuiaCompletada,
  FilaGuiaCompletada,
  GuiaCompletadaRepositorio,
} from '../../domain/repositorios/guia-completada-repositorio';

export class PrismaGuiaCompletadaRepositorio implements GuiaCompletadaRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async marcarCompletada(datos: DatosGuiaCompletada): Promise<void> {
    await this.prisma.guiaCompletada.upsert({
      where: {
        guia_id_estudiante_id: {
          guia_id: datos.guia_id,
          estudiante_id: datos.estudiante_id,
        },
      },
      create: datos,
      update: {}, // idempotente: no se pisa la fecha de la primera vez
    });
  }

  async listarPorGuias(guia_ids: number[]): Promise<FilaGuiaCompletada[]> {
    if (guia_ids.length === 0) return [];
    return this.prisma.guiaCompletada.findMany({ where: { guia_id: { in: guia_ids } } });
  }

  async buscar(guia_id: number, estudiante_id: number): Promise<FilaGuiaCompletada | null> {
    return this.prisma.guiaCompletada.findUnique({
      where: { guia_id_estudiante_id: { guia_id, estudiante_id } },
    });
  }
}
