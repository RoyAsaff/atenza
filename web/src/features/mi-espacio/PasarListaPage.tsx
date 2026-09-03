// HU-15 · Llamado de lista: marcar Puntual/Atraso/Licencia/Falta por
// estudiante. El backend no cambia (mismo POST/GET de siempre); lo que
// cambia acá es cómo se recorre la nómina.
//
// 18/08: rediseño (design_handoff_pasar_lista). El docente elige entre dos
// formas de pasar lista con un conmutador en el encabezado:
//   - "Lista completa" (1a) — el curso entero a la vista, se marcan las
//     excepciones. Para quien mira el aula ya sentada.
//   - "Llamado uno por uno" (1b) — un estudiante por pantalla, teclas 1–4.
//     Para quien canta la lista en voz alta.
// Los dos modos comparten el mismo `marcajes`: cambiar de modo no pierde
// nada, solo cambia cómo se presenta.
//
// El cambio de fondo: el estado inicial de cada fila pasa a ser Puntual en
// vez de null. Antes, quien no se marcaba quedaba como Falta al guardar (el
// backend completaba los null) — el caso normal (casi todos vinieron) era
// el que más trabajo costaba. Ahora el POST manda los marcajes explícitos
// de todos; el endpoint ya aceptaba esa forma, no se tocó backend.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Search } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import {
  Clase,
  ConvocatoriaTardia,
  FilaListaAsistencia,
  Materia,
  MarcajeAsistencia,
} from '../../core/tipos';
import { Input, PageBreadcrumb, cn } from '../../core/ui/ui';

type Modo = 'lista' | 'llamado';

const CLAVE_MODO = 'atenza.pasarLista.modo';
const MAX_ITEMS_PANEL = 7;

const DIAS_ABREV = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Clase.fecha viaja como medianoche UTC (mismo criterio que MateriaDetallePage).
function formatearFechaCorta(iso: string): string {
  const d = new Date(iso);
  return `${DIAS_ABREV[d.getUTCDay()]} ${d.getUTCDate()} ${MESES_ABREV[d.getUTCMonth()]}`;
}

function formatearDiaLargo(iso: string): string {
  const d = new Date(iso);
  return `${DIAS_LARGO[d.getUTCDay()]} ${d.getUTCDate()}`;
}

function formatearHora(fecha: Date): string {
  return fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function useRelojActual() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return ahora;
}

interface OpcionEstado {
  valor: MarcajeAsistencia;
  texto: string;
  atajo: '1' | '2' | '3' | '4';
  colorActivo: string;
  colorPunto: string;
  colorTexto: string;
  resaltadoFila?: { fondo: string; borde: string; bordeControl: string };
}

// Mismos cuatro colores de siempre — sin cambios de backend ni de paleta.
const OPCIONES: OpcionEstado[] = [
  {
    valor: 'puntual',
    texto: 'Puntual',
    atajo: '1',
    colorActivo: 'bg-secondary-700 text-white',
    colorPunto: 'bg-secondary-700',
    colorTexto: 'text-secondary-700',
  },
  {
    valor: 'atrasado',
    texto: 'Atraso',
    atajo: '2',
    colorActivo: 'bg-accent-600 text-white',
    colorPunto: 'bg-accent-600',
    colorTexto: 'text-accent-700',
    resaltadoFila: { fondo: 'bg-accent-50', borde: 'border-accent-600', bordeControl: 'border-accent-300' },
  },
  {
    valor: 'licencia',
    texto: 'Licencia',
    atajo: '3',
    colorActivo: 'bg-primary-700 text-white',
    colorPunto: 'bg-primary-700',
    colorTexto: 'text-primary-700',
    resaltadoFila: { fondo: 'bg-primary-50', borde: 'border-primary-700', bordeControl: 'border-primary-300' },
  },
  {
    valor: 'falta',
    texto: 'Falta',
    atajo: '4',
    colorActivo: 'bg-red-600 text-white',
    colorPunto: 'bg-red-600',
    colorTexto: 'text-red-600',
    resaltadoFila: { fondo: 'bg-red-50', borde: 'border-red-600', bordeControl: 'border-red-300' },
  },
];

const MAPA_OPCIONES = Object.fromEntries(OPCIONES.map((o) => [o.valor, o])) as Record<
  MarcajeAsistencia,
  OpcionEstado
>;

// Habilitación tardía (02/09): etiqueta legible por tipo de convocatoria.
const TIPO_CONVOCATORIA_TEXTO: Record<ConvocatoriaTardia['tipo'], string> = {
  evaluacion: 'la evaluación',
  guia: 'la guía',
  examen_codigo: 'el examen de código',
};

// ── Conmutador de modo (encabezado) ───────────────────────────────

function ConmutadorModo({ modo, onCambiar }: { modo: Modo; onCambiar: (m: Modo) => void }) {
  const opciones: { valor: Modo; texto: string }[] = [
    { valor: 'lista', texto: 'Lista completa' },
    { valor: 'llamado', texto: 'Llamado uno por uno' },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Forma de pasar lista"
      className="flex h-[34px] shrink-0 overflow-hidden rounded-[9px] border border-border"
    >
      {opciones.map((op, i) => {
        const activo = modo === op.valor;
        return (
          <button
            key={op.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onCambiar(op.valor)}
            className={cn(
              'flex items-center whitespace-nowrap px-[14px] text-[13px] transition',
              i > 0 && 'border-l border-border',
              activo
                ? 'bg-primary-800 font-bold text-white'
                : 'bg-surface font-medium text-text-secondary hover:bg-surface-hover',
            )}
          >
            {op.texto}
          </button>
        );
      })}
    </div>
  );
}

// ── Encabezado (común a los dos modos) ────────────────────────────

function EncabezadoPasarLista({
  materiaId,
  nombreMateria,
  clase,
  totalEstudiantes,
  modo,
  onModo,
  yaRegistrada,
  mostrarConmutador,
}: {
  materiaId: string;
  nombreMateria?: string;
  clase: Clase | null;
  totalEstudiantes: number | null;
  modo: Modo;
  onModo: (m: Modo) => void;
  yaRegistrada: boolean;
  mostrarConmutador: boolean;
}) {
  const ahora = useRelojActual();

  if (modo === 'llamado') {
    return (
      <div className="flex items-center justify-between gap-5 border-b border-border bg-surface px-6 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-[18px] font-extrabold tracking-tight text-text">
            Pasar lista{clase?.tema ? ` · ${clase.tema}` : ''}
          </h1>
          <p className="text-[14px] text-text-muted">
            {clase ? formatearFechaCorta(clase.fecha) : ''}
            {clase?.hora ? ` · ${clase.hora}` : ''}
          </p>
        </div>
        {mostrarConmutador && <ConmutadorModo modo={modo} onCambiar={onModo} />}
      </div>
    );
  }

  const partesSubtitulo = [clase?.tema, clase?.hora];
  if (totalEstudiantes != null) {
    partesSubtitulo.push(`${totalEstudiantes} ${totalEstudiantes === 1 ? 'estudiante' : 'estudiantes'}`);
  }

  return (
    <div className="flex flex-col items-start gap-4 border-b border-border bg-surface px-6 py-[18px] sm:flex-row sm:justify-between">
      <div className="flex min-w-0 flex-col gap-[5px]">
        <PageBreadcrumb>
          <Link to={`/materias/${materiaId}`}>‹ {nombreMateria ?? 'Clases'}</Link>
        </PageBreadcrumb>
        <h1 className="text-[22px] font-extrabold tracking-tight text-text">Pasar lista</h1>
        <p className="text-[15px] text-text-secondary">{partesSubtitulo.filter(Boolean).join(' · ')}</p>
        {yaRegistrada && (
          <p className="text-[14px] text-accent-700">
            Esta clase ya tiene asistencia registrada — al guardar se corrige.
          </p>
        )}
      </div>
      {mostrarConmutador && (
        <div className="flex shrink-0 flex-col items-end gap-[10px]">
          <p className="whitespace-nowrap font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-text-muted">
            {clase ? `${formatearFechaCorta(clase.fecha)} · ` : ''}
            {formatearHora(ahora)}
          </p>
          <ConmutadorModo modo={modo} onCambiar={onModo} />
        </div>
      )}
    </div>
  );
}

// ── 1a · Lista completa ────────────────────────────────────────────

function ControlEstadoFila({
  valor,
  onCambiar,
  nombreAria,
  resaltado,
}: {
  valor: MarcajeAsistencia;
  onCambiar: (v: MarcajeAsistencia) => void;
  nombreAria: string;
  resaltado?: OpcionEstado['resaltadoFila'];
}) {
  return (
    <>
      {/* Tablet/desktop: segmentado conectado de 38px */}
      <div
        role="radiogroup"
        aria-label={nombreAria}
        className={cn(
          'hidden overflow-hidden rounded-[9px] border sm:flex',
          resaltado ? resaltado.bordeControl : 'border-border',
        )}
      >
        {OPCIONES.map((op, i) => {
          const activo = op.valor === valor;
          return (
            <button
              key={op.valor}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onCambiar(op.valor)}
              className={cn(
                'flex h-[38px] items-center px-[15px] text-[14px] transition',
                i > 0 && 'border-l',
                i > 0 && (resaltado ? resaltado.bordeControl : 'border-border'),
                activo
                  ? cn(op.colorActivo, 'font-bold')
                  : 'bg-surface font-medium text-text-secondary hover:bg-surface-hover',
              )}
            >
              {op.texto}
            </button>
          );
        })}
      </div>
      {/* Móvil: cuatro botones de 44px, ancho completo, en grid 2×2 */}
      <div role="radiogroup" aria-label={nombreAria} className="grid grid-cols-2 gap-2 sm:hidden">
        {OPCIONES.map((op) => {
          const activo = op.valor === valor;
          return (
            <button
              key={op.valor}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onCambiar(op.valor)}
              className={cn(
                'flex h-11 items-center justify-center rounded-lg border text-[14px] transition',
                activo
                  ? cn(op.colorActivo, 'border-transparent font-bold')
                  : 'border-border bg-surface font-medium text-text-secondary hover:bg-surface-hover',
              )}
            >
              {op.texto}
            </button>
          );
        })}
      </div>
    </>
  );
}

function FilaEstudianteLista({
  fila,
  valor,
  onCambiar,
  filaRef,
}: {
  fila: FilaListaAsistencia;
  valor: MarcajeAsistencia;
  onCambiar: (v: MarcajeAsistencia) => void;
  filaRef: (el: HTMLDivElement | null) => void;
}) {
  const resaltado = MAPA_OPCIONES[valor].resaltadoFila;
  return (
    <div
      ref={filaRef}
      className={cn(
        'flex flex-col gap-2 border-b border-neutral-100 px-4 py-3 last:border-b-0 sm:h-[52px] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0',
        resaltado && cn(resaltado.fondo, 'border-l-[3px]', resaltado.borde, 'sm:pl-[13px] sm:pr-4'),
      )}
    >
      <p className="truncate text-[16px] font-semibold text-text">
        {fila.apellidos}, {fila.nombres}
      </p>
      <ControlEstadoFila
        valor={valor}
        onCambiar={onCambiar}
        nombreAria={`Estado de ${fila.apellidos}, ${fila.nombres}`}
        resaltado={resaltado}
      />
    </div>
  );
}

function FranjaContadores({
  conteos,
  busqueda,
  onBuscar,
  mostrarBuscador,
  onVolverTodosAPuntual,
}: {
  conteos: Record<MarcajeAsistencia, number>;
  busqueda: string;
  onBuscar: (v: string) => void;
  mostrarBuscador: boolean;
  onVolverTodosAPuntual: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-[13px]">
      <div className="flex flex-wrap items-center gap-[18px]">
        {OPCIONES.map((op) => (
          <span key={op.valor} className="inline-flex items-center gap-[7px] text-[14px] text-text-secondary">
            <span className={cn('h-[9px] w-[9px] shrink-0 rounded-[3px]', op.colorPunto)} />
            {op.texto} <strong className="text-text">{conteos[op.valor]}</strong>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-[14px]">
        <button
          type="button"
          onClick={onVolverTodosAPuntual}
          className="whitespace-nowrap text-[14px] font-medium text-link hover:text-primary-800"
        >
          Volver todos a Puntual
        </button>
        {mostrarBuscador && (
          <>
            <div className="h-[18px] w-px shrink-0 bg-border" />
            <Input
              value={busqueda}
              onChange={(e) => onBuscar(e.target.value)}
              placeholder="Buscar por nombre…"
              iconoIzq={<Search size={14} />}
              className="h-[34px] w-[190px] py-1 text-[13px]"
            />
          </>
        )}
      </div>
    </div>
  );
}

function ResumenPie({ conteos }: { conteos: Record<MarcajeAsistencia, number> }) {
  const segmentos: { texto: string; fuerte?: boolean }[] = [];
  if (conteos.puntual > 0) {
    segmentos.push({ texto: `${conteos.puntual} ${conteos.puntual === 1 ? 'puntual' : 'puntuales'}` });
  }
  if (conteos.atrasado > 0) {
    segmentos.push({ texto: `${conteos.atrasado} ${conteos.atrasado === 1 ? 'atraso' : 'atrasos'}` });
  }
  if (conteos.licencia > 0) {
    segmentos.push({ texto: `${conteos.licencia} ${conteos.licencia === 1 ? 'licencia' : 'licencias'}` });
  }
  if (conteos.falta > 0) {
    segmentos.push({ texto: `${conteos.falta} ${conteos.falta === 1 ? 'falta' : 'faltas'}`, fuerte: true });
  } else {
    segmentos.push({ texto: 'ninguna falta' });
  }
  return (
    <p className="text-[15px] text-text-secondary">
      {segmentos.map((s, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {s.fuerte ? <span className="font-semibold text-text">{s.texto}</span> : s.texto}
        </span>
      ))}
    </p>
  );
}

// Habilitación tardía (02/09): quién quedó habilitado para qué, tras
// corregir su asistencia mientras esa evaluación/guía/examen ya estaba en
// curso — nombres resueltos por el llamador contra la nómina.
function AvisoConvocados({ lineas }: { lineas: string[] }) {
  if (lineas.length === 0) return null;
  return (
    <div className="mx-6 mb-4 rounded-lg border border-accent-300 bg-accent-50 px-4 py-3 text-[14px] text-accent-800">
      <p className="font-semibold">Se habilitó el acceso para quien llegó tarde:</p>
      <ul className="mt-1 list-disc pl-5">
        {lineas.map((linea, i) => (
          <li key={i}>{linea}</li>
        ))}
      </ul>
    </div>
  );
}

function PieGuardar({
  conteos,
  fechaClase,
  yaRegistrada,
  guardando,
  guardadoOk,
  error,
  onGuardar,
}: {
  conteos: Record<MarcajeAsistencia, number>;
  fechaClase: string;
  yaRegistrada: boolean;
  guardando: boolean;
  guardadoOk: boolean;
  error: string;
  onGuardar: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 mt-4 flex flex-col gap-3 border-t border-border bg-surface px-6 py-[14px] sm:flex-row sm:items-center sm:justify-between sm:gap-5">
      <ResumenPie conteos={conteos} />
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
        {error && <p className="text-[14px] text-red-600">{error}</p>}
        {guardadoOk && !error && (
          <span className="inline-flex items-center gap-1 text-[14px] text-secondary-700">
            <Check size={15} /> Asistencia guardada
          </span>
        )}
        {!guardadoOk && !error && fechaClase && (
          <span className="whitespace-nowrap text-[14px] text-text-muted">
            Se guardará como asistencia del {fechaClase}
          </span>
        )}
        <button
          type="button"
          onClick={onGuardar}
          disabled={guardando || guardadoOk}
          className="w-full rounded-lg bg-primary-800 px-[22px] py-3 text-[15px] font-bold text-white transition hover:bg-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50 sm:w-auto"
        >
          {guardando ? 'Guardando…' : yaRegistrada ? 'Corregir asistencia' : 'Guardar asistencia'}
        </button>
      </div>
    </div>
  );
}

function ModoListaCompleta({
  listaOrdenada,
  marcajes,
  onCambiar,
  conteos,
  onVolverTodosAPuntual,
  fechaClase,
  yaRegistrada,
  guardando,
  guardadoOk,
  error,
  onGuardar,
  filaRefs,
}: {
  listaOrdenada: FilaListaAsistencia[];
  marcajes: Record<number, MarcajeAsistencia>;
  onCambiar: (estudianteId: number, v: MarcajeAsistencia) => void;
  conteos: Record<MarcajeAsistencia, number>;
  onVolverTodosAPuntual: () => void;
  fechaClase: string;
  yaRegistrada: boolean;
  guardando: boolean;
  guardadoOk: boolean;
  error: string;
  onGuardar: () => void;
  filaRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
}) {
  const [busqueda, setBusqueda] = useState('');
  const mostrarBuscador = listaOrdenada.length >= 15;

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return listaOrdenada;
    return listaOrdenada.filter((f) => `${f.apellidos} ${f.nombres}`.toLowerCase().includes(q));
  }, [listaOrdenada, busqueda]);

  return (
    <>
      <FranjaContadores
        conteos={conteos}
        busqueda={busqueda}
        onBuscar={setBusqueda}
        mostrarBuscador={mostrarBuscador}
        onVolverTodosAPuntual={onVolverTodosAPuntual}
      />
      <div className="px-6 pt-4">
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {listaFiltrada.map((fila) => (
            <FilaEstudianteLista
              key={fila.estudiante_id}
              fila={fila}
              valor={marcajes[fila.estudiante_id] ?? 'puntual'}
              onCambiar={(v) => onCambiar(fila.estudiante_id, v)}
              filaRef={(el) => {
                if (el) filaRefs.current.set(fila.estudiante_id, el);
                else filaRefs.current.delete(fila.estudiante_id);
              }}
            />
          ))}
          {listaFiltrada.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-text-secondary">
              Nadie coincide con "{busqueda}".
            </p>
          )}
        </div>
      </div>
      <PieGuardar
        conteos={conteos}
        fechaClase={fechaClase}
        yaRegistrada={yaRegistrada}
        guardando={guardando}
        guardadoOk={guardadoOk}
        error={error}
        onGuardar={onGuardar}
      />
    </>
  );
}

// ── 1b · Llamado uno por uno ───────────────────────────────────────

function ProgresoLlamado({ posicion, total }: { posicion: number; total: number }) {
  const pct = total > 0 ? ((posicion + 1) / total) * 100 : 0;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted">
          {posicion + 1} de {total}
        </p>
        <p className="text-[14px] text-text-muted">quedan {Math.max(0, total - (posicion + 1))}</p>
      </div>
      <div className="h-[6px] overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-primary-800"
          style={{ width: `${pct}%`, transition: 'width var(--duration-base) var(--ease-atenza)' }}
        />
      </div>
    </div>
  );
}

function TarjetaEstudiante({
  posicion,
  fila,
  valorActual,
  anterior,
  onMarcar,
  onRetroceder,
}: {
  posicion: number;
  fila: FilaListaAsistencia;
  valorActual: MarcajeAsistencia | undefined;
  anterior: FilaListaAsistencia | null;
  onMarcar: (v: MarcajeAsistencia) => void;
  onRetroceder: () => void;
}) {
  return (
    <div className="flex flex-col gap-[22px] rounded-[14px] border border-border bg-surface px-[26px] py-7">
      <div className="flex flex-col gap-[6px]">
        <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-text-muted">Nº {posicion + 1}</p>
        <p className="text-[28px] font-extrabold leading-[1.15] tracking-tight text-text sm:text-[34px]">
          {fila.apellidos}, {fila.nombres}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {OPCIONES.map((op) => {
          const activo = valorActual === op.valor;
          return (
            <button
              key={op.valor}
              type="button"
              onClick={() => onMarcar(op.valor)}
              className={cn(
                'flex h-[60px] items-center rounded-[10px] px-5 text-left text-[18px] font-bold transition sm:h-[68px]',
                activo ? op.colorActivo : 'border border-border bg-surface text-text hover:bg-surface-hover',
              )}
            >
              {op.texto}{' '}
              <span
                className={cn('font-mono text-[12px] font-medium', activo ? 'opacity-80' : 'text-text-muted')}
              >
                · {op.atajo}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-neutral-100 pt-1">
        {anterior ? (
          <button
            type="button"
            onClick={onRetroceder}
            className="inline-flex items-center gap-1 text-[14px] font-medium text-link hover:text-primary-800"
          >
            <ArrowLeft size={14} /> Corregir el anterior ({anterior.apellidos}, {anterior.nombres})
          </button>
        ) : (
          <span />
        )}
        <span className="whitespace-nowrap font-mono text-[12px] text-text-disabled">
          1–4 o clic · Enter repite Puntual
        </span>
      </div>
    </div>
  );
}

function CierreLlamado({ onTerminar }: { onTerminar: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface px-[18px] py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p className="text-[15px] text-text-secondary">Al llegar al final se revisa todo junto antes de guardar.</p>
      <button
        type="button"
        onClick={onTerminar}
        className="rounded-lg border border-border bg-surface px-[15px] py-[9px] text-[14px] font-semibold text-text-secondary transition hover:bg-surface-hover"
      >
        Terminar y revisar
      </button>
    </div>
  );
}

interface ItemMarcado {
  fila: FilaListaAsistencia;
  valor: MarcajeAsistencia;
}

function ItemPanel({ item }: { item: ItemMarcado }) {
  const op = MAPA_OPCIONES[item.valor];
  return (
    <div className="flex items-center justify-between gap-[10px] border-b border-neutral-100 px-[15px] py-[9px] last:border-b-0">
      <p className="truncate text-[13px] text-text">
        {item.fila.apellidos}, {item.fila.nombres}
      </p>
      <span className={cn('shrink-0 text-[12px] font-bold', op.colorTexto)}>{op.texto}</span>
    </div>
  );
}

function PanelYaMarcados({
  items,
  onSeleccionar,
}: {
  items: ItemMarcado[];
  onSeleccionar: (estudianteId: number) => void;
}) {
  const visibles = items.slice(0, MAX_ITEMS_PANEL);
  const resto = items.length - visibles.length;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-[15px] py-3">
        <p className="text-[14px] font-bold text-text">Ya marcados</p>
        <span className="font-mono text-[11px] text-text-muted">{items.length}</span>
      </div>
      {visibles.map((item) => (
        <button
          key={item.fila.estudiante_id}
          type="button"
          onClick={() => onSeleccionar(item.fila.estudiante_id)}
          className="block w-full text-left hover:bg-surface-hover"
        >
          <ItemPanel item={item} />
        </button>
      ))}
      {resto > 0 && (
        <div className="bg-neutral-50 px-[15px] py-[10px]">
          <p className="font-mono text-[11px] text-text-disabled">{resto} más · clic para corregir</p>
        </div>
      )}
    </div>
  );
}

function ModoLlamado({
  listaOrdenada,
  indice,
  marcajes,
  ordenTocados,
  onMarcarYAvanzar,
  onRetroceder,
  onSeleccionarPanel,
  onTerminar,
}: {
  listaOrdenada: FilaListaAsistencia[];
  indice: number;
  marcajes: Record<number, MarcajeAsistencia>;
  ordenTocados: number[];
  onMarcarYAvanzar: (v: MarcajeAsistencia) => void;
  onRetroceder: () => void;
  onSeleccionarPanel: (estudianteId: number) => void;
  onTerminar: () => void;
}) {
  const total = listaOrdenada.length;
  const estudianteActual = listaOrdenada[indice] ?? null;
  const anterior = indice > 0 ? listaOrdenada[indice - 1] : null;

  const itemsPanel = useMemo<ItemMarcado[]>(() => {
    const porId = new Map(listaOrdenada.map((f) => [f.estudiante_id, f]));
    return ordenTocados
      .map((estudianteId) => porId.get(estudianteId))
      .filter((f): f is FilaListaAsistencia => !!f)
      .map((fila) => ({ fila, valor: marcajes[fila.estudiante_id] ?? 'puntual' }));
  }, [ordenTocados, listaOrdenada, marcajes]);

  useEffect(() => {
    if (!estudianteActual) return;
    function alTeclado(e: KeyboardEvent) {
      const activo = document.activeElement;
      if (activo instanceof HTMLElement && (activo.tagName === 'INPUT' || activo.tagName === 'TEXTAREA')) return;
      if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
        onMarcarYAvanzar(OPCIONES[Number(e.key) - 1].valor);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onMarcarYAvanzar('puntual');
      } else if (e.key === 'ArrowLeft') {
        onRetroceder();
      } else if (e.key === 'Escape') {
        onTerminar();
      }
    }
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [estudianteActual, onMarcarYAvanzar, onRetroceder, onTerminar]);

  if (!estudianteActual) return null; // el padre ya redirige a 1a al terminar el llamado

  return (
    <div className="grid grid-cols-1 items-start gap-5 px-6 pb-6 pt-[22px] lg:grid-cols-[minmax(0,1fr)_296px]">
      <div className="flex flex-col gap-4">
        <ProgresoLlamado posicion={indice} total={total} />
        <TarjetaEstudiante
          posicion={indice}
          fila={estudianteActual}
          valorActual={marcajes[estudianteActual.estudiante_id]}
          anterior={anterior}
          onMarcar={onMarcarYAvanzar}
          onRetroceder={onRetroceder}
        />
        <CierreLlamado onTerminar={onTerminar} />

        {/* Móvil: mismo panel, plegado — en desktop va en la columna derecha */}
        {itemsPanel.length > 0 && (
          <details className="rounded-xl border border-border bg-surface lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-[15px] py-3 text-[14px] font-bold text-text">
              Ya marcados
              <span className="font-mono text-[11px] font-normal text-text-muted">{itemsPanel.length}</span>
            </summary>
            <div className="border-t border-border">
              {itemsPanel.slice(0, MAX_ITEMS_PANEL).map((item) => (
                <button
                  key={item.fila.estudiante_id}
                  type="button"
                  onClick={() => onSeleccionarPanel(item.fila.estudiante_id)}
                  className="block w-full text-left hover:bg-surface-hover"
                >
                  <ItemPanel item={item} />
                </button>
              ))}
            </div>
          </details>
        )}
      </div>
      <div className="hidden lg:block">
        {itemsPanel.length > 0 && <PanelYaMarcados items={itemsPanel} onSeleccionar={onSeleccionarPanel} />}
      </div>
    </div>
  );
}

// ── Estados de carga/vacío/error ───────────────────────────────────

function EsqueletoPasarLista({ modo }: { modo: Modo }) {
  if (modo === 'llamado') {
    return (
      <div className="animate-pulse px-6 pb-6 pt-[22px]">
        <div className="mb-4 h-[6px] w-full rounded-full bg-neutral-100" />
        <div className="flex flex-col gap-[22px] rounded-[14px] border border-border bg-surface px-[26px] py-7">
          <div className="h-8 w-2/3 rounded bg-neutral-100" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[68px] rounded-[10px] bg-neutral-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="animate-pulse">
      <div className="flex gap-4 border-b border-border bg-surface px-6 py-[13px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-5 w-20 rounded bg-neutral-100" />
        ))}
      </div>
      <div className="px-6 pt-4">
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex h-[52px] items-center justify-between gap-4 border-b border-neutral-100 px-4 last:border-b-0"
            >
              <div className="h-3 w-40 rounded bg-neutral-100" />
              <div className="h-[38px] w-[220px] rounded-[9px] bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────

export function PasarListaPage() {
  const { id, claseId } = useParams();
  const claseIdNum = Number(claseId);
  const queryClient = useQueryClient();

  const [marcajes, setMarcajes] = useState<Record<number, MarcajeAsistencia>>({});
  // Recientes primero — alimenta el panel "Ya marcados" y el punto donde
  // retoma el llamado al volver de 1a. Separado de `marcajes` porque acá
  // importa el ORDEN en que se tocó, no solo el valor final.
  const [ordenTocados, setOrdenTocados] = useState<number[]>([]);
  const [modo, setModo] = useState<Modo>(() =>
    localStorage.getItem(CLAVE_MODO) === 'llamado' ? 'llamado' : 'lista',
  );
  const [indice, setIndice] = useState(0);
  const [error, setError] = useState('');
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [convocados, setConvocados] = useState<ConvocatoriaTardia[]>([]);

  const filaRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // Estudiante al que hay que hacer scroll apenas se vuelva a 1a — se llena
  // justo antes de cambiar de modo, nunca durante el render.
  const idParaScroll = useRef<number | null>(null);

  const { data: materia } = useQuery({
    queryKey: ['materia', id],
    queryFn: async () => {
      const { data } = await api.get<{ materia: Materia }>(`/api/materias/${id}`);
      return data.materia;
    },
  });

  // Mismo queryKey que MateriaDetallePage/EvaluacionesMateriaPage: si se
  // llega acá desde el calendario de la materia, esto ya está en caché.
  const { data: clases } = useQuery({
    queryKey: ['clases', id],
    queryFn: async () => {
      const { data } = await api.get<{ clases: Clase[] }>(`/api/materias/${id}/clases`);
      return data.clases;
    },
  });
  const clase = clases?.find((c) => c.id === claseIdNum) ?? null;

  const {
    data: lista,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['lista-asistencia', claseId],
    queryFn: async () => {
      const { data } = await api.get<{ lista: FilaListaAsistencia[] }>(
        `/api/materias/${id}/clases/${claseId}/asistencia`,
      );
      return data.lista;
    },
  });

  const listaOrdenada = useMemo(() => {
    if (!lista) return [];
    return [...lista].sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es'));
  }, [lista]);

  const yaRegistrada = useMemo(() => lista?.some((f) => f.marcaje !== null) ?? false, [lista]);

  useEffect(() => {
    if (listaOrdenada.length === 0) return;
    const inicial: Record<number, MarcajeAsistencia> = {};
    for (const fila of listaOrdenada) inicial[fila.estudiante_id] = fila.marcaje ?? 'puntual';
    setMarcajes(inicial);
  }, [listaOrdenada]);

  // "El mensaje se borra en cuanto cambia cualquier marcaje" — corrige el
  // bug de "Corregir parece registrar" (el ✓ quedaba fijo aunque después
  // se cambiaran marcajes).
  useEffect(() => {
    setGuardadoOk(false);
    setConvocados([]);
  }, [marcajes]);

  // Scroll al volver de 1b a 1a — con scrollTo sobre el <main> real de
  // Layout.tsx, nunca scrollIntoView (rompe ese contenedor).
  useEffect(() => {
    if (modo !== 'lista') return;
    const idObjetivo = idParaScroll.current;
    if (idObjetivo == null) return;
    idParaScroll.current = null;
    const frame = requestAnimationFrame(() => {
      const el = filaRefs.current.get(idObjetivo);
      const contenedor = el?.closest('main');
      if (!el || !(contenedor instanceof HTMLElement)) return;
      const rectEl = el.getBoundingClientRect();
      const rectCont = contenedor.getBoundingClientRect();
      const destino = contenedor.scrollTop + (rectEl.top - rectCont.top) - 130;
      contenedor.scrollTo({ top: Math.max(0, destino), behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [modo]);

  function marcar(estudianteId: number, valor: MarcajeAsistencia) {
    setMarcajes((m) => ({ ...m, [estudianteId]: valor }));
    setOrdenTocados((prev) => [estudianteId, ...prev.filter((x) => x !== estudianteId)]);
  }

  function volverTodosAPuntual() {
    setMarcajes(Object.fromEntries(listaOrdenada.map((f) => [f.estudiante_id, 'puntual' as MarcajeAsistencia])));
    setOrdenTocados([]);
  }

  function pasarALista() {
    if (modo === 'llamado') {
      idParaScroll.current = listaOrdenada[indice]?.estudiante_id ?? null;
    }
    setModo('lista');
    localStorage.setItem(CLAVE_MODO, 'lista');
  }

  function seleccionarModo(nuevo: Modo) {
    if (nuevo === 'lista') {
      pasarALista();
      return;
    }
    const tocadosSet = new Set(ordenTocados);
    const primerPendiente = listaOrdenada.findIndex((f) => !tocadosSet.has(f.estudiante_id));
    if (primerPendiente === -1) {
      // Ya se tocaron todos: entra directo a la revisión (1a), no a la tarjeta.
      setModo('lista');
      localStorage.setItem(CLAVE_MODO, 'lista');
      return;
    }
    setIndice(primerPendiente);
    setModo('llamado');
    localStorage.setItem(CLAVE_MODO, 'llamado');
  }

  function marcarYAvanzar(valor: MarcajeAsistencia) {
    const fila = listaOrdenada[indice];
    if (!fila) return;
    marcar(fila.estudiante_id, valor);
    if (indice + 1 >= listaOrdenada.length) {
      pasarALista();
    } else {
      setIndice(indice + 1);
    }
  }

  function retroceder() {
    setIndice((i) => Math.max(0, i - 1));
  }

  function seleccionarEnPanel(estudianteId: number) {
    const pos = listaOrdenada.findIndex((f) => f.estudiante_id === estudianteId);
    if (pos !== -1) setIndice(pos);
  }

  const conteos = useMemo(() => {
    const acc: Record<MarcajeAsistencia, number> = { puntual: 0, atrasado: 0, licencia: 0, falta: 0 };
    for (const fila of listaOrdenada) {
      const v = marcajes[fila.estudiante_id] ?? 'puntual';
      acc[v]++;
    }
    return acc;
  }, [listaOrdenada, marcajes]);

  const guardar = useMutation({
    mutationFn: async () => {
      const marcajesEnviar = listaOrdenada.map((f) => ({
        estudiante_id: f.estudiante_id,
        marcaje: marcajes[f.estudiante_id] ?? 'puntual',
      }));
      const { data } = await api.post<{ convocados: ConvocatoriaTardia[] }>(
        `/api/materias/${id}/clases/${claseId}/asistencia`,
        { marcajes: marcajesEnviar },
      );
      return data;
    },
    onSuccess: (data) => {
      setError('');
      setGuardadoOk(true);
      setConvocados(data.convocados);
      queryClient.invalidateQueries({ queryKey: ['lista-asistencia', claseId] });
      queryClient.invalidateQueries({ queryKey: ['consolidado-asistencia', id] });
    },
    onError: (err: unknown) => {
      setGuardadoOk(false);
      setError(mensajeDeError(err));
    },
  });

  // Habilitación tardía: nombre resuelto contra la nómina ya cargada, un
  // renglón por convocatoria (un mismo estudiante puede aparecer más de
  // una vez si llegó tarde a una clase con varias cosas lanzadas a la vez).
  const lineasConvocados = useMemo(() => {
    const porId = new Map(listaOrdenada.map((f) => [f.estudiante_id, f]));
    return convocados.map((c) => {
      const fila = porId.get(c.estudiante_id);
      const nombre = fila ? `${fila.apellidos}, ${fila.nombres}` : `Estudiante #${c.estudiante_id}`;
      return `${nombre} → ${TIPO_CONVOCATORIA_TEXTO[c.tipo]} "${c.tema}"`;
    });
  }, [convocados, listaOrdenada]);

  return (
    <div>
      <EncabezadoPasarLista
        materiaId={id!}
        nombreMateria={materia?.nombre_materia}
        clase={clase}
        totalEstudiantes={lista ? listaOrdenada.length : null}
        modo={modo}
        onModo={seleccionarModo}
        yaRegistrada={yaRegistrada}
        mostrarConmutador={!!lista && lista.length > 0}
      />

      {isLoading && <EsqueletoPasarLista modo={modo} />}

      {isError && (
        <div className="px-6 py-10 text-center">
          <p className="mb-3 text-sm text-red-600">No se pudo cargar la nómina.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-surface-hover"
          >
            Reintentar
          </button>
        </div>
      )}

      {lista && lista.length === 0 && (
        <p className="px-6 py-10 text-center text-sm text-text-secondary">
          Aún no hay estudiantes inscritos en esta materia.
        </p>
      )}

      {guardadoOk && <AvisoConvocados lineas={lineasConvocados} />}

      {lista &&
        lista.length > 0 &&
        (modo === 'lista' ? (
          <ModoListaCompleta
            listaOrdenada={listaOrdenada}
            marcajes={marcajes}
            onCambiar={marcar}
            conteos={conteos}
            onVolverTodosAPuntual={volverTodosAPuntual}
            fechaClase={clase ? formatearDiaLargo(clase.fecha) : ''}
            yaRegistrada={yaRegistrada}
            guardando={guardar.isPending}
            guardadoOk={guardadoOk}
            error={error}
            onGuardar={() => guardar.mutate()}
            filaRefs={filaRefs}
          />
        ) : (
          <ModoLlamado
            listaOrdenada={listaOrdenada}
            indice={indice}
            marcajes={marcajes}
            ordenTocados={ordenTocados}
            onMarcarYAvanzar={marcarYAvanzar}
            onRetroceder={retroceder}
            onSeleccionarPanel={seleccionarEnPanel}
            onTerminar={pasarALista}
          />
        ))}
    </div>
  );
}
