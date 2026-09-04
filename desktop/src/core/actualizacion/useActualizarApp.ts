// Actualización automática — corre una sola vez al arrancar la app (no hay
// polling periódico: es software de examen, no necesita más que revisar al
// abrir). Descarga siempre que haya una versión nueva, pero solo instala y
// reinicia si en ESE momento no hay un examen en curso (ver
// estadoExamen.ts) — si el estudiante arrancó un examen mientras se
// descargaba, la actualización se descarta y se vuelve a intentar en el
// próximo arranque en frío de la app, nunca interrumpe un intento activo.
//
// Cualquier falla (sin internet, servidor de updates caído, etc.) se traga
// en silencio: nunca debe bloquear ni demorar el login/uso de la app.

import { useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { hayExamenActivo } from './estadoExamen';

export function useActualizarApp() {
  useEffect(() => {
    (async () => {
      try {
        const actualizacion = await check();
        if (!actualizacion) return;

        await actualizacion.download();
        if (hayExamenActivo()) return;

        await actualizacion.install();
        await relaunch();
      } catch {
        // Sin conexión / servidor de updates caído — se reintenta solo en
        // el próximo arranque, no hace falta avisar nada acá.
      }
    })();
  }, []);
}
