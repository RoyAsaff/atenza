export interface MensajeEmail {
  destinatario: string;
  asunto: string;
  cuerpo: string; // texto plano por ahora; HTML cuando haya proveedor real
}

export interface EmailService {
  enviar(mensaje: MensajeEmail): Promise<void>;
}
