import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import type { Tono } from './Badge';

const TONOS_ALERT: Record<Tono, string> = {
  neutral: 'bg-neutral-50 border-neutral-200 text-neutral-700',
  primary: 'bg-primary-50 border-primary-200 text-primary-900',
  success: 'bg-secondary-50 border-secondary-200 text-secondary-900',
  info: 'bg-primary-50 border-primary-200 text-primary-900',
  warning: 'bg-accent-50 border-accent-200 text-accent-900',
  danger: 'bg-red-50 border-red-200 text-red-800',
  dark: 'bg-neutral-900 border-neutral-900 text-white',
};

export function Alert({
  tone = 'warning',
  icon,
  onCerrar,
  className = '',
  children,
}: {
  tone?: Tono;
  icon?: ReactNode;
  onCerrar?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm',
        TONOS_ALERT[tone],
        className,
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
      {onCerrar && (
        <button
          onClick={onCerrar}
          className="-m-1 shrink-0 rounded-md p-1 opacity-60 transition hover:opacity-100"
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
