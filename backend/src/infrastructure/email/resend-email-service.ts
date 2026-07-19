// API HTTP de Resend (https://resend.com/docs/api-reference/emails/send-email)
// en vez de SMTP — Railway (plan Hobby) bloquea los puertos SMTP salientes
// (587/465), pero HTTPS normal (443) funciona sin problema. Esta es la
// alternativa que la propia Railway recomienda para transaccionales.

import { EmailService, MensajeEmail } from '../../domain/servicios/email-service';

export class ResendEmailService implements EmailService {
  constructor(
    private readonly apiKey: string,
    private readonly remitente: string,
  ) {}

  async enviar(mensaje: MensajeEmail): Promise<void> {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.remitente,
        to: mensaje.destinatario,
        subject: mensaje.asunto,
        text: mensaje.cuerpo,
      }),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      throw new Error(`Resend respondió ${respuesta.status}: ${detalle}`);
    }
  }
}
