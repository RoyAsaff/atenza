// Subida de archivos a disco local (comprobantes, QR de cobro).
// Detrás de esta configuración; migrable a S3/Cloudinary más adelante.

import multer from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';

export const CARPETA_UPLOADS = join(process.cwd(), 'uploads');

if (!existsSync(CARPETA_UPLOADS)) mkdirSync(CARPETA_UPLOADS, { recursive: true });

const EXTENSIONES_PERMITIDAS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const TAMANO_MAX_MB = 5;

const storage = multer.diskStorage({
  destination: CARPETA_UPLOADS,
  filename: (_req, file, cb) => {
    const nombre = `${Date.now()}-${randomBytes(8).toString('hex')}${extname(file.originalname).toLowerCase()}`;
    cb(null, nombre);
  },
});

export const subirArchivo = multer({
  storage,
  limits: { fileSize: TAMANO_MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
      return cb(new Error(`Solo se permiten: ${EXTENSIONES_PERMITIDAS.join(', ')}`));
    }
    cb(null, true);
  },
});

/** Ruta pública con la que se sirve el archivo. */
export function rutaPublica(nombreArchivo: string): string {
  return `/uploads/${nombreArchivo}`;
}

// Importar preguntas desde Word: el archivo solo se parsea (no se guarda
// en disco ni se sirve), así que va en memoria en vez de a CARPETA_UPLOADS.
export const subirDocumento = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (extname(file.originalname).toLowerCase() !== '.docx') {
      return cb(new Error('Solo se permiten archivos .docx'));
    }
    cb(null, true);
  },
});
