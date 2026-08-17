import { GuiaIntento as FilaGuiaIntentoPrisma, PrismaClient } from '@prisma/client';
import {
  FilaMonitoreoGuia,
  FilaResultadoGuia,
  FilaRevisionGuia,
  GuiaIncidente,
  GuiaIntento,
  GuiaRespuesta,
} from '../../domain/entidades/guia';
import { TipoIncidente } from '../../domain/entidades/intento';
import {
  DatosNuevoGuiaIntento,
  GuiaIntentoRepositorio,
} from '../../domain/repositorios/guia-intento-repositorio';

const ESTADOS_ACTIVOS = ['en_curso', 'pausado', 'desconectado'] as const;

function aGuiaIntento(fila: FilaGuiaIntentoPrisma): GuiaIntento {
  return {
    id: fila.id,
    guia_id: fila.guia_id,
    estudiante_id: fila.estudiante_id,
    estado: fila.estado,
    es_oficial: fila.es_oficial,
    numero_intento: fila.numero_intento,
    fecha_inicio: fila.fecha_inicio,
    fecha_limite: fila.fecha_limite,
    fecha_fin: fila.fecha_fin,
    aciertos: fila.aciertos,
    nota_obtenida: fila.nota_obtenida,
  };
}

export class PrismaGuiaIntentoRepositorio implements GuiaIntentoRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorId(id: number): Promise<GuiaIntento | null> {
    const fila = await this.prisma.guiaIntento.findUnique({ where: { id } });
    return fila ? aGuiaIntento(fila) : null;
  }

  async buscarActivoPorEstudianteYGuia(
    guia_id: number,
    estudiante_id: number,
  ): Promise<GuiaIntento | null> {
    const fila = await this.prisma.guiaIntento.findFirst({
      where: { guia_id, estudiante_id, estado: { in: [...ESTADOS_ACTIVOS] } },
      orderBy: { fecha_inicio: 'desc' },
    });
    return fila ? aGuiaIntento(fila) : null;
  }

  async buscarOficialPorEstudianteYGuia(
    guia_id: number,
    estudiante_id: number,
  ): Promise<GuiaIntento | null> {
    const fila = await this.prisma.guiaIntento.findFirst({
      where: { guia_id, estudiante_id, es_oficial: true },
    });
    return fila ? aGuiaIntento(fila) : null;
  }

  async buscarOficialActivoPorEstudiante(estudiante_id: number): Promise<GuiaIntento | null> {
    const fila = await this.prisma.guiaIntento.findFirst({
      where: { estudiante_id, es_oficial: true, estado: { in: [...ESTADOS_ACTIVOS] } },
      orderBy: { fecha_inicio: 'desc' },
    });
    return fila ? aGuiaIntento(fila) : null;
  }

  async contarPorEstudianteYGuia(guia_id: number, estudiante_id: number): Promise<number> {
    return this.prisma.guiaIntento.count({ where: { guia_id, estudiante_id } });
  }

  async listarPorGuia(guia_id: number): Promise<GuiaIntento[]> {
    const filas = await this.prisma.guiaIntento.findMany({ where: { guia_id } });
    return filas.map(aGuiaIntento);
  }

  async listarMonitoreo(guia_id: number): Promise<FilaMonitoreoGuia[]> {
    const [filas, totalPreguntas] = await Promise.all([
      this.prisma.guiaIntento.findMany({
        where: { guia_id, es_oficial: true },
        include: {
          estudiante: { select: { nombres: true, apellidos: true } },
          _count: { select: { respuestas: true, incidentes: true } },
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.guiaPregunta.count({ where: { guia_id } }),
    ]);

    return filas.map((f) => ({
      intento_id: f.id,
      estudiante_id: f.estudiante_id,
      nombres: f.estudiante.nombres,
      apellidos: f.estudiante.apellidos,
      estado: f.estado,
      respondidas: f._count.respuestas,
      total_preguntas: totalPreguntas,
      incidentes: f._count.incidentes,
      fecha_inicio: f.fecha_inicio,
      fecha_limite: f.fecha_limite,
    }));
  }

  async listarResultados(guia_id: number): Promise<FilaResultadoGuia[]> {
    const [guia, filas] = await Promise.all([
      this.prisma.guia.findUnique({ where: { id: guia_id } }),
      this.prisma.guiaIntento.findMany({
        where: { guia_id },
        include: {
          estudiante: { select: { nombres: true, apellidos: true } },
          _count: { select: { incidentes: true } },
        },
        orderBy: { id: 'asc' },
      }),
    ]);
    const notaTotal = guia?.nota ?? 0;

    // Una fila por estudiante, agregando todos sus intentos (oficial +
    // repasos) — no hay forma directa de agrupar así en una sola query de
    // Prisma sin SQL crudo, y el volumen (estudiantes de una clase) es chico.
    const porEstudiante = new Map<number, typeof filas>();
    for (const f of filas) {
      const lista = porEstudiante.get(f.estudiante_id) ?? [];
      lista.push(f);
      porEstudiante.set(f.estudiante_id, lista);
    }

    const resultado: FilaResultadoGuia[] = [];
    for (const intentos of porEstudiante.values()) {
      const oficial = intentos.find((i) => i.es_oficial);
      const { nombres, apellidos } = intentos[0].estudiante;
      resultado.push({
        estudiante_id: intentos[0].estudiante_id,
        nombres,
        apellidos,
        intento_id: oficial?.id ?? null,
        estado_oficial: oficial?.estado ?? null,
        nota_obtenida: oficial?.nota_obtenida ?? null,
        nota_total: notaTotal,
        total_intentos: intentos.length,
        incidentes: intentos.reduce((acc, i) => acc + i._count.incidentes, 0),
      });
    }
    return resultado;
  }

  async listarRevisionPendiente(guia_id: number): Promise<FilaRevisionGuia[]> {
    const filas = await this.prisma.guiaRespuesta.findMany({
      where: { correcta: null, intento: { guia_id, es_oficial: true } },
      include: {
        pregunta: true,
        intento: { include: { estudiante: { select: { nombres: true, apellidos: true } } } },
      },
      orderBy: { id: 'asc' },
    });
    return filas.map((f) => ({
      guia_respuesta_id: f.id,
      guia_intento_id: f.guia_intento_id,
      estudiante_id: f.intento.estudiante_id,
      nombres: f.intento.estudiante.nombres,
      apellidos: f.intento.estudiante.apellidos,
      pregunta_referencia: f.pregunta.referencia,
      respuesta_modelo: f.pregunta.respuesta_modelo,
      texto_libre: f.texto_libre,
    }));
  }

  async crear(datos: DatosNuevoGuiaIntento): Promise<GuiaIntento> {
    const fila = await this.prisma.guiaIntento.create({
      data: {
        guia_id: datos.guia_id,
        estudiante_id: datos.estudiante_id,
        es_oficial: datos.es_oficial,
        numero_intento: datos.numero_intento,
        fecha_limite: datos.fecha_limite,
      },
    });
    return aGuiaIntento(fila);
  }

  async cambiarEstado(
    id: number,
    estado: GuiaIntento['estado'],
    datos?: { fecha_fin?: Date },
  ): Promise<GuiaIntento> {
    const fila = await this.prisma.guiaIntento.update({
      where: { id },
      data: { estado, fecha_fin: datos?.fecha_fin },
    });
    return aGuiaIntento(fila);
  }

  async guardarNota(id: number, aciertos: number, nota_obtenida: number): Promise<GuiaIntento> {
    const fila = await this.prisma.guiaIntento.update({
      where: { id },
      data: { aciertos, nota_obtenida },
    });
    return aGuiaIntento(fila);
  }

  async respuestasDe(guia_intento_id: number): Promise<GuiaRespuesta[]> {
    return this.prisma.guiaRespuesta.findMany({ where: { guia_intento_id } });
  }

  async guardarRespuesta(
    guia_intento_id: number,
    guia_pregunta_id: number,
    datos: { correcta?: boolean; texto_libre?: string },
  ): Promise<GuiaRespuesta> {
    return this.prisma.guiaRespuesta.upsert({
      where: { guia_intento_id_guia_pregunta_id: { guia_intento_id, guia_pregunta_id } },
      create: {
        guia_intento_id,
        guia_pregunta_id,
        correcta: datos.correcta ?? null,
        texto_libre: datos.texto_libre ?? null,
      },
      update: {
        correcta: datos.correcta ?? null,
        texto_libre: datos.texto_libre ?? null,
        respondida_en: new Date(),
        // Si vuelve a mandar una abierta ya revisada, se resetea la
        // revisión — cambió el texto, hay que volver a mirarla.
        revisada_en: null,
        revisada_por_id: null,
      },
    });
  }

  async contarRespuestas(guia_intento_id: number): Promise<number> {
    return this.prisma.guiaRespuesta.count({ where: { guia_intento_id } });
  }

  async contarRespuestasCorrectas(guia_intento_id: number): Promise<number> {
    return this.prisma.guiaRespuesta.count({ where: { guia_intento_id, correcta: true } });
  }

  async respuestasAbiertasPendientes(guia_intento_id: number): Promise<GuiaRespuesta[]> {
    return this.prisma.guiaRespuesta.findMany({ where: { guia_intento_id, correcta: null } });
  }

  async revisarRespuesta(
    guia_respuesta_id: number,
    correcta: boolean,
    revisada_por_id: number,
  ): Promise<GuiaRespuesta> {
    return this.prisma.guiaRespuesta.update({
      where: { id: guia_respuesta_id },
      data: { correcta, revisada_en: new Date(), revisada_por_id },
    });
  }

  async registrarIncidente(
    guia_intento_id: number,
    tipo: TipoIncidente,
    detalle?: string,
  ): Promise<GuiaIncidente> {
    return this.prisma.guiaIncidente.create({
      data: { guia_intento_id, tipo, detalle: detalle ?? null },
    });
  }

  async contarIncidentes(guia_intento_id: number): Promise<number> {
    return this.prisma.guiaIncidente.count({ where: { guia_intento_id } });
  }

  async finalizarVencidosGlobal(): Promise<GuiaIntento[]> {
    const vencidos = await this.prisma.guiaIntento.findMany({
      where: { estado: { in: ['en_curso', 'desconectado'] }, fecha_limite: { lte: new Date() } },
    });
    const actualizados: GuiaIntento[] = [];
    for (const intento of vencidos) {
      const fila = await this.prisma.guiaIntento.update({
        where: { id: intento.id },
        data: { estado: 'finalizado', fecha_fin: new Date() },
      });
      actualizados.push(aGuiaIntento(fila));
    }
    return actualizados;
  }
}
