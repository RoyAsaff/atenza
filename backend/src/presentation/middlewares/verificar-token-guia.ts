// Guías (fusión con PaginaGuias, 05/08): la página de la guía corre en
// un dominio externo (GitHub Pages) y no tiene sesión real de ATENZA, así
// que el link que arma `VerGuias` para el estudiante lleva un JWT de
// alcance acotado (`guia_id`, ver token-service.ts) en vez del token de
// sesión normal.
//
// A propósito NO es el middleware `autenticar`: ese exige una fila activa
// en `sesiones` vía `jti` (ver autenticar.ts), y este token no tiene
// sesión asociada — solo se verifica la firma/expiración y que el
// `guia_id` del token coincida con el de la URL.

import { NextFunction, Request, Response } from 'express';
import { NoAutorizadoError } from '../../domain/errores';
import { TokenService } from '../../domain/servicios/token-service';

export function crearVerificarTokenGuia(tokens: TokenService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const cabecera = req.headers.authorization;
      if (!cabecera?.startsWith('Bearer ')) {
        throw new NoAutorizadoError('Falta el token de acceso a la guía');
      }

      const payload = tokens.verificar(cabecera.slice('Bearer '.length));

      const guiaId = Number(req.params.id);
      if (payload.contexto !== 'estudiante' || payload.guia_id !== guiaId) {
        throw new NoAutorizadoError('Token de guía inválido para este recurso');
      }

      req.auth = payload;
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Guías nativas (16/08): mismo criterio, pero acotado a UN intento puntual
// (`guia_intento_id`, ver rendir-guia.ts) en vez de a la guía entera — así
// el reporte de respuestas/incidencias desde la página externa no puede
// mezclarse con otro intento del mismo estudiante.
export function crearVerificarTokenGuiaIntento(tokens: TokenService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const cabecera = req.headers.authorization;
      if (!cabecera?.startsWith('Bearer ')) {
        throw new NoAutorizadoError('Falta el token de acceso a la guía');
      }

      const payload = tokens.verificar(cabecera.slice('Bearer '.length));

      const intentoId = Number(req.params.intentoId);
      if (payload.contexto !== 'estudiante' || payload.guia_intento_id !== intentoId) {
        throw new NoAutorizadoError('Token de guía inválido para este recurso');
      }

      req.auth = payload;
      next();
    } catch (error) {
      next(error);
    }
  };
}
