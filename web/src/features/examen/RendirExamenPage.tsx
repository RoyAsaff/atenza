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
//
// Unificación de identidad en web (05/08): `Layout` monta esta pantalla a
// pantalla completa (sin sidebar) apenas detecta un intento activo, sin
// importar en qué parte del panel estuviera el docente/estudiante — mismo
// criterio que `_Raiz`/`ExamenController` en mobile. `onTerminado` le avisa
// a `Layout` cuándo es seguro volver al panel normal (recién al aceptar la
// pantalla de "enviado"/"cancelado", nunca antes — por la razón de arriba).
//
// Rediseño móvil (2a, ver design_handoff_rendir_examen): una pregunta por
// pantalla como la app móvil, barra inferior en la zona del pulgar, mapa de
// preguntas en una hoja inferior y pantalla de repaso antes de enviar. En
// ≥lg escala sin rediseño (1a): mapa inline, repaso en panel, barra de tres
// botones. Safari en iPhone no implementa la Fullscreen API — por eso el
// aviso de incidente solo ofrece "volver a pantalla completa" en escritorio.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronUp,
  ClipboardX,
  Lock,
  PauseCircle,
  ShieldAlert,
} from 'lucide-react';
import { api, mensajeDeError, urlArchivo } from '../../core/api/cliente';
import { obtenerSocket } from '../../core/realtime/socket';
import { useAuth } from '../../core/auth/AuthContext';
import { IntentoParaRendir, PreguntaParaRendir } from '../../core/tipos';
import { Button, Card, CardBody, cn } from '../../core/ui/ui';

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

const CINCO_MINUTOS = 300;

type EstadoCelda = 'respondida' | 'blanco';

/** Quita un id de un Set sin mutar el original (los estados de guardado se
 * comparan por referencia). */
function sinId(set: Set<number>, id: number): Set<number> {
  if (!set.has(id)) return set;
  const copia = new Set(set);
  copia.delete(id);
  return copia;
}

function formatearRestante(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = String(Math.floor((segundos % 3600) / 60)).padStart(2, '0');
  const s = String(segundos % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

// ── Pantallas auxiliares (sin cambios de diseño) ────────────────────

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

function PantallaEnviado({
  motivo,
  onAceptar,
}: {
  motivo: 'estudiante' | 'tiempo';
  onAceptar: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary-900 px-6 text-center text-white">
      <CheckCircle2 size={56} className="mb-4 text-secondary-400" />
      <h1 className="text-lg font-bold">{motivo === 'tiempo' ? 'Se envió tu examen' : 'Examen enviado'}</h1>
      <p className="mt-2 text-sm text-white/70">
        {motivo === 'tiempo' ? 'Se acabó el tiempo.' : 'Tu examen se envió correctamente.'}
      </p>
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

// ── Indicador de guardado (cabecera) ────────────────────────────────

function IndicadorGuardado({
  guardando,
  sinGuardar,
}: {
  guardando: Set<number>;
  sinGuardar: Set<number>;
}) {
  if (sinGuardar.size > 0) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1 text-[13px] font-bold text-white">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
        {sinGuardar.size} sin guardar
      </span>
    );
  }
  if (guardando.size > 0) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-accent-400">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" />
        Guardando…
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-secondary-400">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondary-400" />
      Guardado
    </span>
  );
}

// ── Cabecera de la pregunta ──────────────────────────────────────────

function Cabecera({
  tema,
  indice,
  total,
  restante,
  respondidas,
  guardando,
  sinGuardar,
}: {
  tema: string;
  indice: number;
  total: number;
  restante: number | null;
  respondidas: number;
  guardando: Set<number>;
  sinGuardar: Set<number>;
}) {
  const bajoTiempo = restante !== null && restante < CINCO_MINUTOS;
  return (
    <div className="shrink-0 border-b border-white/10 px-[18px] pt-4 pb-[14px]">
      <div className="flex items-center justify-between gap-3">
        <h1 className="truncate text-[15px] font-bold text-white">{tema}</h1>
        {restante !== null && (
          <span
            className={cn(
              'flex h-[30px] shrink-0 items-center rounded-lg px-[11px] font-mono text-[15px] font-bold text-white',
              bajoTiempo ? 'bg-red-600' : 'bg-white/10',
            )}
          >
            {formatearRestante(restante)}
          </span>
        )}
      </div>
      <div className="mt-[11px] flex flex-col gap-[6px]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-white/60">
            Pregunta <span className="font-bold text-white">{indice + 1}</span> de {total}
          </span>
          <IndicadorGuardado guardando={guardando} sinGuardar={sinGuardar} />
        </div>
        <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.12]">
          <div
            className="h-full rounded-full bg-secondary-400 transition-all duration-base"
            style={{ width: `${total ? (respondidas / total) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Aviso de tiempo (5 minutos restantes) ───────────────────────────

function AvisoTiempo({ pendientes, onCerrar }: { pendientes: number; onCerrar: () => void }) {
  useEffect(() => {
    const id = setTimeout(onCerrar, 10000);
    return () => clearTimeout(id);
  }, [onCerrar]);

  return (
    <button
      type="button"
      onClick={onCerrar}
      className="mx-[18px] mt-3 flex shrink-0 flex-col items-start gap-1 rounded-2xl border border-accent-600 bg-accent-500/16 px-[15px] py-[14px] text-left"
    >
      <p className="text-[15px] font-bold text-accent-400">Quedan 5 minutos</p>
      <p className="text-[14px] text-white/75">
        {pendientes > 0
          ? `Tienes ${pendientes} pregunta${pendientes === 1 ? '' : 's'} en blanco. Al vencer el tiempo se envía automáticamente.`
          : 'Al vencer el tiempo se envía automáticamente.'}
      </p>
    </button>
  );
}

// ── Aviso de incidente ───────────────────────────────────────────────

function AvisoIncidente({
  aviso,
  incidentes,
  onCerrar,
  onReentrarFullscreen,
}: {
  aviso: { visible: boolean; deFullscreen: boolean } | null;
  incidentes: number;
  onCerrar: () => void;
  onReentrarFullscreen: () => void;
}) {
  useEffect(() => {
    if (!aviso?.visible) return;
    const id = setTimeout(onCerrar, 8000);
    return () => clearTimeout(id);
  }, [aviso, onCerrar]);

  if (!aviso?.visible) return null;

  return (
    <div className="absolute right-[18px] bottom-24 left-[18px] z-30 rounded-2xl border border-accent-600 bg-primary-900 px-4 py-[14px] shadow-[0_10px_28px_rgba(28,51,84,0.55)]">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="shrink-0 text-accent-400" />
        <p className="text-[15px] font-bold text-accent-400">Saliste del examen</p>
      </div>
      <p className="mt-1 text-[14px] leading-[1.45] text-white/75">
        Quedó registrado y tu docente lo verá. Es la {incidentes}ª vez.
      </p>
      {aviso.deFullscreen && (
        <button
          type="button"
          onClick={onReentrarFullscreen}
          className="mt-3 hidden h-[42px] items-center rounded-[10px] bg-accent-500 px-[18px] text-[14px] font-semibold text-white lg:inline-flex"
        >
          Volver a pantalla completa
        </button>
      )}
    </div>
  );
}

// ── Mapa de preguntas (inline en escritorio, hoja en móvil) ─────────

function celdaEstado(pregunta: PreguntaParaRendir, respuestas: Record<number, number | null>): EstadoCelda {
  return respuestas[pregunta.id] != null ? 'respondida' : 'blanco';
}

function MapaInline({
  preguntas,
  respuestas,
  indiceActual,
  onIrAPregunta,
}: {
  preguntas: PreguntaParaRendir[];
  respuestas: Record<number, number | null>;
  indiceActual: number;
  onIrAPregunta: (i: number) => void;
}) {
  return (
    <div className="mt-6 hidden flex-wrap gap-2 lg:flex" role="group" aria-label="Mapa de preguntas">
      {preguntas.map((p, i) => {
        const estado = celdaEstado(p, respuestas);
        const actual = i === indiceActual;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onIrAPregunta(i)}
            aria-label={`Pregunta ${i + 1}, ${estado === 'respondida' ? 'respondida' : 'en blanco'}`}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg font-mono text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              estado === 'respondida'
                ? 'bg-primary-600 text-white'
                : 'border border-accent-600 bg-accent-500/20 text-accent-400',
            )}
            style={actual ? { boxShadow: '0 0 0 2px var(--color-secondary-400)' } : undefined}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

function HojaMapa({
  abierto,
  onCerrar,
  preguntas,
  respuestas,
  indiceActual,
  onIrAPregunta,
  onRevisar,
}: {
  abierto: boolean;
  onCerrar: () => void;
  preguntas: PreguntaParaRendir[];
  respuestas: Record<number, number | null>;
  indiceActual: number;
  onIrAPregunta: (i: number) => void;
  onRevisar: () => void;
}) {
  const [arrastreY, setArrastreY] = useState(0);
  const inicioYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!abierto) return;
    function alTeclado(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar();
    }
    document.addEventListener('keydown', alTeclado);
    return () => document.removeEventListener('keydown', alTeclado);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const total = preguntas.length;
  const respondidas = preguntas.filter((p) => respuestas[p.id] != null).length;

  function alTocarInicio(e: React.TouchEvent) {
    inicioYRef.current = e.touches[0].clientY;
  }
  function alTocarMover(e: React.TouchEvent) {
    if (inicioYRef.current == null) return;
    const delta = e.touches[0].clientY - inicioYRef.current;
    if (delta > 0) setArrastreY(delta);
  }
  function alTocarFin() {
    if (arrastreY > 80) onCerrar();
    setArrastreY(0);
    inicioYRef.current = null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Mapa de preguntas"
    >
      <button
        type="button"
        aria-label="Cerrar mapa"
        onClick={onCerrar}
        className="absolute inset-0 bg-[rgba(28,51,84,0.72)]"
      />
      <div
        className="relative flex w-full flex-col gap-[15px] rounded-t-[22px] border-t border-white/18 bg-primary-900 px-[18px] pt-4 pb-5 shadow-[0_-12px_32px_rgba(28,51,84,0.5)]"
        style={{ transform: `translateY(${arrastreY}px)` }}
      >
        <div
          className="mx-auto h-1 w-[38px] shrink-0 touch-none rounded-full bg-white/25"
          onTouchStart={alTocarInicio}
          onTouchMove={alTocarMover}
          onTouchEnd={alTocarFin}
        />
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[17px] font-extrabold text-white">Tus preguntas</p>
          <p className="shrink-0 text-[14px] text-white/60">
            {respondidas} respondidas · {total - respondidas} en blanco
          </p>
        </div>
        <div className="grid grid-cols-5 gap-[9px]">
          {preguntas.map((p, i) => {
            const estado = celdaEstado(p, respuestas);
            const actual = i === indiceActual;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onIrAPregunta(i)}
                aria-label={`Pregunta ${i + 1}, ${estado === 'respondida' ? 'respondida' : 'en blanco'}`}
                className={cn(
                  'flex h-[52px] items-center justify-center rounded-xl font-mono text-[16px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  estado === 'respondida'
                    ? 'bg-primary-600 text-white'
                    : 'border border-accent-600 bg-accent-500/20 text-accent-400',
                )}
                style={actual ? { boxShadow: '0 0 0 2px var(--color-secondary-400)' } : undefined}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 text-[13px] text-white/60">
            <span className="h-2.5 w-2.5 rounded-full bg-primary-600" /> Respondida
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-white/60">
            <span className="h-2.5 w-2.5 rounded-full border border-accent-600 bg-accent-500/20" /> En blanco
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-white/60">
            <span
              className="h-2.5 w-2.5 rounded-full bg-primary-600"
              style={{ boxShadow: '0 0 0 2px var(--color-secondary-400)' }}
            />
            Actual
          </span>
        </div>
        <button
          type="button"
          onClick={onRevisar}
          className="h-[54px] shrink-0 rounded-[13px] bg-accent-500 text-[17px] font-bold text-white transition hover:bg-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Revisar y enviar
        </button>
      </div>
    </div>
  );
}

// ── Barra inferior ───────────────────────────────────────────────────

function BarraInferior({
  indice,
  esUltima,
  respondidas,
  total,
  estados,
  onAnterior,
  onSiguiente,
  onIrARepaso,
  onAbrirMapa,
}: {
  indice: number;
  esUltima: boolean;
  respondidas: number;
  total: number;
  estados: EstadoCelda[];
  onAnterior: () => void;
  onSiguiente: () => void;
  onIrARepaso: () => void;
  onAbrirMapa: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-white/10 bg-white/[0.04] px-[18px] pt-3 pb-5">
      {/* Móvil: navegación + resumen del mapa */}
      <div className="flex flex-col gap-[11px] lg:hidden">
        <div className="flex items-center gap-[11px]">
          {indice > 0 && (
            <button
              type="button"
              onClick={onAnterior}
              aria-label="Pregunta anterior"
              className="flex h-[54px] w-14 shrink-0 items-center justify-center rounded-[13px] border border-white/28 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <button
            type="button"
            onClick={esUltima ? onIrARepaso : onSiguiente}
            className="h-[54px] flex-1 rounded-[13px] bg-accent-500 text-[17px] font-bold text-white transition hover:bg-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {esUltima ? 'Revisar y enviar' : 'Siguiente'}
          </button>
        </div>
        <button
          type="button"
          onClick={onAbrirMapa}
          className="flex h-11 w-full items-center justify-center gap-[9px] rounded-[11px] border border-white/22 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span className="flex shrink-0 gap-1">
            {estados.slice(0, 4).map((e, i) => (
              <span
                key={i}
                className={cn('h-[7px] w-[7px] rounded-full', e === 'respondida' ? 'bg-primary-600' : 'bg-white/28')}
              />
            ))}
          </span>
          <span className="text-[14px] font-semibold text-white/85">
            {respondidas} de {total} respondidas
          </span>
          <span className="flex shrink-0 items-center gap-0.5 text-[13px] text-white/50">
            ver todas <ChevronUp size={13} />
          </span>
        </button>
      </div>

      {/* Escritorio: fila de tres botones */}
      <div className="hidden items-center gap-[11px] lg:flex">
        <button
          type="button"
          onClick={onAnterior}
          disabled={indice === 0}
          className="h-[54px] flex-1 rounded-[13px] border border-white/28 text-[16px] font-semibold text-white transition hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={onSiguiente}
          disabled={esUltima}
          className="h-[54px] flex-1 rounded-[13px] bg-accent-500 text-[17px] font-bold text-white transition hover:bg-accent-600 disabled:opacity-40 disabled:hover:bg-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Siguiente
        </button>
        <button
          type="button"
          onClick={onIrARepaso}
          className="h-[54px] flex-1 rounded-[13px] border border-white/28 text-[16px] font-semibold text-white/85 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Revisar y enviar
        </button>
      </div>
    </div>
  );
}

// ── Pantalla de repaso ───────────────────────────────────────────────

function PantallaRepaso({
  intento,
  respuestas,
  restante,
  sinGuardar,
  enviando,
  onVolver,
  onIrAPregunta,
  onEnviar,
}: {
  intento: IntentoParaRendir;
  respuestas: Record<number, number | null>;
  restante: number | null;
  sinGuardar: Set<number>;
  enviando: boolean;
  onVolver: () => void;
  onIrAPregunta: (i: number) => void;
  onEnviar: () => void;
}) {
  const total = intento.preguntas.length;
  const pendientes = intento.preguntas.filter((p) => respuestas[p.id] == null);
  const nPendientes = pendientes.length;
  const hayGuardado = sinGuardar.size === 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-primary-900 text-white lg:static lg:inset-auto lg:z-auto lg:rounded-2xl lg:border lg:border-white/10 lg:bg-white/[0.04]">
      <div className="flex shrink-0 items-center justify-between px-[18px] pt-4 pb-[14px]">
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver al examen"
          className="flex h-9 w-11 items-center justify-center rounded-[9px] bg-white/10 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <ChevronLeft size={20} />
        </button>
        {restante !== null && (
          <span
            className={cn(
              'flex h-[30px] shrink-0 items-center rounded-lg px-[11px] font-mono text-[15px] font-bold text-white',
              restante < CINCO_MINUTOS ? 'bg-red-600' : 'bg-white/10',
            )}
          >
            {formatearRestante(restante)}
          </span>
        )}
      </div>

      <div className="flex-1 px-[18px]">
        <div className="flex flex-col gap-[18px]">
          <h2 className="text-[24px] leading-[1.2] font-extrabold tracking-[-0.01em] text-white">
            Antes de enviar
          </h2>
          <p className="text-[16px] leading-[1.5] text-white/72">
            {nPendientes === 0
              ? `Respondiste las ${total} preguntas.`
              : `Te quedan ${nPendientes} pregunta${nPendientes === 1 ? '' : 's'} sin responder. Una vez enviado no podrás volver a abrirlo.`}
          </p>

          {nPendientes > 0 && (
            <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4">
              <p className="text-[13px] font-semibold tracking-[0.04em] text-white/50 uppercase">
                Toca para ir
              </p>
              <div className="mt-3 grid grid-cols-4 gap-[10px]">
                {pendientes.map((p) => {
                  const i = intento.preguntas.findIndex((q) => q.id === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onIrAPregunta(i)}
                      aria-label={`Pregunta ${i + 1}, en blanco`}
                      className="flex h-[56px] items-center justify-center rounded-[13px] border border-accent-600 bg-accent-500/20 font-mono text-[16px] font-bold text-accent-400 transition hover:bg-accent-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className={cn(
              'flex items-center gap-2 rounded-[13px] px-[15px] py-[13px]',
              hayGuardado ? 'bg-secondary-400/12' : 'bg-red-600/15',
            )}
          >
            <span
              className={cn('h-[7px] w-[7px] shrink-0 rounded-full', hayGuardado ? 'bg-secondary-400' : 'bg-red-400')}
            />
            <span className={cn('text-[14px]', hayGuardado ? 'text-secondary-400' : 'text-red-400')}>
              {hayGuardado
                ? `Tus ${total - nPendientes} respuestas están guardadas`
                : `${sinGuardar.size} respuestas no se han guardado — se reintentará al enviar`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-[10px] px-[18px] pt-3 pb-5">
        <button
          type="button"
          onClick={onEnviar}
          disabled={enviando}
          className="h-[54px] rounded-[13px] bg-accent-500 text-[17px] font-bold text-white transition hover:bg-accent-600 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {enviando ? 'Enviando…' : nPendientes === 0 ? 'Enviar examen' : 'Enviar de todas formas'}
        </button>
        <button
          type="button"
          onClick={onVolver}
          disabled={enviando}
          className="h-[50px] rounded-[13px] border border-white/28 text-[16px] font-semibold text-white transition hover:bg-white/10 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Seguir respondiendo
        </button>
      </div>
    </div>
  );
}

// ── Vista principal de preguntas ───────────────────────────────────

function VistaExamen({
  intento,
  respuestas,
  onElegir,
  restante,
  onEnviar,
  enviando,
  error,
  guardando,
  sinGuardar,
  incidentes,
  avisoIncidente,
  onCerrarAvisoIncidente,
  onReentrarFullscreen,
}: {
  intento: IntentoParaRendir;
  respuestas: Record<number, number | null>;
  onElegir: (preguntaId: number, opcionId: number) => void;
  restante: number | null;
  onEnviar: () => void;
  enviando: boolean;
  error: string;
  guardando: Set<number>;
  sinGuardar: Set<number>;
  incidentes: number;
  avisoIncidente: { visible: boolean; deFullscreen: boolean } | null;
  onCerrarAvisoIncidente: () => void;
  onReentrarFullscreen: () => void;
}) {
  const [indice, setIndice] = useState(0);
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const [pantalla, setPantalla] = useState<'pregunta' | 'repaso'>('pregunta');
  const [avisoCincoMinMostrado, setAvisoCincoMinMostrado] = useState(false);
  const [avisoTiempoVisible, setAvisoTiempoVisible] = useState(false);

  const total = intento.preguntas.length;
  const pregunta = intento.preguntas[Math.min(indice, total - 1)];
  const esUltima = indice === total - 1;

  const estados = useMemo<EstadoCelda[]>(
    () => intento.preguntas.map((p) => celdaEstado(p, respuestas)),
    [intento.preguntas, respuestas],
  );
  const respondidas = useMemo(() => estados.filter((e) => e === 'respondida').length, [estados]);

  // El aviso de "quedan 5 minutos" sale una sola vez.
  useEffect(() => {
    if (restante !== null && restante > 0 && restante <= CINCO_MINUTOS && !avisoCincoMinMostrado) {
      setAvisoCincoMinMostrado(true);
      setAvisoTiempoVisible(true);
    }
  }, [restante, avisoCincoMinMostrado]);

  function irAPregunta(i: number) {
    setIndice(i);
    setMapaAbierto(false);
    setPantalla('pregunta');
  }

  return (
    <div className="relative flex h-dvh flex-col bg-primary-900 text-white select-none lg:block lg:h-auto lg:min-h-screen lg:px-8 lg:py-10">
      <div className="flex h-full flex-col lg:mx-auto lg:h-auto lg:max-w-2xl">
        {pantalla === 'repaso' ? (
          <PantallaRepaso
            intento={intento}
            respuestas={respuestas}
            restante={restante}
            sinGuardar={sinGuardar}
            enviando={enviando}
            onVolver={() => setPantalla('pregunta')}
            onIrAPregunta={irAPregunta}
            onEnviar={onEnviar}
          />
        ) : (
          <>
            <Cabecera
              tema={intento.tema}
              indice={indice}
              total={total}
              restante={restante}
              respondidas={respondidas}
              guardando={guardando}
              sinGuardar={sinGuardar}
            />
            {avisoTiempoVisible && (
              <AvisoTiempo
                pendientes={total - respondidas}
                onCerrar={() => setAvisoTiempoVisible(false)}
              />
            )}

            <div className="flex-1 overflow-y-auto px-[18px] py-5">
              <p className="text-[19px] leading-[1.4] font-semibold text-white">{pregunta.pregunta}</p>
              {pregunta.url_imagen && (
                <img
                  src={urlArchivo(pregunta.url_imagen)}
                  alt=""
                  className="mt-4 max-h-[180px] w-full rounded-xl border border-white/10 object-contain"
                />
              )}

              <div
                role="radiogroup"
                aria-label="Opciones de respuesta"
                className="mt-4 flex flex-col gap-[11px]"
              >
                {pregunta.opciones.map((opcion, i) => {
                  const letra = String.fromCharCode(65 + i);
                  const elegida = respuestas[pregunta.id] === opcion.id;
                  return (
                    <button
                      key={opcion.id}
                      type="button"
                      role="radio"
                      aria-checked={elegida}
                      onClick={() => onElegir(pregunta.id, opcion.id)}
                      className={cn(
                        'flex min-h-[62px] items-center gap-[13px] rounded-2xl border px-[15px] py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                        elegida
                          ? 'border-primary-400 bg-primary-600'
                          : 'border-white/28 bg-white/[0.09] hover:bg-white/[0.14]',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold',
                          elegida ? 'bg-white text-primary-700' : 'bg-white/15 text-white/80',
                        )}
                      >
                        {letra}
                      </span>
                      <span
                        className={cn(
                          'text-[16px] leading-[1.35] text-white',
                          elegida ? 'font-bold' : 'font-normal',
                        )}
                      >
                        {opcion.texto}
                      </span>
                    </button>
                  );
                })}
              </div>

              <MapaInline
                preguntas={intento.preguntas}
                respuestas={respuestas}
                indiceActual={indice}
                onIrAPregunta={irAPregunta}
              />

              {error && <p className="mt-4 text-[14px] text-red-300">{error}</p>}
            </div>

            <BarraInferior
              indice={indice}
              esUltima={esUltima}
              respondidas={respondidas}
              total={total}
              estados={estados}
              onAnterior={() => setIndice((i) => Math.max(0, i - 1))}
              onSiguiente={() => setIndice((i) => Math.min(total - 1, i + 1))}
              onIrARepaso={() => setPantalla('repaso')}
              onAbrirMapa={() => setMapaAbierto(true)}
            />
          </>
        )}

        <AvisoIncidente
          aviso={avisoIncidente}
          incidentes={incidentes}
          onCerrar={onCerrarAvisoIncidente}
          onReentrarFullscreen={onReentrarFullscreen}
        />
      </div>

      <HojaMapa
        abierto={mapaAbierto}
        onCerrar={() => setMapaAbierto(false)}
        preguntas={intento.preguntas}
        respuestas={respuestas}
        indiceActual={indice}
        onIrAPregunta={irAPregunta}
        onRevisar={() => {
          setMapaAbierto(false);
          setPantalla('repaso');
        }}
      />
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────

export function RendirExamenPage({ onTerminado }: { onTerminado?: () => void } = {}) {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [respuestas, setRespuestas] = useState<Record<number, number | null>>({});
  const [contando, setContando] = useState(false);
  const [numeroCuenta, setNumeroCuenta] = useState(5);
  const [comenzado, setComenzado] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [motivoEnviado, setMotivoEnviado] = useState<'estudiante' | 'tiempo'>('estudiante');
  const [cancelado, setCancelado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [restante, setRestante] = useState<number | null>(null);
  const [guardando, setGuardando] = useState<Set<number>>(new Set());
  const [sinGuardar, setSinGuardar] = useState<Set<number>>(new Set());
  const [incidentes, setIncidentes] = useState(0);
  const [avisoIncidente, setAvisoIncidente] = useState<{ visible: boolean; deFullscreen: boolean } | null>(
    null,
  );
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const respuestasRef = useRef(respuestas);

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

  useEffect(() => {
    respuestasRef.current = respuestas;
  }, [respuestas]);

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
    if (!comenzado || !intento?.fecha_limite || enviado) return;
    const limite = new Date(intento.fecha_limite).getTime();
    function tick() {
      const rest = Math.max(0, Math.round((limite - Date.now()) / 1000));
      setRestante(rest);
      if (rest === 0) {
        // El servidor autofinaliza al vencer (HU-24 Esc. 1). Hay que marcar
        // "enviado" ANTES de refrescar: si no, /api/intentos/actual ya
        // devuelve null y el estudiante cae en PantallaSinExamen sin
        // enterarse de que su examen se envió.
        setMotivoEnviado('tiempo');
        setEnviado(true);
        refetch();
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [comenzado, intento?.fecha_limite, enviado, refetch]);

  // Medidas de seguridad del navegador: desde que se pide fullscreen (ya
  // sea durante la cuenta regresiva o durante el examen en sí).
  useEffect(() => {
    if (!(contando || comenzado) || !intento) return;
    const intentoId = intento.intento_id;

    function reportarIncidente(deFullscreen: boolean) {
      setIncidentes((n) => n + 1);
      setAvisoIncidente({ visible: true, deFullscreen });
      api.post(`/api/intentos/${intentoId}/incidente`, { tipo: 'salida_pantalla' }).catch(() => {});
    }

    async function alVisibilityChange() {
      if (document.hidden) {
        reportarIncidente(false);
      } else {
        wakeLockRef.current = await pedirWakeLock();
      }
    }

    // "visibilitychange" NO se dispara al salir de pantalla completa (Esc):
    // la pestaña sigue visible, solo cambia la presentación. Hace falta
    // escuchar "fullscreenchange" aparte para detectar esa salida. En
    // Safari/iOS este listener nunca dispara (no hay Fullscreen API ahí),
    // pero no hace falta distinguirlo: solo se usa para decidir si mostrar
    // el botón de "volver a pantalla completa", que igual está oculto en
    // móvil.
    function alFullscreenChange() {
      if (!document.fullscreenElement) {
        reportarIncidente(true);
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
      reportarIncidente(false);
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

  // Reintento automático cada 10 s mientras haya respuestas sin guardar,
  // además del reintento al enviar (reintentarPendientes).
  useEffect(() => {
    if (!comenzado || !intento) return;
    const id = setInterval(() => {
      setSinGuardar((actuales) => {
        actuales.forEach((preguntaId) => {
          const opcionId = respuestasRef.current[preguntaId];
          if (opcionId != null) guardarRespuesta(preguntaId, opcionId);
        });
        return actuales;
      });
    }, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comenzado, intento]);

  async function manejarComenzar() {
    // Fullscreen y Wake Lock exigen originarse en un gesto del usuario
    // (este click): no se pueden disparar desde un useEffect diferido.
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // El navegador puede negar pantalla completa (o no soportarla, como
      // Safari/iOS); seguimos igual.
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

  /** POST de una respuesta, actualizando los sets de guardado. Se usa desde
   * elegirOpcion, el reintento automático y reintentarPendientes: nunca se
   * traga el error en silencio, siempre queda reflejado en `sinGuardar`. */
  function guardarRespuesta(preguntaId: number, opcionId: number): Promise<void> {
    setGuardando((s) => new Set(s).add(preguntaId));
    return api
      .post(`/api/intentos/${intento!.intento_id}/respuestas`, {
        pregunta_id: preguntaId,
        opcion_id: opcionId,
      })
      .then(() => {
        setGuardando((s) => sinId(s, preguntaId));
        setSinGuardar((s) => sinId(s, preguntaId));
      })
      .catch(() => {
        setGuardando((s) => sinId(s, preguntaId));
        setSinGuardar((s) => new Set(s).add(preguntaId));
      });
  }

  function elegirOpcion(preguntaId: number, opcionId: number) {
    setRespuestas((r) => ({ ...r, [preguntaId]: opcionId }));
    guardarRespuesta(preguntaId, opcionId);
  }

  async function reintentarPendientes() {
    if (!intento) return;
    const pendientes = intento.preguntas.filter((p) => {
      const elegida = respuestas[p.id];
      return elegida != null && (elegida !== p.opcion_elegida_id || sinGuardar.has(p.id));
    });
    await Promise.all(pendientes.map((p) => guardarRespuesta(p.id, respuestas[p.id]!)));
  }

  async function manejarEnviar() {
    if (!intento) return;
    setEnviando(true);
    setError('');
    try {
      await reintentarPendientes();
      await api.post(`/api/intentos/${intento.intento_id}/finalizar`);
      salirDeModoSeguro();
      setMotivoEnviado('estudiante');
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
    onTerminado?.();
  }

  function aceptarEnviado() {
    setEnviado(false);
    setError('');
    onTerminado?.();
  }

  function reentrarFullscreen() {
    document.documentElement.requestFullscreen().catch(() => {});
  }

  if (enviado) return <PantallaEnviado motivo={motivoEnviado} onAceptar={aceptarEnviado} />;
  if (cancelado) return <PantallaCancelado onAceptar={aceptarCancelado} />;
  if (!intento) return <PantallaSinExamen onSalir={manejarSalir} />;
  if (intento.estado === 'pausado') return <PantallaPausada />;
  if (contando) return <PantallaCuenta numero={numeroCuenta} />;
  if (!comenzado) return <PantallaComenzar intento={intento} onComenzar={manejarComenzar} />;

  return (
    <VistaExamen
      intento={intento}
      respuestas={respuestas}
      onElegir={elegirOpcion}
      restante={restante}
      onEnviar={manejarEnviar}
      enviando={enviando}
      error={error}
      guardando={guardando}
      sinGuardar={sinGuardar}
      incidentes={incidentes}
      avisoIncidente={avisoIncidente}
      onCerrarAvisoIncidente={() => setAvisoIncidente(null)}
      onReentrarFullscreen={reentrarFullscreen}
    />
  );
}
