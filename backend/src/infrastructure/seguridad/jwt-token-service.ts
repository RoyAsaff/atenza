import jwt from 'jsonwebtoken';
import { NoAutorizadoError } from '../../domain/errores';
import { PayloadToken, TokenService } from '../../domain/servicios/token-service';

export class JwtTokenService implements TokenService {
  constructor(private readonly secreto: string) {}

  firmar(payload: PayloadToken, duracionSegundos: number): string {
    return jwt.sign(
      {
        sub: String(payload.sub),
        contexto: payload.contexto,
        ...(payload.guia_id !== undefined ? { guia_id: payload.guia_id } : {}),
        ...(payload.guia_intento_id !== undefined
          ? { guia_intento_id: payload.guia_intento_id }
          : {}),
      },
      this.secreto,
      { expiresIn: duracionSegundos, jwtid: payload.jti },
    );
  }

  verificar(token: string): PayloadToken {
    try {
      const decodificado = jwt.verify(token, this.secreto) as jwt.JwtPayload;
      return {
        sub: Number(decodificado.sub),
        contexto: decodificado.contexto,
        jti: decodificado.jti as string,
        ...(decodificado.guia_id !== undefined ? { guia_id: Number(decodificado.guia_id) } : {}),
        ...(decodificado.guia_intento_id !== undefined
          ? { guia_intento_id: Number(decodificado.guia_intento_id) }
          : {}),
      };
    } catch {
      throw new NoAutorizadoError('Token inválido o expirado');
    }
  }
}
