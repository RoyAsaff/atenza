import bcrypt from 'bcryptjs';
import { PasswordHasher } from '../../domain/servicios/password-hasher';

const RONDAS = 10;

export class BcryptPasswordHasher implements PasswordHasher {
  hashear(passwordPlano: string): Promise<string> {
    return bcrypt.hash(passwordPlano, RONDAS);
  }

  comparar(passwordPlano: string, hash: string): Promise<boolean> {
    return bcrypt.compare(passwordPlano, hash);
  }
}
