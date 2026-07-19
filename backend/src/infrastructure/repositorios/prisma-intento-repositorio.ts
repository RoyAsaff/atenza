import { Intento as FilaIntentoPrisma, Prisma, PrismaClient } from '@prisma/client';
import {
  FilaMonitoreo,
  Incidente,
  Intento,
  Respuesta,
  TipoIncidente,
} from '../../domain/entidades/intento';
import { FilaResultado, Nota } from '../../domain/entidades/nota';
import {
  DatosNuevaNota,
  DatosNuevoIntento,
  IntentoRepositorio,
} from '../../domain/repositorios/intento-repositorio';

function aIntento(fila: FilaIntentoPrisma): Intento {
  return {
    id: fila.id,
    evaluacion_id: fila.evaluacion_id,
    estudiante_id: fila.estudiante_id,
    estado: fila.estado,
    orden_preguntas: fila.orden_preguntas as number[],
    orden_opciones: fila.orden_opciones as Record<string, number[]>,
    fecha_inicio: fila.fecha_inicio,
    fecha_limite: fila.fecha_limite,
    fecha_fin: fila.fecha_fin,
  };
}

const ESTADOS_ACTIVOS = ['en_curso', 'pausado', 'desconectado'] as const;

export class PrismaIntentoRepositorio implements IntentoRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorId(id: number): Promise<Intento | null> {
    const fila = await this.prisma.intento.findUnique({ where: { id } });
    return fila ? aIntento(fila) : null;
  }

  async buscarActivoPorEstudiante(estudiante_id: number): Promise<Intento | null> {
    const fila = await this.prisma.intento.findFirst({
      where: { estudiante_id, estado: { in: [...ESTADOS_ACTIVOS] } },
      orderBy: { fecha_inicio: 'desc' },
    });
    return fila ? aIntento(fila) : null;
  }

  async buscarPorEvaluacionYEstudiante(
    evaluacion_id: number,
    estudiante_id: number,
  ): Promise<Intento | null> {
    const fila = await this.prisma.intento.findUnique({
      where: { evaluacion_id_estudiante_id: { evaluacion_id, estudiante_id } },
    });
    return fila ? aIntento(fila) : null;
  }

  async listarPorEvaluacion(evaluacion_id: number): Promise<Intento[]> {
    const filas = await this.prisma.intento.findMany({ where: { evaluacion_id } });
    return filas.map(aIntento);
  }

  async listarPorEvaluacionConDetalle(evaluacion_id: number): Promise<FilaMonitoreo[]> {
    const [filas, evaluacion] = await Promise.all([
      this.prisma.intento.findMany({
        where: { evaluacion_id },
        include: {
          estudiante: { select: { nombres: true, apellidos: true } },
          _count: { select: { respuestas: true, incidentes: true } },
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.evaluacion.findUnique({
        where: { id: evaluacion_id },
        include: { _count: { select: { preguntas: true } } },
      }),
    ]);
    const totalPreguntas = evaluacion?._count.preguntas ?? 0;

    return filas.map((f) => ({
      intento_id: f.id,
      estudiante_id: f.estudiante_id,
      nombres: f.estudiante.nombres,
      apellidos: f.estudiante.apellidos,
      estado: f.estado,
      respondidas: f._count.respuestas,
      total_preguntas: totalPreguntas,
      incidentes: f._count.incidentes,
    }));
  }

  async crear(datos: DatosNuevoIntento): Promise<Intento> {
    const fila = await this.prisma.intento.create({
      data: {
        evaluacion_id: datos.evaluacion_id,
        estudiante_id: datos.estudiante_id,
        orden_preguntas: datos.orden_preguntas as Prisma.InputJsonValue,
        orden_opciones: datos.orden_opciones as Prisma.InputJsonValue,
        fecha_limite: datos.fecha_limite,
      },
    });
    return aIntento(fila);
  }

  async cambiarEstado(
    id: number,
    estado: Intento['estado'],
    datos?: { fecha_fin?: Date },
  ): Promise<Intento> {
    const fila = await this.prisma.intento.update({
      where: { id },
      data: { estado, fecha_fin: datos?.fecha_fin },
    });
    return aIntento(fila);
  }

  async marcarConexion(estudiante_id: number, conectado: boolean): Promise<Intento[]> {
    return this.prisma.$transaction(async (tx) => {
      const activos = await tx.intento.findMany({
        where: {
          estudiante_id,
          estado: conectado ? 'desconectado' : 'en_curso',
        },
      });
      const actualizados: Intento[] = [];
      for (const intento of activos) {
        const fila = await tx.intento.update({
          where: { id: intento.id },
          data: { estado: conectado ? 'en_curso' : 'desconectado' },
        });
        actualizados.push(aIntento(fila));
      }
      return actualizados;
    });
  }

  async respuestasDe(intento_id: number): Promise<Respuesta[]> {
    return this.prisma.respuesta.findMany({ where: { intento_id } });
  }

  async guardarRespuesta(
    intento_id: number,
    pregunta_id: number,
    opcion_id: number,
  ): Promise<Respuesta> {
    return this.prisma.respuesta.upsert({
      where: { intento_id_pregunta_id: { intento_id, pregunta_id } },
      create: { intento_id, pregunta_id, opcion_id },
      update: { opcion_id, respondida_en: new Date() },
    });
  }

  async registrarIncidente(
    intento_id: number,
    tipo: TipoIncidente,
    detalle?: string,
  ): Promise<Incidente> {
    return this.prisma.incidente.create({
      data: { intento_id, tipo, detalle: detalle ?? null },
    });
  }

  async finalizarVencidos(evaluacion_id: number): Promise<Intento[]> {
    const vencidos = await this.prisma.intento.findMany({
      where: {
        evaluacion_id,
        estado: { in: ['en_curso', 'desconectado'] },
        fecha_limite: { lte: new Date() },
      },
    });
    const actualizados: Intento[] = [];
    for (const intento of vencidos) {
      const fila = await this.prisma.intento.update({
        where: { id: intento.id },
        data: { estado: 'finalizado', fecha_fin: new Date() },
      });
      actualizados.push(aIntento(fila));
    }
    return actualizados;
  }

  async contarAciertos(intento_id: number): Promise<number> {
    return this.prisma.respuesta.count({
      where: { intento_id, opcion: { es_correcta: true } },
    });
  }

  async guardarNota(datos: DatosNuevaNota): Promise<Nota> {
    const ultima = await this.prisma.nota.findFirst({
      where: { intento_id: datos.intento_id },
      orderBy: { version: 'desc' },
    });
    return this.prisma.nota.create({
      data: { ...datos, version: (ultima?.version ?? 0) + 1 },
    });
  }

  async notaVigentePorIntento(intento_id: number): Promise<Nota | null> {
    return this.prisma.nota.findFirst({
      where: { intento_id },
      orderBy: { version: 'desc' },
    });
  }

  async notasVigentesPorEvaluacion(evaluacion_id: number): Promise<Nota[]> {
    const notas = await this.prisma.nota.findMany({
      where: { evaluacion_id },
      orderBy: { version: 'desc' },
    });
    // Una fila por intento_id: al venir ordenado por version desc, la
    // primera vez que se ve cada intento_id es su versión vigente.
    const vigentes = new Map<number, Nota>();
    for (const nota of notas) {
      if (!vigentes.has(nota.intento_id)) vigentes.set(nota.intento_id, nota);
    }
    return [...vigentes.values()];
  }

  async listarResultados(evaluacion_id: number): Promise<FilaResultado[]> {
    const filas = await this.prisma.intento.findMany({
      where: { evaluacion_id },
      include: {
        estudiante: { select: { nombres: true, apellidos: true } },
        _count: { select: { incidentes: true } },
        notas: { orderBy: { version: 'desc' }, take: 1 },
      },
      orderBy: { id: 'asc' },
    });
    return filas.map((f) => {
      const nota = f.notas[0];
      return {
        estudiante_id: f.estudiante_id,
        nombres: f.estudiante.nombres,
        apellidos: f.estudiante.apellidos,
        aciertos: nota?.aciertos ?? 0,
        total_preguntas: nota?.total_preguntas ?? 0,
        nota_obtenida: nota?.nota_obtenida ?? 0,
        incidentes: f._count.incidentes,
      };
    });
  }
}
