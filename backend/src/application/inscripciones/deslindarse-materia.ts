// Caso de uso "Deslindar Materia" (diagrama E3, actor Estudiante):
// el estudiante se retira a sí mismo de la materia. Retiro lógico igual
// que HU-12: pierde acceso, el historial se conserva y queda en bitácora.

import { EstadoInvalidoError, NoEncontradoError } from '../../domain/errores';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';

export class DeslindarseDeMateria {
  constructor(
    private readonly inscripciones: InscripcionRepositorio,
    private readonly bitacora: BitacoraRepositorio,
  ) {}

  async ejecutar(entrada: {
    inscripcion_id: number;
    estudiante_id: number;
    ip?: string;
    dispositivo?: string;
  }): Promise<void> {
    const inscripcion = await this.inscripciones.buscarPorId(entrada.inscripcion_id);
    // La inscripción debe existir Y ser del propio estudiante (mismo 404
    // en ambos casos para no revelar inscripciones ajenas).
    if (!inscripcion || inscripcion.estudiante_id !== entrada.estudiante_id) {
      throw new NoEncontradoError('Inscripción');
    }
    if (inscripcion.retirado) {
      throw new EstadoInvalidoError('Ya no estás inscrito en esta materia');
    }

    await this.inscripciones.retirar(inscripcion.id);

    // HU-29: los retiros son evento sensible
    await this.bitacora.registrar({
      usuario_id: entrada.estudiante_id,
      rol_contexto: 'estudiante',
      accion: 'estudiante_deslindado',
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
