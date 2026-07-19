// Composición de dependencias: aquí (y solo aquí) se conectan
// las implementaciones concretas con los casos de uso.

import { prisma } from '../infrastructure/db/prisma';
import { PrismaUsuarioRepositorio } from '../infrastructure/repositorios/prisma-usuario-repositorio';
import { PrismaSesionRepositorio } from '../infrastructure/repositorios/prisma-sesion-repositorio';
import { PrismaBitacoraRepositorio } from '../infrastructure/repositorios/prisma-bitacora-repositorio';
import { BcryptPasswordHasher } from '../infrastructure/seguridad/bcrypt-password-hasher';
import { JwtTokenService } from '../infrastructure/seguridad/jwt-token-service';
import { PrismaTokenUsuarioRepositorio } from '../infrastructure/repositorios/prisma-token-usuario-repositorio';
import { PrismaMateriaRepositorio } from '../infrastructure/repositorios/prisma-materia-repositorio';
import { ConsolaEmailService } from '../infrastructure/email/consola-email-service';
import { SmtpEmailService } from '../infrastructure/email/smtp-email-service';
import { ResendEmailService } from '../infrastructure/email/resend-email-service';
import { RegistrarUsuario } from '../application/auth/registrar-usuario';
import { IniciarSesion } from '../application/auth/iniciar-sesion';
import {
  EnviarVerificacionEmail,
  VerificarEmail,
} from '../application/auth/verificacion-email';
import {
  SolicitarResetPassword,
  RestablecerPassword,
} from '../application/auth/recuperar-password';
import { PrismaPlanRepositorio } from '../infrastructure/repositorios/prisma-plan-repositorio';
import { PrismaPagoRepositorio } from '../infrastructure/repositorios/prisma-pago-repositorio';
import { PrismaConfiguracionPagoRepositorio } from '../infrastructure/repositorios/prisma-configuracion-pago-repositorio';
import { ObtenerEstadoCuenta } from '../application/cuenta/obtener-estado-cuenta';
import { ElegirPlan } from '../application/cuenta/elegir-plan';
import { SubirComprobanteSuscripcion } from '../application/cuenta/subir-comprobante-suscripcion';
import { ResolverSuscripcion } from '../application/cuenta/resolver-suscripcion';
import { ExpirarComprobantesPendientes } from '../application/cuenta/expirar-comprobantes-pendientes';
import { CrearMateria } from '../application/materias/crear-materia';
import { crearVerificarCuentaActiva } from './middlewares/verificar-cuenta-activa';
import { PrismaInscripcionRepositorio } from '../infrastructure/repositorios/prisma-inscripcion-repositorio';
import { UnirseAMateria } from '../application/inscripciones/unirse-materia';
import { GestionarCodigoMateria } from '../application/inscripciones/gestionar-codigo';
import { RetirarEstudiante, VerNomina } from '../application/inscripciones/nomina';
import { DeslindarseDeMateria } from '../application/inscripciones/deslindarse-materia';
import { PrismaClaseRepositorio } from '../infrastructure/repositorios/prisma-clase-repositorio';
import {
  ActualizarClase,
  CrearClase,
  EliminarClase,
  GenerarCalendario,
  VerClases,
} from '../application/clases/gestionar-clases';
import { PrismaAsistenciaRepositorio } from '../infrastructure/repositorios/prisma-asistencia-repositorio';
import {
  GuardarAsistencia,
  VerConsolidadoAsistencia,
  VerListaAsistencia,
  VerMiAsistencia,
} from '../application/asistencias/gestionar-asistencia';
import { PrismaEvaluacionRepositorio } from '../infrastructure/repositorios/prisma-evaluacion-repositorio';
import {
  ActualizarEvaluacion,
  ActualizarPregunta,
  AgregarPregunta,
  CrearEvaluacion,
  DemostracionEvaluacion,
  EliminarPregunta,
  GuardarEvaluacion,
  ReordenarPreguntas,
  SubirImagenPregunta,
  VerEvaluacion,
  VerEvaluaciones,
  VerEvaluacionesMateria,
} from '../application/evaluaciones/gestionar-evaluaciones';
import { PrismaIntentoRepositorio } from '../infrastructure/repositorios/prisma-intento-repositorio';
import { SocketIoEmisor } from '../infrastructure/realtime/socketio-emisor';
import {
  CancelarEvaluacion,
  LanzarEvaluacion,
  PausarEvaluacion,
  PausarIntento,
  ReactivarEvaluacion,
  ReactivarIntento,
  VerMonitoreo,
} from '../application/evaluaciones/gestionar-examen';
import {
  FinalizarIntento,
  GuardarRespuesta,
  ReportarIncidente,
  VerIntentoActual,
} from '../application/intentos/rendir-examen';
import {
  PublicarNotas,
  VerDetalleIntento,
  VerMiDetalleIntento,
  VerMisNotas,
  VerResultados,
} from '../application/evaluaciones/ver-resultados';
import {
  ExportarCentralizador,
  VerCentralizador,
} from '../application/materias/ver-centralizador';
import {
  ConfirmarImportacionPreguntas,
  PrevisualizarImportacionPreguntas,
} from '../application/evaluaciones/importar-preguntas';
import { extraerHtmlDocx } from '../infrastructure/parsers/extraer-html-docx';

/** Convierte duraciones tipo "8h", "30d", "45m" a segundos. */
export function duracionASegundos(duracion: string): number {
  const match = /^(\d+)([smhd])$/.exec(duracion.trim());
  if (!match) throw new Error(`Duración inválida: "${duracion}" (usa 30m, 8h, 30d)`);
  const cantidad = Number(match[1]);
  const factor = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return cantidad * factor;
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('Falta JWT_SECRET en el .env');

// URL base para los enlaces de los correos (frontend futuro)
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

export const usuarioRepositorio = new PrismaUsuarioRepositorio(prisma);
export const sesionRepositorio = new PrismaSesionRepositorio(prisma);
export const bitacoraRepositorio = new PrismaBitacoraRepositorio(prisma);
export const tokenUsuarioRepositorio = new PrismaTokenUsuarioRepositorio(prisma);
export const materiaRepositorio = new PrismaMateriaRepositorio(prisma);
export const passwordHasher = new BcryptPasswordHasher();
export const tokenService = new JwtTokenService(JWT_SECRET);
// Prioridad: RESEND_API_KEY (API HTTP — funciona en plataformas que
// bloquean SMTP saliente, como Railway en plan Hobby) > SMTP_HOST (VPS/
// Coolify, sin esa restricción) > consola (dev local, sin nada cargado).
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Atenza <no-responde@atenza.com>';
export const emailService = process.env.RESEND_API_KEY
  ? new ResendEmailService(process.env.RESEND_API_KEY, EMAIL_FROM)
  : process.env.SMTP_HOST
    ? new SmtpEmailService({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        usuario: process.env.SMTP_USER ?? '',
        password: process.env.SMTP_PASSWORD ?? '',
        remitente: EMAIL_FROM,
      })
    : new ConsolaEmailService();

// SaaS por cuenta (17/07): declarados antes de registrarUsuario porque el
// registro ya necesita el plan por defecto (prueba gratis).
export const planRepositorio = new PrismaPlanRepositorio(prisma);
export const pagoRepositorio = new PrismaPagoRepositorio(prisma);
export const configuracionPagoRepositorio = new PrismaConfiguracionPagoRepositorio(prisma);
export const inscripcionRepositorio = new PrismaInscripcionRepositorio(prisma);

export const registrarUsuario = new RegistrarUsuario(
  usuarioRepositorio,
  planRepositorio,
  passwordHasher,
);

export const iniciarSesion = new IniciarSesion(
  usuarioRepositorio,
  sesionRepositorio,
  bitacoraRepositorio,
  passwordHasher,
  tokenService,
  {
    docenteSegundos: duracionASegundos(process.env.JWT_EXPIRES_DOCENTE ?? '8h'),
    estudianteSegundos: duracionASegundos(process.env.JWT_EXPIRES_ESTUDIANTE ?? '30d'),
  },
);

// HU-04
export const enviarVerificacionEmail = new EnviarVerificacionEmail(
  usuarioRepositorio,
  tokenUsuarioRepositorio,
  emailService,
  APP_URL,
);
export const verificarEmail = new VerificarEmail(
  usuarioRepositorio,
  tokenUsuarioRepositorio,
);
export const solicitarResetPassword = new SolicitarResetPassword(
  usuarioRepositorio,
  tokenUsuarioRepositorio,
  emailService,
  APP_URL,
);
export const restablecerPassword = new RestablecerPassword(
  usuarioRepositorio,
  tokenUsuarioRepositorio,
  sesionRepositorio,
  bitacoraRepositorio,
  passwordHasher,
);

// SaaS por cuenta (17/07): reemplaza a E2 (pago/precio por materia)
export const estadoCuenta = new ObtenerEstadoCuenta(
  usuarioRepositorio,
  planRepositorio,
  pagoRepositorio,
  inscripcionRepositorio,
);
export const elegirPlan = new ElegirPlan(
  pagoRepositorio,
  planRepositorio,
  configuracionPagoRepositorio,
  bitacoraRepositorio,
);
export const subirComprobanteSuscripcion = new SubirComprobanteSuscripcion(
  pagoRepositorio,
  bitacoraRepositorio,
);
export const resolverSuscripcion = new ResolverSuscripcion(
  pagoRepositorio,
  usuarioRepositorio,
  bitacoraRepositorio,
);
export const expirarComprobantesPendientes = new ExpirarComprobantesPendientes(
  pagoRepositorio,
  bitacoraRepositorio,
);
export const cuentaActiva = crearVerificarCuentaActiva(estadoCuenta);
export const crearMateria = new CrearMateria(materiaRepositorio, bitacoraRepositorio);

// E3
export const unirseAMateria = new UnirseAMateria(
  inscripcionRepositorio,
  materiaRepositorio,
  bitacoraRepositorio,
  estadoCuenta,
);
export const gestionarCodigoMateria = new GestionarCodigoMateria(
  materiaRepositorio,
  bitacoraRepositorio,
);
export const verNomina = new VerNomina(inscripcionRepositorio, materiaRepositorio);
export const retirarEstudiante = new RetirarEstudiante(
  inscripcionRepositorio,
  materiaRepositorio,
  bitacoraRepositorio,
);
export const deslindarseDeMateria = new DeslindarseDeMateria(
  inscripcionRepositorio,
  bitacoraRepositorio,
);

// E4
export const claseRepositorio = new PrismaClaseRepositorio(prisma);

export const verClases = new VerClases(
  claseRepositorio,
  materiaRepositorio,
  inscripcionRepositorio,
);
export const crearClase = new CrearClase(
  claseRepositorio,
  materiaRepositorio,
  bitacoraRepositorio,
);
export const generarCalendario = new GenerarCalendario(
  claseRepositorio,
  materiaRepositorio,
  bitacoraRepositorio,
);
export const actualizarClase = new ActualizarClase(
  claseRepositorio,
  materiaRepositorio,
  bitacoraRepositorio,
);
export const eliminarClase = new EliminarClase(
  claseRepositorio,
  materiaRepositorio,
  bitacoraRepositorio,
);

// E5
export const asistenciaRepositorio = new PrismaAsistenciaRepositorio(prisma);

export const verListaAsistencia = new VerListaAsistencia(
  claseRepositorio,
  materiaRepositorio,
  inscripcionRepositorio,
  asistenciaRepositorio,
);
export const guardarAsistencia = new GuardarAsistencia(
  asistenciaRepositorio,
  claseRepositorio,
  materiaRepositorio,
  inscripcionRepositorio,
  bitacoraRepositorio,
);
export const verConsolidadoAsistencia = new VerConsolidadoAsistencia(
  materiaRepositorio,
  inscripcionRepositorio,
  asistenciaRepositorio,
);
export const verMiAsistencia = new VerMiAsistencia(
  materiaRepositorio,
  inscripcionRepositorio,
  claseRepositorio,
  asistenciaRepositorio,
);

// E6
export const evaluacionRepositorio = new PrismaEvaluacionRepositorio(prisma);

export const crearEvaluacion = new CrearEvaluacion(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  bitacoraRepositorio,
);
export const verEvaluaciones = new VerEvaluaciones(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
);
export const verEvaluacion = new VerEvaluacion(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
);
export const verEvaluacionesMateria = new VerEvaluacionesMateria(
  evaluacionRepositorio,
  materiaRepositorio,
);
export const actualizarEvaluacion = new ActualizarEvaluacion(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  bitacoraRepositorio,
);
export const agregarPregunta = new AgregarPregunta(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  bitacoraRepositorio,
);
export const actualizarPregunta = new ActualizarPregunta(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  bitacoraRepositorio,
);
export const eliminarPregunta = new EliminarPregunta(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  bitacoraRepositorio,
);
export const reordenarPreguntas = new ReordenarPreguntas(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  bitacoraRepositorio,
);
export const subirImagenPregunta = new SubirImagenPregunta(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  bitacoraRepositorio,
);
export const guardarEvaluacion = new GuardarEvaluacion(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  bitacoraRepositorio,
);
export const demostracionEvaluacion = new DemostracionEvaluacion(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
);
export const previsualizarImportacionPreguntas = new PrevisualizarImportacionPreguntas(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  extraerHtmlDocx,
);
export const confirmarImportacionPreguntas = new ConfirmarImportacionPreguntas(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  bitacoraRepositorio,
);

// E7 — ejecución en vivo. socketIoEmisor se instancia sin `io`; index.ts
// lo conecta al servidor Socket.IO real una vez que existe el http.Server.
export const intentoRepositorio = new PrismaIntentoRepositorio(prisma);
export const socketIoEmisor = new SocketIoEmisor();

export const lanzarEvaluacion = new LanzarEvaluacion(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  asistenciaRepositorio,
  intentoRepositorio,
  bitacoraRepositorio,
  socketIoEmisor,
);
export const verMonitoreo = new VerMonitoreo(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  intentoRepositorio,
  bitacoraRepositorio,
  socketIoEmisor,
);
export const pausarEvaluacion = new PausarEvaluacion(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  intentoRepositorio,
  bitacoraRepositorio,
  socketIoEmisor,
);
export const reactivarEvaluacion = new ReactivarEvaluacion(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  intentoRepositorio,
  bitacoraRepositorio,
  socketIoEmisor,
);
export const cancelarEvaluacion = new CancelarEvaluacion(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  intentoRepositorio,
  bitacoraRepositorio,
  socketIoEmisor,
);
export const pausarIntento = new PausarIntento(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  intentoRepositorio,
  bitacoraRepositorio,
  socketIoEmisor,
);
export const reactivarIntento = new ReactivarIntento(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  intentoRepositorio,
  bitacoraRepositorio,
  socketIoEmisor,
);

export const verIntentoActual = new VerIntentoActual(intentoRepositorio, evaluacionRepositorio);
export const guardarRespuesta = new GuardarRespuesta(
  intentoRepositorio,
  evaluacionRepositorio,
  socketIoEmisor,
);
export const reportarIncidente = new ReportarIncidente(
  intentoRepositorio,
  bitacoraRepositorio,
  socketIoEmisor,
);
export const finalizarIntento = new FinalizarIntento(
  intentoRepositorio,
  bitacoraRepositorio,
  socketIoEmisor,
);

// E8 — resultados, notas y centralizador
export const verResultados = new VerResultados(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  intentoRepositorio,
  bitacoraRepositorio,
  socketIoEmisor,
);
export const verDetalleIntento = new VerDetalleIntento(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  intentoRepositorio,
);
export const publicarNotas = new PublicarNotas(
  evaluacionRepositorio,
  claseRepositorio,
  materiaRepositorio,
  intentoRepositorio,
  bitacoraRepositorio,
);
export const verMisNotas = new VerMisNotas(
  materiaRepositorio,
  inscripcionRepositorio,
  evaluacionRepositorio,
  intentoRepositorio,
);
export const verMiDetalleIntento = new VerMiDetalleIntento(
  materiaRepositorio,
  inscripcionRepositorio,
  evaluacionRepositorio,
  intentoRepositorio,
);
export const verCentralizador = new VerCentralizador(
  materiaRepositorio,
  evaluacionRepositorio,
  inscripcionRepositorio,
  intentoRepositorio,
);
export const exportarCentralizador = new ExportarCentralizador(verCentralizador);
