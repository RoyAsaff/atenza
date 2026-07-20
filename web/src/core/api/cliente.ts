// Cliente HTTP único: agrega el token a cada petición y ante un 401
// (sesión cerrada por otro login — D-03 — o expirada) vuelve al login.

import axios from 'axios';
import { limpiarSesion, obtenerSesion } from '../auth/almacen-sesion';

// Vacío (default) = mismo origen ("/"), para cuando un proxy enruta /api
// al backend bajo el mismo dominio (ver web/src/vite-env.d.ts). Si web y
// backend quedan en dominios separados (ej. Railway), VITE_API_URL trae
// la URL absoluta del backend.
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/' });

// Los archivos subidos (QR de cobro, comprobantes) llegan del backend como
// ruta relativa ("/uploads/xxx.png"). En src/href eso se resuelve contra el
// origen de "web", no el de la API — funciona con baseURL "/" (mismo
// origen) pero rompe cuando VITE_API_URL apunta a un dominio aparte
// (Railway). Hay que anteponer la base absoluta a mano.
export function urlArchivo(rutaRelativa: string): string {
  return `${import.meta.env.VITE_API_URL || ''}${rutaRelativa}`;
}

api.interceptors.request.use((config) => {
  const sesion = obtenerSesion();
  if (sesion) config.headers.Authorization = `Bearer ${sesion.token}`;
  return config;
});

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      limpiarSesion();
      // "Rendir examen" (contexto estudiante) vive en /examen/*, con su
      // propio login — no mandarlo al login de docentes.
      const esExamen = window.location.pathname.startsWith('/examen');
      const destino = esExamen ? '/examen/login' : '/login';
      if (window.location.pathname !== destino) {
        window.location.href = `${destino}?motivo=sesion_terminada`;
      }
    }
    return Promise.reject(error);
  },
);

/** Extrae el mensaje de error que envía la API. */
export function mensajeDeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { mensaje?: string; error?: string; detalles?: { mensaje: string }[] }
      | undefined;
    if (data?.detalles?.length) return data.detalles.map((d) => d.mensaje).join('; ');
    if (data?.mensaje) return data.mensaje;
    if (data?.error) return data.error;
  }
  return 'Error de conexión con el servidor';
}
