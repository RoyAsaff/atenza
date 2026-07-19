// HU-02 · Registro de cuenta self-service
// Escenario 1: datos válidos → cuenta creada, email como identificador único
// Escenario 2: email duplicado → rechazo con conflicto (409)
// Escenario 3: password débil → se valida en presentación (zod, min 8)

import { UsuarioPublico, aPublico } from '../../domain/entidades/usuario';
import { EmailYaRegistradoError } from '../../domain/errores';
import { UsuarioRepositorio } from '../../domain/repositorios/usuario-repositorio';
import { PlanRepositorio } from '../../domain/repositorios/plan-repositorio';
import { PasswordHasher } from '../../domain/servicios/password-hasher';

export interface EntradaRegistro {
  nombres: string;
  apellidos: string;
  email: string;
  whatsapp?: string;
  password: string;
}

export class RegistrarUsuario {
  constructor(
    private readonly usuarios: UsuarioRepositorio,
    private readonly planes: PlanRepositorio,
    private readonly hasher: PasswordHasher,
  ) {}

  async ejecutar(entrada: EntradaRegistro): Promise<UsuarioPublico> {
    const email = entrada.email.trim().toLowerCase();

    const existente = await this.usuarios.buscarPorEmail(email);
    if (existente) throw new EmailYaRegistradoError();

    const passwordHash = await this.hasher.hashear(entrada.password);

    // SaaS por cuenta (17/07): la prueba gratis de 30 días arranca aquí
    // (Usuario.trial_inicio = ahora, por defecto en el schema) con el plan
    // de menor orden (Básico) — así el docente ya tiene un tope desde el día 1.
    const planPorDefecto = await this.planes.buscarPorDefecto();

    // D-02: toda cuenta auto-registrada es docente_estudiante;
    // el rol admin solo se asigna manualmente.
    const usuario = await this.usuarios.crear({
      nombres: entrada.nombres.trim(),
      apellidos: entrada.apellidos.trim(),
      email,
      passwordHash,
      whatsapp: entrada.whatsapp?.trim(),
      rol_nombre: 'docente_estudiante',
      plan_id: planPorDefecto?.id,
    });

    return aPublico(usuario);
  }
}
