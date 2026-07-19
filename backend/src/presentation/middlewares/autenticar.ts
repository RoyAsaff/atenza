// Middleware de autenticación (base de HU-33):
// 1. Verifica el JWT.
// 2. Verifica que la sesión (jti) siga activa en BD — así el cierre
//    forzado de D-03 invalida de verdad el token anterior del docente.

import { NextFunction, Request, Response } from 'express';
import { NoAutorizadoError } from '../../domain/errores';
import { PayloadToken, TokenService } from '../../domain/servicios/token-service';
import { SesionRepositorio } from '../../domain/repositorios/sesion-repositorio';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: PayloadToken;
    }
  }
}

export function crearAutenticar(tokens: TokenService, sesiones: SesionRepositorio) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const cabecera = req.headers.authorization;
      if (!cabecera?.startsWith('Bearer ')) {
        throw new NoAutorizadoError('Falta el token Bearer');
      }

      const payload = tokens.verificar(cabecera.slice('Bearer '.length));

      const sesion = await sesiones.buscarPorJti(payload.jti);
      if (!sesion || sesion.cerrada_en !== null || sesion.expira_en < new Date()) {
        throw new NoAutorizadoError('La sesión ya no está activa');
      }

      req.auth = payload;
      next();
    } catch (error) {
      next(error);
    }
  };
}
