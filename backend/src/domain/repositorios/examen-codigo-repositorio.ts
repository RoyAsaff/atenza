import { EstadoEvaluacion } from '../entidades/evaluacion';
import {
  CasoPrueba,
  Ejercicio,
  ExamenCodigo,
  ExamenCodigoConClase,
  ExamenCodigoConEjercicios,
} from '../entidades/examen-codigo';

export interface DatosNuevoExamenCodigo {
  clase_id: number;
  tema: string;
  nota: number;
}

export interface DatosCasoPrueba {
  entrada: string;
  salida_esperada: string;
  es_oculto: boolean;
}

export interface DatosEjercicio {
  enunciado: string;
  plantilla_codigo?: string | null;
  nota: number;
  casos_prueba: DatosCasoPrueba[];
}

export interface ExamenCodigoRepositorio {
  buscarPorId(id: number): Promise<ExamenCodigo | null>;
  buscarConEjercicios(id: number): Promise<ExamenCodigoConEjercicios | null>;
  listarPorClase(clase_id: number): Promise<ExamenCodigo[]>;
  listarPorMateriaConClase(materia_id: number): Promise<ExamenCodigoConClase[]>;
  crear(datos: DatosNuevoExamenCodigo): Promise<ExamenCodigo>;
  actualizar(
    id: number,
    datos: { tema?: string; nota?: number; tiempo_limite_minutos?: number | null },
  ): Promise<ExamenCodigo>;
  cambiarEstado(id: number, estado: EstadoEvaluacion): Promise<ExamenCodigo>;
  marcarLanzada(id: number): Promise<ExamenCodigo>;
  marcarPublicada(id: number): Promise<ExamenCodigo>;
  listarFinalizadosPorMateria(materia_id: number): Promise<ExamenCodigo[]>;
  listarPublicadosPorMateria(materia_id: number): Promise<ExamenCodigo[]>;
  /** Barrido en segundo plano: todos los exámenes de código lanzados ahora mismo. */
  listarLanzados(): Promise<ExamenCodigo[]>;
  /** Deshacer un examen (p.ej. lanzado por error): borra en cascada
   * ejercicios/casos, intentos, respuestas, incidentes y notas. */
  eliminar(id: number): Promise<void>;

  contarEjercicios(examen_codigo_id: number): Promise<number>;
  buscarEjercicio(ejercicio_id: number): Promise<Ejercicio | null>;
  agregarEjercicio(examen_codigo_id: number, datos: DatosEjercicio): Promise<Ejercicio>;
  /** Reemplaza enunciado/plantilla/casos (borra los anteriores, crea los nuevos). */
  actualizarEjercicio(ejercicio_id: number, datos: DatosEjercicio): Promise<Ejercicio>;
  eliminarEjercicio(ejercicio_id: number): Promise<void>;
  reordenarEjercicios(examen_codigo_id: number, ordenIds: number[]): Promise<void>;
  casosDe(ejercicio_id: number): Promise<CasoPrueba[]>;
}
