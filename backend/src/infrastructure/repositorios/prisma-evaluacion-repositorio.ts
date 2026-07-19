import { PrismaClient } from '@prisma/client';
import {
  EstadoEvaluacion,
  Evaluacion,
  EvaluacionConClase,
  EvaluacionConPreguntas,
  Pregunta,
} from '../../domain/entidades/evaluacion';
import {
  DatosNuevaEvaluacion,
  DatosPregunta,
  EvaluacionRepositorio,
} from '../../domain/repositorios/evaluacion-repositorio';

export class PrismaEvaluacionRepositorio implements EvaluacionRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorId(id: number): Promise<Evaluacion | null> {
    return this.prisma.evaluacion.findUnique({ where: { id } });
  }

  async buscarConPreguntas(id: number): Promise<EvaluacionConPreguntas | null> {
    return this.prisma.evaluacion.findUnique({
      where: { id },
      include: {
        preguntas: {
          orderBy: { orden: 'asc' },
          include: { opciones: { orderBy: { id: 'asc' } } },
        },
      },
    });
  }

  async listarPorClase(clase_id: number): Promise<Evaluacion[]> {
    return this.prisma.evaluacion.findMany({ where: { clase_id }, orderBy: { id: 'asc' } });
  }

  async listarPorMateriaConClase(materia_id: number): Promise<EvaluacionConClase[]> {
    return this.prisma.evaluacion.findMany({
      where: { clase: { materia_id } },
      include: { clase: { select: { id: true, fecha: true, hora: true, tema: true } } },
      orderBy: [{ clase: { fecha: 'desc' } }, { id: 'desc' }],
    });
  }

  async crear(datos: DatosNuevaEvaluacion): Promise<Evaluacion> {
    return this.prisma.evaluacion.create({ data: datos });
  }

  async actualizar(
    id: number,
    datos: { tema?: string; nota?: number; tiempo_limite_minutos?: number | null },
  ): Promise<Evaluacion> {
    return this.prisma.evaluacion.update({ where: { id }, data: datos });
  }

  async cambiarEstado(id: number, estado: EstadoEvaluacion): Promise<Evaluacion> {
    return this.prisma.evaluacion.update({ where: { id }, data: { estado } });
  }

  async marcarLanzada(id: number): Promise<Evaluacion> {
    return this.prisma.evaluacion.update({
      where: { id },
      data: { estado: 'lanzada', fecha_lanzamiento: new Date() },
    });
  }

  async marcarPublicada(id: number): Promise<Evaluacion> {
    return this.prisma.evaluacion.update({
      where: { id },
      data: { publicada: true, fecha_publicacion: new Date() },
    });
  }

  async listarFinalizadasPorMateria(materia_id: number): Promise<Evaluacion[]> {
    return this.prisma.evaluacion.findMany({
      where: { estado: 'finalizada', clase: { materia_id } },
      orderBy: { fecha_lanzamiento: 'asc' },
    });
  }

  async listarPublicadasPorMateria(materia_id: number): Promise<Evaluacion[]> {
    return this.prisma.evaluacion.findMany({
      where: { publicada: true, clase: { materia_id } },
      orderBy: { fecha_publicacion: 'asc' },
    });
  }

  async contarPreguntas(evaluacion_id: number): Promise<number> {
    return this.prisma.pregunta.count({ where: { evaluacion_id } });
  }

  async buscarPregunta(pregunta_id: number): Promise<Pregunta | null> {
    return this.prisma.pregunta.findUnique({
      where: { id: pregunta_id },
      include: { opciones: { orderBy: { id: 'asc' } } },
    });
  }

  async agregarPregunta(evaluacion_id: number, datos: DatosPregunta): Promise<Pregunta> {
    const orden = await this.contarPreguntas(evaluacion_id);
    return this.prisma.pregunta.create({
      data: {
        pregunta: datos.pregunta,
        evaluacion_id,
        orden,
        opciones: { create: datos.opciones },
      },
      include: { opciones: { orderBy: { id: 'asc' } } },
    });
  }

  async actualizarPregunta(pregunta_id: number, datos: DatosPregunta): Promise<Pregunta> {
    return this.prisma.$transaction(async (tx) => {
      await tx.opcion.deleteMany({ where: { pregunta_id } });
      return tx.pregunta.update({
        where: { id: pregunta_id },
        data: {
          pregunta: datos.pregunta,
          opciones: { create: datos.opciones },
        },
        include: { opciones: { orderBy: { id: 'asc' } } },
      });
    });
  }

  async actualizarImagenPregunta(pregunta_id: number, url_imagen: string): Promise<Pregunta> {
    return this.prisma.pregunta.update({
      where: { id: pregunta_id },
      data: { url_imagen },
      include: { opciones: { orderBy: { id: 'asc' } } },
    });
  }

  async eliminarPregunta(pregunta_id: number): Promise<void> {
    await this.prisma.pregunta.delete({ where: { id: pregunta_id } });
  }

  async reordenarPreguntas(evaluacion_id: number, ordenIds: number[]): Promise<void> {
    await this.prisma.$transaction(
      ordenIds.map((id, index) =>
        this.prisma.pregunta.update({ where: { id }, data: { orden: index } }),
      ),
    );
  }
}
