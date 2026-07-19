// QR único global de cobro (17/07) — fila singleton, no hay uno por plan.

export interface ConfiguracionPagoRepositorio {
  obtenerQr(): Promise<string | null>;
  establecerQr(url_qr: string): Promise<void>;
}
