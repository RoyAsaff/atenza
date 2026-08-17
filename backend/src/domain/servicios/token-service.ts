import { ContextoSesion } from '../entidades/sesion';

export interface PayloadToken {
  sub: number; // id del usuario
  contexto: ContextoSesion;
  jti: string; // id de la sesión emitida (tabla sesiones)
  // Token de alcance acotado para abrir una guía desde su página externa
  // (sin sesión real, ver verificar-token-guia.ts) — si está presente, este
  // token NO corresponde a una fila de `sesiones` y no debe pasar por
  // el middleware `autenticar` normal.
  guia_id?: number;
  // Guías nativas (16/08): acota el token a UN intento puntual (oficial o
  // repaso), no a la guía entera — así el reporte de respuestas/incidencias
  // desde la página externa queda atado a ese intento específico.
  guia_intento_id?: number;
}

export interface TokenService {
  firmar(payload: PayloadToken, duracionSegundos: number): string;
  /** Devuelve el payload si el token es válido; lanza NoAutorizadoError si no. */
  verificar(token: string): PayloadToken;
}
