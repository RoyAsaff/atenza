// HU-16 · Consolidado de asistencia por materia: totales por estudiante
// y porcentaje de asistencia (respaldo del historial al cierre del semestre)
//
// 13/09: mismo lenguaje visual que MonitoreoPage (design_handoff_monitoreo,
// 18/08) — tabla nativa con encabezado uppercase y pie con el total, en vez
// del Card/Tabla genérico de antes. Coherencia con ResultadosPage y
// GuiaResultadosPage, que comparten el mismo patrón.

import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../core/api/cliente';
import { FilaConsolidadoAsistencia, Materia } from '../../core/tipos';
import { PageBreadcrumb } from '../../core/ui/ui';

function EsqueletoConsolidado() {
  return (
    <div className="animate-pulse">
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="h-[70px] bg-surface" />
      </div>
      <div className="mt-[18px] overflow-hidden rounded-xl border border-border bg-surface">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex h-9 items-center gap-4 border-b border-neutral-100 px-4 last:border-b-0">
            <div className="h-3 flex-1 rounded bg-neutral-100" />
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-3 w-10 rounded bg-neutral-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConsolidadoAsistenciaPage() {
  const { id } = useParams();

  const { data: materia } = useQuery({
    queryKey: ['materia', id],
    queryFn: async () => {
      const { data } = await api.get<{ materia: Materia }>(`/api/materias/${id}`);
      return data.materia;
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['consolidado-asistencia', id],
    queryFn: async () => {
      const { data } = await api.get<{ consolidado: FilaConsolidadoAsistencia[] }>(
        `/api/materias/${id}/asistencia/consolidado`,
      );
      return data.consolidado;
    },
  });

  return (
    <div>
      <PageBreadcrumb>
        <Link to={`/materias/${id}`}>‹ {materia ? materia.nombre_materia : 'Materia'}</Link>
      </PageBreadcrumb>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex items-center gap-5 bg-surface px-[22px] py-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[19px] font-extrabold tracking-tight text-text">
              Consolidado de asistencia
            </h1>
            {materia && <p className="mt-[5px] text-sm text-text-secondary">{materia.nombre_materia}</p>}
          </div>
        </div>
      </div>

      {isLoading && <EsqueletoConsolidado />}
      {isError && <p className="mt-[18px] text-sm text-red-600">No se pudo cargar el consolidado.</p>}

      {data && data.length === 0 && (
        <p className="mt-[18px] py-8 text-center text-sm text-text-secondary">
          Aún no hay estudiantes inscritos en esta materia.
        </p>
      )}

      {data && data.length > 0 && (
        <div className="mt-[18px] overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-neutral-50">
              <tr>
                <th className="px-4 py-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Apellidos y nombres
                </th>
                <th className="px-4 py-[9px] text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Puntual
                </th>
                <th className="px-4 py-[9px] text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Atraso
                </th>
                <th className="px-4 py-[9px] text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Licencia
                </th>
                <th className="px-4 py-[9px] text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Falta
                </th>
                <th className="px-4 py-[9px] text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Clases
                </th>
                <th className="px-4 py-[9px] text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  % Asistencia
                </th>
                <th className="px-4 py-[9px] text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                  % Puntualidad
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((fila) => (
                <tr
                  key={fila.estudiante_id}
                  className="border-b border-neutral-100 transition last:border-b-0 hover:bg-surface-hover"
                >
                  <td className="px-4 py-2 text-[14px] font-semibold text-text">
                    {fila.apellidos} {fila.nombres}
                  </td>
                  <td className="px-4 py-2 text-center text-text-secondary">{fila.puntual}</td>
                  <td className="px-4 py-2 text-center text-text-secondary">{fila.atrasado}</td>
                  <td className="px-4 py-2 text-center text-text-secondary">{fila.licencia}</td>
                  <td className="px-4 py-2 text-center text-text-secondary">{fila.falta}</td>
                  <td className="px-4 py-2 text-center text-text-secondary">{fila.total_clases}</td>
                  <td className="px-4 py-2 text-center font-semibold text-text">
                    {fila.porcentaje_asistencia}%
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-text">
                    {fila.porcentaje_puntualidad}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-[9px]">
            <p className="font-mono text-[11px] tracking-[0.04em] text-text-disabled">
              {data.length} {data.length === 1 ? 'estudiante' : 'estudiantes'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
