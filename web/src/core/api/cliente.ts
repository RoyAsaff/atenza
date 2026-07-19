// Cliente HTTP único: agrega el token a cada petición y ante un 401
// (sesión cerrada por otro login — D-03 — o expirada) vuelve al login.

import axios from 'axios';
import { limpiarSesion, obtenerSesion } from '../auth/almacen-sesion';

export const api = axios.create({ baseURL: '/' });

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
