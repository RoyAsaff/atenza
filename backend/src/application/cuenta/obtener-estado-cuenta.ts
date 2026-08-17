// SaaS por cuenta (17/07, rediseñado 17/08) · Estado de la cuenta del
// docente: plan actual, vigencia (plan gratuito permanente o pagos
// aprobados), y si está en modo solo lectura. Lo consumen: el middleware de
// bloqueo, el middleware de features (Word/Guías), el banner web,
// CrearMateria (tope de materias) y UnirseAMateria (tope de estudiantes).

import { Plan } from '../../domain/entidades/plan';
import { NoEncontradoError } from '../../domain/errores';
import { UsuarioRepositorio } from '../../domain/repositorios/usuario-repositorio';
import { PlanRepositorio } from '../../domain/repositorios/plan-repositorio';
import { PagoRepositorio } from '../../domain/repositorios/pago-repositorio';
import { InscripcionRepositorio } from '../../domain/repositorios/inscripcion-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';

const DIAS_AVISO_VENCIMIENTO = 5;

export interface EstadoCuenta {
  plan: Plan | null;
  // null = plan gratuito (permanente, sin vencimiento) — antes de 17/08
  // esto nunca era null, todo plan vencía a los 30/365 días.
  vigente_hasta: Date | null;
  dias_restantes: number | null;
  en_aviso: boolean;
  solo_lectura: boolean;
  limite_estudiantes: number | null;
  estudiantes_activos: number;
  limite_materias: number | null;
  materias_activas: number;
}

export class ObtenerEstadoCuenta {
  constructor(
    private readonly usuarios: UsuarioRepositorio,
    private readonly planes: PlanRepositorio,
    private readonly pagos: PagoRepositorio,
    private readonly inscripciones: InscripcionRepositorio,
    private readonly materias: MateriaRepositorio,
  ) {}

  async ejecutar(usuario_id: number): Promise<EstadoCuenta> {
    const usuario = await this.usuarios.buscarPorId(usuario_id);
    if (!usuario) throw new NoEncontradoError('Usuario');

    const plan = usuario.plan_id ? await this.planes.buscarPorId(usuario.plan_id) : null;
    const estudiantes_activos = await this.inscripciones.contarActivasPorDocente(usuario_id);
    const materias_activas = await this.materias.contarPorDocente(usuario_id);

    // 17/08: el plan gratuito es permanente — nunca cae en solo_lectura por
    // vencimiento, no hay trial ni pago que cronometrar.
    if (plan?.tipo === 'gratuito') {
      return {
        plan,
        vigente_hasta: null,
        dias_restantes: null,
        en_aviso: false,
        solo_lectura: false,
        limite_estudiantes: plan.limite_estudiantes,
        estudiantes_activos,
        limite_materias: plan.limite_materias,
        materias_activas,
      };
    }

    // Plan de pago (o institucional, o sin plan — defensivo): vigencia =
    // último pago aprobado. Ya no hay fallback a trial_inicio (17/08,
    // eliminado): si nunca hubo pago aprobado, vigente_hasta = epoch (ya
    // vencido) — una cuenta Pro vencida sin renovar queda en solo_lectura
    // duro, no se degrada automáticamente al plan Gratis.
    const vigente_hasta = (await this.pagos.vigenciaActual(usuario_id)) ?? new Date(0);
    const ahora = new Date();
    const dias_restantes = Math.ceil(
      (vigente_hasta.getTime() - ahora.getTime()) / (24 * 3600 * 1000),
    );
    const solo_lectura = vigente_hasta <= ahora;
    const en_aviso = !solo_lectura && dias_restantes <= DIAS_AVISO_VENCIMIENTO;

    return {
      plan,
      vigente_hasta,
      dias_restantes,
      en_aviso,
      solo_lectura,
      limite_estudiantes: plan?.limite_estudiantes ?? null,
      estudiantes_activos,
      limite_materias: plan?.limite_materias ?? null,
      materias_activas,
    };
  }
}
