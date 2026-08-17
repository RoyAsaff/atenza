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
  // SaaS por cuenta (17/07, rediseñado 17/08): plan_id es el plan
  // contratado actualmente (Gratis por defecto al registrarse, null solo
  // en cuentas admin). trial_inicio ELIMINADO (17/08): el plan Gratis es
  // permanente, no hay nada que cronometrar — ver ObtenerEstadoCuenta.
  plan_id: number | null;
}

export type UsuarioPublico = Omit<Usuario, 'password'>;

export function aPublico(u: Usuario): UsuarioPublico {
  const { password: _omitido, ...publico } = u;
  return publico;
}
