import { Guia } from '../entidades/guia';

export interface DatosNuevaGuia {
  clase_id: number;
  tema: string;
  url: string;
  orden: number;
}

export interface GuiaRepositorio {
  buscarPorId(id: number): Promise<Guia | null>;
  listarPorClase(clase_id: number): Promise<Guia[]>; // ordenadas por `orden`
  crear(datos: DatosNuevaGuia): Promise<Guia>;
  actualizar(
    id: number,
    datos: { tema?: string; url?: string; orden?: number },
  ): Promise<Guia>;
  eliminar(id: number): Promise<void>;
}
