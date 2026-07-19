import { Usuario } from '../entidades/usuario';

export interface DatosNuevoUsuario {
  nombres: string;
  apellidos: string;
  email: string;
  passwordHash: string;
  whatsapp?: string;
  rol_nombre: 'admin' | 'docente_estudiante';
  /** SaaS por cuenta (17/07): plan Básico asignado al registrarse (prueba gratis). */
  plan_id?: number;
}

export interface UsuarioRepositorio {
  buscarPorEmail(email: string): Promise<Usuario | null>;
  buscarPorId(id: number): Promise<Usuario | null>;
  crear(datos: DatosNuevoUsuario): Promise<Usuario>;
  marcarEmailVerificado(id: number): Promise<void>;
  actualizarPassword(id: number, passwordHash: string): Promise<void>;
  /** Al aprobar un pago: fija el plan recién pagado (permite upgrade/downgrade). */
  actualizarPlan(id: number, plan_id: number): Promise<void>;
  /** HU-09: listado con búsqueda para el panel admin. */
  listar(buscar?: string): Promise<Usuario[]>;
}
