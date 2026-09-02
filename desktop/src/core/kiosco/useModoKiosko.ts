// Modo kiosko del examen — HU-21-equivalente de escritorio (mismo
// principio que mobile/RendirExamenPage web: DETECTAR y AVISAR, nunca
// bloquear solo; el docente decide, ver POST .../incidente). Alcance v1
// según el plan (lexical-baking-acorn.md): sin hooks nativos de Windows
// para bloquear Alt+Tab/tecla Windows — eso queda fuera a propósito.
//
// Tres incidentes, los mismos que el backend admite para código
// (TipoIncidenteCodigo):
//   - perdida_foco: la ventana deja de tener foco del SO (onFocusChanged).
//   - ventana_minimizada: se minimiza (onResized + isMinimized()).
//   - intento_cierre: el estudiante intenta cerrar la ventana — se
//     bloquea con preventDefault(), nunca se cierra sola.

import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { TipoIncidenteCodigo } from '../tipos';

export function useModoKiosko(activo: boolean, onIncidente: (tipo: TipoIncidenteCodigo) => void) {
  // La entrada a fullscreen no depende de un gesto del usuario acá (a
  // diferencia de la Fullscreen API del navegador) — es una llamada nativa
  // de ventana, se puede disparar desde un efecto.
  const onIncidenteRef = useRef(onIncidente);
  onIncidenteRef.current = onIncidente;

  useEffect(() => {
    if (!activo) return;
    const win = getCurrentWindow();
    let minimizada = false;
    const desuscribir: (() => void)[] = [];

    win.setFullscreen(true).catch(() => {});

    win.onFocusChanged(({ payload: enfocada }) => {
      if (!enfocada) onIncidenteRef.current('perdida_foco');
    }).then((f) => desuscribir.push(f));

    win.onResized(async () => {
      const ahora = await win.isMinimized().catch(() => false);
      if (ahora && !minimizada) onIncidenteRef.current('ventana_minimizada');
      minimizada = ahora;
    }).then((f) => desuscribir.push(f));

    win.onCloseRequested((evento) => {
      evento.preventDefault();
      onIncidenteRef.current('intento_cierre');
    }).then((f) => desuscribir.push(f));

    return () => {
      desuscribir.forEach((f) => f());
    };
  }, [activo]);

  useEffect(() => {
    if (activo) return;
    // Al terminar el examen (enviado/cancelado), suelta el fullscreen —
    // el `return` del efecto de arriba ya sacó los listeners.
    getCurrentWindow().setFullscreen(false).catch(() => {});
  }, [activo]);
}
