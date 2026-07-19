// HU-10 · Unirse a una materia con código (estudiante)
// El estudiante ingresa el código compartido por el docente + su código
// de estudiante para ESA materia (D-04). Si fue retirado y vuelve a usar
// el código, la inscripción se reactiva (sin duplicar — HU-10 Esc. 2).

import { Inscripcion } from '../../domain/entidades/inscripcion';
import {
  CodigoMateriaInvalidoError,
  CuentaVencidaError,
  LimiteEstudiantesExcedidoError,
  ProhibidoError,
  YaInscritoError,
} from '../../domain/errores';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { ObtenerEstadoCuenta } from '../cuenta/obtener-estado-cuenta';

export interface EntradaUnirse {
  estudiante_id: number;
  codigo_materia: string;
  codigo_estudiante: string;
  ip?: string;
  dispositivo?: string;
}

export interface ResultadoUnirse {
  inscripcion: Inscripcion;
  materia: {
    id: number;
    nombre_materia: string;
    sigla: string | null;
    carrera: string;
    semestre: string;
    universidad: string;
  };
}

export class UnirseAMateria {
  constructor(
    private readonly inscripciones: InscripcionRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly estadoCuenta: ObtenerEstadoCuenta,
  ) {}

  async ejecutar(entrada: EntradaUnirse): Promise<ResultadoUnirse> {
    const codigo = entrada.codigo_materia.trim().toUpperCase();
    const materia = await this.materias.buscarPorCodigo(codigo);

    // HU-10 Esc. 3: código inexistente, regenerado o desactivado — mismo
    // mensaje para no filtrar información sobre materias ajenas.
    if (!materia || !materia.codigo_activo) {
      throw new CodigoMateriaInvalidoError();
    }

    if (materia.docente_id === entrada.estudiante_id) {
      throw new ProhibidoError('No puedes inscribirte en tu propia materia');
    }

    const existente = await this.inscripciones.buscarPorEstudianteYMateria(
      entrada.estudiante_id,
      materia.id,
    );

    if (existente && !existente.retirado) {
      throw new YaInscritoError(); // HU-10 Esc. 2
    }

    // SaaS por cuenta (17/07): la cuenta del docente dueño de la materia
    // debe estar vigente y con cupo (una reactivación cuenta igual que un
    // alta nueva — el cupo siempre refleja estudiantes activos reales).
    const cuenta = await this.estadoCuenta.ejecutar(materia.docente_id);
    if (cuenta.solo_lectura) throw new CuentaVencidaError();
    if (
      cuenta.limite_estudiantes !== null &&
      cuenta.estudiantes_activos >= cuenta.limite_estudiantes
    ) {
      throw new LimiteEstudiantesExcedidoError();
    }

    const inscripcion = existente
      ? await this.inscripciones.reactivar(existente.id, entrada.codigo_estudiante)
      : await this.inscripciones.crear({
          estudiante_id: entrada.estudiante_id,
          materia_id: materia.id,
          codigo_estudiante: entrada.codigo_estudiante,
        });

    await this.bitacora.registrar({
      usuario_id: entrada.estudiante_id,
      rol_contexto: 'estudiante',
      accion: existente ? 'inscripcion_reactivada' : 'inscripcion_creada',
      entidad: 'inscripcion',
      entidad_id: String(inscripcion.id),
      valor_anterior: existente ? { retirado: true } : undefined,
      valor_nuevo: {
        materia_id: materia.id,
        codigo_materia: codigo,
        codigo_estudiante: entrada.codigo_estudiante,
      },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return {
      inscripcion,
      materia: {
        id: materia.id,
        nombre_materia: materia.nombre_materia,
        sigla: materia.sigla,
        carrera: materia.carrera,
        semestre: materia.semestre,
        universidad: materia.universidad,
      },
    };
  }
}
