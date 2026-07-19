import { ReactNode } from 'react';
import { cn } from './cn';

/** Clases de input/textarea/select consistentes en toda la app. */
export const campoClases = cn(
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text',
  'placeholder:text-text-disabled',
  'focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100',
);

export const campoInvalidoClases =
  'border-red-300 focus:border-red-400 focus:ring-red-100';

export function Campo({
  etiqueta,
  ayuda,
  error,
  requerido = false,
  className = '',
  children,
}: {
  etiqueta: ReactNode;
  ayuda?: ReactNode;
  error?: ReactNode;
  requerido?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn('block text-sm font-medium text-text-secondary', className)}>
      {etiqueta}
      {requerido && <span className="ml-0.5 text-red-500">*</span>}
      <div className="mt-1.5 font-normal">{children}</div>
      {error ? (
        <p className="mt-1 text-xs font-normal text-red-600">{error}</p>
      ) : (
        ayuda && <p className="mt-1 text-xs font-normal text-text-muted">{ayuda}</p>
      )}
    </label>
  );
}
