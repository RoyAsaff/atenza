// Entidades Evaluacion / Pregunta / Opcion según el diagrama (E6)
// HU-17/HU-19: estado del flujo Borrador → Lista → Lanzada → Finalizada
// (campo no presente en el diagrama, acordado el 13/07 — ver schema.prisma)

export type EstadoEvaluacion = 'borrador' | 'lista' | 'lanzada' | 'finalizada';

export interface Evaluacion {
  id: number;
  tema: string;
  clase_id: number;
  nota: number;
  estado: EstadoEvaluacion;
  tiempo_limite_minutos: number | null;
  fecha_lanzamiento: Date | null;
  /** E8 (HU-26): el docente decide cuándo el estudiante ve su nota. */
  publicada: boolean;
  fecha_publicacion: Date | null;
  creado_en: Date;
}

export interface Opcion {
  id: number;
  texto: string;
  pregunta_id: number;
  es_correcta: boolean;
}

export interface Pregunta {
  id: number;
  pregunta: string;
  url_imagen: string | null;
  evaluacion_id: number;
  orden: number;
  opciones: Opcion[];
}

export interface EvaluacionConPreguntas extends Evaluacion {
  preguntas: Pregunta[];
}

/** Todas las evaluaciones de una materia (cualquier clase): vista a nivel
 * materia, junto a "Código y nómina" — cada fila necesita saber de qué
 * clase es, ya que mezcla evaluaciones de varias. */
export interface EvaluacionConClase extends Evaluacion {
  clase: {
    id: number;
    fecha: Date;
    hora: string;
    tema: string;
  };
}

/** "Reutilizar evaluación": todas las evaluaciones del docente en cualquiera
 * de sus materias, con el dato de la materia — para el selector cross-materia. */
export interface EvaluacionConMateria extends Evaluacion {
  clase: {
    id: number;
    fecha: Date;
    hora: string;
    tema: string;
  };
  materia: {
    id: number;
    nombre_materia: string;
  };
}

/** HU-19 Esc. 2: vista de demostración — sin exponer la opción correcta. */
export interface OpcionDemostracion {
  id: number;
  texto: string;
}

export interface PreguntaDemostracion {
  id: number;
  pregunta: string;
  url_imagen: string | null;
  opciones: OpcionDemostracion[];
}

export interface Demostracion {
  tema: string;
  nota: number;
  preguntas: PreguntaDemostracion[];
}
