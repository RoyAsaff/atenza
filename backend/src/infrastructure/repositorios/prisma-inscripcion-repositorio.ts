import { PrismaClient } from '@prisma/client';
import {
  Inscripcion,
  InscripcionConEstudiante,
  InscripcionConMateria,
} from '../../domain/entidades/inscripcion';
import {
  DatosNuevaInscripcion,
  InscripcionRepositorio,
} from '../../domain/repositorios/inscripcion-repositorio';

export class PrismaInscripcionRepositorio implements InscripcionRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorId(id: number): Promise<Inscripcion | null> {
    return this.prisma.inscripcion.findUnique({ where: { id } });
  }

  async buscarPorEstudianteYMateria(
    estudiante_id: number,
    materia_id: number,
  ): Promise<Inscripcion | null> {
    return this.prisma.inscripcion.findUnique({
      where: { estudiante_id_materia_id: { estudiante_id, materia_id } },
    });
  }

  async crear(datos: DatosNuevaInscripcion): Promise<Inscripcion> {
    return this.prisma.inscripcion.create({ data: datos });
  }

  async reactivar(id: number, codigo_estudiante: string): Promise<Inscripcion> {
    return this.prisma.inscripcion.update({
      where: { id },
      data: {
        retirado: false,
        fecha_retiro: null,
        codigo_estudiante,
        fecha_inscripcion: new Date(),
      },
    });
  }

  async listarPorMateria(
    materia_id: number,
    buscar?: string,
  ): Promise<InscripcionConEstudiante[]> {
    return this.prisma.inscripcion.findMany({
      where: {
        materia_id,
        retirado: false,
        ...(buscar
          ? {
              OR: [
                { codigo_estudiante: { contains: buscar, mode: 'insensitive' } },
                { estudiante: { nombres: { contains: buscar, mode: 'insensitive' } } },
                { estudiante: { apellidos: { contains: buscar, mode: 'insensitive' } } },
                { estudiante: { email: { contains: buscar, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        estudiante: {
          select: { id: true, nombres: true, apellidos: true, email: true },
        },
      },
      // HU-12: nómina ordenada por apellidos
      orderBy: [{ estudiante: { apellidos: 'asc' } }, { estudiante: { nombres: 'asc' } }],
    });
  }

  async listarPorEstudiante(estudiante_id: number): Promise<InscripcionConMateria[]> {
    return this.prisma.inscripcion.findMany({
      where: { estudiante_id, retirado: false },
      include: {
        materia: {
          select: {
            id: true,
            nombre_materia: true,
            sigla: true,
            carrera: true,
            semestre: true,
            universidad: true,
            docente: { select: { nombres: true, apellidos: true } },
          },
        },
      },
      orderBy: { materia: { nombre_materia: 'asc' } },
    });
  }

  async retirar(id: number): Promise<Inscripcion> {
    return this.prisma.inscripcion.update({
      where: { id },
      data: { retirado: true, fecha_retiro: new Date() },
    });
  }

  async contarActivasPorDocente(docente_id: number): Promise<number> {
    return this.prisma.inscripcion.count({
      where: { retirado: false, materia: { docente_id } },
    });
  }
}
