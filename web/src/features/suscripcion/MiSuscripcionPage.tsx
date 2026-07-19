// SaaS por cuenta (17/07) · Estado de la suscripción, historial de pagos
// y subir comprobante de un pago pendiente. Reemplaza a MisSolicitudesPage.

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, mensajeDeError } from '../../core/api/cliente';
import { EstadoCuenta, Pago } from '../../core/tipos';
import { Alert, Badge, Button, Card, CardBody, EstadoBadge, PageHeader } from '../../core/ui/ui';

export function MiSuscripcionPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const inputArchivo = useRef<HTMLInputElement>(null);
  const [pagoSeleccionado, setPagoSeleccionado] = useState<number | null>(null);

  const estado = useQuery({
    queryKey: ['cuenta-estado'],
    queryFn: async () => {
      const { data } = await api.get<{ estado: EstadoCuenta }>('/api/cuenta/estado');
      return data.estado;
    },
  });

  const pagos = useQuery({
    queryKey: ['cuenta-pagos'],
    queryFn: async () => {
      const { data } = await api.get<{ pagos: Pago[] }>('/api/cuenta/pagos');
      return data.pagos;
    },
  });

  const subir = useMutation({
    mutationFn: async ({ id, archivo }: { id: number; archivo: File }) => {
      const formData = new FormData();
      formData.append('comprobante', archivo);
      await api.post(`/api/cuenta/pagos/${id}/comprobante`, formData);
    },
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['cuenta-pagos'] });
      queryClient.invalidateQueries({ queryKey: ['cuenta-estado'] });
    },
    onError: (err) => setError(mensajeDeError(err)),
  });

  function elegirArchivo(id: number) {
    setPagoSeleccionado(id);
    inputArchivo.current?.click();
  }

  return (
    <div>
      <input
        ref={inputArchivo}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo && pagoSeleccionado !== null) {
            subir.mutate({ id: pagoSeleccionado, archivo });
          }
          e.target.value = '';
        }}
      />

      <PageHeader
        eyebrow="Suscripción"
        title="Mi suscripción"
        actions={
          <Link to="/suscripcion/planes" className="inline-flex">
            <Button>Cambiar de plan</Button>
          </Link>
        }
      />

      {estado.data && (
        <Card className="mt-5">
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-text-secondary">Plan actual</p>
              <p className="text-xl font-bold text-text">
                {estado.data.plan?.nombre ?? 'Sin plan'}
              </p>
              <p className="text-sm text-text-secondary">
                {estado.data.estudiantes_activos} / {estado.data.limite_estudiantes ?? '∞'}{' '}
                estudiantes activos
              </p>
            </div>
            <div className="text-right">
              {estado.data.solo_lectura ? (
                <Badge tone="warning">Cuenta vencida · solo lectura</Badge>
              ) : estado.data.en_aviso ? (
                <Badge tone="warning">
                  Vence en {estado.data.dias_restantes} día
                  {estado.data.dias_restantes === 1 ? '' : 's'}
                </Badge>
              ) : (
                <Badge tone="success">Vigente</Badge>
              )}
              <p className="mt-1 text-xs text-text-disabled">
                Hasta {new Date(estado.data.vigente_hasta).toLocaleDateString()}
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {error && (
        <div className="mt-4">
          <Alert tone="warning">{error}</Alert>
        </div>
      )}

      <h2 className="mt-8 mb-3 text-sm font-semibold text-text-secondary">Historial de pagos</h2>
      {pagos.isLoading && <p className="text-text-secondary">Cargando…</p>}

      {pagos.data && pagos.data.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-text-secondary shadow-xs">
          Todavía no hiciste ningún pago; estás en tu prueba gratis de 30 días.
        </div>
      )}

      <div className="space-y-3">
        {pagos.data?.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm"
          >
            <div>
              <p className="font-bold text-text">{p.plan.nombre}</p>
              <p className="text-sm text-text-secondary">
                Bs. {p.monto} · {p.ciclo} · {new Date(p.fecha).toLocaleString()}
              </p>
              {p.estado === 'aprobada' && p.fecha_expira && (
                <p className="text-xs text-text-disabled">
                  Vigencia hasta {new Date(p.fecha_expira).toLocaleDateString()}
                </p>
              )}
              {p.estado === 'rechazada' && p.motivo_rechazo && (
                <p className="text-sm text-red-600 mt-1">Motivo: {p.motivo_rechazo}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <EstadoBadge estado={p.estado} />
              {p.comprobante && (
                <a
                  href={p.comprobante}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary-700 hover:text-primary-800 hover:underline"
                >
                  Ver comprobante
                </a>
              )}
              {p.estado === 'pendiente' && (
                <Button
                  tamano="sm"
                  onClick={() => elegirArchivo(p.id)}
                  disabled={subir.isPending}
                  cargando={subir.isPending && pagoSeleccionado === p.id}
                >
                  {subir.isPending && pagoSeleccionado === p.id
                    ? 'Subiendo…'
                    : 'Subir comprobante'}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
