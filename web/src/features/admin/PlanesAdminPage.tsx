// SaaS por cuenta (17/07) · Editar los 4 tramos de plan y el QR único
// global de cobro (admin). Reemplaza a PreciosPage.

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, mensajeDeError, urlArchivo } from '../../core/api/cliente';
import { Plan } from '../../core/tipos';
import {
  Alert,
  Badge,
  Button,
  Campo,
  Card,
  CardBody,
  CardHeader,
  Input,
  PageHeader,
  Spinner,
} from '../../core/ui/ui';

function FilaPlan({ plan }: { plan: Plan }) {
  const queryClient = useQueryClient();
  const [limite, setLimite] = useState(plan.limite_estudiantes?.toString() ?? '');
  const [monto, setMonto] = useState(plan.monto_mensual.toString());
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const esInstitucional = plan.limite_estudiantes === null;

  const guardar = useMutation({
    mutationFn: () =>
      api.patch(`/api/admin/planes/${plan.id}`, {
        limite_estudiantes: esInstitucional ? null : Number(limite),
        monto_mensual: esInstitucional ? 0 : Number(monto),
      }),
    onSuccess: () => {
      setError('');
      setExito(true);
      setTimeout(() => setExito(false), 2000);
      queryClient.invalidateQueries({ queryKey: ['admin-planes'] });
    },
    onError: (err) => setError(mensajeDeError(err)),
  });

  return (
    <Card>
      <CardHeader title={plan.nombre} description={esInstitucional ? 'Contratación directa, sin self-service' : `Precio anual = ${monto ? Number(monto) * 10 : '—'} Bs (10x, 2 meses gratis)`} />
      <CardBody className="flex flex-wrap items-end gap-3">
        {!esInstitucional && (
          <>
            <Campo etiqueta="Límite de estudiantes" className="w-40">
              <Input
                type="number"
                min="1"
                value={limite}
                onChange={(e) => setLimite(e.target.value)}
              />
            </Campo>
            <Campo etiqueta="Precio mensual (Bs.)" className="w-40">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </Campo>
          </>
        )}
        <Button disabled={guardar.isPending} onClick={() => guardar.mutate()}>
          {guardar.isPending ? 'Guardando…' : exito ? 'Guardado ✓' : 'Guardar'}
        </Button>
        {error && <p className="text-sm text-red-600 w-full">{error}</p>}
      </CardBody>
    </Card>
  );
}

function SeccionQr() {
  const queryClient = useQueryClient();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const qr = useQuery({
    queryKey: ['admin-configuracion-pago'],
    queryFn: async () => {
      const { data } = await api.get<{ url_qr: string | null }>('/api/admin/configuracion-pago');
      return data.url_qr;
    },
  });

  const subir = useMutation({
    mutationFn: async () => {
      if (!archivo) return;
      const formData = new FormData();
      formData.append('qr', archivo);
      await api.post('/api/admin/configuracion-pago/qr', formData);
    },
    onSuccess: () => {
      setError('');
      setExito('QR actualizado; se usa para todos los planes.');
      setArchivo(null);
      queryClient.invalidateQueries({ queryKey: ['admin-configuracion-pago'] });
    },
    onError: (err) => {
      setExito('');
      setError(mensajeDeError(err));
    },
  });

  function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    subir.mutate();
  }

  return (
    <Card>
      <CardHeader title="QR de cobro" description="Único, se usa para todos los planes y ciclos" />
      <CardBody>
        <div className="flex flex-wrap items-center gap-4">
          {qr.data ? (
            <img
              src={urlArchivo(qr.data)}
              alt="QR de cobro vigente"
              className="h-32 w-32 rounded-xl border border-border bg-surface object-contain p-2 shadow-sm"
            />
          ) : (
            <Badge tone="warning">Sin QR cargado</Badge>
          )}
          <form onSubmit={manejarSubmit} className="flex flex-wrap items-end gap-3">
            <Campo etiqueta="Nuevo QR">
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="text-sm text-text-secondary"
              />
            </Campo>
            <Button type="submit" disabled={!archivo || subir.isPending}>
              {subir.isPending ? 'Subiendo…' : 'Actualizar QR'}
            </Button>
          </form>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        {exito && <p className="text-sm text-secondary-800 mt-3">{exito}</p>}
      </CardBody>
    </Card>
  );
}

export function PlanesAdminPage() {
  const planes = useQuery({
    queryKey: ['admin-planes'],
    queryFn: async () => {
      const { data } = await api.get<{ planes: Plan[] }>('/api/admin/planes');
      return data.planes;
    },
  });

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader eyebrow="Administración" title="Planes de suscripción" />

      {planes.isLoading && (
        <div className="flex items-center gap-2 text-text-secondary">
          <Spinner /> Cargando…
        </div>
      )}
      {planes.data?.map((plan) => <FilaPlan key={plan.id} plan={plan} />)}

      <SeccionQr />

      <Alert tone="info">
        Cambiar un plan no afecta a docentes que ya pagaron ese ciclo — su vigencia sigue
        igual hasta que renueven.
      </Alert>
    </div>
  );
}
