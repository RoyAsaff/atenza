// SaaS por cuenta (17/07): bloquea acciones de escritura del docente
// cuando su cuenta está vencida (modo solo lectura). Se aplica igual que
// `soloDocente` — threaded manualmente en cada ruta de escritura — y
// NUNCA en rutas de `cuenta-rutas.ts` (no debe bloquear el pago mismo).

import { NextFunction, Request, Response } from 'express';
import { CuentaVencidaError } from '../../domain/errores';
import { ObtenerEstadoCuenta } from '../../application/cuenta/obtener-estado-cuenta';

export function crearVerificarCuentaActiva(estadoCuenta: ObtenerEstadoCuenta) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const cuenta = await estadoCuenta.ejecutar(req.auth!.sub);
      if (cuenta.solo_lectura) throw new CuentaVencidaError();
      next();
    } catch (error) {
      next(error);
    }
  };
}
