// Entidad Materia según el diagrama de clases (E2)
// codigo_activo (E3, HU-11): acordado con Roy el 12/07 — permite cerrar
// inscripciones sin perder el código. Pendiente reflejar en diagrama.
// SaaS por cuenta (17/07): ya no tiene `activado` propio — la materia vive
// mientras la cuenta del docente esté vigente (ver ObtenerEstadoCuenta).

export interface Materia {
  id: number;
  nombre_materia: string;
  sigla: string | null;
  codigo: string;
  codigo_activo: boolean;
  carrera: string;
  semestre: string;
  universidad: string;
  docente_id: number;
}
