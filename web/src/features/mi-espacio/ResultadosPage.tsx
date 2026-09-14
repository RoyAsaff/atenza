// E8 · HU-25 (resultados calculados automáticamente al finalizar) +
// HU-26 (el docente decide cuándo publicarlos a los estudiantes).
//
// 13/09: mismo lenguaje visual que MonitoreoPage (design_handoff_monitoreo,
// 18/08) — encabezado con punto de estado + franja de estadísticas, tabla
// nativa con encabezado uppercase y pie con el total, en vez del
// Card/PageHeader/Tabla genérico de antes.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Eye, Hourglass, XCircle } from 'lucide-react';
import { api, mensajeDeError, urlArchivo } from '../../core/api/cliente';
import { DetalleIntento, Evaluacion, Resultados } from '../../core/tipos';
import { Alert, Badge, cn, Modal, PageBreadcrumb, Spinner } from '../../core/ui/ui';

// ── Modal "Ver examen" ─────────────────────────────────────────────

function ModalDetalleIntento({
  materiaId,
  evaluacionId,
  estudianteId,
  nombreEstudiante,
  onCerrar,
}: {
  materiaId: number;
  evaluacionId: number;
  estudianteId: number;
  nombreEstudiante: string;
  onCerrar: () => void;
}) {
  const {
    data: detalle,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['detalle-intento', String(evaluacionId), String(estudianteId)],
    queryFn: async () => {
      const { data } = await api.get<{ detalle: DetalleIntento }>(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/resultados/${estudianteId}`,
      );
      return data.detalle;
    },
  });

  return (
    <Modal titulo={nombreEstudiante} eyebrow="Ver examen" maxWidth="max-w-2xl" onCerrar={onCerrar}>
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Spinner /> Cargando…
        </div>
      )}
      {isError && <Alert tone="danger">{mensajeDeError(error)}</Alert>}
      {detalle && (
        <div className="space-y-4">
          {detalle.preguntas.map((pregunta, idx) => (
            <div key={pregunta.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-text-muted">
                    {idx + 1}
                  </span>
                  <p className="font-medium text-text">{pregunta.pregunta}</p>
                </div>
                {pregunta.opcion_elegida_id === null ? (
                  <Badge tone="neutral">Sin responder</Badge>
                ) : pregunta.acerto ? (
                  <Badge tone="success">
                    <CheckCircle2 size={12} /> Correcta
                  </Badge>
                ) : (
                  <Badge tone="danger">
                    <XCircle size={12} /> Incorrecta
                  </Badge>
                )}
              </div>
              {pregunta.url_imagen && (
                <img
                  src={urlArchivo(pregunta.url_imagen)}
                  alt=""
                  className="ml-9 mt-2 max-h-32 rounded-xl border border-border"
                />
              )}
              <ul className="ml-9 mt-2 space-y-1">
                {pregunta.opciones.map((opcion) => {
                  const esElegida = opcion.id === pregunta.opcion_elegida_id;
                  const clase = opcion.es_correcta
                    ? 'bg-secondary-50 font-medium text-secondary-800'
                    : esElegida
                      ? 'bg-red-50 font-medium text-red-700'
                      : 'text-text-secondary';
                  return (
                    <li key={opcion.id} className={`rounded-lg px-2 py-1 text-sm ${clase}`}>
                      {opcion.es_correcta ? '✓ ' : esElegida ? '✗ ' : '· '}
                      {opcion.texto}
                      {esElegida && !opcion.es_correcta ? ' (elegida)' : ''}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ── Franja de estadísticas (encabezado) ─────────────────────────────

function FranjaEstadisticas({
  promedio,
  notaMaxima,
  notaMinima,
}: {
  promedio: number;
  notaMaxima: number;
  notaMinima: number;
}) {
  const items = [
    { etiqueta: 'Promedio', valor: promedio },
    { etiqueta: 'Nota máxima', valor: notaMaxima },
    { etiqueta: 'Nota mínima', valor: notaMinima },
  ];
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-border bg-surface px-[22px] py-[11px]">
      {items.map((item) => (
        <span key={item.etiqueta} className="inline-flex items-baseline gap-[7px]">
          <span className="text-[19px] font-extrabold text-text">{item.valor}</span>
          <span className="text-[13px] text-text-muted">{item.etiqueta}</span>
        </span>
      ))}
    </div>
  );
}

export function ResultadosPage() {
  const { id, evalId } = useParams();
  const materiaId = Number(id);
  const evaluacionId = Number(evalId);
  const queryClient = useQueryClient();
  const [errorPublicar, setErrorPublicar] = useState('');
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<{
    id: number;
    nombre: string;
  } | null>(null);

  const { data: evaluacion } = useQuery({
    queryKey: ['evaluacion', String(evaluacionId)],
    queryFn: async () => {
      const { data } = await api.get<{ evaluacion: Evaluacion }>(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}`,
      );
      return data.evaluacion;
    },
  });

  const {
    data: resultados,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['resultados', String(evaluacionId)],
    queryFn: async () => {
      const { data } = await api.get<{ resultados: Resultados }>(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/resultados`,
      );
      return data.resultados;
    },
  });

  const publicar = useMutation({
    mutationFn: () =>
      api.post(`/api/materias/${materiaId}/evaluaciones/${evaluacionId}/publicar-notas`),
    onSuccess: () => {
      setErrorPublicar('');
      queryClient.invalidateQueries({ queryKey: ['evaluacion', String(evaluacionId)] });
    },
    onError: (err: unknown) => setErrorPublicar(mensajeDeError(err)),
  });

  const puedePublicar = evaluacion && !evaluacion.publicada && resultados;

  return (
    <div>
      <PageBreadcrumb>
        <Link to={`/materias/${id}/evaluaciones/${evalId}`}>‹ {evaluacion?.tema ?? 'Evaluación'}</Link>
      </PageBreadcrumb>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex items-center gap-5 bg-surface px-[22px] py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-[7px] w-[7px] shrink-0 rounded-full',
                  evaluacion?.publicada ? 'bg-secondary-500' : 'bg-neutral-300',
                )}
              />
              <p
                className={cn(
                  'font-mono text-[10px] font-medium uppercase tracking-[0.1em]',
                  evaluacion?.publicada ? 'text-secondary-700' : 'text-text-muted',
                )}
              >
                {evaluacion?.publicada ? 'Notas publicadas' : 'Resultados'}
              </p>
            </div>
            <h1 className="mt-[5px] truncate text-[19px] font-extrabold tracking-tight text-text">
              {evaluacion?.tema}
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              {evaluacion?.publicada && evaluacion.fecha_publicacion
                ? `Publicadas el ${new Date(evaluacion.fecha_publicacion).toLocaleString()}`
                : 'Aciertos, nota ponderada e incidentes de cada estudiante.'}
            </p>
          </div>

          {puedePublicar && (
            <button
              type="button"
              onClick={() => publicar.mutate()}
              disabled={publicar.isPending}
              className="shrink-0 rounded-lg bg-primary-800 px-[17px] py-2.5 text-sm font-bold text-white transition hover:bg-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {publicar.isPending ? 'Publicando…' : 'Publicar notas'}
            </button>
          )}
        </div>

        {resultados && (
          <FranjaEstadisticas
            promedio={resultados.estadisticas.promedio}
            notaMaxima={resultados.estadisticas.nota_maxima}
            notaMinima={resultados.estadisticas.nota_minima}
          />
        )}
      </div>

      {errorPublicar && <p className="mt-2 text-sm text-red-600">{errorPublicar}</p>}

      {isError && (
        <Alert tone="warning" icon={<Hourglass size={16} />} className="mt-[18px]">
          {mensajeDeError(error)}{' '}
          <Link
            to={`/materias/${id}/evaluaciones/${evalId}/monitoreo`}
            className="font-medium underline"
          >
            Ver monitoreo →
          </Link>
        </Alert>
      )}

      {isLoading && (
        <div className="mt-[18px] flex items-center gap-2 text-sm text-text-secondary">
          <Spinner /> Cargando…
        </div>
      )}

      {resultados && (
        <div className="mt-[18px] overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-neutral-50">
              <tr>
                <th className="px-4 py-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Estudiante
                </th>
                <th className="px-4 py-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Aciertos
                </th>
                <th className="px-4 py-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Nota
                </th>
                <th className="px-4 py-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Incidentes
                </th>
                <th className="px-4 py-[9px]" />
              </tr>
            </thead>
            <tbody>
              {resultados.filas.map((fila) => (
                <tr
                  key={fila.estudiante_id}
                  className="border-b border-neutral-100 transition last:border-b-0 hover:bg-surface-hover"
                >
                  <td className="px-4 py-2 text-[14px] font-semibold text-text">
                    {fila.apellidos} {fila.nombres}
                  </td>
                  <td className="px-4 py-2 text-text-secondary">
                    {fila.aciertos} / {fila.total_preguntas}
                  </td>
                  <td className="px-4 py-2 font-semibold text-text">{fila.nota_obtenida}</td>
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
                    <button
                      type="button"
                      onClick={() =>
                        setEstudianteSeleccionado({
                          id: fila.estudiante_id,
                          nombre: `${fila.apellidos} ${fila.nombres}`,
                        })
                      }
                      className="inline-flex items-center gap-1 text-[13px] font-semibold text-link hover:text-primary-800"
                    >
                      <Eye size={13} /> Ver examen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-[9px]">
            <p className="font-mono text-[11px] tracking-[0.04em] text-text-disabled">
              {resultados.filas.length} {resultados.filas.length === 1 ? 'estudiante' : 'estudiantes'} · nota
              ponderada sobre {resultados.nota_total}
            </p>
          </div>
        </div>
      )}

      {estudianteSeleccionado && (
        <ModalDetalleIntento
          materiaId={materiaId}
          evaluacionId={evaluacionId}
          estudianteId={estudianteSeleccionado.id}
          nombreEstudiante={estudianteSeleccionado.nombre}
          onCerrar={() => setEstudianteSeleccionado(null)}
        />
      )}
    </div>
  );
}
