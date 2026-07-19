import { ContextoSesion } from '../entidades/sesion';

export interface PayloadToken {
  sub: number; // id del usuario
  contexto: ContextoSesion;
  jti: string; // id de la sesión emitida (tabla sesiones)
}

export interface TokenService {
  firmar(payload: PayloadToken, duracionSegundos: number): string;
  /** Devuelve el payload si el token es válido; lanza NoAutorizadoError si no. */
  verificar(token: string): PayloadToken;
}
