// Implementación de producción: envía por SMTP genérico (nodemailer), así
// sirve igual con Resend, Mailgun, SES o cualquier otro proveedor que dé
// credenciales SMTP — no ata el código a un SDK propietario.

import { createTransport, Transporter } from 'nodemailer';
import { EmailService, MensajeEmail } from '../../domain/servicios/email-service';

export class SmtpEmailService implements EmailService {
  private readonly transportador: Transporter;
  private readonly remitente: string;

  constructor(config: {
    host: string;
    port: number;
    usuario: string;
    password: string;
    remitente: string;
  }) {
    this.transportador = createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.usuario, pass: config.password },
    });
    this.remitente = config.remitente;
  }

  async enviar(mensaje: MensajeEmail): Promise<void> {
    await this.transportador.sendMail({
      from: this.remitente,
      to: mensaje.destinatario,
      subject: mensaje.asunto,
      text: mensaje.cuerpo,
    });
  }
}
