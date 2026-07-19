import { Plan } from '../entidades/plan';

export interface PlanRepositorio {
  listar(soloActivos?: boolean): Promise<Plan[]>;
  buscarPorId(id: number): Promise<Plan | null>;
  /** El plan de menor `orden` — se asigna por defecto al registrarse (prueba gratis). */
  buscarPorDefecto(): Promise<Plan | null>;
  actualizar(
    id: number,
    datos: { nombre?: string; limite_estudiantes?: number | null; monto_mensual?: number },
  ): Promise<Plan>;
}
