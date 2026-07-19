import { PrismaClient } from '@prisma/client';
import { ConfiguracionPagoRepositorio } from '../../domain/repositorios/configuracion-pago-repositorio';

const ID_FILA_UNICA = 1;

export class PrismaConfiguracionPagoRepositorio implements ConfiguracionPagoRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async obtenerQr(): Promise<string | null> {
    const config = await this.prisma.configuracionPago.findUnique({
      where: { id: ID_FILA_UNICA },
    });
    return config?.url_qr ?? null;
  }

  async establecerQr(url_qr: string): Promise<void> {
    await this.prisma.configuracionPago.upsert({
      where: { id: ID_FILA_UNICA },
      update: { url_qr },
      create: { id: ID_FILA_UNICA, url_qr },
    });
  }
}
