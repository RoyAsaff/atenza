// HU-11 · Gestionar el código de materia (docente)
// Ver (lo devuelve GET /api/materias/:id), regenerar (invalida el anterior
// y reabre inscripciones) y desactivar/activar (cierra o reabre el acceso
// sin cambiar el código).

import { Materia } from '../../domain/entidades/materia';
import { NoEncontradoError, ProhibidoError } from '../../domain/errores';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';

interface Contexto {
  materia_id: number;
  docente_id: number;
  ip?: string;
  dispositivo?: string;
}

export class GestionarCodigoMateria {
  constructor(
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async regenerar(entrada: Contexto): Promise<{ codigo: string; codigo_activo: boolean }> {
    const materia = await this.exigirPropia(entrada);
    const nuevo = await this.materias.regenerarCodigo(materia.id);

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'codigo_materia_regenerado',
      entidad: 'materia',
      entidad_id: String(materia.id),
      valor_anterior: { codigo: materia.codigo, codigo_activo: materia.codigo_activo },
      valor_nuevo: { codigo: nuevo, codigo_activo: true },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return { codigo: nuevo, codigo_activo: true };
  }

  async cambiarEstado(
    entrada: Contexto & { activo: boolean },
  ): Promise<{ codigo: string; codigo_activo: boolean }> {
    const materia = await this.exigirPropia(entrada);
    await this.materias.establecerCodigoActivo(materia.id, entrada.activo);

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: entrada.activo ? 'codigo_materia_activado' : 'codigo_materia_desactivado',
      entidad: 'materia',
      entidad_id: String(materia.id),
      valor_anterior: { codigo_activo: materia.codigo_activo },
      valor_nuevo: { codigo_activo: entrada.activo },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return { codigo: materia.codigo, codigo_activo: entrada.activo };
  }

  private async exigirPropia(entrada: Contexto): Promise<Materia> {
    const materia = await this.materias.buscarPorId(entrada.materia_id);
    if (!materia) throw new NoEncontradoError('Materia');
    if (materia.docente_id !== entrada.docente_id) {
      throw new ProhibidoError('La materia no te pertenece');
    }
    return materia;
  }
}
