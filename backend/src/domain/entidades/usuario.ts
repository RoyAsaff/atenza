// Entidad Usuario según el diagrama de clases
// (codigo_estudiante removido por D-04: pertenece a la inscripción, E3)

export interface Usuario {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  password: string; // hash bcrypt
  whatsapp: string | null;
  rol_id: number;
  rol_nombre: 'admin' | 'docente_estudiante';
  activo: boolean;
  email_verificado: boolean;
  // SaaS por cuenta (17/07): prueba gratis de 30 días desde el registro;
  // plan_id es el plan contratado actualmente (null solo en cuentas admin).
  trial_inicio: Date;
  plan_id: number | null;
}

export type UsuarioPublico = Omit<Usuario, 'password'>;

export function aPublico(u: Usuario): UsuarioPublico {
  const { password: _omitido, ...publico } = u;
  return publico;
}
