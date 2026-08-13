import { ContextoSesion } from '../entidades/sesion';

export interface PayloadToken {
  sub: number; // id del usuario
  contexto: ContextoSesion;
  jti: string; // id de la sesión emitida (tabla sesiones)
  // Token de alcance acotado para abrir una guía desde PaginaGuias (sin
  // sesión real, ver verificar-token-guia.ts) — si está presente, este
  // token NO corresponde a una fila de `sesiones` y no debe pasar por
  // el middleware `autenticar` normal.
  guia_id?: number;
}

export interface TokenService {
  firmar(payload: PayloadToken, duracionSegundos: number): string;
  /** Devuelve el payload si el token es válido; lanza NoAutorizadoError si no. */
  verificar(token: string): PayloadToken;
}
