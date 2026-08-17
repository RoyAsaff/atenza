// "Inicio" (13/08, reemplaza el resumen anterior de ver-resumen.ts): ya no
// interesa un resumen por materia (próxima clase / última evaluación /
// última guía) — el pedido de Roy es ver de un vistazo las clases de HOY
// nada más, con acceso directo a pasar lista / evaluaciones / guías de esa
// clase puntual. Esas acciones ahora son botones que llevan a la pantalla
// real, así que ya no hace falta traer evaluaciones ni guías acá.
//
// Rediseño de Inicio (17/08, handoff 1b): se agregan los campos que
// necesita el nuevo layout (bloque "en curso", "Resto del día", "Ya
// pasó") — `rol` para poder fusionar dictadas+inscritas en una sola lista,
// `total_estudiantes` para el subtítulo, `asistencia_tomada`/
// `asistencia_resumen`/`tiene_evaluacion_abierta` para las filas de "Ya
// pasó" y el badge de evaluación abierta. `duracion_minutos` es un valor
// FIJO (decisión con Roy: `Clase` no tiene duración real en el schema, no
// se migra de nuevo solo para esto) — no viene de la base.

import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { AsistenciaRepositorio } from '../../domain/repositorios/asistencia-repositorio';
import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';

// Valor fijo: no hay campo de duración real en Clase (ver nota arriba).
export const DURACION_CLASE_MINUTOS = 90;

export interface ClaseDeHoy {
  clase_id: number;
  materia_id: number;
  nombre_materia: string;
  hora: string;
  tema: string;
  duracion_minutos: number;
  rol: 'dictada' | 'inscrita';
  total_estudiantes: number;
  asistencia_tomada: boolean;
  asistencia_resumen: { presentes: number; total: number } | null;
  tiene_evaluacion_abierta: boolean;
}

// Bolivia no tiene horario de verano — offset fijo UTC-4. `fecha`/`hora` de
// una clase se guardan literales (hora Bolivia tal cual la tipeó el
// docente, sin conversión — ver comentario que tenía ver-resumen.ts), así
// que "hoy" tiene que vivir en ese mismo marco literal en vez de la fecha
// UTC real del server (mismo bug que ya se corrigió ahí: sin este ajuste,
// clases de la tarde/noche en Bolivia caían en el "mañana" UTC).
const OFFSET_BOLIVIA_MINUTOS = 4 * 60;

function hoyBolivia(): Date {
  const ahora = new Date(Date.now() - OFFSET_BOLIVIA_MINUTOS * 60 * 1000);
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
}

const PRESENTES: readonly string[] = ['puntual', 'atrasado'];

export class VerClasesDeHoy {
  constructor(
    private readonly materias: MateriaRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly asistencias: AsistenciaRepositorio,
    private readonly evaluaciones: EvaluacionRepositorio,
  ) {}

  async ejecutar(entrada: { usuario_id: number }): Promise<{
    dictadas: ClaseDeHoy[];
    inscritas: ClaseDeHoy[];
  }> {
    const hoy = hoyBolivia();
    const [materiasDictadas, inscripcionesEstudiante] = await Promise.all([
      this.materias.listarPorDocente(entrada.usuario_id),
      this.inscripciones.listarPorEstudiante(entrada.usuario_id),
    ]);

    const [dictadas, inscritas] = await Promise.all([
      this.clasesDeHoy(materiasDictadas, hoy, 'dictada'),
      this.clasesDeHoy(
        inscripcionesEstudiante.map((i) => i.materia),
        hoy,
        'inscrita',
      ),
    ]);

    return { dictadas, inscritas };
  }

  private async clasesDeHoy(
    materias: { id: number; nombre_materia: string }[],
    hoy: Date,
    rol: 'dictada' | 'inscrita',
  ): Promise<ClaseDeHoy[]> {
    const porMateria = await Promise.all(
      materias.map(async (materia) => {
        const [clases, totalEstudiantes] = await Promise.all([
          this.clases.listarPorMateria(materia.id),
          this.inscripciones.contarActivosPorMateria(materia.id),
        ]);
        const deHoy = clases.filter((c) => c.fecha.getTime() === hoy.getTime());

        return Promise.all(
          deHoy.map(async (c): Promise<ClaseDeHoy> => {
            const [asistenciasClase, evaluacionesClase] = await Promise.all([
              this.asistencias.listarPorClase(c.id),
              this.evaluaciones.listarPorClase(c.id),
            ]);

            const asistencia_tomada = asistenciasClase.length > 0;
            const asistencia_resumen = asistencia_tomada
              ? {
                  presentes: asistenciasClase.filter((a) => PRESENTES.includes(a.marcaje)).length,
                  total: asistenciasClase.length,
                }
              : null;

            return {
              clase_id: c.id,
              materia_id: materia.id,
              nombre_materia: materia.nombre_materia,
              hora: c.hora,
              tema: c.tema,
              duracion_minutos: DURACION_CLASE_MINUTOS,
              rol,
              total_estudiantes: totalEstudiantes,
              asistencia_tomada,
              asistencia_resumen,
              tiene_evaluacion_abierta: evaluacionesClase.some((e) => e.estado === 'lanzada'),
            };
          }),
        );
      }),
    );
    // Aplanado y ordenado por hora — lista única cronológica, no agrupada
    // por materia (puede haber más de una materia con clase el mismo día).
    return porMateria.flat().sort((a, b) => a.hora.localeCompare(b.hora));
  }
}
