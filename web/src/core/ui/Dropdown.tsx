import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [posicion, setPosicion] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { montado, saliendo } = useUnmountAnim(abierto);

  useEffect(() => {
    function alClicFuera(e: MouseEvent) {
      const objetivo = e.target as Node;
      const dentroDelTrigger = raizRef.current?.contains(objetivo);
      const dentroDelMenu = menuRef.current?.contains(objetivo);
      if (!dentroDelTrigger && !dentroDelMenu) setAbierto(false);
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

  // El menú se renderiza en un portal a <body> (ver return más abajo) para
  // no quedar recortado por algún ancestro con overflow-hidden/auto — p.ej.
  // el contenedor redondeado del header de Monitoreo, que antes cortaba el
  // último ítem ("Cancelar examen") cuando el menú se abría ahí. Al vivir
  // fuera del árbol del trigger, su posición hay que calcularla a mano en
  // base al rect real del trigger, y recalcularla si se hace scroll/resize
  // mientras está abierto.
  useLayoutEffect(() => {
    if (!abierto || !raizRef.current) return;
    function actualizarPosicion() {
      const rect = raizRef.current!.getBoundingClientRect();
      setPosicion(
        align === 'end'
          ? { top: rect.bottom + 8, right: window.innerWidth - rect.right }
          : { top: rect.bottom + 8, left: rect.left },
      );
    }
    actualizarPosicion();
    window.addEventListener('scroll', actualizarPosicion, true);
    window.addEventListener('resize', actualizarPosicion);
    return () => {
      window.removeEventListener('scroll', actualizarPosicion, true);
      window.removeEventListener('resize', actualizarPosicion);
    };
  }, [abierto, align]);

  return (
    <div ref={raizRef} className="relative inline-block" onClick={() => setAbierto((v) => !v)}>
      {trigger({ abierto })}
      {montado &&
        posicion &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            className={cn('fixed z-30 min-w-48 rounded-lg border border-border bg-surface p-1 shadow-md')}
            style={{
              top: posicion.top,
              left: posicion.left,
              right: posicion.right,
              animation: `${saliendo ? 'atenza-fade-out' : 'atenza-scale-in'} var(--duration-fast) var(--ease-atenza)`,
            }}
          >
            {children}
          </div>,
          document.body,
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
