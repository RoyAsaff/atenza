import { ContextoSesion, Sesion } from '../entidades/sesion';

export interface DatosNuevaSesion {
  usuario_id: number;
  contexto: ContextoSesion;
  jti: string;
  dispositivo?: string;
  ip?: string;
  expira_en: Date;
}

export interface SesionRepositorio {
  crear(datos: DatosNuevaSesion): Promise<Sesion>;
  buscarPorJti(jti: string): Promise<Sesion | null>;
  /** Cierra todas las sesiones activas del usuario en un contexto. Devuelve las cerradas. */
  cerrarActivas(
    usuario_id: number,
    contexto: ContextoSesion,
    motivo: string,
  ): Promise<Sesion[]>;
  /** Cierra TODAS las sesiones activas del usuario (HU-04: reset de contraseña). */
  cerrarTodas(usuario_id: number, motivo: string): Promise<Sesion[]>;
}
