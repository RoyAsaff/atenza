// Copiado de web/src/core/ui/Campo.tsx — ver Button.tsx para el motivo.

import { ReactNode } from 'react';
import { cn } from './cn';

export const campoClases = cn(
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text',
  'placeholder:text-text-disabled',
  'focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100',
);

export const campoInvalidoClases = 'border-red-300 focus:border-red-400 focus:ring-red-100';

export function Campo({
  etiqueta,
  error,
  className = '',
  children,
}: {
  etiqueta: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn('block text-sm font-medium text-text-secondary', className)}>
      {etiqueta}
      <div className="mt-1.5 font-normal">{children}</div>
      {error && <p className="mt-1 text-xs font-normal text-red-600">{error}</p>}
    </label>
  );
}
