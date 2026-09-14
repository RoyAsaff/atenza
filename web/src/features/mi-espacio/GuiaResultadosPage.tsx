// Guías nativas (16/08) · Resultados de una guía lanzada — nota oficial,
// intentos totales (oficial + repasos), incidencias, y las acciones de
// pausar/reactivar/cancelar del intento oficial. Calca ResultadosPage y
// MonitoreoPage de exámenes.
//
// 13/09: mismo lenguaje visual que MonitoreoPage (design_handoff_monitoreo,
// 18/08) — encabezado con punto de estado, tabla nativa con encabezado
// uppercase y pie con el total, en vez del Card/PageHeader/Tabla genérico
// de antes.

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { obtenerSocket } from '../../core/realtime/socket';
import { EstadoGuia, EstadoIntento, FilaResultadoGuia, Guia } from '../../core/tipos';
import { Alert, Badge, cn, PageBreadcrumb } from '../../core/ui/ui';

const ESTADO_INTENTO_TONO: Record<
  EstadoIntento,
  { texto: string; tono: 'neutral' | 'success' | 'info' | 'warning' | 'dark' }
> = {
  en_curso: { texto: 'En curso', tono: 'success' },
  pausado: { texto: 'Pausado', tono: 'warning' },
  finalizado: { texto: 'Finalizado', tono: 'dark' },
  desconectado: { texto: 'Desconectado', tono: 'neutral' },
  cancelado: { texto: 'Cancelado', tono: 'neutral' },
};

const ESTADO_GUIA_TEXTO: Record<EstadoGuia, string> = {
  publicada: 'Publicada',
  lanzada: 'Lanzada',
  cerrada: 'Cerrada',
  externa_legacy: 'Externa',
};

function FilaResultado({
  fila,
  materiaId,
  guiaId,
  puedeGestionar,
}: {
  fila: FilaResultadoGuia;
  materiaId: number;
  guiaId: number;
  puedeGestionar: boolean;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const alTerminar = {
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['guia-resultados', String(guiaId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  };

  const pausar = useMutation({
    mutationFn: () =>
      api.post(
        `/api/materias/${materiaId}/guias/${guiaId}/intentos/${fila.intento_id}/pausar`,
      ),
    ...alTerminar,
  });
  const reactivar = useMutation({
    mutationFn: () =>
      api.post(
        `/api/materias/${materiaId}/guias/${guiaId}/intentos/${fila.intento_id}/reactivar`,
      ),
    ...alTerminar,
  });

  return (
    <tr className="border-b border-neutral-100 transition last:border-b-0 hover:bg-surface-hover">
      <td className="px-4 py-2 text-[14px] font-semibold text-text">
        {fila.apellidos} {fila.nombres}
      </td>
      <td className="px-4 py-2">
        {fila.estado_oficial ? (
          <Badge tone={ESTADO_INTENTO_TONO[fila.estado_oficial].tono}>
            {ESTADO_INTENTO_TONO[fila.estado_oficial].texto}
          </Badge>
        ) : (
          <span className="font-mono text-[12px] text-text-disabled">—</span>
        )}
      </td>
      <td className="px-4 py-2 text-text-secondary">
        {fila.aciertos !== null ? (
          `${fila.aciertos}/${fila.total_preguntas}`
        ) : (
          <span className="font-mono text-[12px] text-text-disabled">—</span>
        )}
      </td>
      <td className="px-4 py-2 text-text-secondary">
        {fila.nota_obtenida !== null ? (
          `${fila.nota_obtenida}/${fila.nota_total}`
        ) : (
          <span className="text-accent-700">Pendiente</span>
        )}
      </td>
      <td className="px-4 py-2 text-text-secondary">{fila.total_intentos}</td>
      <td className="px-4 py-2">
        {fila.incidentes > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2 py-[2px] text-[11px] font-bold text-accent-700">
            <AlertTriangle size={11} />
            {fila.incidentes}
          </span>
        ) : (
          <span className="font-mono text-[12px] text-text-disabled">—</span>
        )}
      </td>
      <td className="px-4 py-2 text-right">
        {puedeGestionar && fila.intento_id && (
          <>
            {(fila.estado_oficial === 'en_curso' || fila.estado_oficial === 'desconectado') && (
              <button
                onClick={() => pausar.mutate()}
                disabled={pausar.isPending}
                className="text-[13px] font-semibold text-accent-700 hover:text-accent-800 disabled:opacity-50"
              >
                Pausar
              </button>
            )}
            {fila.estado_oficial === 'pausado' && (
              <button
                onClick={() => reactivar.mutate()}
                disabled={reactivar.isPending}
                className="text-[13px] font-semibold text-link hover:text-primary-800 disabled:opacity-50"
              >
                Reactivar
              </button>
            )}
          </>
        )}
        {error && <p className="mt-0.5 text-[11px] text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

function EsqueletoGuiaResultados() {
  return (
    <div className="animate-pulse">
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="h-[70px] bg-surface" />
      </div>
      <div className="mt-[18px] overflow-hidden rounded-xl border border-border bg-surface">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex h-9 items-center gap-4 border-b border-neutral-100 px-4 last:border-b-0">
            <div className="h-3 flex-1 rounded bg-neutral-100" />
            <div className="h-3 w-[90px] rounded bg-neutral-100" />
            <div className="h-3 w-[60px] rounded bg-neutral-100" />
            <div className="h-3 w-[60px] rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GuiaResultadosPage() {
  const { id, guiaId } = useParams();
  const materiaId = Number(id);
  const queryClient = useQueryClient();
  const [errorAccion, setErrorAccion] = useState('');

  const { data: guia } = useQuery({
    queryKey: ['guia', guiaId],
    queryFn: async () => {
      const { data } = await api.get<{ guia: Guia & { tema: string } }>(
        `/api/materias/${materiaId}/guias/${guiaId}`,
      );
      return data.guia;
    },
  });

  const {
    data: resultados,
    isLoading,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['guia-resultados', guiaId],
    queryFn: async () => {
      const { data } = await api.get<{ resultados: FilaResultadoGuia[] }>(
        `/api/materias/${materiaId}/guias/${guiaId}/resultados`,
      );
      return data.resultados;
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const { data: pendientes } = useQuery({
    queryKey: ['guia-revision', guiaId],
    queryFn: async () => {
      const { data } = await api.get<{ pendientes: unknown[] }>(
        `/api/materias/${materiaId}/guias/${guiaId}/revision`,
      );
      return data.pendientes.length;
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  // En vivo: los eventos por intento no traen datos suficientes para
  // parchar esta tabla (está agrupada por estudiante, no por intento) —
  // a diferencia de Monitoreo de exámenes, acá se opta por invalidar y
  // volver a pedir (clases chicas, costo bajo) en vez de armar el join.
  useEffect(() => {
    const socket = obtenerSocket();
    const claveResultados = ['guia-resultados', guiaId];
    const claveRevision = ['guia-revision', guiaId];

    const unirseASala = () => {
      socket.emit('monitorear-guia', Number(guiaId));
      queryClient.invalidateQueries({ queryKey: claveResultados });
    };
    unirseASala();
    socket.on('connect', unirseASala);

    const refrescar = () => {
      queryClient.invalidateQueries({ queryKey: claveResultados });
      queryClient.invalidateQueries({ queryKey: claveRevision });
    };
    socket.on('progreso', refrescar);
    socket.on('incidente', refrescar);
    socket.on('intento-actualizado', refrescar);
    socket.on('estado-actualizado', refrescar);

    return () => {
      socket.off('connect', unirseASala);
      socket.off('progreso', refrescar);
      socket.off('incidente', refrescar);
      socket.off('intento-actualizado', refrescar);
      socket.off('estado-actualizado', refrescar);
    };
  }, [guiaId, queryClient]);

  const cancelar = useMutation({
    mutationFn: () => api.post(`/api/materias/${materiaId}/guias/${guiaId}/cancelar`),
    onSuccess: () => {
      setErrorAccion('');
      queryClient.invalidateQueries({ queryKey: ['guia', guiaId] });
      queryClient.invalidateQueries({ queryKey: ['guia-resultados', guiaId] });
    },
    onError: (err: unknown) => setErrorAccion(mensajeDeError(err)),
  });

  function manejarCancelar() {
    if (
      window.confirm(
        'Se cancela el lanzamiento para todo el curso. Se conservan las respuestas ya guardadas. ¿Continuar?',
      )
    ) {
      cancelar.mutate();
    }
  }

  const puedeGestionar = guia?.estado === 'lanzada';

  return (
    <div>
      <PageBreadcrumb>
        <Link to={`/materias/${id}`}>‹ Materia</Link>
      </PageBreadcrumb>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex items-center gap-5 bg-surface px-[22px] py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={cn('h-[7px] w-[7px] shrink-0 rounded-full', puedeGestionar ? 'bg-secondary-500' : 'bg-neutral-300')}
              />
              <p
                className={cn(
                  'font-mono text-[10px] font-medium uppercase tracking-[0.1em]',
                  puedeGestionar ? 'text-secondary-700' : 'text-text-muted',
                )}
              >
                {guia ? ESTADO_GUIA_TEXTO[guia.estado] : 'Guía'}
              </p>
            </div>
            <h1 className="mt-[5px] truncate text-[19px] font-extrabold tracking-tight text-text">
              {guia?.tema ?? 'Resultados'}
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Nota del intento oficial, intentos totales e incidencias por estudiante.
            </p>
          </div>

          {puedeGestionar && (
            <div className="flex shrink-0 items-center gap-2">
              <Link
                to={`/materias/${id}/guias/${guiaId}/monitoreo`}
                className="rounded-lg border border-border bg-surface px-[15px] py-2.5 text-sm font-semibold text-text-secondary transition hover:bg-surface-hover"
              >
                Monitoreo en vivo
              </Link>
              <button
                type="button"
                onClick={manejarCancelar}
                disabled={cancelar.isPending}
                className="rounded-lg bg-red-600 px-[15px] py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                Cancelar lanzamiento
              </button>
            </div>
          )}
        </div>
      </div>

      {errorAccion && <p className="mt-2 text-sm text-red-600">{errorAccion}</p>}

      {!!pendientes && pendientes > 0 && (
        <Alert tone="warning" icon={<ClipboardCheck size={16} />} className="mt-[18px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Hay {pendientes} respuesta{pendientes === 1 ? '' : 's'} abierta
              {pendientes === 1 ? '' : 's'} esperando revisión — la nota de esos estudiantes
              queda pendiente hasta que las califiques.
            </span>
            <Link
              to={`/materias/${id}/guias/${guiaId}/revision`}
              className="shrink-0 text-sm font-semibold text-primary-700 hover:underline"
            >
              Revisar ahora →
            </Link>
          </div>
        </Alert>
      )}

      {isLoading && <EsqueletoGuiaResultados />}

      {resultados && resultados.length === 0 && (
        <p className="mt-[18px] py-8 text-center text-sm text-text-secondary">
          Todavía no se lanzó esta guía a nadie.
        </p>
      )}

      {resultados && resultados.length > 0 && (
        <div className="mt-[18px] overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-neutral-50">
              <tr>
                <th className="px-4 py-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Estudiante
                </th>
                <th className="px-4 py-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Estado
                </th>
                <th className="px-4 py-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Aciertos
                </th>
                <th className="px-4 py-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Nota
                </th>
                <th className="px-4 py-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Intentos
                </th>
                <th className="px-4 py-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Incidencias
                </th>
                <th className="px-4 py-[9px]" />
              </tr>
            </thead>
            <tbody>
              {resultados.map((fila) => (
                <FilaResultado
                  key={fila.estudiante_id}
                  fila={fila}
                  materiaId={materiaId}
                  guiaId={Number(guiaId)}
                  puedeGestionar={puedeGestionar}
                />
              ))}
            </tbody>
          </table>
          <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-[9px]">
            <p className="font-mono text-[11px] tracking-[0.04em] text-text-disabled">
              {resultados.length} {resultados.length === 1 ? 'estudiante' : 'estudiantes'} · actualizado{' '}
              {dataUpdatedAt
                ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                : '—'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
