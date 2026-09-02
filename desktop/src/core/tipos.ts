// Tipos mínimos del cliente de escritorio — calcado de
// backend/src/domain/entidades/intento-codigo.ts (shape "para rendir") y de
// web/src/core/tipos.ts (Contexto/Usuario/SesionActiva), con Date → string
// (igual criterio que el resto de la app: los DTOs viajan por JSON). Sin
// paquete compartido todavía entre backend/web/desktop (ver plan de E9).

export type Contexto = 'docente' | 'admin' | 'estudiante';

export interface Usuario {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
}

export interface SesionActiva {
  token: string;
  expira_en: string;
  contexto: Contexto;
  usuario: Usuario;
}

export type EstadoIntento = 'en_curso' | 'pausado' | 'finalizado' | 'desconectado' | 'cancelado';

export type TipoIncidenteCodigo = 'perdida_foco' | 'ventana_minimizada' | 'intento_cierre';

export interface ResultadoCaso {
  caso_id: number;
  paso: boolean;
  stdout: string;
  stderr: string;
  tiempo_ms: number;
}

export interface CasoParaRendir {
  id: number;
  entrada: string;
  salida_esperada: string;
}

export interface EjercicioParaRendir {
  id: number;
  enunciado: string;
  plantilla_codigo: string | null;
  orden: number;
  casos_visibles: CasoParaRendir[];
  total_casos: number;
  ultimo_codigo: string | null;
  ultimo_resultado: ResultadoCaso[] | null;
}

export interface IntentoCodigoParaRendir {
  intento_id: number;
  examen_codigo_id: number;
  tema: string;
  nota: number;
  estado: EstadoIntento;
  fecha_limite: string | null;
  ejercicios: EjercicioParaRendir[];
}

export interface ResultadoEnvio {
  casos_acertados: number;
  casos_totales: number;
  resultados_visibles: ResultadoCaso[];
}
