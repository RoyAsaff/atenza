import { Router } from 'express';
import { z } from 'zod';
import {
  enviarVerificacionEmail,
  iniciarSesion,
  registrarUsuario,
  restablecerPassword,
  sesionRepositorio,
  solicitarResetPassword,
  tokenService,
  usuarioRepositorio,
  verificarEmail,
} from '../dependencias';
import { crearAutenticar } from '../middlewares/autenticar';
import { aPublico } from '../../domain/entidades/usuario';

export const authRouter = Router();

// HU-02, Escenario 3: contraseña mínima de 8 caracteres
const esquemaRegistro = z.object({
  nombres: z.string().min(1, 'Nombres es obligatorio'),
  apellidos: z.string().min(1, 'Apellidos es obligatorio'),
  email: z.string().email('Correo inválido'),
  whatsapp: z.string().min(6).optional(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

const esquemaLogin = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
  // Opcional: la web lo omite (se deriva del rol); la app móvil envía 'estudiante'
  contexto: z.enum(['docente', 'estudiante', 'admin']).optional(),
});

// POST /api/auth/registro — HU-02 (+ envío de verificación, HU-04)
authRouter.post('/registro', async (req, res, next) => {
  try {
    const datos = esquemaRegistro.parse(req.body);
    const usuario = await registrarUsuario.ejecutar(datos);

    // HU-04 Esc. 1: se envía el correo pero NO bloquea el uso básico
    enviarVerificacionEmail.ejecutar(usuario.id).catch((e) => {
      console.error('[atenza-api] fallo al enviar verificación:', e);
    });

    res.status(201).json({ usuario });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/verificar-email — HU-04 Esc. 1
authRouter.post('/verificar-email', async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    await verificarEmail.ejecutar(token);
    res.json({ mensaje: 'Correo verificado' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/password/olvide — HU-04 Esc. 2 (paso 1)
authRouter.post('/password/olvide', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    await solicitarResetPassword.ejecutar(email);
    // Siempre 200: no revelamos si el correo existe
    res.json({ mensaje: 'Si el correo existe, recibirás un enlace de recuperación' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/password/restablecer — HU-04 Esc. 2 (paso 2)
authRouter.post('/password/restablecer', async (req, res, next) => {
  try {
    const datos = z
      .object({
        token: z.string().min(1),
        password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
      })
      .parse(req.body);
    await restablecerPassword.ejecutar({
      tokenPlano: datos.token,
      nuevaPassword: datos.password,
      ip: req.ip,
      dispositivo: req.headers['user-agent'],
    });
    res.json({ mensaje: 'Contraseña actualizada; vuelve a iniciar sesión' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login — HU-01
authRouter.post('/login', async (req, res, next) => {
  try {
    const datos = esquemaLogin.parse(req.body);
    const resultado = await iniciarSesion.ejecutar({
      ...datos,
      ip: req.ip,
      dispositivo: req.headers['user-agent'],
    });
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me — útil para probar el token y la sesión activa
const autenticar = crearAutenticar(tokenService, sesionRepositorio);

authRouter.get('/me', autenticar, async (req, res, next) => {
  try {
    const usuario = await usuarioRepositorio.buscarPorId(req.auth!.sub);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ contexto: req.auth!.contexto, usuario: aPublico(usuario) });
  } catch (error) {
    next(error);
  }
});
