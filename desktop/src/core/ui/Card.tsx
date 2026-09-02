// Copiado de web/src/core/ui/Card.tsx — ver Button.tsx para el motivo.

import { ReactNode } from 'react';
import { cn } from './cn';

export function Card({
  elevado = false,
  className = '',
  children,
}: {
  elevado?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface',
        elevado ? 'shadow-md' : 'shadow-xs',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardBody({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}
