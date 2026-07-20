// Verificar pagos de suscripción (admin) — reemplaza al viejo HU-08 por
// materia; ahora cada pago es de una cuenta de docente (17/07).

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, mensajeDeError, urlArchivo } from '../../core/api/cliente';
import { EstadoPago, Pago } from '../../core/tipos';
import { Button, Card, CardBody, EmptyState, EstadoBadge, PageHeader, Spinner } from '../../core/ui/ui';

const FILTROS: { valor: EstadoPago | ''; texto: string }[] = [
  { valor: 'en_verificacion', texto: 'En verificación' },
  { valor: 'pendiente', texto: 'Pendientes' },
  { valor: 'aprobada', texto: 'Aprobadas' },
  { valor: 'rechazada', texto: 'Rechazadas' },
  { valor: 'expirada', texto: 'Expiradas' },
  { valor: '', texto: 'Todas' },
];

export function SolicitudesAdminPage() {
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<EstadoPago | ''>('en_verificacion');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-solicitudes', filtro],
    queryFn: async () => {
      const { data } = await api.get<{ solicitudes: Pago[] }>(
        '/api/admin/solicitudes',
        { params: filtro ? { estado: filtro } : {} },
      );
      return data.solicitudes;
    },
  });

  const alTerminar = {
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin-solicitudes'] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  };

  const aprobar = useMutation({
    mutationFn: (id: number) => api.post(`/api/admin/solicitudes/${id}/aprobar`),
    ...alTerminar,
  });

  const rechazar = useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      api.post(`/api/admin/solicitudes/${id}/rechazar`, { motivo }),
    ...alTerminar,
  });

  function manejarRechazo(id: number) {
    const motivo = window.prompt('Motivo del rechazo (lo verá el docente):');
    if (motivo?.trim()) rechazar.mutate({ id, motivo: motivo.trim() });
  }

  return (
    <div>
      <div className="mb-5">
        <PageHeader eyebrow="Administración" title="Pagos de suscripción" />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTROS.map((f) => (
          <button
            key={f.texto}
            onClick={() => setFiltro(f.valor)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              filtro === f.valor
                ? 'border-primary-800 bg-primary-800 text-white shadow-xs'
                : 'border-border bg-surface text-text-secondary shadow-xs hover:bg-surface-hover hover:text-text'
            }`}
          >
            {f.texto}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {isLoading && (
        <div className="flex items-center gap-2 text-text-secondary">
          <Spinner /> Cargando…
        </div>
      )}

      {data && data.length === 0 && (
        <EmptyState title="No hay pagos con este estado" />
      )}

      <div className="space-y-3">
        {data?.map((p) => (
          <Card key={p.id}>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-text">
                  #{p.id} · Docente #{p.usuario_id} · Plan {p.plan.nombre}
                </p>
                <p className="text-sm text-text-secondary">
                  Bs. {p.monto} · ciclo {p.ciclo} · {new Date(p.fecha).toLocaleString()}
                </p>
                {p.fecha_expira && (
                  <p className="text-xs text-text-disabled">
                    Vigencia hasta {new Date(p.fecha_expira).toLocaleDateString()}
                  </p>
                )}
                {p.motivo_rechazo && (
                  <p className="text-sm text-red-600 mt-1">Motivo: {p.motivo_rechazo}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <EstadoBadge estado={p.estado} />
                {p.comprobante && (
                  <a
                    href={urlArchivo(p.comprobante)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-primary-700 hover:text-primary-800 hover:underline"
                  >
                    Ver comprobante
                  </a>
                )}
                {p.estado === 'en_verificacion' && (
                  <>
                    <Button
                      tamano="sm"
                      onClick={() => aprobar.mutate(p.id)}
                      disabled={aprobar.isPending}
                      className="bg-secondary-700 hover:bg-secondary-800 active:bg-secondary-900"
                    >
                      Aprobar
                    </Button>
                    <Button
                      tamano="sm"
                      variante="danger"
                      onClick={() => manejarRechazo(p.id)}
                      disabled={rechazar.isPending}
                    >
                      Rechazar
                    </Button>
                  </>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
