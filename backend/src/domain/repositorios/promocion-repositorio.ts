import { CicloAplicablePromo, Promocion, TipoDescuento } from '../entidades/promocion';

export interface DatosPromocion {
  nombre: string;
  codigo?: string | null;
  tipo_descuento: TipoDescuento;
  valor: number;
  ciclo_aplicable: CicloAplicablePromo;
  combinable_con_anual: boolean;
  solo_cuentas_nuevas: boolean;
  fecha_inicio: Date;
  fecha_fin: Date;
  usos_maximos?: number | null;
  usos_maximos_por_cuenta?: number | null;
}

export interface PromocionRepositorio {
  buscarPorId(id: number): Promise<Promocion | null>;
  buscarPorCodigo(codigo: string): Promise<Promocion | null>;
  /** Automáticas vigentes: codigo=null, activo=true, dentro de la ventana de fechas. */
  listarAutomaticasVigentes(ahora: Date): Promise<Promocion[]>;
  /** Admin: todas, incluidas inactivas/vencidas. */
  listar(): Promise<Promocion[]>;
  crear(datos: DatosPromocion): Promise<Promocion>;
  actualizar(id: number, datos: Partial<DatosPromocion> & { activo?: boolean }): Promise<Promocion>;
  /** Usos por cuenta contra pagos no rechazados/no expirados (evita reintentos ilimitados). */
  contarUsosPorCuenta(promocion_id: number, usuario_id: number): Promise<number>;
  /** Atómico — se llama solo al APROBAR un pago (D6 del plan). */
  incrementarUsos(promocion_id: number): Promise<void>;
}
