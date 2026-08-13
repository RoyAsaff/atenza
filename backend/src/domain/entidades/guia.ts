// Entidad Guía de pre-clase (fusión con PaginaGuias, 05/08) — no está en
// el diagrama. Vive sobre una Clase, igual que Asistencia/Evaluación, pero
// sin ciclo borrador/lanzada: es visible para inscritos apenas se crea.
// `url` apunta a una página autocontenida publicada en PaginaGuias
// (GitHub Pages) — ATENZA solo referencia el link, no aloja el contenido.

export interface Guia {
  id: number;
  clase_id: number;
  tema: string;
  url: string;
  orden: number;
}

/** Fila para el docente: la guía + quién de la nómina ya la completó. */
export interface FilaGuiaDocente extends Guia {
  completados: FilaEstudianteCompletoGuia[];
}

export interface FilaEstudianteCompletoGuia {
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  completado_en: Date;
}

/** Fila para el estudiante: la guía + su propio link de acceso (con el
 * token de alcance acotado ya incluido) y si ya la completó. */
export interface FilaGuiaEstudiante {
  id: number;
  tema: string;
  orden: number;
  url_acceso: string;
  completado: boolean;
}

/** Fila de "Mis guías" (materia completa, no una clase puntual) — para el
 * tab "Guías" de mobile/web, mismo espíritu que "Mis notas" (VerMisNotas). */
export interface FilaMiGuia extends FilaGuiaEstudiante {
  clase_id: number;
  clase_tema: string;
  clase_fecha: Date;
}
