import { ReactNode } from 'react';
import { cn } from './cn';
import { Skeleton } from './Skeleton';

export function Tabla({
  cargando = false,
  vacio,
  className = '',
  children,
}: {
  cargando?: boolean;
  vacio?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className={cn('w-full text-sm', className)}>{children}</table>
      {cargando && (
        <div className="space-y-2 p-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      )}
      {!cargando && vacio && <div className="p-4">{vacio}</div>}
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-border bg-surface-sunken">{children}</thead>;
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function Tr({ className = '', children }: { className?: string; children: ReactNode }) {
  return <tr className={cn('transition hover:bg-surface-hover', className)}>{children}</tr>;
}

export function Th({
  alineado = 'left',
  className = '',
  children,
}: {
  alineado?: 'left' | 'center' | 'right';
  className?: string;
  children?: ReactNode;
}) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted',
        alineado === 'center' && 'text-center',
        alineado === 'right' && 'text-right',
        alineado === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  alineado = 'left',
  className = '',
  children,
}: {
  alineado?: 'left' | 'center' | 'right';
  className?: string;
  children?: ReactNode;
}) {
  return (
    <td
      className={cn(
        'px-4 py-3 text-text',
        alineado === 'center' && 'text-center',
        alineado === 'right' && 'text-right',
        className,
      )}
    >
      {children}
    </td>
  );
}
