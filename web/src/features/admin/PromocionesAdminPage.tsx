// Rediseño SaaS (17/08) · Promociones: descuento de temporada (automático,
// sin código, por ventana de fechas) o cupón (con código), configurables
// por el admin. Mismo patrón visual que PlanesAdminPage.tsx.

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, mensajeDeError } from '../../core/api/cliente';
import { Promocion } from '../../core/tipos';
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
  Select,
  Spinner,
} from '../../core/ui/ui';

function fechaInput(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD para <input type="date">
}

function FilaPromocion({ promo }: { promo: Promocion }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const alternarActivo = useMutation({
    mutationFn: () => api.patch(`/api/admin/promociones/${promo.id}`, { activo: !promo.activo }),
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin-promociones'] });
    },
    onError: (err) => setError(mensajeDeError(err)),
  });

  const vencida = new Date(promo.fecha_fin) < new Date();

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {promo.nombre}
            {promo.codigo ? (
              <Badge tone="info">{promo.codigo}</Badge>
            ) : (
              <Badge tone="neutral">Automática</Badge>
            )}
            {vencida && <Badge tone="warning">Vencida</Badge>}
            {!promo.activo && <Badge tone="dark">Desactivada</Badge>}
          </span>
        }
        description={
          `${promo.tipo_descuento === 'porcentaje' ? `${promo.valor}%` : `Bs. ${promo.valor}`} · ` +
          `ciclo ${promo.ciclo_aplicable} · ${fechaInput(promo.fecha_inicio)} a ${fechaInput(promo.fecha_fin)} · ` +
          `usos ${promo.usos_actuales}/${promo.usos_maximos ?? '∞'}` +
          (promo.usos_maximos_por_cuenta !== null
            ? ` (máx. ${promo.usos_maximos_por_cuenta}/cuenta)`
            : '') +
          (promo.solo_cuentas_nuevas ? ' · solo cuentas nuevas' : '') +
          (promo.combinable_con_anual ? ' · combina con anual' : ' · no combina con anual')
        }
      />
      <CardBody className="flex items-center gap-3">
        <Button
          variante="secondary"
          tamano="sm"
          disabled={alternarActivo.isPending}
          onClick={() => alternarActivo.mutate()}
        >
          {promo.activo ? 'Desactivar' : 'Activar'}
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardBody>
    </Card>
  );
}

interface FormPromocion {
  nombre: string;
  codigo: string;
  tipo_descuento: 'porcentaje' | 'monto_fijo';
  valor: string;
  ciclo_aplicable: 'mensual' | 'anual' | 'ambos';
  combinable_con_anual: boolean;
  solo_cuentas_nuevas: boolean;
  fecha_inicio: string;
  fecha_fin: string;
  usos_maximos: string;
  usos_maximos_por_cuenta: string;
}

const FORM_INICIAL: FormPromocion = {
  nombre: '',
  codigo: '',
  tipo_descuento: 'porcentaje',
  valor: '',
  ciclo_aplicable: 'ambos',
  combinable_con_anual: true,
  solo_cuentas_nuevas: false,
  fecha_inicio: '',
  fecha_fin: '',
  usos_maximos: '',
  usos_maximos_por_cuenta: '1',
};

function FormularioPromocion() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormPromocion>(FORM_INICIAL);
  const [error, setError] = useState('');

  const crear = useMutation({
    mutationFn: () =>
      api.post('/api/admin/promociones', {
        nombre: form.nombre,
        codigo: form.codigo.trim() || undefined, // vacío = automática por temporada
        tipo_descuento: form.tipo_descuento,
        valor: Number(form.valor),
        ciclo_aplicable: form.ciclo_aplicable,
        combinable_con_anual: form.combinable_con_anual,
        solo_cuentas_nuevas: form.solo_cuentas_nuevas,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        usos_maximos: form.usos_maximos === '' ? undefined : Number(form.usos_maximos),
        usos_maximos_por_cuenta:
          form.usos_maximos_por_cuenta === '' ? undefined : Number(form.usos_maximos_por_cuenta),
      }),
    onSuccess: () => {
      setError('');
      setForm(FORM_INICIAL);
      queryClient.invalidateQueries({ queryKey: ['admin-promociones'] });
    },
    onError: (err) => setError(mensajeDeError(err)),
  });

  function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <Card>
      <CardHeader
        title="Nueva promoción"
        description="Dejá el código vacío para un descuento automático de temporada (sin código, se aplica solo durante la ventana de fechas)"
      />
      <CardBody>
        <form onSubmit={manejarEnvio} className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre">
            <Input
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej. Verano 2026"
            />
          </Campo>
          <Campo etiqueta="Código (opcional — vacío = automática)">
            <Input
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
              placeholder="Ej. BIENVENIDA20"
            />
          </Campo>
          <Campo etiqueta="Tipo de descuento">
            <Select
              value={form.tipo_descuento}
              onChange={(e) =>
                setForm({ ...form, tipo_descuento: e.target.value as FormPromocion['tipo_descuento'] })
              }
            >
              <option value="porcentaje">Porcentaje</option>
              <option value="monto_fijo">Monto fijo (Bs.)</option>
            </Select>
          </Campo>
          <Campo etiqueta={form.tipo_descuento === 'porcentaje' ? 'Valor (%)' : 'Valor (Bs.)'}>
            <Input
              required
              type="number"
              min="0"
              max={form.tipo_descuento === 'porcentaje' ? '100' : undefined}
              step="0.01"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
            />
          </Campo>
          <Campo etiqueta="Ciclo aplicable">
            <Select
              value={form.ciclo_aplicable}
              onChange={(e) =>
                setForm({ ...form, ciclo_aplicable: e.target.value as FormPromocion['ciclo_aplicable'] })
              }
            >
              <option value="ambos">Mensual y anual</option>
              <option value="mensual">Solo mensual</option>
              <option value="anual">Solo anual</option>
            </Select>
          </Campo>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={form.combinable_con_anual}
                onChange={(e) => setForm({ ...form, combinable_con_anual: e.target.checked })}
              />
              Combina con el descuento anual
            </label>
          </div>
          <Campo etiqueta="Desde">
            <Input
              required
              type="date"
              value={form.fecha_inicio}
              onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
            />
          </Campo>
          <Campo etiqueta="Hasta">
            <Input
              required
              type="date"
              value={form.fecha_fin}
              onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
            />
          </Campo>
          <Campo etiqueta="Usos máximos totales (vacío = ilimitado)">
            <Input
              type="number"
              min="1"
              value={form.usos_maximos}
              onChange={(e) => setForm({ ...form, usos_maximos: e.target.value })}
            />
          </Campo>
          <Campo etiqueta="Usos máximos por cuenta (vacío = ilimitado)">
            <Input
              type="number"
              min="1"
              value={form.usos_maximos_por_cuenta}
              onChange={(e) => setForm({ ...form, usos_maximos_por_cuenta: e.target.value })}
            />
          </Campo>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={form.solo_cuentas_nuevas}
                onChange={(e) => setForm({ ...form, solo_cuentas_nuevas: e.target.checked })}
              />
              Solo cuentas nuevas (nunca pagaron)
            </label>
          </div>

          <div className="sm:col-span-2">
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={crear.isPending}>
              {crear.isPending ? 'Creando…' : 'Crear promoción'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function PromocionesAdminPage() {
  const promociones = useQuery({
    queryKey: ['admin-promociones'],
    queryFn: async () => {
      const { data } = await api.get<{ promociones: Promocion[] }>('/api/admin/promociones');
      return data.promociones;
    },
  });

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader eyebrow="Administración" title="Promociones" />

      {promociones.isLoading && (
        <div className="flex items-center gap-2 text-text-secondary">
          <Spinner /> Cargando…
        </div>
      )}
      {promociones.data?.length === 0 && (
        <Alert tone="info">Todavía no creaste ninguna promoción.</Alert>
      )}
      {promociones.data?.map((promo) => <FilaPromocion key={promo.id} promo={promo} />)}

      <FormularioPromocion />
    </div>
  );
}
