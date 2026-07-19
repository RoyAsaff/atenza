// Entidad Sesion — acordada el 12/07 para soportar D-03 y HU-33

export type ContextoSesion = 'docente' | 'estudiante' | 'admin';

export interface Sesion {
  id: number;
  usuario_id: number;
  contexto: ContextoSesion;
  jti: string;
  dispositivo: string | null;
  ip: string | null;
  creada_en: Date;
  expira_en: Date;
  cerrada_en: Date | null;
  motivo_cierre: string | null;
}
