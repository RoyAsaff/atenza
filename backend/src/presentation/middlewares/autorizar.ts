// HU-33 (parcial): autorización por contexto de uso.
// La autorización por propiedad (dueño de la materia / inscrito)
// se valida dentro de cada caso de uso.

import { NextFunction, Request, Response } from 'express';
import { ContextoSesion } from '../../domain/entidades/sesion';
import { ProhibidoError } from '../../domain/errores';

export function autorizarContexto(...permitidos: ContextoSesion[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !permitidos.includes(req.auth.contexto)) {
      return next(
        new ProhibidoError(
          `Esta operación requiere contexto: ${permitidos.join(' o ')}`,
        ),
      );
    }
    next();
  };
}
