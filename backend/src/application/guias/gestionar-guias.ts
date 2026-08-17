// Guías de pre-clase (fusión con PaginaGuias, 05/08; guías nativas 16/08) —
// no está en el diagrama. El contenido (teoría + cuestionario) vive siempre
// en la página externa del propio docente — nunca en la base de Atenza.
// Desde el 16/08, crear una guía nueva ya nace "nativa": el docente carga
// nota + el manifest de preguntas (GuiaPregunta) junto con tema/url, sin
// intermediarios. Las guías creadas antes de este cambio quedan
// "externa_legacy" (nota null) y siguen funcionando exactamente igual que
// siempre — sin intentos, sin nota, solo el booleano de GuiaCompletada.

import { EstadoGuia, FilaGuiaDocente, FilaGuiaEstudiante, FilaMiGuia, Guia } from '../../domain/entidades/guia';
import { NoEncontradoError, ProhibidoError } from '../../domain/errores';
import { DatosGuiaPregunta, GuiaRepositorio } from '../../domain/repositorios/guia-repositorio';
import { GuiaIntentoRepositorio } from '../../domain/repositorios/guia-intento-repositorio';
import { GuiaCompletadaRepositorio } from '../../domain/repositorios/guia-completada-repositorio';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { UsuarioRepositorio } from '../../domain/repositorios/usuario-repositorio';
import { TiempoRealEmisor } from '../../domain/repositorios/tiempo-real';
import { TokenService } from '../../domain/servicios/token-service';

interface Auditoria {
  ip?: string;
  dispositivo?: string;
}

// Vigencia del link que se le da al estudiante para abrir la guía (solo
// guías "externa_legacy" — las nativas piden el link en el momento de
// "Tomar la guía", acotado a un intento puntual, ver rendir-guia.ts).
const ACCESO_GUIA_SEGUNDOS = 24 * 3600;

export async function exigirMateriaPropia(
  materias: MateriaRepositorio,
  materia_id: number,
  docente_id: number,
) {
  const materia = await materias.buscarPorId(materia_id);
  if (!materia) throw new NoEncontradoError('Materia');
  if (materia.docente_id !== docente_id) {
    throw new ProhibidoError('La materia no te pertenece');
  }
  return materia;
}

async function exigirClaseDeMateria(
  clases: ClaseRepositorio,
  materia_id: number,
  clase_id: number,
) {
  const clase = await clases.buscarPorId(clase_id);
  if (!clase || clase.materia_id !== materia_id) {
    throw new NoEncontradoError('Clase');
  }
  return clase;
}

export async function exigirGuiaDeMateria(
  guias: GuiaRepositorio,
  clases: ClaseRepositorio,
  materia_id: number,
  guia_id: number,
): Promise<Guia> {
  const guia = await guias.buscarPorId(guia_id);
  if (!guia) throw new NoEncontradoError('Guía');
  await exigirClaseDeMateria(clases, materia_id, guia.clase_id);
  return guia;
}

/** Arma el link de acceso "de siempre" (guías externa_legacy) — con el
 * token de alcance acotado por guía, no por intento. Reusado por VerGuias y
 * VerMisGuias en su rama legacy. */
async function armarAccesoLegacy(
  tokens: TokenService,
  completadas: GuiaCompletadaRepositorio,
  guia: Guia,
  estudiante_id: number,
): Promise<{ url_acceso: string; completado: boolean }> {
  const propio = await completadas.buscar(guia.id, estudiante_id);
  const token = tokens.firmar(
    { sub: estudiante_id, contexto: 'estudiante', guia_id: guia.id, jti: `guia-${guia.id}` },
    ACCESO_GUIA_SEGUNDOS,
  );
  const separador = guia.url.includes('?') ? '&' : '?';
  return {
    url_acceso: `${guia.url}${separador}atenza_token=${token}&guia=${guia.id}`,
    completado: propio !== null,
  };
}

/** Estado de una guía nativa para el estudiante: su intento oficial, si
 * tiene uno (todavía no lanzada = ninguno). */
async function armarEstadoNativa(
  guiaIntentos: GuiaIntentoRepositorio,
  guia: Guia,
  estudiante_id: number,
): Promise<{ url_acceso: string; completado: boolean; nota_obtenida: number | null }> {
  const oficial = await guiaIntentos.buscarOficialPorEstudianteYGuia(guia.id, estudiante_id);
  return {
    url_acceso: '', // el link real se pide al "Tomar la guía" (rendir-guia.ts)
    completado: oficial?.estado === 'finalizado' || oficial?.estado === 'cancelado',
    nota_obtenida: oficial?.nota_obtenida ?? null,
  };
}

// ── Crear / editar / eliminar (docente) ──────────────────────────

export class CrearGuia {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      clase_id: number;
      docente_id: number;
      tema: string;
      url: string;
      orden: number;
      nota: number;
      tiempo_limite_minutos?: number | null;
      preguntas: DatosGuiaPregunta[];
      integracion_detectada?: boolean;
    },
  ): Promise<Guia> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    await exigirClaseDeMateria(this.clases, entrada.materia_id, entrada.clase_id);

    const guia = await this.guias.crear({
      clase_id: entrada.clase_id,
      tema: entrada.tema,
      url: entrada.url,
      orden: entrada.orden,
      nota: entrada.nota,
      tiempo_limite_minutos: entrada.tiempo_limite_minutos,
      preguntas: entrada.preguntas,
      integracion_detectada: entrada.integracion_detectada,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'guia_creada',
      entidad: 'guia',
      entidad_id: String(guia.id),
      valor_nuevo: {
        clase_id: guia.clase_id,
        tema: guia.tema,
        url: guia.url,
        nota: guia.nota,
        preguntas: entrada.preguntas.length,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return guia;
  }
}

export class ActualizarGuia {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      guia_id: number;
      docente_id: number;
      tema?: string;
      url?: string;
      orden?: number;
      nota?: number;
      tiempo_limite_minutos?: number | null;
      preguntas?: DatosGuiaPregunta[];
      integracion_detectada?: boolean;
    },
  ): Promise<Guia> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    const anterior = await exigirGuiaDeMateria(
      this.guias,
      this.clases,
      entrada.materia_id,
      entrada.guia_id,
    );
    if (anterior.estado === 'lanzada') {
      throw new ProhibidoError('No se puede editar una guía ya lanzada');
    }

    const guia = await this.guias.actualizar(entrada.guia_id, {
      tema: entrada.tema,
      url: entrada.url,
      orden: entrada.orden,
      nota: entrada.nota,
      tiempo_limite_minutos: entrada.tiempo_limite_minutos,
      preguntas: entrada.preguntas,
      integracion_detectada: entrada.integracion_detectada,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'guia_actualizada',
      entidad: 'guia',
      entidad_id: String(guia.id),
      valor_anterior: { tema: anterior.tema, url: anterior.url, orden: anterior.orden },
      valor_nuevo: { tema: guia.tema, url: guia.url, orden: guia.orden },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return guia;
  }
}

export class EliminarGuia {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(
    entrada: Auditoria & { materia_id: number; guia_id: number; docente_id: number },
  ): Promise<void> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    const guia = await exigirGuiaDeMateria(
      this.guias,
      this.clases,
      entrada.materia_id,
      entrada.guia_id,
    );
    if (guia.estado === 'lanzada') {
      throw new ProhibidoError('No se puede eliminar una guía ya lanzada');
    }

    await this.guias.eliminar(entrada.guia_id);

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'guia_eliminada',
      entidad: 'guia',
      entidad_id: String(guia.id),
      valor_anterior: { clase_id: guia.clase_id, tema: guia.tema, url: guia.url },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}

/** Detalle de UNA guía puntual (docente) — usado por las pantallas de
 * Resultados/Revisión/Lanzamiento, que no tienen el clase_id a mano. */
export class VerGuiaDetalle {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    guia_id: number;
    docente_id: number;
  }): Promise<Guia> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    return exigirGuiaDeMateria(this.guias, this.clases, entrada.materia_id, entrada.guia_id);
  }
}

// ── Ver guías de una clase — docente dueño o estudiante inscrito ─
// Mismo branching 404 que VerClases: no revela materias ajenas.

export class VerGuias {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly completadas: GuiaCompletadaRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
    private readonly tokens: TokenService,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    clase_id: number;
    usuario_id: number;
  }): Promise<FilaGuiaDocente[] | FilaGuiaEstudiante[]> {
    const materia = await this.materias.buscarPorId(entrada.materia_id);
    if (!materia) throw new NoEncontradoError('Materia');

    const esDueno = materia.docente_id === entrada.usuario_id;
    if (!esDueno) {
      const inscripcion = await this.inscripciones.buscarPorEstudianteYMateria(
        entrada.usuario_id,
        entrada.materia_id,
      );
      if (!inscripcion || inscripcion.retirado) {
        throw new NoEncontradoError('Materia');
      }
    }

    await exigirClaseDeMateria(this.clases, entrada.materia_id, entrada.clase_id);
    const listado = await this.guias.listarPorClase(entrada.clase_id);
    if (listado.length === 0) return [];

    if (esDueno) {
      return this.verComoDocente(entrada.materia_id, listado);
    }
    return this.verComoEstudiante(entrada.usuario_id, listado);
  }

  private async verComoDocente(materia_id: number, listado: Guia[]): Promise<FilaGuiaDocente[]> {
    const nomina = await this.inscripciones.listarPorMateria(materia_id);
    const mapaEstudiante = new Map(nomina.map((i) => [i.estudiante_id, i.estudiante]));

    const registros = await this.completadas.listarPorGuias(listado.map((g) => g.id));
    const porGuia = new Map<number, typeof registros>();
    for (const r of registros) {
      const lista = porGuia.get(r.guia_id) ?? [];
      lista.push(r);
      porGuia.set(r.guia_id, lista);
    }

    return Promise.all(
      listado.map(async (guia) => ({
        ...guia,
        // Dato de siempre: quién de la nómina abrió/completó la guía.
        completados: (porGuia.get(guia.id) ?? []).flatMap((r) => {
          const estudiante = mapaEstudiante.get(r.estudiante_id);
          if (!estudiante) return [];
          return [
            {
              estudiante_id: r.estudiante_id,
              nombres: estudiante.nombres,
              apellidos: estudiante.apellidos,
              completado_en: r.completado_en,
            },
          ];
        }),
        preguntas: await this.guias.listarPreguntas(guia.id),
      })),
    );
  }

  private async verComoEstudiante(
    estudiante_id: number,
    listado: Guia[],
  ): Promise<FilaGuiaEstudiante[]> {
    return Promise.all(
      listado.map(async (guia): Promise<FilaGuiaEstudiante> => {
        const acceso =
          guia.estado === 'externa_legacy'
            ? { ...(await armarAccesoLegacy(this.tokens, this.completadas, guia, estudiante_id)), nota_obtenida: null }
            : await armarEstadoNativa(this.guiaIntentos, guia, estudiante_id);
        return {
          id: guia.id,
          tema: guia.tema,
          orden: guia.orden,
          estado: guia.estado,
          nota: guia.nota,
          ...acceso,
        };
      }),
    );
  }
}

// ── "Mis guías" — todas las de la materia, no una clase puntual ─
// Mismo espíritu que VerMisNotas: tab plano para el estudiante en vez de
// tener que entrar clase por clase (que sí necesita el docente).

export class VerMisGuias {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly completadas: GuiaCompletadaRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
    private readonly tokens: TokenService,
  ) {}

  async ejecutar(entrada: { materia_id: number; estudiante_id: number }): Promise<FilaMiGuia[]> {
    const materia = await this.materias.buscarPorId(entrada.materia_id);
    if (!materia) throw new NoEncontradoError('Materia');

    const inscripcion = await this.inscripciones.buscarPorEstudianteYMateria(
      entrada.estudiante_id,
      entrada.materia_id,
    );
    if (!inscripcion || inscripcion.retirado) {
      throw new NoEncontradoError('Materia'); // mismo 404 que VerMisNotas/VerMiAsistencia
    }

    const clases = await this.clases.listarPorMateria(entrada.materia_id);
    const filas: FilaMiGuia[] = [];
    for (const clase of clases) {
      const guiasDeClase = await this.guias.listarPorClase(clase.id);
      for (const guia of guiasDeClase) {
        const acceso =
          guia.estado === 'externa_legacy'
            ? {
                ...(await armarAccesoLegacy(this.tokens, this.completadas, guia, entrada.estudiante_id)),
                nota_obtenida: null,
              }
            : await armarEstadoNativa(this.guiaIntentos, guia, entrada.estudiante_id);
        filas.push({
          id: guia.id,
          tema: guia.tema,
          orden: guia.orden,
          estado: guia.estado,
          nota: guia.nota,
          clase_id: clase.id,
          clase_tema: clase.tema,
          clase_fecha: clase.fecha,
          ...acceso,
        });
      }
    }
    return filas;
  }
}

// ── Completar (llamado desde la propia guía externa, sin sesión) ─
// Sigue existiendo tal cual para guías "externa_legacy". En guías nativas
// el señal real es GuiaIntento.estado (rendir-guia.ts, /finalizar) — este
// endpoint no se usa ahí, pero no hace daño si una página vieja lo llama.

export class RegistrarCompletado {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly completadas: GuiaCompletadaRepositorio,
    private readonly usuarios: UsuarioRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: { guia_id: number; estudiante_id: number }): Promise<void> {
    const guia = await this.guias.buscarPorId(entrada.guia_id);
    if (!guia) throw new NoEncontradoError('Guía');

    // Idempotente a propósito: el estudiante puede reabrir/repasar la guía
    // después de completarla sin que se duplique ni falle. El chequeo
    // previo (13/08) es para no reemitir 'guia-completada' en cada repaso
    // — el docente ya lo vio la primera vez, reemitir duplicaría su nombre
    // en la lista del lado del cliente.
    const yaEstaba = await this.completadas.buscar(entrada.guia_id, entrada.estudiante_id);

    await this.completadas.marcarCompletada({
      guia_id: entrada.guia_id,
      estudiante_id: entrada.estudiante_id,
    });

    if (yaEstaba) return;

    const estudiante = await this.usuarios.buscarPorId(entrada.estudiante_id);
    if (!estudiante) return;

    this.tiempoReal.emitirAClase(guia.clase_id, 'guia-completada', {
      guia_id: guia.id,
      estudiante_id: estudiante.id,
      nombres: estudiante.nombres,
      apellidos: estudiante.apellidos,
      completado_en: new Date(),
    });
  }
}
