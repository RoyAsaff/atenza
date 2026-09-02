import { IntentoCodigo as FilaIntentoCodigoPrisma, Prisma, PrismaClient } from '@prisma/client';
import {
  FilaMonitoreoCodigo,
  FilaResultadoCodigo,
  IncidenteCodigo,
  IntentoCodigo,
  NotaCodigo,
  RespuestaCodigo,
  ResultadoCaso,
  TipoIncidenteCodigo,
} from '../../domain/entidades/intento-codigo';
import {
  DatosGuardarRespuestaCodigo,
  DatosNuevaNotaCodigo,
  DatosNuevoIntentoCodigo,
  IntentoCodigoRepositorio,
} from '../../domain/repositorios/intento-codigo-repositorio';

function aIntentoCodigo(fila: FilaIntentoCodigoPrisma): IntentoCodigo {
  return {
    id: fila.id,
    examen_codigo_id: fila.examen_codigo_id,
    estudiante_id: fila.estudiante_id,
    estado: fila.estado,
    orden_ejercicios: fila.orden_ejercicios as number[],
    fecha_inicio: fila.fecha_inicio,
    fecha_limite: fila.fecha_limite,
    fecha_fin: fila.fecha_fin,
  };
}

const ESTADOS_ACTIVOS = ['en_curso', 'pausado', 'desconectado'] as const;

export class PrismaIntentoCodigoRepositorio implements IntentoCodigoRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorId(id: number): Promise<IntentoCodigo | null> {
    const fila = await this.prisma.intentoCodigo.findUnique({ where: { id } });
    return fila ? aIntentoCodigo(fila) : null;
  }

  async buscarActivoPorEstudiante(estudiante_id: number): Promise<IntentoCodigo | null> {
    const fila = await this.prisma.intentoCodigo.findFirst({
      where: { estudiante_id, estado: { in: [...ESTADOS_ACTIVOS] } },
      orderBy: { fecha_inicio: 'desc' },
    });
    return fila ? aIntentoCodigo(fila) : null;
  }

  async buscarPorExamenYEstudiante(
    examen_codigo_id: number,
    estudiante_id: number,
  ): Promise<IntentoCodigo | null> {
    const fila = await this.prisma.intentoCodigo.findUnique({
      where: { examen_codigo_id_estudiante_id: { examen_codigo_id, estudiante_id } },
    });
    return fila ? aIntentoCodigo(fila) : null;
  }

  async listarPorExamen(examen_codigo_id: number): Promise<IntentoCodigo[]> {
    const filas = await this.prisma.intentoCodigo.findMany({ where: { examen_codigo_id } });
    return filas.map(aIntentoCodigo);
  }

  async listarPorExamenConDetalle(examen_codigo_id: number): Promise<FilaMonitoreoCodigo[]> {
    const [filas, examen] = await Promise.all([
      this.prisma.intentoCodigo.findMany({
        where: { examen_codigo_id },
        include: {
          estudiante: { select: { nombres: true, apellidos: true } },
          _count: { select: { respuestas: true, incidentes: true } },
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.examenCodigo.findUnique({
        where: { id: examen_codigo_id },
        include: { _count: { select: { ejercicios: true } } },
      }),
    ]);
    const totalEjercicios = examen?._count.ejercicios ?? 0;

    return filas.map((f) => ({
      intento_id: f.id,
      estudiante_id: f.estudiante_id,
      nombres: f.estudiante.nombres,
      apellidos: f.estudiante.apellidos,
      estado: f.estado,
      ejercicios_enviados: f._count.respuestas,
      total_ejercicios: totalEjercicios,
      incidentes: f._count.incidentes,
      fecha_inicio: f.fecha_inicio,
      fecha_limite: f.fecha_limite,
    }));
  }

  async crear(datos: DatosNuevoIntentoCodigo): Promise<IntentoCodigo> {
    const fila = await this.prisma.intentoCodigo.create({
      data: {
        examen_codigo_id: datos.examen_codigo_id,
        estudiante_id: datos.estudiante_id,
        orden_ejercicios: datos.orden_ejercicios as Prisma.InputJsonValue,
        fecha_limite: datos.fecha_limite,
      },
    });
    return aIntentoCodigo(fila);
  }

  async cambiarEstado(
    id: number,
    estado: IntentoCodigo['estado'],
    datos?: { fecha_fin?: Date },
  ): Promise<IntentoCodigo> {
    const fila = await this.prisma.intentoCodigo.update({
      where: { id },
      data: { estado, fecha_fin: datos?.fecha_fin },
    });
    return aIntentoCodigo(fila);
  }

  async marcarConexion(estudiante_id: number, conectado: boolean): Promise<IntentoCodigo[]> {
    return this.prisma.$transaction(async (tx) => {
      const activos = await tx.intentoCodigo.findMany({
        where: { estudiante_id, estado: conectado ? 'desconectado' : 'en_curso' },
      });
      const actualizados: IntentoCodigo[] = [];
      for (const intento of activos) {
        const fila = await tx.intentoCodigo.update({
          where: { id: intento.id },
          data: { estado: conectado ? 'en_curso' : 'desconectado' },
        });
        actualizados.push(aIntentoCodigo(fila));
      }
      return actualizados;
    });
  }

  async respuestasDe(intento_id: number): Promise<RespuestaCodigo[]> {
    const filas = await this.prisma.respuestaCodigo.findMany({ where: { intento_id } });
    return filas.map((f) => ({ ...f, resultado_json: f.resultado_json as unknown as ResultadoCaso[] }));
  }

  async guardarRespuesta(datos: DatosGuardarRespuestaCodigo): Promise<RespuestaCodigo> {
    const fila = await this.prisma.respuestaCodigo.upsert({
      where: { intento_id_ejercicio_id: { intento_id: datos.intento_id, ejercicio_id: datos.ejercicio_id } },
      create: {
        intento_id: datos.intento_id,
        ejercicio_id: datos.ejercicio_id,
        codigo_fuente: datos.codigo_fuente,
        casos_acertados: datos.casos_acertados,
        casos_totales: datos.casos_totales,
        resultado_json: datos.resultado_json as unknown as Prisma.InputJsonValue,
      },
      update: {
        codigo_fuente: datos.codigo_fuente,
        casos_acertados: datos.casos_acertados,
        casos_totales: datos.casos_totales,
        resultado_json: datos.resultado_json as unknown as Prisma.InputJsonValue,
        respondida_en: new Date(),
      },
    });
    return { ...fila, resultado_json: fila.resultado_json as unknown as ResultadoCaso[] };
  }

  async contarEjerciciosEnviados(intento_id: number): Promise<number> {
    return this.prisma.respuestaCodigo.count({ where: { intento_id } });
  }

  async registrarIncidente(
    intento_id: number,
    tipo: TipoIncidenteCodigo,
    detalle?: string,
  ): Promise<IncidenteCodigo> {
    return this.prisma.incidenteCodigo.create({
      data: { intento_id, tipo, detalle: detalle ?? null },
    });
  }

  async contarIncidentes(intento_id: number): Promise<number> {
    return this.prisma.incidenteCodigo.count({ where: { intento_id } });
  }

  private async finalizarVencidosDonde(where: {
    examen_codigo_id?: number;
  }): Promise<IntentoCodigo[]> {
    const vencidos = await this.prisma.intentoCodigo.findMany({
      where: { ...where, estado: { in: ['en_curso', 'desconectado'] }, fecha_limite: { lte: new Date() } },
    });
    const actualizados: IntentoCodigo[] = [];
    for (const intento of vencidos) {
      const fila = await this.prisma.intentoCodigo.update({
        where: { id: intento.id },
        data: { estado: 'finalizado', fecha_fin: new Date() },
      });
      actualizados.push(aIntentoCodigo(fila));
    }
    return actualizados;
  }

  async finalizarVencidos(examen_codigo_id: number): Promise<IntentoCodigo[]> {
    return this.finalizarVencidosDonde({ examen_codigo_id });
  }

  // Barrido periódico (ver barrer-vencimientos.ts): mismo chequeo que
  // finalizarVencidos, pero sin acotar a un examen — recorre todos de una.
  async finalizarVencidosGlobal(): Promise<IntentoCodigo[]> {
    return this.finalizarVencidosDonde({});
  }

  async contarCasos(intento_id: number): Promise<{ acertados: number; totales: number }> {
    const agregado = await this.prisma.respuestaCodigo.aggregate({
      where: { intento_id },
      _sum: { casos_acertados: true, casos_totales: true },
    });
    return {
      acertados: agregado._sum.casos_acertados ?? 0,
      totales: agregado._sum.casos_totales ?? 0,
    };
  }

  async guardarNota(datos: DatosNuevaNotaCodigo): Promise<NotaCodigo> {
    const ultima = await this.prisma.notaCodigo.findFirst({
      where: { intento_id: datos.intento_id },
      orderBy: { version: 'desc' },
    });
    return this.prisma.notaCodigo.create({
      data: { ...datos, version: (ultima?.version ?? 0) + 1 },
    });
  }

  async notaVigentePorIntento(intento_id: number): Promise<NotaCodigo | null> {
    return this.prisma.notaCodigo.findFirst({
      where: { intento_id },
      orderBy: { version: 'desc' },
    });
  }

  async notasVigentesPorExamen(examen_codigo_id: number): Promise<NotaCodigo[]> {
    const notas = await this.prisma.notaCodigo.findMany({
      where: { examen_codigo_id },
      orderBy: { version: 'desc' },
    });
    // Igual que Nota (E8): la primera vez que aparece cada intento_id,
    // viniendo ordenado por version desc, es su versión vigente.
    const vigentes = new Map<number, NotaCodigo>();
    for (const nota of notas) {
      if (!vigentes.has(nota.intento_id)) vigentes.set(nota.intento_id, nota);
    }
    return [...vigentes.values()];
  }

  async listarResultados(examen_codigo_id: number): Promise<FilaResultadoCodigo[]> {
    const filas = await this.prisma.intentoCodigo.findMany({
      where: { examen_codigo_id },
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
        casos_acertados: nota?.casos_acertados ?? 0,
        casos_totales: nota?.casos_totales ?? 0,
        nota_obtenida: nota?.nota_obtenida ?? 0,
        incidentes: f._count.incidentes,
      };
    });
  }
}
