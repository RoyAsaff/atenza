import jwt from 'jsonwebtoken';
import { NoAutorizadoError } from '../../domain/errores';
import { PayloadToken, TokenService } from '../../domain/servicios/token-service';

export class JwtTokenService implements TokenService {
  constructor(private readonly secreto: string) {}

  firmar(payload: PayloadToken, duracionSegundos: number): string {
    return jwt.sign(
      { sub: String(payload.sub), contexto: payload.contexto },
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
      };
    } catch {
      throw new NoAutorizadoError('Token inválido o expirado');
    }
  }
}
