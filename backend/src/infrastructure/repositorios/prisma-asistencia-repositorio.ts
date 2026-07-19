import { PrismaClient } from '@prisma/client';
import { Asistencia } from '../../domain/entidades/asistencia';
import {
  AsistenciaRepositorio,
  DatosMarcaje,
} from '../../domain/repositorios/asistencia-repositorio';

export class PrismaAsistenciaRepositorio implements AsistenciaRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async listarPorClase(clase_id: number): Promise<Asistencia[]> {
    return this.prisma.asistencia.findMany({ where: { clase_id } });
  }

  async listarPorMateria(materia_id: number): Promise<Asistencia[]> {
    return this.prisma.asistencia.findMany({ where: { clase: { materia_id } } });
  }

  async guardarVarias(datos: DatosMarcaje[]): Promise<Asistencia[]> {
    if (datos.length === 0) return [];
    return this.prisma.$transaction(
      datos.map((d) =>
        this.prisma.asistencia.upsert({
          where: {
            clase_id_estudiante_id: {
              clase_id: d.clase_id,
              estudiante_id: d.estudiante_id,
            },
          },
          create: d,
          update: { marcaje: d.marcaje },
        }),
      ),
    );
  }
}
