// Frena fuerza bruta en endpoints de credenciales. Requiere `trust proxy`
// configurado (ver app.ts) para contar por IP real del cliente y no por la
// IP del proxy de la plataforma (Railway/Coolify).

import { Request } from 'express';
import rateLimit from 'express-rate-limit';

const MENSAJE_DEMASIADOS_INTENTOS = {
  error: 'DEMASIADOS_INTENTOS',
  mensaje: 'Demasiados intentos, espera unos minutos',
};

// Bug reportado 13/08: con el límite solo por IP, varios estudiantes en la
// misma red de colegio (NAT — una sola IP pública para todos) agotaban el
// cupo del grupo entero apenas un par de ellos fallaba el password, aunque
// `skipSuccessfulRequests` ya evitaba contar los aciertos. La defensa real
// contra fuerza bruta pasa a ser por CUENTA (limitarLoginPorCuenta, abajo):
// así el intento fallido de un estudiante no consume el cupo de otro. Esta
// queda como respaldo genérico contra un flood/scan real desde una sola
// IP — el límite es generoso a propósito, ya no es la primera línea de
// defensa.
//
// 100 seguía siendo poco: confirmado con Roy que hay redes con 50-100+
// personas conectadas a la vez (laboratorio/varios cursos), y ni bien
// alguien pega en el límite reintenta al toque — eso multiplica los
// requests en la misma ventana y mantiene bloqueado a todo el grupo.
// Subido a 500: sigue acotando un flood real sin ser el cuello de botella
// de una red compartida grande.
export const limitarLoginPorIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: MENSAJE_DEMASIADOS_INTENTOS,
});

export function emailDelCuerpo(req: Request): string {
  const email = req.body?.email;
  // Sin email en el body (request mal formado, antes de que zod lo valide
  // en el handler) cae a un balde compartido por IP — no hay cuenta
  // puntual que proteger ahí, y sigue acotado por limitarLoginPorIp.
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : `sin-email:${req.ip}`;
}

// Fuerza bruta sobre UNA cuenta puntual, sin importar desde qué IP —
// límite ajustado a propósito, es la defensa que de verdad importa.
export const limitarLoginPorCuenta = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: emailDelCuerpo,
  message: MENSAJE_DEMASIADOS_INTENTOS,
});

// Mismo bug que tenía login antes del 13/08 (ver limitarLoginPorIp arriba),
// reportado el 19/08 en "olvidé mi contraseña": contar solo por IP hace que
// varios estudiantes en la misma red de colegio (NAT) agoten el cupo del
// grupo entero con un par de intentos — y con el límite tan bajo (5), se
// vuelve a agotar en minutos aunque se reinicie el backend (el contador
// vive en memoria, un restart solo lo pone en 0 un instante). Mismo
// arreglo: la defensa real pasa a ser por CUENTA (el email que puso en el
// forms, no revela si existe igual), este queda de respaldo genérico
// contra un flood real desde una sola IP.
export const limitarResetPassword = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: MENSAJE_DEMASIADOS_INTENTOS,
});

export const limitarResetPasswordPorCuenta = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailDelCuerpo,
  message: MENSAJE_DEMASIADOS_INTENTOS,
});

// E9 (01/09): cada "Ejecutar"/"Enviar" de un examen de código gasta un
// contenedor Docker real (dockerode-python-runner.ts) — a diferencia de
// login, acá SÍ hay un costo de infraestructura real por request, no solo
// riesgo de fuerza bruta. Por estudiante (req.auth.sub, ya autenticado a
// esta altura — nunca por IP: varios estudiantes del mismo laboratorio
// comparten IP, igual que el bug de login del 13/08), generoso para no
// entorpecer una sesión real de prueba-y-error durante el examen.
export const limitarEjecucionCodigo = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => String(req.auth?.sub ?? req.ip),
  message: MENSAJE_DEMASIADOS_INTENTOS,
});
