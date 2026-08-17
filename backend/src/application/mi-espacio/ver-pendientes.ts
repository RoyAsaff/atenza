// Inicio (17/08, handoff 1b) · panel "Requiere tu atención": hasta 4 ítems
// que cruzan TODAS las materias del docente. Solo 2 de los 3 tipos que
// pide el handoff (decisión con Roy): "asistencia" (2+ faltas
// consecutivas) queda afuera de esta pasada — no hay método de repo ni
// regla definida, y el propio handoff permite que el panel funcione con
// menos de los 3 tipos, o que no se renderice si no hay ítems.

import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';
import { GuiaIntentoRepositorio } from '../../domain/repositorios/guia-intento-repositorio';

export type TipoPendiente = 'evaluacion_abierta' | 'por_revisar';

export interface Pendiente {
  tipo: TipoPendiente;
  titulo: string;
  detalle: string;
  url: string;
}

const MAX_PENDIENTES = 4;

export class VerPendientesDocente {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
  ) {}

  async ejecutar(entrada: { docente_id: number }): Promise<Pendiente[]> {
    const evaluacionesDocente = await this.evaluaciones.listarPorDocente(entrada.docente_id);

    const abiertas: Pendiente[] = evaluacionesDocente
      .filter((e) => e.estado === 'lanzada')
      .map((e) => ({
        tipo: 'evaluacion_abierta',
        titulo: e.tema,
        detalle: `${e.materia.nombre_materia} · lanzada el ${formatearFecha(e.fecha_lanzamiento)}`,
        url: `/materias/${e.materia.id}/evaluaciones/${e.id}/monitoreo`,
      }));

    const sinPublicar: Pendiente[] = evaluacionesDocente
      .filter((e) => e.estado === 'finalizada' && !e.publicada)
      .map((e) => ({
        tipo: 'por_revisar',
        titulo: e.tema,
        detalle: `Finalizada, sin publicar · ${e.materia.nombre_materia}`,
        url: `/materias/${e.materia.id}/evaluaciones/${e.id}/resultados`,
      }));

    const guiasPorRevisar = await this.guiaIntentos.listarRevisionPendientePorDocente(
      entrada.docente_id,
    );
    const revisionGuias: Pendiente[] = guiasPorRevisar.map((g) => ({
      tipo: 'por_revisar',
      titulo: g.guia_tema,
      detalle: `${g.pendientes} respuesta${g.pendientes === 1 ? '' : 's'} por revisar · ${g.materia_nombre}`,
      url: `/materias/${g.materia_id}/guias/${g.guia_id}/revision`,
    }));

    // Orden: evaluación abierta primero, después "por revisar" (guías
    // antes que evaluaciones sin publicar — respuestas de estudiantes
    // esperando desde antes, criterio razonable no especificado en el
    // handoff). Sin categoría "asistencia" en esta pasada.
    return [...abiertas, ...revisionGuias, ...sinPublicar].slice(0, MAX_PENDIENTES);
  }
}

function formatearFecha(fecha: Date | null): string {
  if (!fecha) return '';
  return fecha.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' });
}
