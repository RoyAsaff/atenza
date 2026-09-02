import { ResultadoCaso } from '../entidades/intento-codigo';

/** Puerto de dominio para correr código de estudiante contra casos de
 * prueba de forma aislada (E9). La implementación real (Docker-outside-
 * of-Docker vía dockerode) vive en infrastructure/ejecucion — este
 * archivo no sabe nada de Docker, solo el contrato que usan los casos de
 * uso (application/intentos-codigo/rendir-examen-codigo.ts). */

export interface CasoParaEjecutar {
  id: number;
  entrada: string;
  salida_esperada: string;
}

export interface EjecutorCodigo {
  /** Corre `codigo` una vez por cada caso (mismo proceso/contenedor,
   * distinto stdin por caso) y compara stdout contra salida_esperada
   * (trim). Nunca lanza por código de estudiante que falle/cuelgue/exceda
   * límites — eso se refleja en el resultado de cada caso, no como
   * excepción; solo lanza ante un error de infraestructura (Docker caído). */
  ejecutar(codigo: string, casos: CasoParaEjecutar[]): Promise<ResultadoCaso[]>;
}
