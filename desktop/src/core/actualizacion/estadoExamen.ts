// Bandera compartida y mínima (no Context, no store — un solo booleano
// leído desde un lugar) que le dice a useActualizarApp.ts si hay un examen
// en curso ahora mismo. La fija ExamenCodigoPage con la misma condición
// que ya usa para el modo kiosko (`comenzado && !enviado && !cancelado`).
// El único motivo de este archivo: instalar una actualización reinicia la
// app (`relaunch()`) — eso NUNCA puede pasar con un intento activo.

let examenActivo = false;

export function marcarExamenActivo(activo: boolean) {
  examenActivo = activo;
}

export function hayExamenActivo(): boolean {
  return examenActivo;
}
