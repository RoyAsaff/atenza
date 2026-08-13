// Resumen de "Inicio" en la web (08/08): por cada materia dictada e
// inscrita, la próxima clase, la última evaluación y la última guía — todo
// resuelto acá, en el servidor, con una sola llamada del navegador (GET
// /api/mi-espacio/resumen). La alternativa de pedirlo desde el cliente
// (una llamada por materia, por cada uno de los 3 datos) no escala si la
// cuenta tiene varias materias.

import { EstadoEvaluacion } from '../../domain/entidades/evaluacion';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';
import { GuiaRepositorio } from '../../domain/repositorios/guia-repositorio';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { VerMisGuias } from '../guias/gestionar-guias';
import { VerMisNotas } from '../evaluaciones/ver-resultados';

interface ProximaClase {
  fecha: Date;
  hora: string;
  tema: string;
}

interface ResumenMateriaDocente {
  materia_id: number;
  nombre_materia: string;
  proxima_clase: ProximaClase | null;
  ultima_evaluacion: { tema: string; estado: EstadoEvaluacion; creado_en: Date } | null;
  ultima_guia: { tema: string; clase_tema: string } | null;
}

interface ResumenMateriaEstudiante {
  materia_id: number;
  nombre_materia: string;
  proxima_clase: ProximaClase | null;
  ultima_evaluacion: {
    tema: string;
    nota_obtenida: number;
    nota_total: number;
    fecha_publicacion: Date;
  } | null;
  ultima_guia: { tema: string; url_acceso: string; completado: boolean } | null;
}

/** `fecha` es solo el día (medianoche UTC, ver esquemaFecha en
 * materias-rutas.ts) y `hora` es un string "HH:MM" sin huso propio — se
 * combinan tomando ambos como literales, mismo criterio con el que ya se
 * guardan (sin conversión de zona horaria de por medio). */
function esFutura(clase: { fecha: Date; hora: string }, ahora: Date): boolean {
  const [horas, minutos] = clase.hora.split(':').map(Number);
  const limite = new Date(clase.fecha);
  limite.setUTCHours(horas, minutos, 0, 0);
  return limite >= ahora;
}

export class VerResumenMiEspacio {
  constructor(
    private readonly materias: MateriaRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly guias: GuiaRepositorio,
    private readonly verMisNotas: VerMisNotas,
    private readonly verMisGuias: VerMisGuias,
  ) {}

  async ejecutar(entrada: { usuario_id: number }): Promise<{
    dictadas: ResumenMateriaDocente[];
    inscritas: ResumenMateriaEstudiante[];
  }> {
    const [materiasDictadas, inscripcionesEstudiante] = await Promise.all([
      this.materias.listarPorDocente(entrada.usuario_id),
      this.inscripciones.listarPorEstudiante(entrada.usuario_id),
    ]);

    const dictadas = await Promise.all(
      materiasDictadas.map((materia) => this.resumenDictada(materia)),
    );
    const inscritas = await Promise.all(
      inscripcionesEstudiante.map((inscripcion) =>
        this.resumenInscrita(inscripcion.materia, entrada.usuario_id),
      ),
    );

    return { dictadas, inscritas };
  }

  private async proximaClase(materia_id: number): Promise<ProximaClase | null> {
    const clases = await this.clases.listarPorMateria(materia_id); // ya viene ordenado por fecha, hora
    const ahora = new Date();
    const futura = clases.find((c) => esFutura(c, ahora));
    return futura ? { fecha: futura.fecha, hora: futura.hora, tema: futura.tema } : null;
  }

  private async resumenDictada(materia: {
    id: number;
    nombre_materia: string;
  }): Promise<ResumenMateriaDocente> {
    const [proxima_clase, evaluaciones, ultima_guia] = await Promise.all([
      this.proximaClase(materia.id),
      this.evaluaciones.listarPorMateriaConClase(materia.id),
      this.ultimaGuiaDictada(materia.id),
    ]);

    const ultima = evaluaciones.reduce<(typeof evaluaciones)[number] | null>(
      (acc, ev) => (!acc || ev.creado_en > acc.creado_en ? ev : acc),
      null,
    );

    return {
      materia_id: materia.id,
      nombre_materia: materia.nombre_materia,
      proxima_clase,
      ultima_evaluacion: ultima
        ? { tema: ultima.tema, estado: ultima.estado, creado_en: ultima.creado_en }
        : null,
      ultima_guia,
    };
  }

  // Sin listarPorMateria en GuiaRepositorio (solo por clase, ver
  // guia-repositorio.ts) — se recorre clase por clase, igual que VerMisGuias
  // del lado estudiante. La guía no tiene `creado_en` propio; el id
  // autoincremental ya sirve de proxy de "creada más recientemente".
  private async ultimaGuiaDictada(
    materia_id: number,
  ): Promise<{ tema: string; clase_tema: string } | null> {
    const clases = await this.clases.listarPorMateria(materia_id);
    let ultima: { tema: string; clase_tema: string; id: number } | null = null;
    for (const clase of clases) {
      const guiasDeClase = await this.guias.listarPorClase(clase.id);
      for (const guia of guiasDeClase) {
        if (!ultima || guia.id > ultima.id) {
          ultima = { tema: guia.tema, clase_tema: clase.tema, id: guia.id };
        }
      }
    }
    return ultima ? { tema: ultima.tema, clase_tema: ultima.clase_tema } : null;
  }

  private async resumenInscrita(
    materia: { id: number; nombre_materia: string },
    estudiante_id: number,
  ): Promise<ResumenMateriaEstudiante> {
    const [proxima_clase, notas, guias] = await Promise.all([
      this.proximaClase(materia.id),
      this.verMisNotas.ejecutar({ materia_id: materia.id, estudiante_id }),
      this.verMisGuias.ejecutar({ materia_id: materia.id, estudiante_id }),
    ]);

    const ultimaNota = notas.reduce<(typeof notas)[number] | null>(
      (acc, n) => (!acc || n.fecha_publicacion > acc.fecha_publicacion ? n : acc),
      null,
    );
    const ultimaGuia = guias.reduce<(typeof guias)[number] | null>(
      (acc, g) => (!acc || g.id > acc.id ? g : acc),
      null,
    );

    return {
      materia_id: materia.id,
      nombre_materia: materia.nombre_materia,
      proxima_clase,
      ultima_evaluacion: ultimaNota
        ? {
            tema: ultimaNota.tema,
            nota_obtenida: ultimaNota.nota_obtenida,
            nota_total: ultimaNota.nota_total,
            fecha_publicacion: ultimaNota.fecha_publicacion,
          }
        : null,
      ultima_guia: ultimaGuia
        ? { tema: ultimaGuia.tema, url_acceso: ultimaGuia.url_acceso, completado: ultimaGuia.completado }
        : null,
    };
  }
}
