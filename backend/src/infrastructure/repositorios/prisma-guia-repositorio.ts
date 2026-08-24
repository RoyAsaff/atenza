import { PrismaClient } from '@prisma/client';
import { EstadoGuia, Guia, GuiaPregunta } from '../../domain/entidades/guia';
import {
  DatosActualizarGuia,
  DatosNuevaGuia,
  GuiaRepositorio,
} from '../../domain/repositorios/guia-repositorio';

export class PrismaGuiaRepositorio implements GuiaRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorId(id: number): Promise<Guia | null> {
    return this.prisma.guia.findUnique({ where: { id } });
  }

  async listarPorClase(clase_id: number): Promise<Guia[]> {
    return this.prisma.guia.findMany({ where: { clase_id }, orderBy: { orden: 'asc' } });
  }

  async listarLanzadas(): Promise<Guia[]> {
    return this.prisma.guia.findMany({ where: { estado: 'lanzada' } });
  }

  async listarCerradasPorMateria(materia_id: number): Promise<Guia[]> {
    return this.prisma.guia.findMany({
      where: { estado: 'cerrada', clase: { materia_id } },
      orderBy: { orden: 'asc' },
    });
  }

  async crear(datos: DatosNuevaGuia): Promise<Guia> {
    return this.prisma.guia.create({
      data: {
        clase_id: datos.clase_id,
        tema: datos.tema,
        url: datos.url,
        orden: datos.orden,
        nota: datos.nota,
        tiempo_limite_minutos: datos.tiempo_limite_minutos ?? null,
        preguntas: {
          create: datos.preguntas.map((p) => ({
            referencia: p.referencia,
            tipo: p.tipo,
            respuesta_modelo: p.respuesta_modelo ?? null,
            orden: p.orden,
          })),
        },
        ...(datos.integracion_detectada !== undefined
          ? { integracion_detectada: datos.integracion_detectada, integracion_verificada_en: new Date() }
          : {}),
      },
    });
  }

  async actualizar(id: number, datos: DatosActualizarGuia): Promise<Guia> {
    // Reemplaza el manifest completo si vino `preguntas` — mismo criterio
    // que ActualizarPregunta de Evaluación con sus opciones: borra y crea de
    // nuevo, más simple que diffear referencia por referencia.
    if (datos.preguntas) {
      await this.prisma.guiaPregunta.deleteMany({ where: { guia_id: id } });
    }
    return this.prisma.guia.update({
      where: { id },
      data: {
        tema: datos.tema,
        url: datos.url,
        orden: datos.orden,
        nota: datos.nota,
        tiempo_limite_minutos: datos.tiempo_limite_minutos,
        ...(datos.preguntas
          ? {
              preguntas: {
                create: datos.preguntas.map((p) => ({
                  referencia: p.referencia,
                  tipo: p.tipo,
                  respuesta_modelo: p.respuesta_modelo ?? null,
                  orden: p.orden,
                })),
              },
            }
          : {}),
        ...(datos.integracion_detectada !== undefined
          ? { integracion_detectada: datos.integracion_detectada, integracion_verificada_en: new Date() }
          : {}),
      },
    });
  }

  async eliminar(id: number): Promise<void> {
    await this.prisma.guia.delete({ where: { id } });
  }

  async cambiarEstado(id: number, estado: EstadoGuia): Promise<Guia> {
    return this.prisma.guia.update({ where: { id }, data: { estado } });
  }

  async listarPreguntas(guia_id: number): Promise<GuiaPregunta[]> {
    return this.prisma.guiaPregunta.findMany({ where: { guia_id }, orderBy: { orden: 'asc' } });
  }

  async buscarPreguntaPorReferencia(
    guia_id: number,
    referencia: string,
  ): Promise<GuiaPregunta | null> {
    return this.prisma.guiaPregunta.findUnique({
      where: { guia_id_referencia: { guia_id, referencia } },
    });
  }
}
