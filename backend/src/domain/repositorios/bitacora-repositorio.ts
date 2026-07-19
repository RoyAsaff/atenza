// HU-29: todo evento sensible se registra con usuario, rol, fecha/hora,
// IP/dispositivo, entidad afectada, valor anterior y valor nuevo.

export interface EventoBitacora {
  usuario_id?: number | null;
  rol_contexto: string; // admin | docente | estudiante | sistema
  accion: string; // login | cierre_sesion_forzado | ...
  entidad: string;
  entidad_id?: string | null;
  valor_anterior?: unknown;
  valor_nuevo?: unknown;
  ip?: string | null;
  dispositivo?: string | null;
}

export interface BitacoraRepositorio {
  registrar(evento: EventoBitacora): Promise<void>;
}
