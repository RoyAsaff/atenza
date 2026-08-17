import { Plan } from '../entidades/plan';

export interface PlanRepositorio {
  listar(soloActivos?: boolean): Promise<Plan[]>;
  buscarPorId(id: number): Promise<Plan | null>;
  /** El plan de menor `orden` — se asigna por defecto al registrarse (prueba gratis). */
  buscarPorDefecto(): Promise<Plan | null>;
  actualizar(
    id: number,
    datos: {
      nombre?: string;
      limite_estudiantes?: number | null;
      limite_materias?: number | null;
      permite_import_word?: boolean;
      permite_guias?: boolean;
      monto_mensual?: number;
      // tipo NO es editable desde el admin: los 3 planes tienen roles fijos por seed.
    },
  ): Promise<Plan>;
}
