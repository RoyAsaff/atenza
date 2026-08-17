import { EstadoGuia, Guia, GuiaPregunta, TipoGuiaPregunta } from '../entidades/guia';

export interface DatosGuiaPregunta {
  referencia: string;
  tipo: TipoGuiaPregunta;
  respuesta_modelo?: string | null;
  orden: number;
}

export interface DatosNuevaGuia {
  clase_id: number;
  tema: string;
  url: string;
  orden: number;
  nota: number;
  tiempo_limite_minutos?: number | null;
  preguntas: DatosGuiaPregunta[];
}

export interface DatosActualizarGuia {
  tema?: string;
  url?: string;
  orden?: number;
  nota?: number;
  tiempo_limite_minutos?: number | null;
  /** Si viene, reemplaza el manifest completo (borra y crea de nuevo —
   * mismo criterio que Evaluación.actualizarPregunta con sus opciones). */
  preguntas?: DatosGuiaPregunta[];
}

export interface GuiaRepositorio {
  buscarPorId(id: number): Promise<Guia | null>;
  listarPorClase(clase_id: number): Promise<Guia[]>; // ordenadas por `orden`
  /** Barrido en segundo plano (ver barrer-vencimientos.ts): todas las
   * guías lanzadas ahora mismo, de cualquier docente/materia. */
  listarLanzadas(): Promise<Guia[]>;
  /** Nace `estado: publicada`, lista para lanzar (16/08: guías nativas). */
  crear(datos: DatosNuevaGuia): Promise<Guia>;
  actualizar(id: number, datos: DatosActualizarGuia): Promise<Guia>;
  eliminar(id: number): Promise<void>;
  cambiarEstado(id: number, estado: EstadoGuia): Promise<Guia>;
  listarPreguntas(guia_id: number): Promise<GuiaPregunta[]>;
  buscarPreguntaPorReferencia(guia_id: number, referencia: string): Promise<GuiaPregunta | null>;
}
