// HU-12 · Nómina y retiro de estudiantes (docente)
// Nómina ordenada por apellidos con búsqueda. El retiro es lógico:
// el estudiante pierde acceso pero su historial se conserva, y el
// evento queda en auditoría.

import { InscripcionConEstudiante } from '../../domain/entidades/inscripcion';
import { Materia } from '../../domain/entidades/materia';
import {
  EstadoInvalidoError,
  NoEncontradoError,
  ProhibidoError,
} from '../../domain/errores';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';

async function exigirMateriaPropia(
  materias: MateriaRepositorio,
  materia_id: number,
  docente_id: number,
): Promise<Materia> {
  const materia = await materias.buscarPorId(materia_id);
  if (!materia) throw new NoEncontradoError('Materia');
  if (materia.docente_id !== docente_id) {
    throw new ProhibidoError('La materia no te pertenece');
  }
  return materia;
}

export class VerNomina {
  constructor(
    private readonly inscripciones: InscripcionRepositorio,
    private readonly materias: MateriaRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    docente_id: number;
    buscar?: string;
  }): Promise<InscripcionConEstudiante[]> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    return this.inscripciones.listarPorMateria(entrada.materia_id, entrada.buscar);
  }
}

export class RetirarEstudiante {
  constructor(
    private readonly inscripciones: InscripcionRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    inscripcion_id: number;
    docente_id: number;
    ip?: string;
    dispositivo?: string;
  }): Promise<void> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);

    const inscripcion = await this.inscripciones.buscarPorId(entrada.inscripcion_id);
    if (!inscripcion || inscripcion.materia_id !== entrada.materia_id) {
      throw new NoEncontradoError('Inscripción');
    }
    if (inscripcion.retirado) {
      throw new EstadoInvalidoError('El estudiante ya fue retirado de la materia');
    }

    await this.inscripciones.retirar(inscripcion.id);

    // HU-29: los retiros de estudiantes son evento sensible
    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'estudiante_retirado',
      entidad: 'inscripcion',
      entidad_id: String(inscripcion.id),
      valor_anterior: { retirado: false },
      valor_nuevo: {
        retirado: true,
        materia_id: inscripcion.materia_id,
        estudiante_id: inscripcion.estudiante_id,
        codigo_estudiante: inscripcion.codigo_estudiante,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}
