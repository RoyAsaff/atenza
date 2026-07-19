import { PrismaClient } from '@prisma/client';
import {
  TipoTokenUsuario,
  TokenUsuario,
  TokenUsuarioRepositorio,
} from '../../domain/repositorios/token-usuario-repositorio';

export class PrismaTokenUsuarioRepositorio implements TokenUsuarioRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async crear(datos: {
    usuario_id: number;
    tipo: TipoTokenUsuario;
    token_hash: string;
    expira_en: Date;
  }): Promise<void> {
    await this.prisma.tokenUsuario.create({ data: datos });
  }

  async buscarValido(
    token_hash: string,
    tipo: TipoTokenUsuario,
  ): Promise<TokenUsuario | null> {
    return this.prisma.tokenUsuario.findFirst({
      where: {
        token_hash,
        tipo,
        usado_en: null,
        expira_en: { gt: new Date() },
      },
    });
  }

  async marcarUsado(id: number): Promise<void> {
    await this.prisma.tokenUsuario.update({
      where: { id },
      data: { usado_en: new Date() },
    });
  }
}
