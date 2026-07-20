// SaaS por cuenta (17/07) · Elegir plan: toggle mensual/anual (estilo
// Claude/Anthropic, anual = 2 meses gratis) → QR + plazo de 24h para
// subir el comprobante. Reemplaza a NuevaSolicitudPage/RenovarMateriaPage.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, mensajeDeError, urlArchivo } from '../../core/api/cliente';
import { CicloPago, Pago, Plan } from '../../core/tipos';
import { Alert, Button, Card, CardBody, PageHeader } from '../../core/ui/ui';

export function PlanesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ciclo, setCiclo] = useState<CicloPago>('mensual');
  const [error, setError] = useState('');

  const planes = useQuery({
    queryKey: ['cuenta-planes'],
    queryFn: async () => {
      const { data } = await api.get<{ planes: Plan[] }>('/api/cuenta/planes');
      return data.planes;
    },
  });

  const elegir = useMutation({
    mutationFn: async (plan_id: number) => {
      const { data } = await api.post<{ pago: Pago; qr_pago: string; plazo_horas: number }>(
        '/api/cuenta/elegir-plan',
        { plan_id, ciclo },
      );
      return data;
    },
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['cuenta-pagos'] });
      queryClient.invalidateQueries({ queryKey: ['cuenta-estado'] });
    },
    onError: (err) => setError(mensajeDeError(err)),
  });

  function monto(plan: Plan): number {
    return ciclo === 'anual' ? plan.monto_mensual * 10 : plan.monto_mensual;
  }

  // Paso 2: QR y plazo, tras elegir un plan
  if (elegir.data) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardBody className="text-center">
            <h1 className="text-xl font-bold text-text mb-1">Plan elegido</h1>
            <p className="text-sm text-text-secondary mb-4">
              {elegir.data.pago.plan.nombre} · {elegir.data.pago.ciclo}
            </p>
            <img
              src={urlArchivo(elegir.data.qr_pago)}
              alt="QR de cobro"
              className="mx-auto h-56 w-56 rounded-xl border border-border bg-surface object-contain p-2 shadow-sm"
            />
            <p className="mt-3 font-semibold text-text">
              Monto: Bs. {elegir.data.pago.monto}
            </p>
            <div className="mt-3">
              <Alert tone="warning">
                Tienes <strong>{elegir.data.plazo_horas} horas</strong> para pagar y subir tu
                comprobante desde "Mi suscripción"; pasado el plazo el pago expira.
              </Alert>
            </div>
            <Button className="mt-4 w-full" onClick={() => navigate('/suscripcion')}>
              Ir a mi suscripción
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Suscripción" title="Elige tu plan" />

      <div className="my-5 inline-flex rounded-xl bg-surface-sunken p-1">
        <button
          onClick={() => setCiclo('mensual')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            ciclo === 'mensual' ? 'bg-surface text-text shadow-sm' : 'text-text-secondary'
          }`}
        >
          Mensual
        </button>
        <button
          onClick={() => setCiclo('anual')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            ciclo === 'anual' ? 'bg-surface text-text shadow-sm' : 'text-text-secondary'
          }`}
        >
          Anual
        </button>
      </div>

      {error && (
        <div className="mb-4">
          <Alert tone="warning">{error}</Alert>
        </div>
      )}

      {planes.isLoading && <p className="text-text-secondary">Cargando…</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {planes.data?.map((plan) => {
          const esInstitucional = plan.limite_estudiantes === null;
          return (
            <Card key={plan.id} className="flex flex-col">
              <CardBody className="flex flex-1 flex-col">
                <h2 className="font-bold text-text">{plan.nombre}</h2>
                <p className="text-sm text-text-secondary mb-3">
                  {esInstitucional
                    ? 'Más de 250 estudiantes'
                    : `Hasta ${plan.limite_estudiantes} estudiantes`}
                </p>

                {esInstitucional ? (
                  <p className="text-lg font-bold text-text mb-4">A medida</p>
                ) : (
                  <div className="mb-4">
                    <p className="text-2xl font-bold text-text">
                      Bs. {monto(plan)}
                      <span className="text-sm font-normal text-text-secondary">
                        {ciclo === 'anual' ? '/año' : '/mes'}
                      </span>
                    </p>
                  </div>
                )}

                <div className="mt-auto">
                  {esInstitucional ? (
                    <Button variante="secondary" className="w-full" disabled>
                      Contáctanos
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      disabled={elegir.isPending}
                      onClick={() => elegir.mutate(plan.id)}
                    >
                      {elegir.isPending ? 'Procesando…' : 'Elegir plan'}
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
