// "Inicio" (13/08, reemplaza el resumen anterior de ver-resumen.ts): ya no
// interesa un resumen por materia (próxima clase / última evaluación /
// última guía) — el pedido de Roy es ver de un vistazo las clases de HOY
// nada más, con acceso directo a pasar lista / evaluaciones / guías de esa
// clase puntual. Esas acciones ahora son botones que llevan a la pantalla
// real, así que ya no hace falta traer evaluaciones ni guías acá.

import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';

export interface ClaseDeHoy {
  clase_id: number;
  materia_id: number;
  nombre_materia: string;
  hora: string;
  tema: string;
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

export class VerClasesDeHoy {
  constructor(
    private readonly materias: MateriaRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly clases: ClaseRepositorio,
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
      this.clasesDeHoy(materiasDictadas, hoy),
      this.clasesDeHoy(
        inscripcionesEstudiante.map((i) => i.materia),
        hoy,
      ),
    ]);

    return { dictadas, inscritas };
  }

  private async clasesDeHoy(
    materias: { id: number; nombre_materia: string }[],
    hoy: Date,
  ): Promise<ClaseDeHoy[]> {
    const porMateria = await Promise.all(
      materias.map(async (materia) => {
        const clases = await this.clases.listarPorMateria(materia.id);
        return clases
          .filter((c) => c.fecha.getTime() === hoy.getTime())
          .map((c) => ({
            clase_id: c.id,
            materia_id: materia.id,
            nombre_materia: materia.nombre_materia,
            hora: c.hora,
            tema: c.tema,
          }));
      }),
    );
    // Aplanado y ordenado por hora — lista única cronológica, no agrupada
    // por materia (puede haber más de una materia con clase el mismo día).
    return porMateria.flat().sort((a, b) => a.hora.localeCompare(b.hora));
  }
}
