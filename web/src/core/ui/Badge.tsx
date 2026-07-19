import { ReactNode } from 'react';
import { cn } from './cn';
import { EstadoPago } from '../tipos';

export type Tono = 'neutral' | 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'dark';

const TONOS_BADGE: Record<Tono, string> = {
  neutral: 'bg-neutral-100 text-neutral-700',
  primary: 'bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-600/20',
  success: 'bg-secondary-50 text-secondary-800 ring-1 ring-inset ring-secondary-600/20',
  info: 'bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-600/20',
  warning: 'bg-accent-50 text-accent-800 ring-1 ring-inset ring-accent-600/20',
  danger: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
  dark: 'bg-neutral-900 text-white',
};

export function Badge({
  tone = 'neutral',
  punto = false,
  className = '',
  children,
}: {
  tone?: Tono;
  punto?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        TONOS_BADGE[tone],
        className,
      )}
    >
      {punto && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const ESTADO_PAGO: Record<EstadoPago, { texto: string; tone: Tono }> = {
  pendiente: { texto: 'Pendiente de pago', tone: 'warning' },
  en_verificacion: { texto: 'En verificación', tone: 'info' },
  aprobada: { texto: 'Aprobada', tone: 'success' },
  rechazada: { texto: 'Rechazada', tone: 'danger' },
  expirada: { texto: 'Expirada', tone: 'neutral' },
};

/** Badge de estado de pago — antes vivía como componente propio en components/EstadoBadge.tsx. */
export function EstadoBadge({ estado }: { estado: EstadoPago }) {
  const { texto, tone } = ESTADO_PAGO[estado];
  return <Badge tone={tone}>{texto}</Badge>;
}
