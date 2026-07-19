import { PrismaClient } from '@prisma/client';
import { Materia } from '../../domain/entidades/materia';
import {
  DatosNuevaMateria,
  MateriaRepositorio,
} from '../../domain/repositorios/materia-repositorio';
import { generarCodigoMateria } from '../codigo-materia';

export class PrismaMateriaRepositorio implements MateriaRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorCodigo(codigo: string): Promise<Materia | null> {
    return this.prisma.materia.findUnique({ where: { codigo } });
  }

  async crear(datos: DatosNuevaMateria): Promise<Materia> {
    // Reintenta si el código generado colisiona (probabilidad mínima)
    for (let intento = 0; intento < 3; intento++) {
      try {
        return await this.prisma.materia.create({
          data: {
            ...datos,
            sigla: datos.sigla ?? null,
            codigo: generarCodigoMateria(),
          },
        });
      } catch (error: unknown) {
        const codigoDuplicado =
          typeof error === 'object' && error !== null && 'code' in error &&
          (error as { code: string }).code === 'P2002';
        if (!codigoDuplicado || intento === 2) throw error;
      }
    }
    throw new Error('No se pudo generar un código de materia único');
  }

  async regenerarCodigo(id: number): Promise<string> {
    // Reintenta si el código generado colisiona (probabilidad mínima).
    // Regenerar reabre las inscripciones: el docente pide un código
    // nuevo precisamente para volver a compartirlo (HU-11).
    for (let intento = 0; intento < 3; intento++) {
      try {
        const nuevo = generarCodigoMateria();
        await this.prisma.materia.update({
          where: { id },
          data: { codigo: nuevo, codigo_activo: true },
        });
        return nuevo;
      } catch (error: unknown) {
        const codigoDuplicado =
          typeof error === 'object' && error !== null && 'code' in error &&
          (error as { code: string }).code === 'P2002';
        if (!codigoDuplicado || intento === 2) throw error;
      }
    }
    throw new Error('No se pudo generar un código de materia único');
  }

  async establecerCodigoActivo(id: number, activo: boolean): Promise<void> {
    await this.prisma.materia.update({
      where: { id },
      data: { codigo_activo: activo },
    });
  }

  async listarPorDocente(docente_id: number): Promise<Materia[]> {
    return this.prisma.materia.findMany({
      where: { docente_id },
      orderBy: { nombre_materia: 'asc' },
    });
  }

  async buscarPorId(id: number): Promise<Materia | null> {
    return this.prisma.materia.findUnique({ where: { id } });
  }

  async listar(buscar?: string): Promise<Materia[]> {
    return this.prisma.materia.findMany({
      where: buscar
        ? {
            OR: [
              { nombre_materia: { contains: buscar, mode: 'insensitive' } },
              { sigla: { contains: buscar, mode: 'insensitive' } },
              { codigo: { contains: buscar, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { nombre_materia: 'asc' },
    });
  }
}
