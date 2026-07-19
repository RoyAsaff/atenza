import { ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from './cn';
import { useUnmountAnim } from './useUnmountAnim';

export function Dropdown({
  trigger,
  align = 'end',
  children,
}: {
  trigger: (props: { abierto: boolean }) => ReactNode;
  align?: 'start' | 'end';
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const { montado, saliendo } = useUnmountAnim(abierto);

  useEffect(() => {
    function alClicFuera(e: MouseEvent) {
      if (raizRef.current && !raizRef.current.contains(e.target as Node)) setAbierto(false);
    }
    function alTeclado(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    if (abierto) {
      document.addEventListener('mousedown', alClicFuera);
      document.addEventListener('keydown', alTeclado);
    }
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alTeclado);
    };
  }, [abierto]);

  return (
    <div ref={raizRef} className="relative inline-block" onClick={() => setAbierto((v) => !v)}>
      {trigger({ abierto })}
      {montado && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'absolute z-30 mt-2 min-w-48 rounded-lg border border-border bg-surface p-1 shadow-md',
            align === 'end' ? 'right-0' : 'left-0',
          )}
          style={{
            animation: `${saliendo ? 'atenza-fade-out' : 'atenza-scale-in'} var(--duration-fast) var(--ease-atenza)`,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  icono,
  peligro = false,
  onSelect,
  children,
}: {
  icono?: ReactNode;
  peligro?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium transition',
        peligro ? 'text-red-600 hover:bg-red-50' : 'text-text hover:bg-surface-hover',
      )}
    >
      {icono}
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-border" />;
}
