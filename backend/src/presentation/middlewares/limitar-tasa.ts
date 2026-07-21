// Frena fuerza bruta en endpoints de credenciales. Requiere `trust proxy`
// configurado (ver app.ts) para contar por IP real del cliente y no por la
// IP del proxy de la plataforma (Railway/Coolify).

import rateLimit from 'express-rate-limit';

export const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  // Los logins correctos no cuentan contra el cupo: en redes de colegio
  // muchos estudiantes comparten una sola IP (NAT), y contar también los
  // aciertos agotaba el cupo del grupo aunque nadie estuviera haciendo
  // fuerza bruta.
  skipSuccessfulRequests: true,
  message: { error: 'DEMASIADOS_INTENTOS', mensaje: 'Demasiados intentos, espera unos minutos' },
});

export const limitarResetPassword = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'DEMASIADOS_INTENTOS', mensaje: 'Demasiados intentos, espera unos minutos' },
});
