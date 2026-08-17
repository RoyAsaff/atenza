// SaaS por cuenta (17/07, rediseñado 17/08) · Elegir plan: 3 tarjetas fijas
// por rol (Gratis / Pro / Institucional) — reemplaza el grid genérico que
// iteraba N tramos por cantidad de alumnos. El precio (con o sin
// promoción) SIEMPRE viene del backend (GET /promociones/validar); nunca
// se calcula en el cliente. Toggle mensual/anual estilo Claude/Anthropic
// (anual = 2 meses gratis) → QR + plazo de 24h para subir el comprobante.

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, mensajeDeError, urlArchivo } from '../../core/api/cliente';
import { CicloPago, Pago, Plan, PrecioPlan } from '../../core/tipos';
import { Alert, Badge, Button, Campo, Card, CardBody, Input, PageHeader } from '../../core/ui/ui';

export function PlanesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ciclo, setCiclo] = useState<CicloPago>('mensual');
  const [codigoInput, setCodigoInput] = useState('');
  const [codigoAplicado, setCodigoAplicado] = useState('');
  const [error, setError] = useState('');

  const planes = useQuery({
    queryKey: ['cuenta-planes'],
    queryFn: async () => {
      const { data } = await api.get<{ planes: Plan[] }>('/api/cuenta/planes');
      return data.planes;
    },
  });

  const planGratis = planes.data?.find((p) => p.tipo === 'gratuito');
  const planPro = planes.data?.find((p) => p.tipo === 'pago');
  const planInstitucional = planes.data?.find((p) => p.tipo === 'institucional');

  // Precio final del plan Pro (con o sin promo) — sin código se detecta
  // sola una promo automática de temporada, si hay alguna vigente.
  const precio = useQuery({
    queryKey: ['precio-plan', planPro?.id, ciclo, codigoAplicado],
    queryFn: async () => {
      const { data } = await api.get<PrecioPlan>('/api/cuenta/promociones/validar', {
        params: { plan_id: planPro!.id, ciclo, codigo: codigoAplicado || undefined },
      });
      return data;
    },
    enabled: !!planPro,
  });

  // Si cambia el ciclo, un código ya aplicado puede dejar de ser válido —
  // se limpia para no mostrar un precio calculado con un código viejo.
  useEffect(() => {
    setCodigoAplicado('');
    setCodigoInput('');
  }, [ciclo]);

  const elegir = useMutation({
    mutationFn: async (plan_id: number) => {
      const { data } = await api.post<{ pago: Pago; qr_pago: string; plazo_horas: number }>(
        '/api/cuenta/elegir-plan',
        { plan_id, ciclo, codigo_promocion: codigoAplicado || undefined },
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
            {elegir.data.pago.monto !== elegir.data.pago.monto_lista && (
              <p className="mt-3 text-sm text-text-secondary line-through">
                Bs. {elegir.data.pago.monto_lista}
              </p>
            )}
            <p className="font-semibold text-text">Monto: Bs. {elegir.data.pago.monto}</p>
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

      <div className="grid gap-4 sm:grid-cols-3">
        {planGratis && (
          <Card className="flex flex-col">
            <CardBody className="flex flex-1 flex-col">
              <h2 className="font-bold text-text">{planGratis.nombre}</h2>
              <p className="text-sm text-text-secondary mb-3">
                1 materia · hasta {planGratis.limite_estudiantes} estudiantes
              </p>
              <p className="text-2xl font-bold text-text mb-4">
                Bs. 0<span className="text-sm font-normal text-text-secondary"> siempre</span>
              </p>
              <ul className="mb-4 space-y-1 text-sm text-text-secondary">
                <li>✓ Asistencia y calendario</li>
                <li>✓ Exámenes con seguridad y monitoreo</li>
                <li className="text-text-disabled">✕ Importar preguntas de Word</li>
                <li className="text-text-disabled">✕ Guías</li>
              </ul>
              <div className="mt-auto">
                <Button variante="secondary" className="w-full" disabled>
                  Plan actual mientras no pagues
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {planPro && (
          <Card className="flex flex-col border-primary-300 ring-1 ring-primary-100">
            <CardBody className="flex flex-1 flex-col">
              <h2 className="font-bold text-text">{planPro.nombre}</h2>
              <p className="text-sm text-text-secondary mb-3">
                Materias y estudiantes ilimitados
              </p>

              <div className="mb-3">
                {precio.data && precio.data.monto !== precio.data.monto_lista && (
                  <p className="text-sm text-text-secondary line-through">
                    Bs. {precio.data.monto_lista}
                  </p>
                )}
                <p className="text-2xl font-bold text-text">
                  Bs. {precio.data ? precio.data.monto : planPro.monto_mensual * (ciclo === 'anual' ? 10 : 1)}
                  <span className="text-sm font-normal text-text-secondary">
                    {ciclo === 'anual' ? '/año' : '/mes'}
                  </span>
                </p>
                {precio.data?.promocion && (
                  <Badge tone="success" className="mt-1">
                    {precio.data.promocion.nombre}
                  </Badge>
                )}
              </div>

              <ul className="mb-4 space-y-1 text-sm text-text-secondary">
                <li>✓ Todo lo del plan Gratis</li>
                <li>✓ Importar preguntas de Word</li>
                <li>✓ Guías</li>
              </ul>

              <Campo etiqueta="Código de promoción (opcional)" className="mb-3">
                <div className="flex gap-2">
                  <Input
                    value={codigoInput}
                    onChange={(e) => setCodigoInput(e.target.value)}
                    placeholder="Ej. BIENVENIDA20"
                  />
                  <Button
                    variante="secondary"
                    type="button"
                    onClick={() => setCodigoAplicado(codigoInput.trim())}
                  >
                    Aplicar
                  </Button>
                </div>
              </Campo>
              {precio.isError && (
                <p className="mb-3 text-xs text-red-600">{mensajeDeError(precio.error)}</p>
              )}

              <div className="mt-auto">
                <Button
                  className="w-full"
                  disabled={elegir.isPending || precio.isLoading}
                  onClick={() => elegir.mutate(planPro.id)}
                >
                  {elegir.isPending ? 'Procesando…' : 'Elegir plan'}
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {planInstitucional && (
          <Card className="flex flex-col">
            <CardBody className="flex flex-1 flex-col">
              <h2 className="font-bold text-text">{planInstitucional.nombre}</h2>
              <p className="text-sm text-text-secondary mb-3">
                Colegios e institutos — condiciones a medida
              </p>
              <p className="text-lg font-bold text-text mb-4">A medida</p>
              <div className="mt-auto">
                <Button variante="secondary" className="w-full" disabled>
                  Contáctanos
                </Button>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
