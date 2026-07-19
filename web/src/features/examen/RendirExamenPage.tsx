// "Rendir examen" desde la web — equivalente al modo kiosco de la app móvil
// (mobile/lib/features/examen/presentation/examen_page.dart), para
// estudiantes sin Android (p. ej. solo tienen iPhone).
//
// No existe forma de bloquear capturas de pantalla en un navegador — eso
// se descarta a propósito. Lo que sí se implementa, todo con soporte
// confirmado incluso en iOS Safari moderno:
//   - Pantalla completa (Fullscreen API) + pantalla siempre encendida
//     (Screen Wake Lock API), ambas disparadas por el gesto de "Comenzar".
//   - Reporte de incidente real al cambiar de pestaña/minimizar
//     (Page Visibility API) — mismo evento que ya reporta el móvil.
//   - Aviso del navegador al intentar cerrar/recargar la pestaña.
//   - Trampa del botón "atrás".
//
// A diferencia del móvil (donde /api/intentos/actual deja de devolver el
// intento en cuanto termina, y la pantalla de cierre nunca llegaba a
// mostrarse — bug que se corrigió ahí saliendo del kiosco en dispose()),
// acá las pantallas de "enviado" y "cancelado" son estado LOCAL de React,
// no dependen de que el servidor siga devolviendo el intento.

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ClipboardX,
  Lock,
  PauseCircle,
  ShieldAlert,
} from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { obtenerSocket } from '../../core/realtime/socket';
import { useAuth } from '../../core/auth/AuthContext';
import { IntentoParaRendir } from '../../core/tipos';
import { Button, Card, CardBody } from '../../core/ui/ui';

/** navigator.wakeLock existe en el tipo de lib.dom aunque el navegador no
 * lo soporte en runtime (Wake Lock API es reciente) — por eso siempre va
 * envuelto en try/catch, nunca se asume presente de verdad. */
async function pedirWakeLock(): Promise<WakeLockSentinel | null> {
  try {
    return await navigator.wakeLock.request('screen');
  } catch {
    return null;
  }
}

const EVENTOS_SOCKET_REFRESCAR = [
  'evaluacion-lanzada',
  'examen-pausado',
  'examen-reactivado',
] as const;

// ── Pantallas auxiliares ───────────────────────────────────────────

function PantallaSinExamen({ onSalir }: { onSalir: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardBody className="p-8 text-center">
          <ClipboardX size={40} className="mx-auto mb-3 text-text-disabled" />
          <h1 className="text-lg font-bold text-text">No tienes ningún examen activo</h1>
          <p className="mt-1 mb-6 text-sm text-text-secondary">
            Cuando tu docente lance un examen, aparecerá acá automáticamente — deja esta
            pestaña abierta.
          </p>
          <Button variante="secondary" onClick={onSalir}>
            Cerrar sesión
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

function PantallaPausada() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary-900 px-6 text-center text-white">
      <PauseCircle size={56} className="mb-4 text-accent-400" />
      <h1 className="text-lg font-bold">El docente pausó tu examen</h1>
      <p className="mt-2 max-w-sm text-sm text-white/70">
        Espera: continuarás exactamente donde quedaste en cuanto te reactive.
      </p>
    </div>
  );
}

function PantallaCancelado({ onAceptar }: { onAceptar: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary-900 px-6 text-center text-white">
      <ShieldAlert size={56} className="mb-4 text-accent-400" />
      <h1 className="text-lg font-bold">El docente canceló el examen</h1>
      <p className="mt-2 max-w-sm text-sm text-white/70">
        Tus respuestas guardadas hasta el momento quedaron registradas.
      </p>
      <Button variante="accent" className="mt-6" onClick={onAceptar}>
        Aceptar
      </Button>
    </div>
  );
}

function PantallaEnviado({ onAceptar }: { onAceptar: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary-900 px-6 text-center text-white">
      <CheckCircle2 size={56} className="mb-4 text-secondary-400" />
      <h1 className="text-lg font-bold">Examen enviado</h1>
      <p className="mt-2 text-sm text-white/70">Tu examen se envió correctamente.</p>
      <Button variante="accent" className="mt-6" onClick={onAceptar}>
        Aceptar
      </Button>
    </div>
  );
}

function PantallaComenzar({
  intento,
  onComenzar,
}: {
  intento: IntentoParaRendir;
  onComenzar: () => void;
}) {
  const n = intento.preguntas.length;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary-900 px-6 text-center text-white">
      <Lock size={40} className="mb-4 text-white/60" />
      <h1 className="text-xl font-extrabold">{intento.tema}</h1>
      <p className="mt-2 text-sm text-white/70">
        {n} pregunta{n === 1 ? '' : 's'} · Nota total: {intento.nota}
      </p>
      <p className="mt-4 max-w-sm text-sm text-white/70">
        Al comenzar, la pantalla pasará a modo completo y se mantendrá encendida. No cambies de
        pestaña ni salgas del navegador: quedará registrado como incidente.
      </p>
      <Button variante="accent" className="mt-6" onClick={onComenzar}>
        Comenzar examen
      </Button>
    </div>
  );
}

function PantallaCuenta({ numero }: { numero: number }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary-900 text-white">
      <p className="mb-6 text-sm uppercase tracking-widest text-white/50">Comenzando…</p>
      <div className="relative flex h-40 w-40 items-center justify-center">
        <span
          key={`anillo-${numero}`}
          className="absolute inset-0 rounded-full bg-accent-500/25"
          style={{ animation: 'atenza-cuenta-anillo 1s ease-out' }}
        />
        <span
          key={`numero-${numero}`}
          className="text-7xl font-extrabold tabular-nums"
          style={{ animation: 'atenza-cuenta-numero 1s ease-out' }}
        >
          {numero}
        </span>
      </div>
    </div>
  );
}

function formatearRestante(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = String(Math.floor((segundos % 3600) / 60)).padStart(2, '0');
  const s = String(segundos % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

// ── Vista principal de preguntas ───────────────────────────────────

function VistaPreguntas({
  intento,
  respuestas,
  onElegir,
  restante,
  onEnviar,
  enviando,
  error,
}: {
  intento: IntentoParaRendir;
  respuestas: Record<number, number | null>;
  onElegir: (preguntaId: number, opcionId: number) => void;
  restante: number | null;
  onEnviar: () => void;
  enviando: boolean;
  error: string;
}) {
  const [indice, setIndice] = useState(0);
  const total = intento.preguntas.length;
  const pregunta = intento.preguntas[Math.min(indice, total - 1)];
  const respondidas = Object.values(respuestas).filter((v) => v != null).length;
  const esUltima = indice === total - 1;

  return (
    <div className="min-h-screen select-none bg-primary-900 px-4 py-6 text-white sm:px-8 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <h1 className="truncate text-lg font-extrabold">{intento.tema}</h1>
          {restante !== null && (
            <span
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold ${
                restante < 60 ? 'bg-red-600' : 'bg-white/10'
              }`}
            >
              {formatearRestante(restante)}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-white/60">
          Pregunta {indice + 1} de {total} · {respondidas} respondidas
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-primary-300 transition-all"
            style={{ width: `${((indice + 1) / total) * 100}%` }}
          />
        </div>

        <div className="mt-6 rounded-2xl bg-white/[0.06] p-5">
          <p className="text-base font-semibold">{pregunta.pregunta}</p>
          {pregunta.url_imagen && (
            <img
              src={pregunta.url_imagen}
              alt=""
              className="mt-3 max-h-52 w-full rounded-xl border border-white/10 object-contain"
            />
          )}

          <div className="mt-4 space-y-3">
            {pregunta.opciones.map((opcion, i) => {
              const letra = String.fromCharCode(65 + i);
              const elegida = respuestas[pregunta.id] === opcion.id;
              return (
                <button
                  key={opcion.id}
                  type="button"
                  onClick={() => onElegir(pregunta.id, opcion.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition ${
                    elegida
                      ? 'border-primary-300 bg-primary-600'
                      : 'border-white/30 bg-white/[0.09] hover:bg-white/[0.14]'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                      elegida ? 'bg-white text-primary-700' : 'bg-white/15 text-white/80'
                    }`}
                  >
                    {letra}
                  </span>
                  <span className={elegida ? 'font-bold' : 'font-normal'}>{opcion.texto}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

        <div className="mt-6 flex gap-3">
          {indice > 0 && (
            <Button variante="secondary" className="flex-1" onClick={() => setIndice((i) => i - 1)}>
              Anterior
            </Button>
          )}
          <Button
            variante="accent"
            className="flex-1"
            disabled={enviando}
            onClick={() => (esUltima ? onEnviar() : setIndice((i) => i + 1))}
          >
            {esUltima ? (enviando ? 'Enviando…' : 'Enviar examen') : 'Siguiente'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────

export function RendirExamenPage() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [respuestas, setRespuestas] = useState<Record<number, number | null>>({});
  const [contando, setContando] = useState(false);
  const [numeroCuenta, setNumeroCuenta] = useState(5);
  const [comenzado, setComenzado] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [cancelado, setCancelado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [restante, setRestante] = useState<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const { data: intento, refetch } = useQuery({
    queryKey: ['intento-actual'],
    queryFn: async () => {
      const { data } = await api.get<{ intento: IntentoParaRendir | null }>(
        '/api/intentos/actual',
      );
      return data.intento;
    },
    refetchInterval: 15000, // respaldo si el socket se cae un momento
    enabled: !enviado, // ya se confirmó localmente; no hace falta seguir consultando
  });

  // Sincroniza las respuestas locales cuando aparece un intento nuevo/reanudado.
  useEffect(() => {
    if (!intento) return;
    const iniciales: Record<number, number | null> = {};
    for (const p of intento.preguntas) iniciales[p.id] = p.opcion_elegida_id;
    setRespuestas(iniciales);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intento?.intento_id]);

  // Socket: mismos eventos que ya escucha el móvil.
  useEffect(() => {
    const socket = obtenerSocket();
    const refrescar = () => queryClient.invalidateQueries({ queryKey: ['intento-actual'] });
    const alCancelado = () => {
      setCancelado(true);
      refrescar();
    };
    EVENTOS_SOCKET_REFRESCAR.forEach((e) => socket.on(e, refrescar));
    socket.on('examen-cancelado', alCancelado);
    return () => {
      EVENTOS_SOCKET_REFRESCAR.forEach((e) => socket.off(e, refrescar));
      socket.off('examen-cancelado', alCancelado);
    };
  }, [queryClient]);

  // Cuenta regresiva de arranque (5→1) antes de mostrar la primera pregunta.
  useEffect(() => {
    if (!contando) return;
    if (numeroCuenta <= 0) {
      setContando(false);
      setComenzado(true);
      return;
    }
    const id = setTimeout(() => setNumeroCuenta((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [contando, numeroCuenta]);

  // Cuenta regresiva del tiempo límite, si lo hay.
  useEffect(() => {
    if (!comenzado || !intento?.fecha_limite) return;
    const limite = new Date(intento.fecha_limite).getTime();
    function tick() {
      const rest = Math.max(0, Math.round((limite - Date.now()) / 1000));
      setRestante(rest);
      // El servidor autofinaliza al vencer (HU-24 Esc. 1); solo refrescamos
      // para reflejarlo — no hay un estado intermedio que esperar.
      if (rest === 0) refetch();
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [comenzado, intento?.fecha_limite, refetch]);

  // Medidas de seguridad del navegador: desde que se pide fullscreen (ya
  // sea durante la cuenta regresiva o durante el examen en sí).
  useEffect(() => {
    if (!(contando || comenzado) || !intento) return;
    const intentoId = intento.intento_id;

    function reportarIncidente() {
      api.post(`/api/intentos/${intentoId}/incidente`, { tipo: 'salida_pantalla' }).catch(() => {});
    }

    async function alVisibilityChange() {
      if (document.hidden) {
        reportarIncidente();
      } else {
        wakeLockRef.current = await pedirWakeLock();
      }
    }

    // "visibilitychange" NO se dispara al salir de pantalla completa (Esc):
    // la pestaña sigue visible, solo cambia la presentación. Hace falta
    // escuchar "fullscreenchange" aparte para detectar esa salida.
    function alFullscreenChange() {
      if (!document.fullscreenElement) {
        reportarIncidente();
      }
    }

    function alBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }

    function alContextMenu(e: MouseEvent) {
      e.preventDefault();
    }

    // La ventana pierde el foco del sistema operativo: cubre clics fuera de
    // la ventana (otra app, o un segundo monitor) que "visibilitychange" no
    // detecta porque la pestaña sigue técnicamente visible.
    function alBlur() {
      reportarIncidente();
    }

    // Trampa del botón "atrás": vuelve a empujar el mismo estado.
    history.pushState(null, '', window.location.href);
    function alPopState() {
      history.pushState(null, '', window.location.href);
    }

    document.addEventListener('visibilitychange', alVisibilityChange);
    document.addEventListener('fullscreenchange', alFullscreenChange);
    window.addEventListener('beforeunload', alBeforeUnload);
    document.addEventListener('contextmenu', alContextMenu);
    window.addEventListener('blur', alBlur);
    window.addEventListener('popstate', alPopState);

    return () => {
      document.removeEventListener('visibilitychange', alVisibilityChange);
      document.removeEventListener('fullscreenchange', alFullscreenChange);
      window.removeEventListener('beforeunload', alBeforeUnload);
      document.removeEventListener('contextmenu', alContextMenu);
      window.removeEventListener('blur', alBlur);
      window.removeEventListener('popstate', alPopState);
    };
  }, [contando, comenzado, intento]);

  async function manejarComenzar() {
    // Fullscreen y Wake Lock exigen originarse en un gesto del usuario
    // (este click): no se pueden disparar desde un useEffect diferido.
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // El navegador puede negar pantalla completa; seguimos igual.
    }
    wakeLockRef.current = await pedirWakeLock();

    // Chequeo único de pantalla extendida (Window Management API): solo
    // Chrome/Edge lo soportan (Safari/iOS no), así que es un extra, no la
    // defensa principal — por eso solo se revisa una vez al comenzar, no
    // en vivo durante todo el examen.
    if ('isExtended' in window.screen && (window.screen as Screen & { isExtended?: boolean }).isExtended) {
      api
        .post(`/api/intentos/${intento!.intento_id}/incidente`, {
          tipo: 'salida_pantalla',
          detalle: 'Pantalla extendida detectada (posible segundo monitor)',
        })
        .catch(() => {});
    }

    setNumeroCuenta(5);
    setContando(true);
  }

  function salirDeModoSeguro() {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setContando(false);
    setComenzado(false);
    setRestante(null);
  }

  function elegirOpcion(preguntaId: number, opcionId: number) {
    setRespuestas((r) => ({ ...r, [preguntaId]: opcionId }));
    api
      .post(`/api/intentos/${intento!.intento_id}/respuestas`, {
        pregunta_id: preguntaId,
        opcion_id: opcionId,
      })
      .catch(() => {
        // Se reintenta al enviar el examen, igual que en el móvil.
      });
  }

  async function reintentarPendientes() {
    if (!intento) return;
    for (const p of intento.preguntas) {
      const elegida = respuestas[p.id];
      if (elegida != null && elegida !== p.opcion_elegida_id) {
        await api.post(`/api/intentos/${intento.intento_id}/respuestas`, {
          pregunta_id: p.id,
          opcion_id: elegida,
        });
      }
    }
  }

  async function manejarEnviar() {
    if (!intento) return;
    setEnviando(true);
    setError('');
    try {
      await reintentarPendientes();
      await api.post(`/api/intentos/${intento.intento_id}/finalizar`);
      salirDeModoSeguro();
      setEnviado(true);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  function manejarSalir() {
    logout();
  }

  function aceptarCancelado() {
    salirDeModoSeguro();
    setCancelado(false);
    queryClient.invalidateQueries({ queryKey: ['intento-actual'] });
  }

  function aceptarEnviado() {
    setEnviado(false);
    setError('');
  }

  if (enviado) return <PantallaEnviado onAceptar={aceptarEnviado} />;
  if (cancelado) return <PantallaCancelado onAceptar={aceptarCancelado} />;
  if (!intento) return <PantallaSinExamen onSalir={manejarSalir} />;
  if (intento.estado === 'pausado') return <PantallaPausada />;
  if (contando) return <PantallaCuenta numero={numeroCuenta} />;
  if (!comenzado) return <PantallaComenzar intento={intento} onComenzar={manejarComenzar} />;

  return (
    <VistaPreguntas
      intento={intento}
      respuestas={respuestas}
      onElegir={elegirOpcion}
      restante={restante}
      onEnviar={manejarEnviar}
      enviando={enviando}
      error={error}
    />
  );
}
