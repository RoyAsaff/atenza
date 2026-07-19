// HU-04 · Escenario 2: recuperación de contraseña.
// Enlace temporal de un solo uso; al restablecer se cierran TODAS
// las sesiones activas y el evento queda en bitácora.

import { randomBytes } from 'crypto';
import { TokenInvalidoError } from '../../domain/errores';
import { UsuarioRepositorio } from '../../domain/repositorios/usuario-repositorio';
import { TokenUsuarioRepositorio } from '../../domain/repositorios/token-usuario-repositorio';
import { SesionRepositorio } from '../../domain/repositorios/sesion-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { EmailService } from '../../domain/servicios/email-service';
import { PasswordHasher } from '../../domain/servicios/password-hasher';
import { hashearToken } from './verificacion-email';

const RESET_MINUTOS = 60;

export class SolicitarResetPassword {
  constructor(
    private readonly usuarios: UsuarioRepositorio,
    private readonly tokens: TokenUsuarioRepositorio,
    private readonly emails: EmailService,
    private readonly appUrl: string,
  ) {}

  /** Siempre "responde ok": no revela si el correo existe o no. */
  async ejecutar(email: string): Promise<void> {
    const usuario = await this.usuarios.buscarPorEmail(email.trim().toLowerCase());
    if (!usuario || !usuario.activo) return;

    const tokenPlano = randomBytes(32).toString('hex');
    await this.tokens.crear({
      usuario_id: usuario.id,
      tipo: 'reset_password',
      token_hash: hashearToken(tokenPlano),
      expira_en: new Date(Date.now() + RESET_MINUTOS * 60 * 1000),
    });

    await this.emails.enviar({
      destinatario: usuario.email,
      asunto: 'ATENZA — Restablecer contraseña',
      cuerpo:
        `Hola ${usuario.nombres},\n\n` +
        `Para definir una nueva contraseña abre este enlace (válido por ${RESET_MINUTOS} minutos, un solo uso):\n` +
        `${this.appUrl}/restablecer-password?token=${tokenPlano}\n\n` +
        `Si no lo solicitaste, ignora este correo.\n`,
    });
  }
}

export class RestablecerPassword {
  constructor(
    private readonly usuarios: UsuarioRepositorio,
    private readonly tokens: TokenUsuarioRepositorio,
    private readonly sesiones: SesionRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly hasher: PasswordHasher,
  ) {}

  async ejecutar(entrada: {
    tokenPlano: string;
    nuevaPassword: string;
    ip?: string;
    dispositivo?: string;
  }): Promise<void> {
    const token = await this.tokens.buscarValido(
      hashearToken(entrada.tokenPlano),
      'reset_password',
    );
    if (!token) throw new TokenInvalidoError();

    const passwordHash = await this.hasher.hashear(entrada.nuevaPassword);
    await this.usuarios.actualizarPassword(token.usuario_id, passwordHash);
    await this.tokens.marcarUsado(token.id);

    // "todas mis sesiones activas se cierran" (HU-04, Escenario 2)
    const cerradas = await this.sesiones.cerrarTodas(token.usuario_id, 'password_reset');

    await this.bitacora.registrar({
      usuario_id: token.usuario_id,
      rol_contexto: 'sistema',
      accion: 'password_restablecido',
      entidad: 'usuario',
      entidad_id: String(token.usuario_id),
      valor_nuevo: { sesiones_cerradas: cerradas.map((s) => s.id) },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}
