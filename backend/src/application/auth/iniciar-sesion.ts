// HU-01 · Inicio de sesión y políticas de sesión por contexto (D-03)
// - Contexto docente (y admin): credenciales por ingreso, sesión única;
//   un nuevo login cierra la anterior y lo registra en auditoría (Escenario 3).
// - Contexto estudiante: sesión persistente (Escenario 4).

import { randomUUID } from 'crypto';
import { UsuarioPublico, aPublico } from '../../domain/entidades/usuario';
import { ContextoSesion } from '../../domain/entidades/sesion';
import {
  CredencialesInvalidasError,
  CuentaDesactivadaError,
  NoAutorizadoError,
} from '../../domain/errores';
import { UsuarioRepositorio } from '../../domain/repositorios/usuario-repositorio';
import { SesionRepositorio } from '../../domain/repositorios/sesion-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { PasswordHasher } from '../../domain/servicios/password-hasher';
import { TokenService } from '../../domain/servicios/token-service';

export interface EntradaLogin {
  email: string;
  password: string;
  /**
   * Opcional: si no se envía, se deriva del rol (admin → admin; resto → docente).
   * La app móvil de estudiantes lo envía explícito ('estudiante').
   */
  contexto?: ContextoSesion;
  ip?: string;
  dispositivo?: string;
}

export interface ResultadoLogin {
  token: string;
  expira_en: Date;
  contexto: ContextoSesion;
  usuario: UsuarioPublico;
}

export interface DuracionesSesion {
  docenteSegundos: number; // también aplica a admin
  estudianteSegundos: number;
}

export class IniciarSesion {
  constructor(
    private readonly usuarios: UsuarioRepositorio,
    private readonly sesiones: SesionRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly duraciones: DuracionesSesion,
  ) {}

  async ejecutar(entrada: EntradaLogin): Promise<ResultadoLogin> {
    const email = entrada.email.trim().toLowerCase();
    const usuario = await this.usuarios.buscarPorEmail(email);

    // Mismo error para "no existe" y "password mal": no revelar cuál falló
    if (!usuario) throw new CredencialesInvalidasError();
    const passwordOk = await this.hasher.comparar(entrada.password, usuario.password);
    if (!passwordOk) throw new CredencialesInvalidasError();
    if (!usuario.activo) throw new CuentaDesactivadaError();

    // Contexto derivado del rol si no viene explícito (web);
    // la app móvil envía 'estudiante' explícitamente.
    const contexto: ContextoSesion =
      entrada.contexto ?? (usuario.rol_nombre === 'admin' ? 'admin' : 'docente');

    // Solo una cuenta con rol admin puede entrar en contexto admin
    if (contexto === 'admin' && usuario.rol_nombre !== 'admin') {
      throw new NoAutorizadoError('La cuenta no tiene rol de administrador');
    }

    // D-03: sesión única en contextos sensibles (docente y admin)
    if (contexto === 'docente' || contexto === 'admin') {
      const cerradas = await this.sesiones.cerrarActivas(
        usuario.id,
        contexto,
        'reemplazada_por_nuevo_login',
      );
      for (const sesion of cerradas) {
        await this.bitacora.registrar({
          usuario_id: usuario.id,
          rol_contexto: contexto,
          accion: 'cierre_sesion_forzado',
          entidad: 'sesion',
          entidad_id: String(sesion.id),
          valor_anterior: { jti: sesion.jti, creada_en: sesion.creada_en },
          valor_nuevo: { motivo: 'reemplazada_por_nuevo_login' },
          ip: entrada.ip,
          dispositivo: entrada.dispositivo,
        });
      }
    }

    const duracionSegundos =
      contexto === 'estudiante'
        ? this.duraciones.estudianteSegundos
        : this.duraciones.docenteSegundos;

    const jti = randomUUID();
    const expira_en = new Date(Date.now() + duracionSegundos * 1000);

    const sesion = await this.sesiones.crear({
      usuario_id: usuario.id,
      contexto,
      jti,
      dispositivo: entrada.dispositivo,
      ip: entrada.ip,
      expira_en,
    });

    const token = this.tokens.firmar({ sub: usuario.id, contexto, jti }, duracionSegundos);

    // HU-29: los inicios de sesión son evento sensible
    await this.bitacora.registrar({
      usuario_id: usuario.id,
      rol_contexto: contexto,
      accion: 'login',
      entidad: 'sesion',
      entidad_id: String(sesion.id),
      valor_nuevo: { jti, contexto, expira_en },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return { token, expira_en, contexto, usuario: aPublico(usuario) };
  }
}
