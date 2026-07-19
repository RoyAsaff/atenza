import { Prisma, PrismaClient } from '@prisma/client';
import {
  BitacoraRepositorio,
  EventoBitacora,
} from '../../domain/repositorios/bitacora-repositorio';

export class PrismaBitacoraRepositorio implements BitacoraRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async registrar(evento: EventoBitacora): Promise<void> {
    // Solo INSERT: el rol de BD atenza_app no permite otra cosa (D-10)
    await this.prisma.bitacora.create({
      data: {
        usuario_id: evento.usuario_id ?? null,
        rol_contexto: evento.rol_contexto,
        accion: evento.accion,
        entidad: evento.entidad,
        entidad_id: evento.entidad_id ?? null,
        valor_anterior:
          (evento.valor_anterior as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        valor_nuevo:
          (evento.valor_nuevo as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        ip: evento.ip ?? null,
        dispositivo: evento.dispositivo ?? null,
      },
    });
  }
}
