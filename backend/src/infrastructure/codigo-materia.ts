import { randomBytes } from 'crypto';

// Código de materia legible y único, p. ej. "K3XW7Q"
// (sin 0/O ni 1/I para evitar confusiones al dictarlo en aula)
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generarCodigoMateria(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
}
