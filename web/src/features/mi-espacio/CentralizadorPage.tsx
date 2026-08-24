// E8 · HU-27 · Centralizador (design_handoff_centralizador, dirección
// "2b" aprobada): matriz de estudiantes × evaluaciones finalizadas, con
// la nota final calculada en vivo en un panel lateral (sticky en xl) en
// vez de una tarjeta de configuración separada arriba de la tabla. El
// acumulado se quitó — ver commit anterior — y no vuelve acá.
//
// Fusión con guías (24/08): en vez de un centralizador aparte para la
// nota de guías, se sumaron como columnas más (guías cerradas) al mismo
// Centralizador — misma matriz, misma nómina, un solo Excel. Como
// evaluaciones y guías suelen pesar distinto en la nota final, "Qué
// cuenta" ahora agrupa por tipo (solo cuando hay de ambos) y aparece un
// control de peso evaluaciones/guías; dentro de cada grupo, lo marcado
// sigue pesando igual entre sí (ver calcularNotaFinal).
//
// Todo el cálculo (nota final, promedios, distribución) es en el
// cliente sobre el `Centralizador` que ya trae el GET; no hay queries
// nuevas. La selección de columnas, la nota base y el peso se guardan en
// localStorage por materia para no perderse al recargar.

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { BarChart3, Check, Download, Search } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { UMBRAL_APROBACION } from '../../core/negocio';
import {
  Centralizador,
  ColumnaCentralizador,
  FilaCentralizador,
  Materia,
  claveColumnaCentralizador,
} from '../../core/tipos';
import { Button, EmptyState, Input, PageBreadcrumb, cn } from '../../core/ui/ui';

const PRESETS_NOTA_BASE = [10, 20, 100];
const PESO_EVALUACIONES_DEFECTO = 70;

type CampoOrden = 'final' | 'apellidos';
interface OrdenCentralizador {
  campo: CampoOrden;
  dir: 'asc' | 'desc';
}

interface FilaEnriquecida {
  fila: FilaCentralizador;
  notaFinal: number | null;
  bajoUmbral: boolean;
  tieneSinRendir: boolean;
}

// ── Cálculo (igual al que ya viaja en el Excel exportado) ────────────

/** Promedia el % de cada columna marcada (nota_obtenida/nota_total, 0 si
 * no tiene nota) DENTRO de su grupo (evaluación/guía) y recién combina
 * ambos grupos según `pesoEvaluaciones` antes de multiplicar por la nota
 * base. Si solo hay un grupo marcado, ese pesa 100 % sin importar el
 * peso configurado. */
function calcularNotaFinal(
  fila: FilaCentralizador,
  columnas: ColumnaCentralizador[],
  notaBase: number,
  pesoEvaluaciones: number,
): number {
  const evaluaciones = columnas.filter((c) => c.tipo === 'evaluacion');
  const guias = columnas.filter((c) => c.tipo === 'guia');

  function promedioGrupo(grupo: ColumnaCentralizador[]): number {
    if (grupo.length === 0) return 0;
    const suma = grupo.reduce((acc, c) => {
      if (c.nota_total <= 0) return acc;
      const obtenida = fila.celdas[claveColumnaCentralizador(c)] ?? 0;
      return acc + obtenida / c.nota_total;
    }, 0);
    return suma / grupo.length;
  }

  const hayEval = evaluaciones.length > 0;
  const hayGuia = guias.length > 0;
  let wEval = hayEval ? pesoEvaluaciones : 0;
  let wGuia = hayGuia ? 100 - pesoEvaluaciones : 0;
  if (hayEval && !hayGuia) wEval = 100;
  if (hayGuia && !hayEval) wGuia = 100;
  const wTotal = wEval + wGuia || 100;

  const porcentaje = (promedioGrupo(evaluaciones) * wEval + promedioGrupo(guias) * wGuia) / wTotal;
  return Math.round(porcentaje * notaBase * 100) / 100;
}

function estiloPorPorcentaje(pct: number): { fondo: string; texto: string } {
  if (pct >= 0.8) return { fondo: 'bg-secondary-50', texto: 'text-secondary-800' };
  if (pct >= UMBRAL_APROBACION) return { fondo: '', texto: 'text-text-secondary' };
  return { fondo: 'bg-red-50', texto: 'text-red-700 font-bold' };
}

function formatearNombre(fila: FilaCentralizador): string {
  const [primerApellido, segundoApellido] = fila.apellidos.trim().split(/\s+/);
  const apellido = segundoApellido
    ? `${primerApellido} ${segundoApellido[0].toUpperCase()}.`
    : primerApellido;
  return `${apellido}, ${fila.nombres}`;
}

function formatearNumero(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1);
}

/** FYI dentro de un grupo: aunque tengan distinto puntaje, lo marcado
 * pesa igual entre sí — null si no hace falta aclararlo (0 o 1 marcada). */
function notaTextoPeso(grupo: ColumnaCentralizador[]): string | null {
  if (grupo.length < 2) return null;
  const mayor = grupo.reduce((m, c) => (c.nota_total > m.nota_total ? c : m));
  const menor = grupo.reduce((m, c) => (c.nota_total < m.nota_total ? c : m));
  if (mayor.nota_total === menor.nota_total) return null;
  return `Pesan igual entre sí: "${mayor.tema}" (${mayor.nota_total} pts) vale lo mismo que "${menor.tema}" (${menor.nota_total} pts).`;
}

// ── Persistencia (localStorage por materia) ───────────────────────────

interface ConfigGuardada {
  columnaClaves: string[];
  notaBase: string;
  pesoEvaluaciones: number;
}

function claveConfig(materiaId: number): string {
  return `atenza.centralizador.${materiaId}`;
}

function leerConfigGuardada(materiaId: number): ConfigGuardada | null {
  try {
    const crudo = localStorage.getItem(claveConfig(materiaId));
    if (!crudo) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datos = JSON.parse(crudo) as any;
    if (typeof datos.notaBase !== 'string') return null;
    const pesoEvaluaciones =
      typeof datos.pesoEvaluaciones === 'number' ? datos.pesoEvaluaciones : PESO_EVALUACIONES_DEFECTO;
    if (Array.isArray(datos.columnaClaves)) {
      return { columnaClaves: datos.columnaClaves, notaBase: datos.notaBase, pesoEvaluaciones };
    }
    // Config de antes de la fusión con guías (24/08): solo evaluacion_ids
    // numéricos, sin tipo — se migran a la clave compuesta de hoy.
    if (Array.isArray(datos.evaluacionIds)) {
      return {
        columnaClaves: datos.evaluacionIds.map((id: number) => `evaluacion:${id}`),
        notaBase: datos.notaBase,
        pesoEvaluaciones,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function guardarConfig(materiaId: number, config: ConfigGuardada): void {
  try {
    localStorage.setItem(claveConfig(materiaId), JSON.stringify(config));
  } catch {
    // localStorage puede fallar (modo privado, cuota llena) — no es crítico,
    // simplemente no persiste esta vez.
  }
}

// ── Matriz (columna izquierda) ────────────────────────────────────────

function Matriz({
  columnas,
  filasVisibles,
  filasOcultas,
  mostrarNotaFinal,
  notaBaseNum,
  orden,
  onOrdenar,
  promedioColumna,
  promedioCurso,
}: {
  // Ya vienen filtradas a las marcadas — una evaluación o guía no tiqueada
  // en el panel "Qué cuenta" no aparece acá (antes se mostraba igual, en
  // gris y tachada; se quitó por confuso: parecía que "no cuenta" era otro
  // estado de la evaluación, no una elección del docente).
  columnas: ColumnaCentralizador[];
  filasVisibles: FilaEnriquecida[];
  filasOcultas: number;
  mostrarNotaFinal: boolean;
  notaBaseNum: number;
  orden: OrdenCentralizador;
  onOrdenar: (campo: CampoOrden) => void;
  promedioColumna: (columna: ColumnaCentralizador) => number | null;
  promedioCurso: number;
}) {
  const plantilla = `210px repeat(${columnas.length}, minmax(0,1fr))${mostrarNotaFinal ? ' 116px' : ''}`;
  const flecha = (campo: CampoOrden) => (orden.campo === campo ? (orden.dir === 'asc' ? '▲' : '▼') : '▼');

  if (columnas.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-[14px] py-8 text-center text-sm text-text-secondary">
        Nada marcado. Elige al menos una evaluación o guía en "Qué cuenta" para verla acá.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      {/* Cabecera */}
      <div
        className="sticky top-0 z-20 grid border-b border-border bg-neutral-50"
        style={{ gridTemplateColumns: plantilla }}
      >
        <button
          type="button"
          onClick={() => onOrdenar('apellidos')}
          className="sticky left-0 z-10 flex items-center gap-1 border-r border-border bg-neutral-50 px-[14px] py-[10px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted"
        >
          Estudiante
          {orden.campo === 'apellidos' && <span className="font-mono text-[10px]">{flecha('apellidos')}</span>}
        </button>
        {columnas.map((columna) => {
          const clave = claveColumnaCentralizador(columna);
          return (
            <div
              key={clave}
              className="flex h-[150px] flex-col items-center justify-end gap-[6px] px-1 pt-2 pb-[9px]"
            >
              {columna.tipo === 'guia' && (
                <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-accent-600">Guía</span>
              )}
              {/* Rotado: en columnas angostas el tema horizontal se corta o se
                  superpone con el vecino. Vertical-rl + rotate-180 lo deja de
                  abajo hacia arriba (como en Excel), sin achicar la columna. */}
              <p
                className="max-h-[120px] origin-center text-[12px] font-semibold text-text [writing-mode:vertical-rl] rotate-180 break-words"
                title={columna.tema}
              >
                {columna.tema}
              </p>
              <p className="font-mono text-[10px] text-text-disabled">/{columna.nota_total}</p>
            </div>
          );
        })}
        {mostrarNotaFinal && (
          <button
            type="button"
            onClick={() => onOrdenar('final')}
            className="flex flex-col items-end justify-center gap-[2px] border-l-2 border-primary-800 bg-primary-50 px-3 py-[9px] text-right"
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-primary-800">Final</span>
            <span className="font-mono text-[10px] text-text-muted">
              /{formatearNumero(notaBaseNum)} {flecha('final')}
            </span>
          </button>
        )}
      </div>

      {/* Filas */}
      {filasVisibles.length === 0 ? (
        <p className="px-[14px] py-8 text-center text-sm text-text-secondary">
          Ningún estudiante coincide con la búsqueda.
        </p>
      ) : (
        filasVisibles.map(({ fila, notaFinal, bajoUmbral, tieneSinRendir }) => {
          const rojo = mostrarNotaFinal && bajoUmbral;
          const naranja = !rojo && mostrarNotaFinal && tieneSinRendir;
          return (
            <div
              key={fila.estudiante_id}
              className={cn(
                'grid border-b border-neutral-100 transition hover:bg-surface-hover',
                rojo && 'border-l-[3px] border-l-red-600 bg-red-50 hover:bg-red-50',
                naranja && 'border-l-[3px] border-l-accent-600 bg-accent-50 hover:bg-accent-50',
              )}
              style={{ gridTemplateColumns: plantilla }}
            >
              <div
                className={cn(
                  'sticky left-0 z-[1] flex h-11 items-center truncate border-r border-neutral-100 px-[14px] text-[14px] font-semibold text-text',
                  rojo || naranja ? 'bg-inherit pl-[11px]' : 'bg-surface',
                )}
              >
                {formatearNombre(fila)}
              </div>
              {columnas.map((columna) => {
                const clave = claveColumnaCentralizador(columna);
                const nota = fila.celdas[clave];
                if (nota == null) {
                  return (
                    <div key={clave} className="flex h-11 items-center justify-center bg-accent-50">
                      <span className="font-mono text-[12px] font-bold tracking-[0.04em] text-accent-700">
                        S/R
                      </span>
                    </div>
                  );
                }
                const pct = columna.nota_total > 0 ? nota / columna.nota_total : 0;
                const estilo = estiloPorPorcentaje(pct);
                return (
                  <div key={clave} className={cn('flex h-11 items-center justify-center', estilo.fondo)}>
                    <span className={cn('font-mono text-[14px]', estilo.texto)}>{nota}</span>
                  </div>
                );
              })}
              {mostrarNotaFinal && (
                <div className="flex h-11 items-center justify-end border-l-2 border-primary-800 bg-primary-50 px-3">
                  <span
                    className={cn(
                      'font-mono text-[17px] font-bold',
                      bajoUmbral ? 'text-red-700' : tieneSinRendir ? 'text-accent-700' : 'text-text',
                    )}
                  >
                    {(notaFinal ?? 0).toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Pie: cuántas filas quedan ocultas por la búsqueda/filtro */}
      {filasOcultas > 0 && (
        <div className="border-b border-neutral-100 bg-neutral-50 px-[14px] py-[9px]">
          <p className="font-mono text-[11px] tracking-[0.04em] text-text-disabled">
            {filasOcultas} fila{filasOcultas === 1 ? '' : 's'} más · {' '}
            {orden.campo === 'final' ? 'ordenadas por nota final' : 'ordenadas alfabéticamente'}
          </p>
        </div>
      )}

      {/* Fila de promedios */}
      <div className="grid border-t border-border bg-neutral-50" style={{ gridTemplateColumns: plantilla }}>
        <div className="flex items-center border-r border-border px-[14px] py-[9px]">
          <p className="text-[12px] font-bold text-text">Promedio</p>
        </div>
        {columnas.map((columna) => {
          const prom = promedioColumna(columna);
          const bajo = prom !== null && columna.nota_total > 0 && prom / columna.nota_total < UMBRAL_APROBACION;
          return (
            <div key={claveColumnaCentralizador(columna)} className="flex items-center justify-center py-[9px]">
              <span
                className={cn(
                  'font-mono text-[12px] font-bold',
                  bajo ? 'text-accent-700' : 'text-text-secondary',
                )}
              >
                {prom !== null ? prom.toFixed(1) : '—'}
              </span>
            </div>
          );
        })}
        {mostrarNotaFinal && (
          <div className="flex items-center justify-end border-l-2 border-primary-800 bg-primary-100 px-3 py-[9px]">
            <span className="font-mono text-[14px] font-bold text-primary-800">{promedioCurso.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Panel de nota final (columna derecha) ─────────────────────────────

function ListaQueCuenta({
  columnas,
  marcadas,
  pesoPorColumna,
  onAlternarColumna,
}: {
  columnas: ColumnaCentralizador[];
  marcadas: Set<string>;
  pesoPorColumna: (columna: ColumnaCentralizador) => number;
  onAlternarColumna: (clave: string) => void;
}) {
  return (
    <div className="mt-[9px] grid grid-cols-2 gap-2 xl:grid-cols-1 xl:gap-[7px]">
      {columnas.map((columna) => {
        const clave = claveColumnaCentralizador(columna);
        const marcada = marcadas.has(clave);
        return (
          <button
            key={clave}
            type="button"
            role="checkbox"
            aria-checked={marcada}
            onClick={() => onAlternarColumna(clave)}
            className={cn(
              'flex h-[38px] items-center gap-[10px] rounded-[9px] border px-[11px] text-left transition',
              marcada
                ? 'border-primary-200 bg-primary-50 hover:border-primary-300'
                : 'border-border bg-neutral-50 hover:bg-surface-hover',
            )}
          >
            <span
              className={cn(
                'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded',
                marcada ? 'bg-primary-800' : 'border border-neutral-300 bg-surface',
              )}
            >
              {marcada && <Check size={11} strokeWidth={3} className="text-white" />}
            </span>
            <span
              className={cn(
                'flex-1 truncate text-[14px] font-semibold text-text',
                !marcada && 'font-medium text-text-disabled',
              )}
            >
              {columna.tema}
            </span>
            <span className={cn('font-mono text-[12px]', marcada ? 'text-text-disabled' : 'text-neutral-300')}>
              /{columna.nota_total}
            </span>
            <span
              className={cn(
                'font-mono text-[12px] font-bold',
                marcada ? 'text-primary-800' : 'font-normal text-neutral-300',
              )}
            >
              {marcada ? `${formatearNumero(pesoPorColumna(columna))} %` : '—'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PanelNotaFinal({
  columnas,
  marcadas,
  columnasSeleccionadas,
  notaBase,
  origenPreset,
  pesoEvaluaciones,
  onCambiarNotaBase,
  onElegirPreset,
  onAlternarColumna,
  onCambiarPesoEvaluaciones,
  onMarcarTodas,
  onMarcarNinguna,
  mostrarNotaFinal,
  notaBaseNum,
  promedioCurso,
  aprueban,
  totalEstudiantes,
  conteoAlto,
  conteoMedio,
  conteoBajo,
  umbralValor,
  altoValor,
  celdasSinRendir,
  estudiantesConSinRendir,
  onVerSinRendir,
  exportando,
  errorExportar,
  onExportar,
}: {
  columnas: ColumnaCentralizador[];
  marcadas: Set<string>;
  columnasSeleccionadas: ColumnaCentralizador[];
  notaBase: string;
  origenPreset: boolean;
  pesoEvaluaciones: number;
  onCambiarNotaBase: (valor: string) => void;
  onElegirPreset: (valor: number) => void;
  onAlternarColumna: (clave: string) => void;
  onCambiarPesoEvaluaciones: (valor: number) => void;
  onMarcarTodas: () => void;
  onMarcarNinguna: () => void;
  mostrarNotaFinal: boolean;
  notaBaseNum: number;
  promedioCurso: number;
  aprueban: number;
  totalEstudiantes: number;
  conteoAlto: number;
  conteoMedio: number;
  conteoBajo: number;
  umbralValor: number;
  altoValor: number;
  celdasSinRendir: number;
  estudiantesConSinRendir: number;
  onVerSinRendir: () => void;
  exportando: boolean;
  errorExportar: string;
  onExportar: () => void;
}) {
  const todasMarcadas = columnas.length > 0 && marcadas.size === columnas.length;

  const columnasEvaluacion = columnas.filter((c) => c.tipo === 'evaluacion');
  const columnasGuia = columnas.filter((c) => c.tipo === 'guia');
  const hayAmbosTipos = columnasEvaluacion.length > 0 && columnasGuia.length > 0;

  const evalSeleccionadas = columnasSeleccionadas.filter((c) => c.tipo === 'evaluacion');
  const guiaSeleccionadas = columnasSeleccionadas.filter((c) => c.tipo === 'guia');
  const hayEvalMarcada = evalSeleccionadas.length > 0;
  const hayGuiaMarcada = guiaSeleccionadas.length > 0;
  let wEval = hayEvalMarcada ? pesoEvaluaciones : 0;
  let wGuia = hayGuiaMarcada ? 100 - pesoEvaluaciones : 0;
  if (hayEvalMarcada && !hayGuiaMarcada) wEval = 100;
  if (hayGuiaMarcada && !hayEvalMarcada) wGuia = 100;
  const pesoPorEvaluacion = hayEvalMarcada ? wEval / evalSeleccionadas.length : 0;
  const pesoPorGuia = hayGuiaMarcada ? wGuia / guiaSeleccionadas.length : 0;

  function pesoPorColumna(columna: ColumnaCentralizador): number {
    return columna.tipo === 'guia' ? pesoPorGuia : pesoPorEvaluacion;
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
        {/* 1 · Cabecera */}
        <div className="border-b border-border px-[18px] py-[14px]">
          <p className="text-[15px] font-bold text-text">Nota final</p>
          <p className="mt-[3px] text-[13px] leading-[1.45] text-text-muted">
            {hayAmbosTipos
              ? 'El % de lo marcado se promedia dentro de su grupo (evaluaciones/guías), los grupos se combinan según su peso, y recién ahí se multiplica por la nota base.'
              : 'El % de cada evaluación marcada se promedia y se multiplica por la nota base.'}
          </p>
        </div>

        {/* 2 · Nota base */}
        <div className="flex flex-col gap-[9px] border-b border-neutral-100 px-[18px] py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">Nota base</p>
          <div className="flex items-center gap-[10px]">
            <div role="radiogroup" aria-label="Nota base" className="flex h-10 overflow-hidden rounded-[9px] border border-border">
              {PRESETS_NOTA_BASE.map((preset, i) => {
                const activo = origenPreset && Number(notaBase) === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => onElegirPreset(preset)}
                    className={cn(
                      'px-[13px] font-mono text-[14px] transition',
                      i > 0 && 'border-l border-border',
                      activo
                        ? 'bg-primary-800 font-bold text-white'
                        : 'bg-surface font-medium text-text-secondary hover:bg-surface-hover',
                    )}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="Otra"
              value={origenPreset ? '' : notaBase}
              onChange={(e) => onCambiarNotaBase(e.target.value)}
              className="h-10 flex-1 rounded-[9px] font-mono text-[14px]"
            />
          </div>
        </div>

        {/* 3 · Qué cuenta */}
        <div className="border-b border-neutral-100 px-[18px] py-4">
          <div className="flex items-baseline justify-between gap-[10px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">Qué cuenta</p>
            <button
              type="button"
              onClick={todasMarcadas ? onMarcarNinguna : onMarcarTodas}
              className="text-[13px] font-medium text-link hover:underline"
            >
              {todasMarcadas ? 'Ninguna' : 'Todas'}
            </button>
          </div>

          {hayAmbosTipos ? (
            <>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.04em] text-text-disabled">
                Evaluaciones
              </p>
              <ListaQueCuenta
                columnas={columnasEvaluacion}
                marcadas={marcadas}
                pesoPorColumna={pesoPorColumna}
                onAlternarColumna={onAlternarColumna}
              />
              {notaTextoPeso(evalSeleccionadas) && (
                <p className="mt-2 text-[12px] leading-[1.4] text-text-muted">{notaTextoPeso(evalSeleccionadas)}</p>
              )}

              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.04em] text-text-disabled">Guías</p>
              <ListaQueCuenta
                columnas={columnasGuia}
                marcadas={marcadas}
                pesoPorColumna={pesoPorColumna}
                onAlternarColumna={onAlternarColumna}
              />
              {notaTextoPeso(guiaSeleccionadas) && (
                <p className="mt-2 text-[12px] leading-[1.4] text-text-muted">{notaTextoPeso(guiaSeleccionadas)}</p>
              )}
            </>
          ) : (
            <>
              <ListaQueCuenta
                columnas={columnas}
                marcadas={marcadas}
                pesoPorColumna={pesoPorColumna}
                onAlternarColumna={onAlternarColumna}
              />
              {notaTextoPeso(columnasSeleccionadas) && (
                <p className="mt-3 text-[13px] leading-[1.45] text-text-muted">
                  {notaTextoPeso(columnasSeleccionadas)}
                </p>
              )}
            </>
          )}
        </div>

        {/* 3b · Peso evaluaciones/guías — solo si hay marcado de ambos tipos */}
        {hayEvalMarcada && hayGuiaMarcada && (
          <div className="border-b border-neutral-100 px-[18px] py-4">
            <div className="flex items-baseline justify-between gap-[10px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                Peso evaluaciones / guías
              </p>
              <span className="font-mono text-[13px] font-bold text-text">
                {formatearNumero(wEval)} % / {formatearNumero(wGuia)} %
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={pesoEvaluaciones}
              onChange={(e) => onCambiarPesoEvaluaciones(Number(e.target.value))}
              className="mt-3 w-full accent-primary-700"
              aria-label="Peso de evaluaciones frente a guías"
            />
            <p className="mt-2 text-[13px] leading-[1.45] text-text-muted">
              Cuánto pesa cada grupo en la nota final. Dentro de cada uno, lo marcado sigue pesando igual entre sí.
            </p>
          </div>
        )}

        {/* 4 · Resultado */}
        <div className="px-[18px] py-4">
          {mostrarNotaFinal ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-[10px]">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                    Promedio del curso
                  </p>
                  <p className="font-mono text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-text">
                    {promedioCurso.toFixed(1)}{' '}
                    <span className="text-[14px] font-medium text-text-muted">/{formatearNumero(notaBaseNum)}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">Aprueban</p>
                  <p className="font-mono text-[30px] font-bold leading-[1.1] text-secondary-700">{aprueban}</p>
                </div>
              </div>
              <div className="flex h-[9px] overflow-hidden rounded-full">
                {conteoAlto > 0 && (
                  <div className="bg-secondary-700" style={{ width: `${(conteoAlto / totalEstudiantes) * 100}%` }} />
                )}
                {conteoMedio > 0 && (
                  <div className="bg-primary-500" style={{ width: `${(conteoMedio / totalEstudiantes) * 100}%` }} />
                )}
                {conteoBajo > 0 && (
                  <div className="bg-red-600" style={{ width: `${(conteoBajo / totalEstudiantes) * 100}%` }} />
                )}
              </div>
              <p className="text-[13px] leading-[1.45] text-text-muted">
                {conteoAlto} sobre {formatearNumero(altoValor)} · {conteoMedio} entre {formatearNumero(umbralValor)} y{' '}
                {formatearNumero(altoValor)} ·{' '}
                <strong className="font-semibold text-red-700">
                  {conteoBajo} bajo {formatearNumero(umbralValor)}
                </strong>
              </p>
            </div>
          ) : (
            <p className="text-[13px] leading-[1.45] text-text-disabled">
              Elige una nota base y al menos una evaluación o guía para ver la nota final.
            </p>
          )}
        </div>
      </div>

      {mostrarNotaFinal && celdasSinRendir > 0 && (
        <div className="flex flex-col gap-[7px] rounded-xl border border-accent-200 bg-accent-50 px-4 py-[14px]">
          <p className="text-[14px] leading-[1.5] text-accent-700">
            <strong>
              {celdasSinRendir} celda{celdasSinRendir === 1 ? '' : 's'} sin rendir
            </strong>{' '}
            entre las marcadas. Cuentan como 0 % y bajan la nota final de {estudiantesConSinRendir} estudiante
            {estudiantesConSinRendir === 1 ? '' : 's'}.
          </p>
          <button
            type="button"
            onClick={onVerSinRendir}
            className="text-left text-[14px] font-semibold text-accent-700 hover:underline"
          >
            Ver quiénes son
          </button>
        </div>
      )}

      <Button
        variante="primary"
        onClick={onExportar}
        disabled={exportando}
        className="w-full justify-start gap-2 rounded-[9px] px-[18px] py-[13px] text-[15px] font-bold"
      >
        <Download size={16} />
        {exportando ? 'Exportando…' : mostrarNotaFinal ? 'Exportar con esta nota final' : 'Exportar a Excel'}
      </Button>
      <p className="-mt-1 text-[13px] leading-[1.45] text-text-muted">
        {mostrarNotaFinal
          ? `El Excel lleva la matriz y la columna Nota final /${formatearNumero(notaBaseNum)} tal como se ve acá.`
          : 'El Excel lleva la matriz tal como está.'}
      </p>
      {errorExportar && <p className="text-sm text-red-600">{errorExportar}</p>}
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────

export function CentralizadorPage() {
  const { id } = useParams();
  const materiaId = Number(id);

  const [errorExportar, setErrorExportar] = useState('');
  const [exportando, setExportando] = useState(false);

  const { data: materia } = useQuery({
    queryKey: ['materia', String(materiaId)],
    queryFn: async () => {
      const { data } = await api.get<{ materia: Materia }>(`/api/materias/${materiaId}`);
      return data.materia;
    },
  });

  const {
    data: centralizador,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['centralizador', String(materiaId)],
    queryFn: async () => {
      const { data } = await api.get<{ centralizador: Centralizador }>(
        `/api/materias/${materiaId}/centralizador`,
      );
      return data.centralizador;
    },
  });

  // Nota final: selección de columnas + nota base + peso evaluaciones/guías,
  // persistidos en localStorage por materia (leerConfigGuardada/guardarConfig
  // arriba).
  const [seleccionadas, setSeleccionadas] = useState<Set<string> | null>(null);
  const [notaBase, setNotaBase] = useState('');
  const [origenPreset, setOrigenPreset] = useState(false);
  const [pesoEvaluaciones, setPesoEvaluaciones] = useState(PESO_EVALUACIONES_DEFECTO);
  const hidratado = useRef(false);

  useEffect(() => {
    if (centralizador && seleccionadas === null) {
      const clavesValidas = new Set(centralizador.columnas.map(claveColumnaCentralizador));
      const guardada = leerConfigGuardada(materiaId);
      if (guardada) {
        setSeleccionadas(new Set(guardada.columnaClaves.filter((clave) => clavesValidas.has(clave))));
        setNotaBase(guardada.notaBase);
        setOrigenPreset(PRESETS_NOTA_BASE.includes(Number(guardada.notaBase)));
        setPesoEvaluaciones(guardada.pesoEvaluaciones);
      } else {
        setSeleccionadas(clavesValidas);
      }
      hidratado.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centralizador, materiaId]);

  useEffect(() => {
    if (!hidratado.current || seleccionadas === null) return;
    guardarConfig(materiaId, { columnaClaves: Array.from(seleccionadas), notaBase, pesoEvaluaciones });
  }, [seleccionadas, notaBase, pesoEvaluaciones, materiaId]);

  const [ordenManual, setOrdenManual] = useState<OrdenCentralizador | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroSinRendir, setFiltroSinRendir] = useState(false);

  const marcadas = seleccionadas ?? new Set<string>();
  const columnas = centralizador?.columnas ?? [];
  const columnasSeleccionadas = columnas.filter((c) => marcadas.has(claveColumnaCentralizador(c)));
  const notaBaseNum = Number(notaBase);
  const notaBaseValida = notaBase.trim() !== '' && Number.isFinite(notaBaseNum) && notaBaseNum > 0;
  const mostrarNotaFinal = notaBaseValida && columnasSeleccionadas.length > 0;

  useEffect(() => {
    if (!mostrarNotaFinal) setFiltroSinRendir(false);
  }, [mostrarNotaFinal]);

  const umbralValor = mostrarNotaFinal ? notaBaseNum * UMBRAL_APROBACION : 0;
  const altoValor = mostrarNotaFinal ? notaBaseNum * 0.8 : 0;

  const filasEnriquecidas: FilaEnriquecida[] = (centralizador?.filas ?? []).map((fila) => {
    const tieneSinRendir = columnasSeleccionadas.some((c) => fila.celdas[claveColumnaCentralizador(c)] == null);
    const notaFinal = mostrarNotaFinal
      ? calcularNotaFinal(fila, columnasSeleccionadas, notaBaseNum, pesoEvaluaciones)
      : null;
    return {
      fila,
      notaFinal,
      bajoUmbral: notaFinal !== null && notaFinal < umbralValor,
      tieneSinRendir,
    };
  });

  const totalEstudiantes = filasEnriquecidas.length;
  const promedioCurso =
    mostrarNotaFinal && totalEstudiantes > 0
      ? filasEnriquecidas.reduce((acc, f) => acc + (f.notaFinal ?? 0), 0) / totalEstudiantes
      : 0;
  const aprueban = filasEnriquecidas.filter((f) => (f.notaFinal ?? 0) >= umbralValor).length;
  const conteoAlto = filasEnriquecidas.filter((f) => (f.notaFinal ?? 0) >= altoValor).length;
  const conteoBajo = filasEnriquecidas.filter((f) => (f.notaFinal ?? 0) < umbralValor).length;
  const conteoMedio = totalEstudiantes - conteoAlto - conteoBajo;

  const celdasSinRendir = filasEnriquecidas.reduce(
    (acc, f) =>
      acc + columnasSeleccionadas.filter((c) => f.fila.celdas[claveColumnaCentralizador(c)] == null).length,
    0,
  );
  const estudiantesConSinRendir = filasEnriquecidas.filter((f) => f.tieneSinRendir).length;

  function promedioColumna(columna: ColumnaCentralizador): number | null {
    const clave = claveColumnaCentralizador(columna);
    const valores = (centralizador?.filas ?? [])
      .map((f) => f.celdas[clave])
      .filter((v): v is number => v != null);
    if (valores.length === 0) return null;
    return valores.reduce((a, b) => a + b, 0) / valores.length;
  }

  const orden: OrdenCentralizador =
    ordenManual ?? (mostrarNotaFinal ? { campo: 'final', dir: 'desc' } : { campo: 'apellidos', dir: 'asc' });

  function alternarOrden(campo: CampoOrden) {
    setOrdenManual((prev) => {
      if (prev && prev.campo === campo) return { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      return { campo, dir: campo === 'final' ? 'desc' : 'asc' };
    });
  }

  const filasVisibles = filasEnriquecidas
    .filter((f) => {
      if (!busqueda.trim()) return true;
      const objetivo = `${f.fila.apellidos} ${f.fila.nombres}`.toLowerCase();
      return objetivo.includes(busqueda.trim().toLowerCase());
    })
    .filter((f) => !filtroSinRendir || f.tieneSinRendir)
    .sort((a, b) => {
      const cmp =
        orden.campo === 'final'
          ? (a.notaFinal ?? -Infinity) - (b.notaFinal ?? -Infinity)
          : `${a.fila.apellidos} ${a.fila.nombres}`.localeCompare(`${b.fila.apellidos} ${b.fila.nombres}`, 'es');
      return orden.dir === 'asc' ? cmp : -cmp;
    });
  const filasOcultas = filasEnriquecidas.length - filasVisibles.length;

  function alternarColumna(clave: string) {
    setSeleccionadas((prev) => {
      const siguiente = new Set(prev ?? []);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  async function exportar() {
    setExportando(true);
    setErrorExportar('');
    try {
      // Si hay una "Nota final" calculada, se manda tal cual para que el
      // Excel traiga esa misma columna extra.
      const params = mostrarNotaFinal
        ? {
            columna_claves: columnasSeleccionadas.map(claveColumnaCentralizador).join(','),
            nota_base: notaBaseNum,
            peso_evaluaciones: pesoEvaluaciones,
            peso_guias: 100 - pesoEvaluaciones,
          }
        : undefined;
      // responseType 'blob' (en vez de un <a href> plano) para que el
      // interceptor de axios adjunte el Bearer token de la sesión.
      const respuesta = await api.get(`/api/materias/${materiaId}/centralizador/exportar`, {
        responseType: 'blob',
        params,
      });
      const url = URL.createObjectURL(respuesta.data as Blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `centralizador_${materiaId}.xlsx`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorExportar(mensajeDeError(err));
    } finally {
      setExportando(false);
    }
  }

  const totalEvaluaciones = columnas.filter((c) => c.tipo === 'evaluacion').length;
  const totalGuias = columnas.filter((c) => c.tipo === 'guia').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-4">
        <div className="flex flex-col gap-[5px]">
          <PageBreadcrumb>
            <Link to={`/materias/${id}`}>‹ {materia?.nombre_materia ?? 'Materia'}</Link>
          </PageBreadcrumb>
          <h1 className="text-[22px] font-extrabold tracking-tight text-text">Centralizador</h1>
          {centralizador && (
            <p className="text-[15px] text-text-secondary">
              {centralizador.filas.length} estudiante{centralizador.filas.length === 1 ? '' : 's'} ·{' '}
              {totalEvaluaciones} evaluación{totalEvaluaciones === 1 ? '' : 'es'} finalizada
              {totalEvaluaciones === 1 ? '' : 's'}
              {totalGuias > 0 && (
                <>
                  {' '}
                  · {totalGuias} guía{totalGuias === 1 ? '' : 's'} cerrada{totalGuias === 1 ? '' : 's'}
                </>
              )}
            </p>
          )}
        </div>
        {centralizador && centralizador.filas.length >= 15 && (
          <Input
            iconoIzq={<Search size={14} />}
            placeholder="Buscar estudiante"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-9 w-64 text-[13px]"
          />
        )}
      </div>

      {filtroSinRendir && (
        <p className="text-sm text-text-muted">
          Mostrando solo estudiantes con notas sin rendir entre las marcadas.{' '}
          <button
            type="button"
            onClick={() => setFiltroSinRendir(false)}
            className="font-medium text-link hover:underline"
          >
            Quitar filtro
          </button>
        </p>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_336px]">
          <div className="animate-pulse space-y-2 rounded-xl border border-border bg-surface p-4">
            <div className="h-9 rounded bg-neutral-100" />
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-11 rounded bg-neutral-100" />
            ))}
          </div>
          <div className="hidden animate-pulse flex-col gap-[14px] xl:flex">
            <div className="h-10 rounded-[9px] bg-neutral-100" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[38px] rounded-[9px] bg-neutral-100" />
            ))}
            <div className="h-[76px] rounded-[9px] bg-neutral-100" />
          </div>
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-6">
          <p className="text-sm text-red-600">{mensajeDeError(error)}</p>
          <Button variante="secondary" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {centralizador && centralizador.columnas.length === 0 && (
        <EmptyState
          icon={<BarChart3 size={32} />}
          title="Todavía no hay evaluaciones ni guías cerradas"
          description="En cuanto termine la primera evaluación o se cierre la primera guía, aparecerá acá con la nota de cada estudiante."
        />
      )}

      {centralizador && centralizador.columnas.length > 0 && (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_336px]">
          <div className="order-2 xl:order-1">
            <Matriz
              columnas={columnasSeleccionadas}
              filasVisibles={filasVisibles}
              filasOcultas={filasOcultas}
              mostrarNotaFinal={mostrarNotaFinal}
              notaBaseNum={notaBaseNum}
              orden={orden}
              onOrdenar={alternarOrden}
              promedioColumna={promedioColumna}
              promedioCurso={promedioCurso}
            />
          </div>
          <div className="order-1 w-full xl:sticky xl:top-5 xl:order-2 xl:w-[336px]">
            <PanelNotaFinal
              columnas={columnas}
              marcadas={marcadas}
              columnasSeleccionadas={columnasSeleccionadas}
              notaBase={notaBase}
              origenPreset={origenPreset}
              pesoEvaluaciones={pesoEvaluaciones}
              onCambiarNotaBase={(valor) => {
                setNotaBase(valor);
                setOrigenPreset(false);
              }}
              onElegirPreset={(valor) => {
                setNotaBase(String(valor));
                setOrigenPreset(true);
              }}
              onAlternarColumna={alternarColumna}
              onCambiarPesoEvaluaciones={setPesoEvaluaciones}
              onMarcarTodas={() => setSeleccionadas(new Set(columnas.map(claveColumnaCentralizador)))}
              onMarcarNinguna={() => setSeleccionadas(new Set())}
              mostrarNotaFinal={mostrarNotaFinal}
              notaBaseNum={notaBaseNum}
              promedioCurso={promedioCurso}
              aprueban={aprueban}
              totalEstudiantes={totalEstudiantes}
              conteoAlto={conteoAlto}
              conteoMedio={conteoMedio}
              conteoBajo={conteoBajo}
              umbralValor={umbralValor}
              altoValor={altoValor}
              celdasSinRendir={celdasSinRendir}
              estudiantesConSinRendir={estudiantesConSinRendir}
              onVerSinRendir={() => setFiltroSinRendir(true)}
              exportando={exportando}
              errorExportar={errorExportar}
              onExportar={exportar}
            />
          </div>
        </div>
      )}
    </div>
  );
}
