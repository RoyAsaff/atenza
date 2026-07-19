// Implementación de desarrollo: imprime el correo en la terminal.
// Antes de producción se reemplaza por SMTP/proveedor implementando
// la misma interfaz EmailService (no se toca ningún caso de uso).

import { EmailService, MensajeEmail } from '../../domain/servicios/email-service';

export class ConsolaEmailService implements EmailService {
  async enviar(mensaje: MensajeEmail): Promise<void> {
    console.log('\n────────── EMAIL (dev) ──────────');
    console.log(`Para:    ${mensaje.destinatario}`);
    console.log(`Asunto:  ${mensaje.asunto}`);
    console.log(mensaje.cuerpo);
    console.log('─────────────────────────────────\n');
  }
}
