// Pantalla de examen — calcado de web/src/features/examen/RendirExamenPage.tsx
// (E7, opción múltiple) pero para ejercicios de código: un editor Monaco
// por ejercicio con "Ejecutar" (casos visibles, no persiste) y "Enviar"
// (todos los casos, persiste y califica) en vez de elegir una opción.
//
// El modo kiosko usa la ventana nativa de Tauri (useModoKiosko) en vez de
// la Fullscreen/Visibility API del navegador — mismo principio de fondo
// (detectar y avisar, nunca bloquear solo, HU-21).
//
// Nota sobre "autosave" (plan de E9, sección Editor): el backend NO tiene
// un endpoint de guardado-sin-calificar — "Ejecutar" corre pero no
// persiste, "Enviar" persiste PERO también corre TODOS los casos
// (incluidos ocultos) y cuenta como entrega calificable de ese ejercicio.
// No hay forma de "autosave" cada 15s sin gastar una corrida de sandbox y
// marcar el ejercicio como entregado de nuevo cada vez — así que v1 no
// autoguarda: el código vive en memoria hasta que el estudiante aprieta
// "Ejecutar" o "Enviar" explícitamente. Ver E9 memory para el seguimiento.
//
// El layout del estado "en curso" (nav de ejercicios + columna de
// enunciado/casos + editor) sigue al pie de la letra el handoff de diseño
// "Examen en curso (rediseño)" — nav de tres columnas en vez de enunciado/
// resultados apilados sobre el editor, `<pre>` para casos multilínea, diff
// línea a línea en el panel de resultados, y el teal (`secondary-600`)
// como único color de CTA (el naranja de `accent` queda para tiempo/
// incidentes). Los otros estados de esta página no están en el alcance de
// ese rediseño y siguen como estaban.

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Editor, { type Monaco } from '@monaco-editor/react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardX,
  Loader2,
  Lock,
  PauseCircle,
  Play,
  ShieldAlert,
} from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { obtenerSocket } from '../../core/realtime/socket';
import { useAuth } from '../../core/auth/AuthContext';
import { useModoKiosko } from '../../core/kiosco/useModoKiosko';
import {
  CasoParaRendir,
  EjercicioParaRendir,
  IntentoCodigoParaRendir,
  ResultadoCaso,
  ResultadoEnvio,
  TipoIncidenteCodigo,
} from '../../core/tipos';
import { Button, cn } from '../../core/ui';

const EVENTOS_SOCKET_REFRESCAR = [
  'examen-codigo-lanzado',
  'examen-codigo-pausado',
  'examen-codigo-reactivado',
] as const;

const CINCO_MINUTOS = 300;

const TEXTO_INCIDENTE: Record<TipoIncidenteCodigo, string> = {
  perdida_foco: 'Perdiste el foco de la ventana',
  ventana_minimizada: 'Minimizaste la ventana',
  intento_cierre: 'Intentaste cerrar la ventana',
};

function formatearRestante(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = String(Math.floor((segundos % 3600) / 60)).padStart(2, '0');
  const s = String(segundos % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

// Mismo criterio que MonitoreoCodigoPage/MonitoreoPage (web) para "hh:mm".
function formatearHora(fechaIso: string): string {
  return new Date(fechaIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

// El backend hoy solo manda `enunciado` (sin `titulo` corto) — se deriva
// tomando su primera cláusula, con un fallback genérico si viene vacía.
function tituloCorto(ejercicio: EjercicioParaRendir, indice: number): string {
  const clausula = ejercicio.enunciado.split(/[.\n?¿!¡]/)[0]?.trim();
  if (!clausula) return `Ejercicio ${indice + 1}`;
  return clausula.length > 42 ? `${clausula.slice(0, 42).trimEnd()}…` : clausula;
}

interface LineaObtenida {
  texto: string;
  estado: 'ok' | 'diff' | 'falta';
}

// Diff línea a línea de "obtenido" contra "esperado" — es lo que hace
// legible un caso multilínea que falló: solo se resalta cuando el caso
// realmente falló (`paso === false`), nunca en una corrida exitosa.
function lineasObtenidas(esperado: string, obtenido: string, paso: boolean): LineaObtenida[] {
  const esp = esperado.split('\n');
  const obt = obtenido.split('\n');
  const max = Math.max(esp.length, obt.length);
  const out: LineaObtenida[] = [];
  for (let i = 0; i < max; i++) {
    const val = obt[i];
    if (val === undefined) out.push({ texto: '(sin salida)', estado: 'falta' });
    else if (!paso && val !== esp[i]) out.push({ texto: val, estado: 'diff' });
    else out.push({ texto: val, estado: 'ok' });
  }
  return out;
}

// Por defecto: casos que pasan colapsados, el primer caso que falla
// expandido. Se recalcula cada vez que llegan resultados nuevos de un
// ejercicio (por Ejecutar o por Enviar).
function clavesAbiertasPorDefecto(ejercicioId: number, resultados: ResultadoCaso[] | null): Record<string, boolean> {
  if (!resultados) return {};
  const i = resultados.findIndex((r) => !r.paso);
  return i === -1 ? {} : { [`${ejercicioId}-${i}`]: true };
}

function limpiarClaves(previas: Record<string, boolean>, ejercicioId: number): Record<string, boolean> {
  return Object.fromEntries(Object.entries(previas).filter(([clave]) => !clave.startsWith(`${ejercicioId}-`)));
}

// Tema propio de Monaco: el `#1e1e1e` de `vs-dark` choca con el navy de
// marca. Ver tabla de colores del handoff de diseño.
function definirTemaAtenza(monaco: Monaco) {
  monaco.editor.defineTheme('atenza-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '85a7d6' },
      { token: 'string', foreground: '76dae5' },
      { token: 'number', foreground: 'f5ba98' },
      { token: 'comment', foreground: 'ffffff57' },
      { token: 'identifier', foreground: 'cbd9ec' },
    ],
    colors: {
      'editor.background': '#0f1d31',
      'editorLineNumber.foreground': '#ffffff3d',
      'editorLineNumber.activeForeground': '#ffffff99',
      'editorGutter.background': '#0f1d31',
      'editor.foreground': '#e8eef3',
    },
  });
}

// ── Pantallas auxiliares (fuera del alcance del rediseño) ─────────────

function PantallaSinExamen({ onSalir }: { onSalir: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8 text-center shadow-md">
        <ClipboardX size={40} className="mx-auto mb-3 text-text-disabled" />
        <h1 className="text-lg font-bold text-text">No tienes ningún examen activo</h1>
        <p className="mt-1 mb-6 text-sm text-text-secondary">
          Cuando tu docente lance un examen de código, aparecerá acá automáticamente — deja la
          app abierta.
        </p>
        <Button variante="secondary" onClick={onSalir}>
          Cerrar sesión
        </Button>
      </div>
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
        Tus ejercicios ya enviados quedaron registrados.
      </p>
      <Button variante="accent" className="mt-6" onClick={onAceptar}>
        Aceptar
      </Button>
    </div>
  );
}

function PantallaEnviado({ motivo, onAceptar }: { motivo: 'estudiante' | 'tiempo'; onAceptar: () => void }) {
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

function PantallaComenzar({ intento, onComenzar }: { intento: IntentoCodigoParaRendir; onComenzar: () => void }) {
  const n = intento.ejercicios.length;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary-900 px-6 text-center text-white">
      <Lock size={40} className="mb-4 text-white/60" />
      <h1 className="text-xl font-extrabold">{intento.tema}</h1>
      <p className="mt-2 text-sm text-white/70">
        {n} ejercicio{n === 1 ? '' : 's'} · Nota total: {intento.nota}
      </p>
      <p className="mt-4 max-w-sm text-sm text-white/70">
        Al comenzar, la ventana pasará a pantalla completa. No la minimices ni cambies de
        aplicación: quedará registrado como incidente y tu docente lo verá.
      </p>
      <Button variante="accent" className="mt-6" onClick={onComenzar}>
        Comenzar examen
      </Button>
    </div>
  );
}

// ── Aviso de incidente (kiosco, fuera del alcance del rediseño) ───────

function AvisoIncidente({
  tipo,
  incidentes,
  onCerrar,
}: {
  tipo: TipoIncidenteCodigo | null;
  incidentes: number;
  onCerrar: () => void;
}) {
  useEffect(() => {
    if (!tipo) return;
    const id = setTimeout(onCerrar, 8000);
    return () => clearTimeout(id);
  }, [tipo, onCerrar]);

  if (!tipo) return null;

  return (
    <div className="fixed right-5 bottom-5 z-30 max-w-sm rounded-2xl border border-accent-600 bg-primary-900 px-4 py-[14px] shadow-lg">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="shrink-0 text-accent-400" />
        <p className="text-[15px] font-bold text-accent-400">{TEXTO_INCIDENTE[tipo]}</p>
      </div>
      <p className="mt-1 text-[14px] leading-[1.45] text-white/75">
        Quedó registrado y tu docente lo verá. Es la {incidentes}ª vez.
      </p>
    </div>
  );
}

// ── Banner de "quedan 5 minutos" ────────────────────────────────────

function BannerCincoMinutos({ pendientes, onCerrar }: { pendientes: number; onCerrar: () => void }) {
  useEffect(() => {
    const id = setTimeout(onCerrar, 10000);
    return () => clearTimeout(id);
  }, [onCerrar]);

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-accent-600/55 bg-accent-500/14 px-5 py-[11px]">
      <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent-400" />
      <p className="text-[13.5px] font-bold text-accent-400">Quedan 5 minutos</p>
      <p className="text-[13.5px] text-white/72">
        {pendientes > 0 &&
          `Te faltan ${pendientes} ejercicio${pendientes === 1 ? '' : 's'} por enviar. `}
        Al vencer el tiempo se guarda lo enviado hasta ese momento.
      </p>
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────

function Header({
  tema,
  notaTotal,
  ejercicios,
  enviados,
  entregadosCount,
  restante,
  duracionTotalSeg,
  confirmarFinal,
  finalizando,
  onPedirFinalizar,
  onCancelarFinalizar,
  onFinalizar,
}: {
  tema: string;
  notaTotal: number;
  ejercicios: EjercicioParaRendir[];
  enviados: Record<number, string>;
  entregadosCount: number;
  restante: number | null;
  duracionTotalSeg: number | null;
  confirmarFinal: boolean;
  finalizando: boolean;
  onPedirFinalizar: () => void;
  onCancelarFinalizar: () => void;
  onFinalizar: () => void;
}) {
  const total = ejercicios.length;
  const bajoTiempo = restante !== null && restante < CINCO_MINUTOS;
  const anchoBarra =
    restante !== null && duracionTotalSeg
      ? `${Math.max(0, Math.min(100, (restante / duracionTotalSeg) * 100))}%`
      : '0%';

  return (
    <header className="shrink-0 border-b border-white/10 bg-primary-900">
      <div className="flex h-[58px] items-center justify-between gap-6 px-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold tracking-[-0.01em] text-white">{tema}</h1>
            <p className="mt-0.5 text-[12.5px] text-white/55">
              Nota total: {notaTotal} · {total} ejercicio{total === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 border-l border-white/12 pl-3.5">
            {ejercicios.map((ej) => {
              const entregado = enviados[ej.id] !== undefined;
              return (
                <span
                  key={ej.id}
                  title={entregado ? 'Entregado' : 'Sin enviar'}
                  className={cn('h-[5px] w-[26px] rounded-[3px]', entregado ? 'bg-secondary-600' : 'bg-white/20')}
                />
              );
            })}
            <span className="ml-2 text-[12.5px] font-semibold text-white/72">
              {entregadosCount} de {total} entregados
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3.5">
          {restante !== null && (
            <div className="flex items-baseline gap-[7px]">
              <span
                className={cn(
                  'text-[11px] font-semibold tracking-[0.09em] uppercase',
                  bajoTiempo ? 'text-accent-400' : 'text-white/45',
                )}
              >
                Restante
              </span>
              <span
                className={cn(
                  'font-mono text-[19px] font-medium tabular-nums tracking-[-0.01em]',
                  bajoTiempo ? 'text-accent-400' : 'text-white/92',
                )}
              >
                {formatearRestante(restante)}
              </span>
            </div>
          )}
          {confirmarFinal ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/70">¿Finalizar el examen?</span>
              <Button variante="secondary" tamano="sm" onClick={onCancelarFinalizar}>
                Seguir
              </Button>
              <Button variante="accent" tamano="sm" cargando={finalizando} onClick={onFinalizar}>
                Sí, finalizar
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onPedirFinalizar}
              style={{ transition: 'all var(--duration-fast) var(--ease-atenza)' }}
              className="inline-flex h-[34px] items-center rounded-lg border border-white/22 px-3.5 text-[13.5px] font-semibold text-white/86 hover:border-white/34 hover:bg-white/10 hover:text-white"
            >
              Finalizar examen
            </button>
          )}
        </div>
      </div>
      <div className="h-0.5 bg-white/8">
        {restante !== null && (
          <div
            className={cn('h-0.5 transition-[width] duration-1000 ease-linear', bajoTiempo ? 'bg-accent-400' : 'bg-white/92')}
            style={{ width: anchoBarra }}
          />
        )}
      </div>
    </header>
  );
}

// ── Nav de ejercicios ────────────────────────────────────────────────

function NavEjercicios({
  ejercicios,
  activoId,
  enviados,
  origenResultados,
  onSeleccionar,
}: {
  ejercicios: EjercicioParaRendir[];
  activoId: number;
  enviados: Record<number, string>;
  origenResultados: Record<number, 'ejecutar' | 'envio'>;
  onSeleccionar: (id: number) => void;
}) {
  return (
    <nav className="flex w-[238px] shrink-0 flex-col border-r border-white/9 bg-exam-panel">
      <p className="px-4 pt-4 pb-2 text-[10.5px] font-bold tracking-[0.11em] text-white/40 uppercase">Ejercicios</p>
      <div className="flex flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {ejercicios.map((ej, i) => {
          const activo = ej.id === activoId;
          const hora = enviados[ej.id];
          const entregado = hora !== undefined;
          const corrido = origenResultados[ej.id] != null;
          const estadoTexto = entregado
            ? `Entregado${hora ? ' ' + hora : ''}`
            : corrido
              ? 'Ejecutado, sin enviar'
              : 'Sin enviar';
          return (
            <button
              key={ej.id}
              type="button"
              onClick={() => onSeleccionar(ej.id)}
              style={{ transition: 'background var(--duration-fast)' }}
              className={cn(
                'flex items-start gap-2.5 rounded-[9px] border px-2.5 pt-2.5 pb-[11px] text-left',
                activo ? 'border-white/16 bg-white/11' : 'border-transparent hover:bg-white/7',
              )}
            >
              <span
                className={cn(
                  'mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] font-mono text-[10px] font-bold',
                  entregado ? 'border-secondary-600 bg-secondary-600 text-exam-on-teal' : 'border-white/28 text-white/55',
                )}
              >
                {entregado ? '✓' : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-[13.5px] font-semibold', activo ? 'text-white' : 'text-white/80')}>
                  {i + 1}. {tituloCorto(ej, i)}
                </span>
                <span className={cn('mt-[3px] block text-[11.5px] font-medium', entregado ? 'text-secondary-400' : 'text-white/42')}>
                  {estadoTexto}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-auto border-t border-white/9 px-4 py-3.5">
        <p className="text-[11.5px] leading-[1.5] text-white/48">
          Tu código vive solo en esta ventana. <span className="font-semibold text-white/72">Enviar</span> es lo
          único que lo guarda en el servidor.
        </p>
      </div>
    </nav>
  );
}

// ── Columna de enunciado y casos ────────────────────────────────────

function TarjetaCaso({ caso, indice }: { caso: CasoParaRendir; indice: number }) {
  const lineasEntrada = caso.entrada ? caso.entrada.split('\n').length : 1;
  const lineasSalida = caso.salida_esperada.split('\n').length;
  return (
    <article className="overflow-hidden rounded-[10px] border border-white/10 bg-black/16">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
        <span className="text-xs font-bold text-white/78">Caso {indice + 1}</span>
        <span className="font-mono text-[10.5px] text-white/38">
          {lineasEntrada} líneas → {lineasSalida}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-px bg-white/7">
        <div className="bg-exam-bar px-3 pt-[9px] pb-[11px]">
          <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.08em] text-white/40 uppercase">Entrada</p>
          <pre
            className={cn(
              'max-h-[150px] overflow-auto font-mono text-[12.5px] leading-[1.65] whitespace-pre',
              caso.entrada ? 'text-white/90' : 'text-white/40',
            )}
          >
            {caso.entrada || '(vacía)'}
          </pre>
        </div>
        <div className="bg-exam-bar px-3 pt-[9px] pb-[11px]">
          <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.08em] text-white/40 uppercase">Salida esperada</p>
          <pre className="max-h-[150px] overflow-auto font-mono text-[12.5px] leading-[1.65] whitespace-pre text-secondary-300">
            {caso.salida_esperada}
          </pre>
        </div>
      </div>
    </article>
  );
}

function ColumnaEnunciado({
  ejercicio,
  indice,
  total,
}: {
  ejercicio: EjercicioParaRendir;
  indice: number;
  total: number;
}) {
  return (
    <section className="flex w-[394px] min-w-[300px] shrink flex-col overflow-y-auto border-r border-white/9 bg-exam-statement">
      <div className="px-6 pt-[22px] pb-[26px]">
        <p className="mb-2.5 font-mono text-[10.5px] font-bold tracking-[0.12em] text-secondary-400 uppercase">
          Ejercicio {indice + 1} de {total}
        </p>
        <h2 className="mb-3 text-[19px] font-bold leading-[1.3] tracking-[-0.015em]">{tituloCorto(ejercicio, indice)}</h2>
        <p className="text-[15.5px] leading-[1.65] whitespace-pre-wrap text-white/86 [text-wrap:pretty]">
          {ejercicio.enunciado}
        </p>
      </div>

      {ejercicio.casos_visibles.length > 0 && (
        <div className="px-6 pb-6">
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-bold tracking-[0.11em] text-white/44 uppercase">Casos de prueba visibles</p>
            <p className="font-mono text-[11px] text-white/40">
              {ejercicio.casos_visibles.length} visibles · {ejercicio.total_casos} al enviar
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            {ejercicio.casos_visibles.map((c, i) => (
              <TarjetaCaso key={c.id} caso={c} indice={i} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Panel de resultados (Ejecutar o Enviar) ─────────────────────────

function FilaResultado({
  indice,
  caso,
  resultado,
  abierto,
  onAlternar,
}: {
  indice: number;
  caso: CasoParaRendir;
  resultado: ResultadoCaso;
  abierto: boolean;
  onAlternar: () => void;
}) {
  const paso = resultado.paso;
  const esperadoLineas = caso.salida_esperada.split('\n');
  const obtenidas = lineasObtenidas(caso.salida_esperada, resultado.stdout, paso);

  return (
    <article
      className={cn(
        'overflow-hidden rounded-[10px] border',
        paso ? 'border-[rgba(20,163,179,0.32)] bg-[rgba(24,197,216,0.05)]' : 'border-[rgba(248,113,113,0.34)] bg-[rgba(248,113,113,0.07)]',
      )}
    >
      <button type="button" onClick={onAlternar} className="flex w-full items-center gap-2.5 px-3 py-[9px] text-left">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', paso ? 'bg-secondary-400' : 'bg-red-400')} />
        <span className={cn('text-[12.5px] font-bold', paso ? 'text-secondary-400' : 'text-red-400')}>
          Caso {indice + 1}
        </span>
        <span className="text-[12.5px] text-white/52">{paso ? 'pasó' : 'falló'}</span>
        <span className="ml-auto font-mono text-[11px] text-white/38">{resultado.tiempo_ms} ms</span>
        <span className="text-[11px] text-white/44">{abierto ? 'ocultar' : 'ver detalle'}</span>
      </button>
      {abierto && (
        <div className="grid grid-cols-3 gap-px border-t border-white/7 bg-white/7">
          <div className="bg-exam-bar px-3 pt-2.5 pb-3">
            <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.08em] text-white/40 uppercase">Entrada</p>
            <pre className="overflow-x-auto font-mono text-[12.5px] leading-[1.7] whitespace-pre text-white/86">
              {caso.entrada || '(vacía)'}
            </pre>
          </div>
          <div className="bg-exam-bar px-3 pt-2.5 pb-3">
            <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.08em] text-white/40 uppercase">Esperado</p>
            <div>
              {esperadoLineas.map((linea, i) => (
                <pre key={i} className="rounded-[3px] px-1 font-mono text-[12.5px] leading-[1.7] whitespace-pre text-secondary-300">
                  {linea || ' '}
                </pre>
              ))}
            </div>
          </div>
          <div className="bg-exam-bar px-3 pt-2.5 pb-3">
            <p className={cn('mb-1.5 text-[10.5px] font-bold tracking-[0.08em] uppercase', paso ? 'text-white/40' : 'text-red-400')}>
              Obtenido
            </p>
            <div>
              {obtenidas.map((l, i) => (
                <pre
                  key={i}
                  className={cn(
                    'rounded-[3px] px-1 font-mono text-[12.5px] leading-[1.7] whitespace-pre',
                    l.estado === 'diff' ? 'bg-red-600/20 text-red-300' : l.estado === 'falta' ? 'text-white/38' : 'text-white/86',
                  )}
                >
                  {l.texto || ' '}
                </pre>
              ))}
            </div>
            {resultado.stderr && (
              <pre className="mt-2 rounded-md bg-[rgba(153,27,27,0.22)] px-2.5 py-2 font-mono text-xs leading-[1.6] whitespace-pre-wrap text-red-300">
                {resultado.stderr}
              </pre>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function PanelResultados({
  origen,
  casosVisibles,
  resultados,
  horaEntrega,
  ejercicioId,
  casosAbiertos,
  onAlternarCaso,
}: {
  origen: 'ejecutar' | 'envio';
  casosVisibles: CasoParaRendir[];
  resultados: ResultadoCaso[];
  horaEntrega: string;
  ejercicioId: number;
  casosAbiertos: Record<string, boolean>;
  onAlternarCaso: (clave: string) => void;
}) {
  const pasados = resultados.filter((r) => r.paso).length;
  const total = resultados.length;
  const todosPasan = pasados === total;

  return (
    <div className="max-h-[302px] shrink-0 overflow-y-auto border-t border-white/9 bg-exam-panel">
      <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-white/8 bg-exam-panel px-5 py-3">
        <div className="flex items-center gap-2.5">
          <p className="text-[13.5px] font-bold">{origen === 'envio' ? 'Resultado del envío' : 'Resultado de la corrida'}</p>
          <span
            className={cn(
              'rounded-full px-2 py-[3px] font-mono text-[11px] font-bold',
              todosPasan ? 'bg-secondary-600 text-exam-on-teal' : 'bg-red-300 text-red-900',
            )}
          >
            {pasados}/{total}
          </span>
        </div>
        <p className="text-xs text-white/44">
          {origen === 'envio' ? `Envío calificado · ${horaEntrega || '—'}` : 'Ejecutar · no guarda ni califica'}
        </p>
      </div>
      <div className="flex flex-col gap-2 px-5 pt-3 pb-5">
        {resultados.map((r, i) => {
          const caso = casosVisibles.find((c) => c.id === r.caso_id) ?? casosVisibles[i];
          if (!caso) return null;
          const clave = `${ejercicioId}-${i}`;
          return (
            <FilaResultado
              key={r.caso_id}
              indice={i}
              caso={caso}
              resultado={r}
              abierto={!!casosAbiertos[clave]}
              onAlternar={() => onAlternarCaso(clave)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Columna del editor ──────────────────────────────────────────────

function EditorColumna({
  ejercicio,
  codigo,
  onCambiarCodigo,
  resultados,
  origen,
  ejecutando,
  enviando,
  entregado,
  horaEntrega,
  error,
  onEjecutar,
  onEnviar,
  casosAbiertos,
  onAlternarCaso,
}: {
  ejercicio: EjercicioParaRendir;
  codigo: string;
  onCambiarCodigo: (valor: string) => void;
  resultados: ResultadoCaso[] | null;
  origen: 'ejecutar' | 'envio' | undefined;
  ejecutando: boolean;
  enviando: boolean;
  entregado: boolean;
  horaEntrega: string;
  error: string;
  onEjecutar: () => void;
  onEnviar: () => void;
  casosAbiertos: Record<string, boolean>;
  onAlternarCaso: (clave: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Cambiar de ejercicio cierra cualquier popover de confirmación abierto.
  useEffect(() => {
    setConfirmando(false);
  }, [ejercicio.id]);

  useEffect(() => {
    if (!confirmando) return;
    function alTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setConfirmando(false);
    }
    function alClickFuera(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setConfirmando(false);
    }
    document.addEventListener('keydown', alTecla);
    document.addEventListener('mousedown', alClickFuera);
    return () => {
      document.removeEventListener('keydown', alTecla);
      document.removeEventListener('mousedown', alClickFuera);
    };
  }, [confirmando]);

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-exam-editor">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/8 bg-exam-bar px-4">
        <span className="font-mono text-[11.5px] text-white/66">solucion.py</span>
        <span className="font-mono text-[11px] text-white/34">Python 3.11</span>
      </div>

      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          path={`ejercicio-${ejercicio.id}.py`}
          language="python"
          theme="atenza-dark"
          beforeMount={definirTemaAtenza}
          value={codigo}
          onChange={(v) => onCambiarCodigo(v ?? '')}
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
            lineHeight: 22,
            minimap: { enabled: false },
            automaticLayout: true,
            padding: { top: 14, bottom: 24 },
            renderLineHighlight: 'none',
            scrollBeyondLastLine: false,
            lineNumbersMinChars: 4,
          }}
        />
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-white/9 bg-exam-bar px-5 py-3.5">
        <button
          type="button"
          onClick={onEjecutar}
          disabled={ejecutando}
          style={{ transition: 'all var(--duration-fast) var(--ease-atenza)' }}
          className="inline-flex h-[38px] items-center gap-2 rounded-[9px] border border-white/22 bg-white/5 px-[15px] text-sm font-semibold text-white hover:border-white/34 hover:bg-white/12 disabled:pointer-events-none disabled:opacity-60"
        >
          {ejecutando ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
          {ejecutando ? 'Ejecutando…' : 'Ejecutar casos visibles'}
        </button>

        <div ref={wrapperRef} className="relative">
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            style={{ transition: 'background var(--duration-fast)' }}
            className="inline-flex h-[38px] items-center gap-2 rounded-[9px] bg-secondary-600 px-[17px] text-sm font-bold text-exam-on-teal hover:bg-secondary-500"
          >
            Enviar y calificar
          </button>
          {confirmando && (
            <div className="absolute bottom-[calc(100%+10px)] left-0 z-20 w-[334px] rounded-xl border border-white/16 bg-primary-900 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
              <p className="mb-1.5 text-sm font-bold">
                Se corre contra {ejercicio.total_casos} casos, incluidos los ocultos
              </p>
              <p className="mb-3.5 text-[13px] leading-[1.55] text-white/72">
                Este envío queda guardado y calificado. Podés volver a enviarlo mientras dure el examen; se
                conserva el último.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmando(false);
                    onEnviar();
                  }}
                  disabled={enviando}
                  className="h-[34px] rounded-lg bg-secondary-600 px-3.5 text-[13.5px] font-bold text-exam-on-teal disabled:opacity-60"
                >
                  Sí, enviar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="h-[34px] rounded-lg border border-white/22 px-3.5 text-[13.5px] font-semibold text-white/86"
                >
                  Seguir editando
                </button>
              </div>
            </div>
          )}
        </div>

        {entregado && (
          <span className="inline-flex items-center gap-[7px] text-[13px] font-semibold text-secondary-400">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary-600" />
            Entregado{horaEntrega ? ` ${horaEntrega}` : ''}
          </span>
        )}

        <p className="ml-auto text-xs text-white/42">Ejecutar no guarda ni califica</p>
      </div>
      {error && <p className="shrink-0 bg-exam-bar px-5 pb-3 text-sm text-red-400">{error}</p>}

      {resultados && resultados.length > 0 && (
        <PanelResultados
          origen={origen ?? 'ejecutar'}
          casosVisibles={ejercicio.casos_visibles}
          resultados={resultados}
          horaEntrega={horaEntrega}
          ejercicioId={ejercicio.id}
          casosAbiertos={casosAbiertos}
          onAlternarCaso={onAlternarCaso}
        />
      )}
    </section>
  );
}

// ── Página principal ────────────────────────────────────────────────

export function ExamenCodigoPage({ onTerminado }: { onTerminado?: () => void } = {}) {
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  const [comenzado, setComenzado] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [motivoEnviado, setMotivoEnviado] = useState<'estudiante' | 'tiempo'>('estudiante');
  const [cancelado, setCancelado] = useState(false);
  const [restante, setRestante] = useState<number | null>(null);

  const [ejercicioActivoId, setEjercicioActivoId] = useState<number | null>(null);
  const [codigos, setCodigos] = useState<Record<number, string>>({});
  const [resultados, setResultados] = useState<Record<number, ResultadoCaso[] | null>>({});
  const [origenResultados, setOrigenResultados] = useState<Record<number, 'ejecutar' | 'envio'>>({});
  const [enviados, setEnviados] = useState<Record<number, string>>({});
  const [casosAbiertos, setCasosAbiertos] = useState<Record<string, boolean>>({});
  const [ejecutando, setEjecutando] = useState(false);
  const [enviandoEjercicio, setEnviandoEjercicio] = useState(false);
  const [errorEjercicio, setErrorEjercicio] = useState('');
  const [confirmarFinal, setConfirmarFinal] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [errorFinal, setErrorFinal] = useState('');

  const [incidentes, setIncidentes] = useState(0);
  const [avisoIncidente, setAvisoIncidente] = useState<TipoIncidenteCodigo | null>(null);
  const [avisoCincoMinMostrado, setAvisoCincoMinMostrado] = useState(false);
  const [avisoTiempoVisible, setAvisoTiempoVisible] = useState(false);

  const { data: intento, refetch } = useQuery({
    queryKey: ['intento-codigo-actual'],
    queryFn: async () => {
      const { data } = await api.get<{ intento: IntentoCodigoParaRendir | null }>('/api/intentos-codigo/actual');
      return data.intento;
    },
    refetchInterval: 15000, // respaldo si el socket se cae un momento
    enabled: !enviado,
  });

  // Sincroniza el estado local cuando aparece un intento nuevo/reanudado.
  useEffect(() => {
    if (!intento) return;
    const codigosIniciales: Record<number, string> = {};
    const resultadosIniciales: Record<number, ResultadoCaso[] | null> = {};
    const origenIniciales: Record<number, 'ejecutar' | 'envio'> = {};
    const enviadosIniciales: Record<number, string> = {};
    const aperturaInicial: Record<string, boolean> = {};
    for (const ej of intento.ejercicios) {
      codigosIniciales[ej.id] = ej.ultimo_codigo ?? ej.plantilla_codigo ?? '';
      resultadosIniciales[ej.id] = ej.ultimo_resultado;
      // `ultimo_codigo` solo se completa vía "Enviar" (Ejecutar es
      // scratchpad, no persiste) — si viene, el ejercicio ya fue entregado.
      if (ej.ultimo_codigo !== null) {
        origenIniciales[ej.id] = 'envio';
        enviadosIniciales[ej.id] = ej.enviado_en ? formatearHora(ej.enviado_en) : '';
      }
      Object.assign(aperturaInicial, clavesAbiertasPorDefecto(ej.id, ej.ultimo_resultado));
    }
    setCodigos(codigosIniciales);
    setResultados(resultadosIniciales);
    setOrigenResultados(origenIniciales);
    setEnviados(enviadosIniciales);
    setCasosAbiertos(aperturaInicial);
    setEjercicioActivoId((actual) =>
      actual && intento.ejercicios.some((e) => e.id === actual) ? actual : (intento.ejercicios[0]?.id ?? null),
    );
    // Un intento_id distinto es un examen nuevo (el anterior ya terminó) —
    // los contadores del anterior no deben arrastrarse.
    setIncidentes(0);
    setAvisoCincoMinMostrado(false);
    setAvisoTiempoVisible(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intento?.intento_id]);

  // Socket: eventos personales del estudiante (ver gestionar-examen-codigo.ts).
  useEffect(() => {
    const socket = obtenerSocket();
    const refrescar = () => queryClient.invalidateQueries({ queryKey: ['intento-codigo-actual'] });
    const alCancelado = () => {
      setCancelado(true);
      refrescar();
    };
    EVENTOS_SOCKET_REFRESCAR.forEach((e) => socket.on(e, refrescar));
    socket.on('examen-codigo-cancelado', alCancelado);
    return () => {
      EVENTOS_SOCKET_REFRESCAR.forEach((e) => socket.off(e, refrescar));
      socket.off('examen-codigo-cancelado', alCancelado);
    };
  }, [queryClient]);

  // Countdown del tiempo límite — el servidor autofinaliza (barrido de 8s),
  // el cliente solo refleja `fecha_limite`, nunca decide la nota.
  useEffect(() => {
    if (!comenzado || !intento?.fecha_limite || enviado) return;
    const limite = new Date(intento.fecha_limite).getTime();
    function tick() {
      const rest = Math.max(0, Math.round((limite - Date.now()) / 1000));
      setRestante(rest);
      if (rest === 0) {
        setMotivoEnviado('tiempo');
        setEnviado(true);
        refetch();
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [comenzado, intento?.fecha_limite, enviado, refetch]);

  useEffect(() => {
    if (restante !== null && restante > 0 && restante <= CINCO_MINUTOS && !avisoCincoMinMostrado) {
      setAvisoCincoMinMostrado(true);
      setAvisoTiempoVisible(true);
    }
  }, [restante, avisoCincoMinMostrado]);

  // Modo kiosko nativo — arma los listeners de ventana solo mientras el
  // examen está efectivamente en curso.
  const intentoId = intento?.intento_id;
  useModoKiosko(comenzado && !enviado && !cancelado, (tipo) => {
    setIncidentes((n) => n + 1);
    setAvisoIncidente(tipo);
    if (intentoId != null) {
      api.post(`/api/intentos-codigo/${intentoId}/incidente`, { tipo }).catch(() => {});
    }
  });

  function manejarComenzar() {
    setComenzado(true);
  }

  async function manejarEjecutar() {
    if (!intento || ejercicioActivoId == null) return;
    const id = ejercicioActivoId;
    setEjecutando(true);
    setErrorEjercicio('');
    try {
      const { data } = await api.post<{ resultados: ResultadoCaso[] }>(
        `/api/intentos-codigo/${intento.intento_id}/ejercicios/${id}/ejecutar`,
        { codigo_fuente: codigos[id] ?? '' },
      );
      setResultados((r) => ({ ...r, [id]: data.resultados }));
      setOrigenResultados((o) => ({ ...o, [id]: 'ejecutar' }));
      setCasosAbiertos((prev) => ({ ...limpiarClaves(prev, id), ...clavesAbiertasPorDefecto(id, data.resultados) }));
    } catch (err) {
      setErrorEjercicio(mensajeDeError(err));
    } finally {
      setEjecutando(false);
    }
  }

  async function manejarEnviarEjercicio() {
    if (!intento || ejercicioActivoId == null) return;
    const id = ejercicioActivoId;
    setEnviandoEjercicio(true);
    setErrorEjercicio('');
    try {
      const { data } = await api.post<{ resultado: ResultadoEnvio }>(
        `/api/intentos-codigo/${intento.intento_id}/ejercicios/${id}/enviar`,
        { codigo_fuente: codigos[id] ?? '' },
      );
      const hora = formatearHora(data.resultado.enviado_en);
      setResultados((r) => ({ ...r, [id]: data.resultado.resultados_visibles }));
      setOrigenResultados((o) => ({ ...o, [id]: 'envio' }));
      setEnviados((e) => ({ ...e, [id]: hora }));
      setCasosAbiertos((prev) => ({
        ...limpiarClaves(prev, id),
        ...clavesAbiertasPorDefecto(id, data.resultado.resultados_visibles),
      }));
    } catch (err) {
      setErrorEjercicio(mensajeDeError(err));
    } finally {
      setEnviandoEjercicio(false);
    }
  }

  async function manejarFinalizarExamen() {
    if (!intento) return;
    setFinalizando(true);
    setErrorFinal('');
    try {
      await api.post(`/api/intentos-codigo/${intento.intento_id}/finalizar`);
      setMotivoEnviado('estudiante');
      setEnviado(true);
    } catch (err) {
      setErrorFinal(mensajeDeError(err));
    } finally {
      setFinalizando(false);
      setConfirmarFinal(false);
    }
  }

  function aceptarCancelado() {
    setCancelado(false);
    setComenzado(false);
    setRestante(null);
    queryClient.invalidateQueries({ queryKey: ['intento-codigo-actual'] });
    onTerminado?.();
  }

  function aceptarEnviado() {
    setEnviado(false);
    setComenzado(false);
    setRestante(null);
    onTerminado?.();
  }

  if (enviado) return <PantallaEnviado motivo={motivoEnviado} onAceptar={aceptarEnviado} />;
  if (cancelado) return <PantallaCancelado onAceptar={aceptarCancelado} />;
  if (!intento) return <PantallaSinExamen onSalir={logout} />;
  if (intento.estado === 'pausado') return <PantallaPausada />;
  if (!comenzado) return <PantallaComenzar intento={intento} onComenzar={manejarComenzar} />;

  const ejercicioActivo = intento.ejercicios.find((e) => e.id === ejercicioActivoId) ?? intento.ejercicios[0];
  const indiceActivo = intento.ejercicios.indexOf(ejercicioActivo);
  const total = intento.ejercicios.length;
  const entregadosCount = Object.keys(enviados).length;
  const duracionTotalSeg = intento.fecha_limite
    ? Math.max(1, Math.round((new Date(intento.fecha_limite).getTime() - new Date(intento.fecha_inicio).getTime()) / 1000))
    : null;

  function onSeleccionarEjercicio(id: number) {
    setEjercicioActivoId(id);
    setErrorEjercicio('');
  }

  function alternarCaso(clave: string) {
    setCasosAbiertos((prev) => ({ ...prev, [clave]: !prev[clave] }));
  }

  return (
    <div className="flex h-screen min-h-[720px] flex-col bg-exam-root text-white">
      <Header
        tema={intento.tema}
        notaTotal={intento.nota}
        ejercicios={intento.ejercicios}
        enviados={enviados}
        entregadosCount={entregadosCount}
        restante={restante}
        duracionTotalSeg={duracionTotalSeg}
        confirmarFinal={confirmarFinal}
        finalizando={finalizando}
        onPedirFinalizar={() => setConfirmarFinal(true)}
        onCancelarFinalizar={() => setConfirmarFinal(false)}
        onFinalizar={manejarFinalizarExamen}
      />
      {errorFinal && <p className="shrink-0 bg-red-900/30 px-6 py-2 text-sm text-red-300">{errorFinal}</p>}
      {avisoTiempoVisible && (
        <BannerCincoMinutos pendientes={total - entregadosCount} onCerrar={() => setAvisoTiempoVisible(false)} />
      )}

      <div className="flex min-h-0 flex-1">
        <NavEjercicios
          ejercicios={intento.ejercicios}
          activoId={ejercicioActivo.id}
          enviados={enviados}
          origenResultados={origenResultados}
          onSeleccionar={onSeleccionarEjercicio}
        />
        {ejercicioActivo && (
          <>
            <ColumnaEnunciado ejercicio={ejercicioActivo} indice={indiceActivo} total={total} />
            <EditorColumna
              ejercicio={ejercicioActivo}
              codigo={codigos[ejercicioActivo.id] ?? ''}
              onCambiarCodigo={(valor) => setCodigos((c) => ({ ...c, [ejercicioActivo.id]: valor }))}
              resultados={resultados[ejercicioActivo.id] ?? null}
              origen={origenResultados[ejercicioActivo.id]}
              ejecutando={ejecutando}
              enviando={enviandoEjercicio}
              entregado={enviados[ejercicioActivo.id] !== undefined}
              horaEntrega={enviados[ejercicioActivo.id] ?? ''}
              error={errorEjercicio}
              onEjecutar={manejarEjecutar}
              onEnviar={manejarEnviarEjercicio}
              casosAbiertos={casosAbiertos}
              onAlternarCaso={alternarCaso}
            />
          </>
        )}
      </div>

      <AvisoIncidente tipo={avisoIncidente} incidentes={incidentes} onCerrar={() => setAvisoIncidente(null)} />
    </div>
  );
}
