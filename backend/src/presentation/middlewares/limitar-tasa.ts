// Frena fuerza bruta en endpoints de credenciales. Requiere `trust proxy`
// configurado (ver app.ts) para contar por IP real del cliente y no por la
// IP del proxy de la plataforma (Railway/Coolify).

import rateLimit from 'express-rate-limit';

export const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'DEMASIADOS_INTENTOS', mensaje: 'Demasiados intentos, espera unos minutos' },
});

export const limitarResetPassword = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'DEMASIADOS_INTENTOS', mensaje: 'Demasiados intentos, espera unos minutos' },
});
