import { KeyboardEvent, ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export function Modal({
  onCerrar,
  titulo,
  eyebrow,
  maxWidth = 'max-w-lg',
  footer,
  children,
}: {
  onCerrar: () => void;
  titulo: ReactNode;
  eyebrow?: ReactNode;
  maxWidth?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    function alTeclado(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onCerrar();
    }
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [onCerrar]);

  function detenerPropagacion(e: KeyboardEvent<HTMLDivElement>) {
    e.stopPropagation();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4 backdrop-blur-sm"
      style={{ animation: 'atenza-fade-in var(--duration-fast) var(--ease-atenza)' }}
      onClick={onCerrar}
    >
      <div
        className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-lg bg-surface shadow-lg ring-1 ring-neutral-900/5`}
        style={{ animation: 'atenza-scale-in var(--duration-fast) var(--ease-atenza)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={detenerPropagacion}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                {eyebrow}
              </p>
            )}
            <h3 className="text-base font-semibold text-text">{titulo}</h3>
          </div>
          <IconButton onClick={onCerrar} aria-label="Cerrar" className="-mr-1.5 -mt-1">
            <X size={16} />
          </IconButton>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
