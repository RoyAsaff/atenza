// Persistencia de la sesión — a diferencia de web (sessionStorage, D-03: no
// recordar entre ingresos, porque es un panel compartido), acá el criterio
// es el de mobile (SharedPreferences): esta máquina es del estudiante, así
// que la sesión sobrevive a cerrar y volver a abrir la app.
//
// @tauri-apps/plugin-store habla con Rust por IPC (todo async) — se
// mantiene un caché en memoria (`cache`) para que core/api/cliente.ts pueda
// leer el token de forma síncrona en el interceptor de axios, igual que
// hacía `obtenerSesion()` en web con sessionStorage. `inicializarSesion()`
// se llama una sola vez al arrancar, antes de montar la UI real.

import { load, Store } from '@tauri-apps/plugin-store';
import { SesionActiva } from '../tipos';

const ARCHIVO = 'sesion.json';
const CLAVE = 'atenza_sesion';

let storePromise: Promise<Store> | null = null;
function obtenerStore(): Promise<Store> {
  if (!storePromise) storePromise = load(ARCHIVO, { autoSave: false });
  return storePromise;
}

let cache: SesionActiva | null = null;

/** Llamar una sola vez al arrancar (antes de renderizar la app real) —
 * carga lo persistido a disco al caché en memoria. */
export async function inicializarSesion(): Promise<SesionActiva | null> {
  const store = await obtenerStore();
  cache = (await store.get<SesionActiva>(CLAVE)) ?? null;
  return cache;
}

/** Lectura síncrona del caché — usar solo después de `inicializarSesion()`. */
export function sesionActual(): SesionActiva | null {
  return cache;
}

export async function guardarSesion(sesion: SesionActiva): Promise<void> {
  cache = sesion;
  const store = await obtenerStore();
  await store.set(CLAVE, sesion);
  await store.save();
}

export async function limpiarSesion(): Promise<void> {
  cache = null;
  const store = await obtenerStore();
  await store.delete(CLAVE);
  await store.save();
}
