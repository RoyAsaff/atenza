import { PrismaClient } from '@prisma/client';
import { EstadoEvaluacion } from '../../domain/entidades/evaluacion';
import {
  CasoPrueba,
  Ejercicio,
  ExamenCodigo,
  ExamenCodigoConClase,
  ExamenCodigoConEjercicios,
} from '../../domain/entidades/examen-codigo';
import {
  DatosCasoPrueba,
  DatosEjercicio,
  DatosNuevoExamenCodigo,
  ExamenCodigoRepositorio,
} from '../../domain/repositorios/examen-codigo-repositorio';

export class PrismaExamenCodigoRepositorio implements ExamenCodigoRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorId(id: number): Promise<ExamenCodigo | null> {
    return this.prisma.examenCodigo.findUnique({ where: { id } });
  }

  async buscarConEjercicios(id: number): Promise<ExamenCodigoConEjercicios | null> {
    return this.prisma.examenCodigo.findUnique({
      where: { id },
      include: {
        ejercicios: {
          orderBy: { orden: 'asc' },
          include: { casos_prueba: { orderBy: { orden: 'asc' } } },
        },
      },
    });
  }

  async listarPorClase(clase_id: number): Promise<ExamenCodigo[]> {
    return this.prisma.examenCodigo.findMany({ where: { clase_id }, orderBy: { id: 'asc' } });
  }

  async listarPorMateriaConClase(materia_id: number): Promise<ExamenCodigoConClase[]> {
    return this.prisma.examenCodigo.findMany({
      where: { clase: { materia_id } },
      include: { clase: { select: { id: true, fecha: true, hora: true, tema: true } } },
      orderBy: [{ clase: { fecha: 'desc' } }, { id: 'desc' }],
    });
  }

  async crear(datos: DatosNuevoExamenCodigo): Promise<ExamenCodigo> {
    return this.prisma.examenCodigo.create({ data: datos });
  }

  async actualizar(
    id: number,
    datos: { tema?: string; nota?: number; tiempo_limite_minutos?: number | null },
  ): Promise<ExamenCodigo> {
    return this.prisma.examenCodigo.update({ where: { id }, data: datos });
  }

  async cambiarEstado(id: number, estado: EstadoEvaluacion): Promise<ExamenCodigo> {
    return this.prisma.examenCodigo.update({ where: { id }, data: { estado } });
  }

  async marcarLanzada(id: number): Promise<ExamenCodigo> {
    return this.prisma.examenCodigo.update({
      where: { id },
      data: { estado: 'lanzada', fecha_lanzamiento: new Date() },
    });
  }

  async marcarPublicada(id: number): Promise<ExamenCodigo> {
    return this.prisma.examenCodigo.update({
      where: { id },
      data: { publicada: true, fecha_publicacion: new Date() },
    });
  }

  async listarFinalizadosPorMateria(materia_id: number): Promise<ExamenCodigo[]> {
    return this.prisma.examenCodigo.findMany({
      where: { estado: 'finalizada', clase: { materia_id } },
      orderBy: { fecha_lanzamiento: 'asc' },
    });
  }

  async listarPublicadosPorMateria(materia_id: number): Promise<ExamenCodigo[]> {
    return this.prisma.examenCodigo.findMany({
      where: { publicada: true, clase: { materia_id } },
      orderBy: { fecha_publicacion: 'asc' },
    });
  }

  async listarLanzados(): Promise<ExamenCodigo[]> {
    return this.prisma.examenCodigo.findMany({ where: { estado: 'lanzada' } });
  }

  async eliminar(id: number): Promise<void> {
    // Cascade en el schema (onDelete: Cascade en ejercicios/casos/intentos/
    // respuestas/incidentes/notas): un solo DELETE basta.
    await this.prisma.examenCodigo.delete({ where: { id } });
  }

  async contarEjercicios(examen_codigo_id: number): Promise<number> {
    return this.prisma.ejercicio.count({ where: { examen_codigo_id } });
  }

  async buscarEjercicio(ejercicio_id: number): Promise<Ejercicio | null> {
    return this.prisma.ejercicio.findUnique({
      where: { id: ejercicio_id },
      include: { casos_prueba: { orderBy: { orden: 'asc' } } },
    });
  }

  async agregarEjercicio(examen_codigo_id: number, datos: DatosEjercicio): Promise<Ejercicio> {
    const orden = await this.contarEjercicios(examen_codigo_id);
    return this.prisma.ejercicio.create({
      data: {
        enunciado: datos.enunciado,
        plantilla_codigo: datos.plantilla_codigo ?? null,
        nota: datos.nota,
        examen_codigo_id,
        orden,
        casos_prueba: { create: aCasosPrisma(datos.casos_prueba) },
      },
      include: { casos_prueba: { orderBy: { orden: 'asc' } } },
    });
  }

  async actualizarEjercicio(ejercicio_id: number, datos: DatosEjercicio): Promise<Ejercicio> {
    return this.prisma.$transaction(async (tx) => {
      await tx.casoPrueba.deleteMany({ where: { ejercicio_id } });
      return tx.ejercicio.update({
        where: { id: ejercicio_id },
        data: {
          enunciado: datos.enunciado,
          plantilla_codigo: datos.plantilla_codigo ?? null,
          nota: datos.nota,
          casos_prueba: { create: aCasosPrisma(datos.casos_prueba) },
        },
        include: { casos_prueba: { orderBy: { orden: 'asc' } } },
      });
    });
  }

  async eliminarEjercicio(ejercicio_id: number): Promise<void> {
    await this.prisma.ejercicio.delete({ where: { id: ejercicio_id } });
  }

  async reordenarEjercicios(examen_codigo_id: number, ordenIds: number[]): Promise<void> {
    await this.prisma.$transaction(
      ordenIds.map((id, index) => this.prisma.ejercicio.update({ where: { id }, data: { orden: index } })),
    );
  }

  async casosDe(ejercicio_id: number): Promise<CasoPrueba[]> {
    return this.prisma.casoPrueba.findMany({ where: { ejercicio_id }, orderBy: { orden: 'asc' } });
  }
}

function aCasosPrisma(casos: DatosCasoPrueba[]) {
  return casos.map((c, orden) => ({ ...c, orden }));
}
