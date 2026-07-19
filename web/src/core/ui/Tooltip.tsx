import { ReactNode, useState } from 'react';
import { cn } from './cn';

const LADOS = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
} as const;

export function Tooltip({
  contenido,
  lado = 'top',
  children,
}: {
  contenido: ReactNode;
  lado?: keyof typeof LADOS;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-40 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white',
            LADOS[lado],
          )}
          style={{ animation: 'atenza-fade-in var(--duration-fast) var(--ease-atenza)' }}
        >
          {contenido}
        </span>
      )}
    </span>
  );
}
