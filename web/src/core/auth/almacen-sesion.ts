// D-03: el panel web (docente/admin) NO recuerda la sesión entre ingresos.
// sessionStorage se borra al cerrar la pestaña, cumpliendo
// "credenciales en cada ingreso".

import { SesionActiva } from '../tipos';

const CLAVE = 'atenza_sesion';

export function obtenerSesion(): SesionActiva | null {
  const crudo = sessionStorage.getItem(CLAVE);
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as SesionActiva;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion: SesionActiva): void {
  sessionStorage.setItem(CLAVE, JSON.stringify(sesion));
}

export function limpiarSesion(): void {
  sessionStorage.removeItem(CLAVE);
}
