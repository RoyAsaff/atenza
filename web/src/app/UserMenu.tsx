// Menú de perfil (08/08): antes solo mostraba el nombre + un badge de
// contexto. Ahora es el ícono de persona arriba a la derecha — patrón
// habitual (Notion/Slack/Classroom) — y ahí mismo vive el resumen de la
// suscripción (estado + días restantes), con link a la página completa
// "Mi suscripción". El banner de aviso (BannerSuscripcion) se mantiene
// aparte, arriba del contenido, para la alerta crítica de cuenta vencida.

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogOut, User } from 'lucide-react';
import { Dropdown, DropdownItem, DropdownSeparator } from '../core/ui/Dropdown';
import { Badge } from '../core/ui/Badge';
import { api } from '../core/api/cliente';
import { EstadoCuenta } from '../core/tipos';

const ETIQUETA_CONTEXTO: Record<string, string> = {
  docente: 'Docente',
  estudiante: 'Estudiante',
  admin: 'Administrador',
};

function ResumenSuscripcion() {
  const { data } = useQuery({
    queryKey: ['cuenta-estado'],
    queryFn: async () => {
      const { data } = await api.get<{ estado: EstadoCuenta }>('/api/cuenta/estado');
      return data.estado;
    },
  });

  if (!data) return null;

  return (
    <Link
      to="/suscripcion"
      className="block rounded-md px-2.5 py-2 transition hover:bg-surface-hover"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Mi suscripción
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-text">{data.plan?.nombre ?? 'Sin plan'}</span>
        {data.solo_lectura ? (
          <Badge tone="warning">Vencida</Badge>
        ) : data.en_aviso ? (
          <Badge tone="warning">
            {data.dias_restantes} día{data.dias_restantes === 1 ? '' : 's'}
          </Badge>
        ) : (
          <Badge tone="success">Vigente</Badge>
        )}
      </div>
      <p className="mt-0.5 text-xs text-primary-700 hover:underline">Ver detalles</p>
    </Link>
  );
}

export function UserMenu({
  nombre,
  contexto,
  onSalir,
}: {
  nombre: string;
  contexto: string;
  onSalir: () => void;
}) {
  const esAdmin = contexto === 'admin';

  return (
    <Dropdown
      trigger={() => (
        <button
          type="button"
          aria-label="Mi perfil"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-600/20 transition hover:bg-primary-100"
        >
          <User size={18} />
        </button>
      )}
    >
      <div className="px-2.5 py-1.5">
        <p className="truncate text-sm font-semibold text-text">{nombre}</p>
        <Badge tone="primary" className="mt-1">
          {ETIQUETA_CONTEXTO[contexto] ?? contexto}
        </Badge>
      </div>

      {!esAdmin && (
        <>
          <DropdownSeparator />
          <ResumenSuscripcion />
        </>
      )}

      <DropdownSeparator />
      <DropdownItem icono={<LogOut size={15} />} peligro onSelect={onSalir}>
        Salir
      </DropdownItem>
    </Dropdown>
  );
}
