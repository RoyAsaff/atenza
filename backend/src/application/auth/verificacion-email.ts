// HU-04 · Escenario 1: verificación de correo.
// El token viaja en el enlace; en BD solo se guarda su hash sha256.

import { createHash, randomBytes } from 'crypto';
import { TokenInvalidoError } from '../../domain/errores';
import { UsuarioRepositorio } from '../../domain/repositorios/usuario-repositorio';
import { TokenUsuarioRepositorio } from '../../domain/repositorios/token-usuario-repositorio';
import { EmailService } from '../../domain/servicios/email-service';

export function hashearToken(tokenPlano: string): string {
  return createHash('sha256').update(tokenPlano).digest('hex');
}

const VERIFICACION_HORAS = 24;

export class EnviarVerificacionEmail {
  constructor(
    private readonly usuarios: UsuarioRepositorio,
    private readonly tokens: TokenUsuarioRepositorio,
    private readonly emails: EmailService,
    private readonly appUrl: string,
  ) {}

  async ejecutar(usuarioId: number): Promise<void> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario || usuario.email_verificado) return;

    const tokenPlano = randomBytes(32).toString('hex');
    await this.tokens.crear({
      usuario_id: usuario.id,
      tipo: 'verificacion_email',
      token_hash: hashearToken(tokenPlano),
      expira_en: new Date(Date.now() + VERIFICACION_HORAS * 3600 * 1000),
    });

    await this.emails.enviar({
      destinatario: usuario.email,
      asunto: 'ATENZA — Verifica tu correo',
      cuerpo:
        `Hola ${usuario.nombres},\n\n` +
        `Verifica tu correo abriendo este enlace (válido por ${VERIFICACION_HORAS} horas):\n` +
        `${this.appUrl}/verificar-email?token=${tokenPlano}\n`,
    });
  }
}

export class VerificarEmail {
  constructor(
    private readonly usuarios: UsuarioRepositorio,
    private readonly tokens: TokenUsuarioRepositorio,
  ) {}

  async ejecutar(tokenPlano: string): Promise<void> {
    const token = await this.tokens.buscarValido(
      hashearToken(tokenPlano),
      'verificacion_email',
    );
    if (!token) throw new TokenInvalidoError();

    await this.usuarios.marcarEmailVerificado(token.usuario_id);
    await this.tokens.marcarUsado(token.id);
  }
}
