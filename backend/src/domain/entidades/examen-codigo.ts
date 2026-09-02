// E9 (01/09) · Entidades ExamenCodigo / Ejercicio / CasoPrueba.
// Calcado deliberadamente de evaluacion.ts (E6) — ver comentario extenso
// en schema.prisma sobre por qué es un sistema paralelo y no una extensión
// de Evaluacion. Reusa el enum EstadoEvaluacion (mismo ciclo de vida
// Borrador → Lista → Lanzada → Finalizada).

import { EstadoEvaluacion } from './evaluacion';

export interface ExamenCodigo {
  id: number;
  tema: string;
  clase_id: number;
  nota: number;
  estado: EstadoEvaluacion;
  tiempo_limite_minutos: number | null;
  fecha_lanzamiento: Date | null;
  publicada: boolean;
  fecha_publicacion: Date | null;
  creado_en: Date;
}

export interface CasoPrueba {
  id: number;
  ejercicio_id: number;
  entrada: string;
  salida_esperada: string;
  es_oculto: boolean;
  orden: number;
}

export interface Ejercicio {
  id: number;
  enunciado: string;
  plantilla_codigo: string | null;
  examen_codigo_id: number;
  nota: number;
  orden: number;
  casos_prueba: CasoPrueba[];
}

export interface ExamenCodigoConEjercicios extends ExamenCodigo {
  ejercicios: Ejercicio[];
}

/** Vista a nivel materia (mezcla exámenes de código de varias clases). */
export interface ExamenCodigoConClase extends ExamenCodigo {
  clase: {
    id: number;
    fecha: Date;
    hora: string;
    tema: string;
  };
}
