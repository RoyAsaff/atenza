import {
  EstadoGuia,
  FilaGuiaLanzadaDocente,
  Guia,
  GuiaPregunta,
  TipoGuiaPregunta,
} from '../entidades/guia';

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
  /** Si vino de un "Analizar link" en el mismo formulario — la marca de
   * tiempo la pone la capa de aplicación (`new Date()`), nunca el cliente. */
  integracion_detectada?: boolean;
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
  integracion_detectada?: boolean;
}

export interface GuiaRepositorio {
  buscarPorId(id: number): Promise<Guia | null>;
  listarPorClase(clase_id: number): Promise<Guia[]>; // ordenadas por `orden`
  /** Barrido en segundo plano (ver barrer-vencimientos.ts): todas las
   * guías lanzadas ahora mismo, de cualquier docente/materia. */
  listarLanzadas(): Promise<Guia[]>;
  /** Inicio (31/08) · panel "Requiere tu atención": guías lanzadas del
   * docente, de cualquiera de sus materias, con el dato de su materia. */
  listarLanzadasPorDocente(docente_id: number): Promise<FilaGuiaLanzadaDocente[]>;
  /** HU-27: guías nativas ya cerradas de toda la materia (cualquier clase)
   * — equivalente de listarFinalizadasPorMateria de Evaluación, para el
   * Centralizador. Las "externa_legacy" nunca llegan a "cerrada", así que
   * quedan afuera solas (no tienen nota cuantitativa que mostrar). */
  listarCerradasPorMateria(materia_id: number): Promise<Guia[]>;
  /** Nace `estado: publicada`, lista para lanzar (16/08: guías nativas). */
  crear(datos: DatosNuevaGuia): Promise<Guia>;
  actualizar(id: number, datos: DatosActualizarGuia): Promise<Guia>;
  eliminar(id: number): Promise<void>;
  cambiarEstado(id: number, estado: EstadoGuia): Promise<Guia>;
  listarPreguntas(guia_id: number): Promise<GuiaPregunta[]>;
  buscarPreguntaPorReferencia(guia_id: number, referencia: string): Promise<GuiaPregunta | null>;
}
