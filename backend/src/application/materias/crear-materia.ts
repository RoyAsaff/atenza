// SaaS por cuenta (17/07, rediseñado 17/08) · Crear materia (docente)
// Reemplaza el flujo "solicitar materia con pago" (HU-06): crear una
// materia no cuesta nada por sí sola. Gateado por el middleware de cuenta
// activa a nivel de ruta, más el tope de materias del plan (Gratis = 1,
// chequeado acá — mismo patrón que UnirseAMateria con el tope de alumnos).

import { Materia } from '../../domain/entidades/materia';
import { LimiteMateriasExcedidoError } from '../../domain/errores';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { ObtenerEstadoCuenta } from '../cuenta/obtener-estado-cuenta';

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
    private readonly estadoCuenta: ObtenerEstadoCuenta,
  ) {}

  async ejecutar(entrada: EntradaCrearMateria): Promise<Materia> {
    const cuenta = await this.estadoCuenta.ejecutar(entrada.usuario_id);
    if (cuenta.limite_materias !== null && cuenta.materias_activas >= cuenta.limite_materias) {
      throw new LimiteMateriasExcedidoError();
    }

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
