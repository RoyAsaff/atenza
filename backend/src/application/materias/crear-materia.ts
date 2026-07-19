// SaaS por cuenta (17/07) · Crear materia (docente)
// Reemplaza el flujo "solicitar materia con pago" (HU-06): con suscripción
// por cuenta, crear una materia no cuesta nada por sí sola — solo el total
// de estudiantes de la cuenta define el precio. Gateado solo por el
// middleware de cuenta activa a nivel de ruta (no hay chequeo aquí).

import { Materia } from '../../domain/entidades/materia';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';

export interface EntradaCrearMateria {
  usuario_id: number;
  nombre_materia: string;
  sigla?: string;
  carrera: string;
  semestre: string;
  universidad: string;
  ip?: string;
  dispositivo?: string;
}

export class CrearMateria {
  constructor(
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(entrada: EntradaCrearMateria): Promise<Materia> {
    const materia = await this.materias.crear({
      nombre_materia: entrada.nombre_materia,
      sigla: entrada.sigla,
      carrera: entrada.carrera,
      semestre: entrada.semestre,
      universidad: entrada.universidad,
      docente_id: entrada.usuario_id,
    });

    await this.bitacora.registrar({
      usuario_id: entrada.usuario_id,
      rol_contexto: 'docente',
      accion: 'materia_creada',
      entidad: 'materia',
      entidad_id: String(materia.id),
      valor_nuevo: { nombre_materia: materia.nombre_materia, codigo: materia.codigo },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return materia;
  }
}
