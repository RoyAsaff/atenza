// SaaS por cuenta (17/07) · Estado de la cuenta del docente: plan actual,
// vigencia (prueba gratis o pagos aprobados), y si está en modo solo
// lectura. Lo consumen: el middleware de bloqueo, el banner web, y
// UnirseAMateria para el chequeo de tope de estudiantes.

import { Plan } from '../../domain/entidades/plan';
import { NoEncontradoError } from '../../domain/errores';
import { UsuarioRepositorio } from '../../domain/repositorios/usuario-repositorio';
import { PlanRepositorio } from '../../domain/repositorios/plan-repositorio';
import { PagoRepositorio } from '../../domain/repositorios/pago-repositorio';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';

const DIAS_PRUEBA_GRATIS = 30;
const DIAS_AVISO_VENCIMIENTO = 5;

export interface EstadoCuenta {
  plan: Plan | null;
  vigente_hasta: Date;
  dias_restantes: number;
  en_aviso: boolean;
  solo_lectura: boolean;
  limite_estudiantes: number | null;
  estudiantes_activos: number;
}

export class ObtenerEstadoCuenta {
  constructor(
    private readonly usuarios: UsuarioRepositorio,
    private readonly planes: PlanRepositorio,
    private readonly pagos: PagoRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
  ) {}

  async ejecutar(usuario_id: number): Promise<EstadoCuenta> {
    const usuario = await this.usuarios.buscarPorId(usuario_id);
    if (!usuario) throw new NoEncontradoError('Usuario');

    const plan = usuario.plan_id ? await this.planes.buscarPorId(usuario.plan_id) : null;

    const finPrueba = new Date(
      usuario.trial_inicio.getTime() + DIAS_PRUEBA_GRATIS * 24 * 3600 * 1000,
    );
    const vigenciaPago = await this.pagos.vigenciaActual(usuario_id);
    const vigente_hasta = vigenciaPago && vigenciaPago > finPrueba ? vigenciaPago : finPrueba;

    const ahora = new Date();
    const dias_restantes = Math.ceil(
      (vigente_hasta.getTime() - ahora.getTime()) / (24 * 3600 * 1000),
    );
    const solo_lectura = vigente_hasta <= ahora;
    const en_aviso = !solo_lectura && dias_restantes <= DIAS_AVISO_VENCIMIENTO;

    const estudiantes_activos = await this.inscripciones.contarActivasPorDocente(usuario_id);

    return {
      plan,
      vigente_hasta,
      dias_restantes,
      en_aviso,
      solo_lectura,
      limite_estudiantes: plan?.limite_estudiantes ?? null,
      estudiantes_activos,
    };
  }
}
