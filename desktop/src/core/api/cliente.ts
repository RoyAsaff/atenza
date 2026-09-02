// Cliente HTTP único — calcado de web/src/core/api/cliente.ts. A diferencia
// de web, acá NO hay "mismo origen": la app de escritorio no tiene origen
// propio, así que VITE_API_URL (quemado en build time, ver .env/.env.
// development) siempre es obligatorio.

import axios from 'axios';
import { limpiarSesion, sesionActual } from '../auth/sesion-store';

export const API_URL = import.meta.env.VITE_API_URL;

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const sesion = sesionActual();
  if (sesion) config.headers.Authorization = `Bearer ${sesion.token}`;
  return config;
});

// Evento propio en vez de un redirect a `/login` (no hay router de
// páginas separadas acá): AuthContext escucha esto y limpia el estado,
// App.tsx cae solo a LoginPage al ver `sesion === null`.
const EVENTO_SESION_TERMINADA = 'atenza:sesion-terminada';

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      limpiarSesion();
      window.dispatchEvent(new Event(EVENTO_SESION_TERMINADA));
    }
    return Promise.reject(error);
  },
);

export function alTerminarSesion(callback: () => void): () => void {
  window.addEventListener(EVENTO_SESION_TERMINADA, callback);
  return () => window.removeEventListener(EVENTO_SESION_TERMINADA, callback);
}

/** Extrae el mensaje de error que envía la API — idéntico a web. */
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
