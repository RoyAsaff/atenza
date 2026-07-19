import { PrismaClient } from '@prisma/client';
import { Clase } from '../../domain/entidades/clase';
import {
  ClaseRepositorio,
  DatosNuevaClase,
} from '../../domain/repositorios/clase-repositorio';

export class PrismaClaseRepositorio implements ClaseRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorId(id: number): Promise<Clase | null> {
    return this.prisma.clase.findUnique({ where: { id } });
  }

  async buscarPorMateriaFechaHora(
    materia_id: number,
    fecha: Date,
    hora: string,
  ): Promise<Clase | null> {
    return this.prisma.clase.findUnique({
      where: { materia_id_fecha_hora: { materia_id, fecha, hora } },
    });
  }

  async listarPorMateria(materia_id: number): Promise<Clase[]> {
    return this.prisma.clase.findMany({
      where: { materia_id },
      orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
    });
  }

  async crear(datos: DatosNuevaClase): Promise<Clase> {
    return this.prisma.clase.create({ data: datos });
  }

  async crearVarias(datos: DatosNuevaClase[]): Promise<Clase[]> {
    if (datos.length === 0) return [];
    const [primera] = datos;

    return this.prisma.$transaction(async (tx) => {
      // Evita duplicar clases ya existentes (HU-14 + unique de BD)
      const existentes = await tx.clase.findMany({
        where: { materia_id: primera.materia_id },
        select: { fecha: true, hora: true },
      });
      const ocupadas = new Set(
        existentes.map((c) => `${c.fecha.toISOString().slice(0, 10)}|${c.hora}`),
      );
      const nuevas = datos.filter(
        (d) => !ocupadas.has(`${d.fecha.toISOString().slice(0, 10)}|${d.hora}`),
      );

      const creadas: Clase[] = [];
      for (const d of nuevas) {
        creadas.push(await tx.clase.create({ data: d }));
      }
      return creadas;
    });
  }

  async actualizar(
    id: number,
    datos: { fecha?: Date; hora?: string; tema?: string },
  ): Promise<Clase> {
    return this.prisma.clase.update({ where: { id }, data: datos });
  }

  async eliminar(id: number): Promise<void> {
    await this.prisma.clase.delete({ where: { id } });
  }
}
