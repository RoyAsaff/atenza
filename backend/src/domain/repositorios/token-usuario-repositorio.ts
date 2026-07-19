// HU-04: tokens de un solo uso para verificación de email y reset de password

export type TipoTokenUsuario = 'verificacion_email' | 'reset_password';

export interface TokenUsuario {
  id: number;
  usuario_id: number;
  tipo: TipoTokenUsuario;
  token_hash: string;
  creado_en: Date;
  expira_en: Date;
  usado_en: Date | null;
}

export interface TokenUsuarioRepositorio {
  crear(datos: {
    usuario_id: number;
    tipo: TipoTokenUsuario;
    token_hash: string;
    expira_en: Date;
  }): Promise<void>;
  /** Devuelve el token solo si existe, no fue usado y no expiró. */
  buscarValido(token_hash: string, tipo: TipoTokenUsuario): Promise<TokenUsuario | null>;
  marcarUsado(id: number): Promise<void>;
}
