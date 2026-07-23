import {
  EstadoEvaluacion,
  Evaluacion,
  EvaluacionConClase,
  EvaluacionConMateria,
  EvaluacionConPreguntas,
  Pregunta,
} from '../entidades/evaluacion';

export interface DatosNuevaEvaluacion {
  clase_id: number;
  tema: string;
  nota: number;
}

export interface DatosOpcion {
  texto: string;
  es_correcta: boolean;
}

export interface DatosPregunta {
  pregunta: string;
  opciones: DatosOpcion[];
}

export interface EvaluacionRepositorio {
  buscarPorId(id: number): Promise<Evaluacion | null>;
  buscarConPreguntas(id: number): Promise<EvaluacionConPreguntas | null>;
  /** Evaluaciones de una clase (para que el docente las gestione). */
  listarPorClase(clase_id: number): Promise<Evaluacion[]>;
  /** Todas las evaluaciones de la materia (cualquier clase, cualquier
   * estado), con el dato de su clase — vista "Evaluaciones" a nivel materia. */
  listarPorMateriaConClase(materia_id: number): Promise<EvaluacionConClase[]>;
  /** "Reutilizar evaluación": todas las evaluaciones del docente en
   * cualquiera de sus materias, ordenadas por fecha de creación descendente. */
  listarPorDocente(docente_id: number): Promise<EvaluacionConMateria[]>;
  crear(datos: DatosNuevaEvaluacion): Promise<Evaluacion>;
  actualizar(
    id: number,
    datos: { tema?: string; nota?: number; tiempo_limite_minutos?: number | null },
  ): Promise<Evaluacion>;
  cambiarEstado(id: number, estado: EstadoEvaluacion): Promise<Evaluacion>;
  /** HU-20: pasa a "lanzada" y deja fecha_lanzamiento en firme. */
  marcarLanzada(id: number): Promise<Evaluacion>;
  /** HU-26: pasa a "publicada" y deja fecha_publicacion en firme. */
  marcarPublicada(id: number): Promise<Evaluacion>;
  /** HU-27: todas las finalizadas de la materia (vía Clase), para el centralizador. */
  listarFinalizadasPorMateria(materia_id: number): Promise<Evaluacion[]>;
  /** HU-26: solo las publicadas de la materia, para "mis notas" del estudiante. */
  listarPublicadasPorMateria(materia_id: number): Promise<Evaluacion[]>;

  contarPreguntas(evaluacion_id: number): Promise<number>;
  buscarPregunta(pregunta_id: number): Promise<Pregunta | null>;
  /** Crea la pregunta con sus opciones; el orden se asigna al final. */
  agregarPregunta(evaluacion_id: number, datos: DatosPregunta): Promise<Pregunta>;
  /** Reemplaza texto y opciones (borra las anteriores, crea las nuevas). */
  actualizarPregunta(pregunta_id: number, datos: DatosPregunta): Promise<Pregunta>;
  actualizarImagenPregunta(pregunta_id: number, url_imagen: string): Promise<Pregunta>;
  eliminarPregunta(pregunta_id: number): Promise<void>;
  /** HU-18 Esc. 1: nuevo orden según la lista completa de ids recibida. */
  reordenarPreguntas(evaluacion_id: number, ordenIds: number[]): Promise<void>;
}
