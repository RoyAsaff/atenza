// Piezas compartidas por EvaluacionEditorPage y ExamenCodigoEditorPage
// (dirección 1b del handoff "editor de evaluación/examen"): la ficha de
// estado al costado y el modal de eliminación con confirmación escrita.
// El resto (barra de lista, tarjetas, formularios) queda duplicado a
// propósito — son casi idénticos pero no vale la pena forzar una
// abstracción para "pregunta" vs "ejercicio".

import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Input, Modal, PageBreadcrumb, cn } from '../../core/ui/ui';
import type { Tono } from '../../core/ui/Badge';
import { EstadoEvaluacion } from '../../core/tipos';

export const ESTADO_TONO: Record<EstadoEvaluacion, { texto: string; tono: Tono }> = {
  borrador: { texto: 'Borrador', tono: 'neutral' },
  lista: { texto: 'Lista', tono: 'success' },
  lanzada: { texto: 'Lanzada', tono: 'info' },
  finalizada: { texto: 'Finalizada', tono: 'dark' },
};

const ORDEN_ESTADOS: EstadoEvaluacion[] = ['borrador', 'lista', 'lanzada', 'finalizada'];

const ETIQUETA_ESTADO: Record<EstadoEvaluacion, string> = {
  borrador: 'Borrador',
  lista: 'Lista',
  lanzada: 'Lanzada',
  finalizada: 'Finalizada',
};

export function formatoHora(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ── Encabezado de una línea: breadcrumb + título + badge a la izquierda,
// sello de autoguardado + menú "···" a la derecha. Sustituye a PageHeader
// en estas dos páginas. ──────────────────────────────────────────────
export function EncabezadoEditor({
  volverA,
  volverTexto,
  titulo,
  estado,
  sello,
  menu,
}: {
  volverA: string;
  volverTexto: string;
  titulo: string;
  estado: EstadoEvaluacion;
  sello?: ReactNode;
  menu?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-border bg-surface px-6 py-4">
      <div className="flex min-w-0 flex-col gap-1">
        <PageBreadcrumb>
          <Link to={volverA}>‹ {volverTexto}</Link>
        </PageBreadcrumb>
        <div className="flex flex-wrap items-center gap-[11px]">
          <h1 className="text-[22px] font-extrabold tracking-tight text-text">{titulo}</h1>
          <Badge tone={ESTADO_TONO[estado].tono}>{ESTADO_TONO[estado].texto}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {sello}
        {menu}
      </div>
    </div>
  );
}

// ── Bloque 1 de la ficha: los cuatro estados, siempre completos. No es
// decorativo — es la explicación de qué se puede hacer en cada uno. ──
export function FichaEstado({ estado, textoActual }: { estado: EstadoEvaluacion; textoActual: string }) {
  const indiceActual = ORDEN_ESTADOS.indexOf(estado);
  return (
    <div className="border-b border-border px-[18px] py-[15px]">
      <p className="text-[15px] font-bold text-text">Estado</p>
      <div className="mt-3 flex flex-col gap-[9px]">
        {ORDEN_ESTADOS.map((clave, i) => {
          const esActual = i === indiceActual;
          const esPasado = i < indiceActual;
          return (
            <div key={clave} className="flex items-center gap-2.5">
              <span
                className={cn(
                  'h-[9px] w-[9px] shrink-0 rounded-[3px]',
                  esActual ? 'bg-primary-800' : esPasado ? 'bg-secondary-700' : 'bg-border',
                )}
              />
              <p
                className={cn(
                  'text-sm',
                  esActual ? 'font-bold text-text' : esPasado ? 'text-text-muted' : 'text-text-disabled',
                )}
              >
                {esActual ? textoActual : ETIQUETA_ESTADO[clave]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface ComprobacionFicha {
  ok: boolean;
  textoOk: string;
  textoFalta: string;
}

// ── Bloque 2 de la ficha (solo borrador/lista): qué falta para lanzar. ──
export function BloqueAntesDeLanzar({ items }: { items: ComprobacionFicha[] }) {
  return (
    <div className="border-b border-neutral-100 px-[18px] py-[15px]">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-muted">
        Antes de lanzar
      </p>
      <div className="mt-[11px] flex flex-col gap-2">
        {items.map((item, i) => (
          <p
            key={i}
            className={cn('flex items-start gap-1.5 text-sm', item.ok ? 'text-text-secondary' : 'text-accent-700')}
          >
            <span className={cn('font-bold', item.ok ? 'text-secondary-800' : 'text-accent-700')}>
              {item.ok ? '✓' : '●'}
            </span>
            {item.ok ? item.textoOk : item.textoFalta}
          </p>
        ))}
      </div>
    </div>
  );
}

// ── Bloque 2b (solo lanzada): cifras en vivo del monitoreo. ──────────
export function BloqueAhoraMismo({
  rindiendo,
  terminaron,
  incidentes,
}: {
  rindiendo: number;
  terminaron: number;
  incidentes: number;
}) {
  return (
    <div className="border-b border-neutral-100 px-[18px] py-[15px]">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-muted">Ahora mismo</p>
      <div className="mt-[11px] flex items-baseline gap-[18px]">
        <div>
          <p className="font-mono text-[26px] font-bold text-text">{rindiendo}</p>
          <p className="text-[13px] text-text-muted">rindiendo</p>
        </div>
        <div>
          <p className="font-mono text-[26px] font-bold text-secondary-800">{terminaron}</p>
          <p className="text-[13px] text-text-muted">terminaron</p>
        </div>
        <div>
          <p className="font-mono text-[26px] font-bold text-accent-700">{incidentes}</p>
          <p className="text-[13px] text-text-muted">incidente{incidentes === 1 ? '' : 's'}</p>
        </div>
      </div>
    </div>
  );
}

// ── Modal de eliminación irreversible. Con `confirmacionTexto`, exige
// escribir "eliminar" (evaluación/examen completos); sin él, es la
// versión corta que reemplaza el window.confirm de una pregunta/ejercicio
// suelto. ─────────────────────────────────────────────────────────────
export function ModalConfirmarEliminar({
  titulo,
  cuerpo,
  filas,
  confirmacionTexto = false,
  textoBoton,
  eliminando,
  error,
  onConfirmar,
  onCerrar,
}: {
  titulo: ReactNode;
  cuerpo: ReactNode;
  filas?: string[];
  confirmacionTexto?: boolean;
  textoBoton: string;
  eliminando: boolean;
  error?: string;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const habilitado = !confirmacionTexto || texto.trim().toLowerCase() === 'eliminar';

  return (
    <Modal
      onCerrar={onCerrar}
      eyebrow={confirmacionTexto ? <span className="text-accent-700">Acción irreversible</span> : undefined}
      titulo={titulo}
      maxWidth="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onCerrar}
            disabled={eliminando}
            className="inline-flex h-[38px] items-center justify-center rounded-[9px] border border-border bg-surface px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-hover disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={!habilitado || eliminando}
            className={cn(
              'inline-flex h-[38px] items-center justify-center rounded-[9px] px-[18px] text-sm font-bold transition disabled:cursor-not-allowed',
              habilitado ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-border text-neutral-500',
            )}
          >
            {eliminando ? 'Eliminando…' : textoBoton}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-[13px]">
        <p className="text-[15px] leading-snug text-text-secondary">{cuerpo}</p>
        {filas && filas.length > 0 && (
          <div className="overflow-hidden rounded-[10px] border border-border">
            {filas.map((f, i) => (
              <p
                key={i}
                className={cn(
                  'px-[13px] py-[9px] text-sm text-text-secondary',
                  i < filas.length - 1 && 'border-b border-neutral-100',
                )}
              >
                {f}
              </p>
            ))}
          </div>
        )}
        {confirmacionTexto && (
          <div>
            <p className="text-sm text-text-secondary">
              Escribe <strong className="font-mono text-text">eliminar</strong> para confirmar:
            </p>
            <Input
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="eliminar"
              className="mt-2 h-10 font-mono"
            />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
