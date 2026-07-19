import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { ErrorDeDominio } from '../../domain/errores';

export function manejarErrores(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'DATOS_INVALIDOS',
      detalles: error.errors.map((e) => ({
        campo: e.path.join('.'),
        mensaje: e.message,
      })),
    });
  }

  if (error instanceof MulterError) {
    const mensaje =
      error.code === 'LIMIT_UNEXPECTED_FILE'
        ? `Campo de archivo inesperado: "${error.field}". Revisa el nombre del campo en el form-data`
        : error.code === 'LIMIT_FILE_SIZE'
          ? 'El archivo supera el tamaño máximo (5 MB)'
          : error.message;
    return res.status(400).json({ error: 'ARCHIVO_INVALIDO', mensaje });
  }

  if (error instanceof ErrorDeDominio) {
    return res.status(error.status).json({ error: error.codigo, mensaje: error.message });
  }

  console.error('[atenza-api] error no controlado:', error);
  return res.status(500).json({ error: 'ERROR_INTERNO' });
}
