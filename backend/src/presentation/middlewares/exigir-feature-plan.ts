// Rediseño SaaS (17/08): bloquea acciones de escritura que requieren una
// función premium (importar de Word, Guías) no incluida en el plan del
// docente. Mismo molde que `verificar-cuenta-activa.ts` — threaded
// manualmente después de `cuentaActiva` en cada ruta de escritura relevante.

import { NextFunction, Request, Response } from 'express';
import { FeatureNoDisponibleError } from '../../domain/errores';
import { ObtenerEstadoCuenta } from '../../application/cuenta/obtener-estado-cuenta';

type FeaturePlan = 'permite_import_word' | 'permite_guias';

export function crearExigirFeaturePlan(estadoCuenta: ObtenerEstadoCuenta, feature: FeaturePlan) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const cuenta = await estadoCuenta.ejecutar(req.auth!.sub);
      if (!cuenta.plan?.[feature]) {
        throw new FeatureNoDisponibleError(
          'Tu plan actual no incluye esta función. Actualiza a Pro para desbloquearla',
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
