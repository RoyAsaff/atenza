import { KeyboardEvent, ReactNode, createContext, useContext, useRef } from 'react';
import { cn } from './cn';

const TabsContexto = createContext<{
  valor: string;
  onCambio: (v: string) => void;
} | null>(null);

function useTabsContexto() {
  const ctx = useContext(TabsContexto);
  if (!ctx) throw new Error('Tabs.* debe usarse dentro de <Tabs>');
  return ctx;
}

export function Tabs({
  value,
  onValueChange,
  className = '',
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <TabsContexto.Provider value={{ valor: value, onCambio: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContexto.Provider>
  );
}

export function TabsList({ className = '', children }: { className?: string; children: ReactNode }) {
  const listaRef = useRef<HTMLDivElement>(null);

  function alTeclado(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const botones = Array.from(
      listaRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    );
    const actual = botones.findIndex((b) => b === document.activeElement);
    if (actual === -1) return;
    e.preventDefault();
    const siguiente = e.key === 'ArrowRight' ? (actual + 1) % botones.length : (actual - 1 + botones.length) % botones.length;
    botones[siguiente]?.focus();
    botones[siguiente]?.click();
  }

  return (
    <div
      ref={listaRef}
      role="tablist"
      onKeyDown={alTeclado}
      className={cn('inline-flex items-center gap-1 rounded-md bg-surface-sunken p-1', className)}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const { valor, onCambio } = useTabsContexto();
  const activo = valor === value;
  return (
    <button
      role="tab"
      type="button"
      aria-selected={activo}
      tabIndex={activo ? 0 : -1}
      onClick={() => onCambio(value)}
      className={cn(
        'rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-sm font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        activo ? 'bg-surface text-text shadow-xs' : 'text-text-secondary hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: ReactNode }) {
  const { valor } = useTabsContexto();
  if (valor !== value) return null;
  return (
    <div role="tabpanel" style={{ animation: 'atenza-fade-in var(--duration-fast) var(--ease-atenza)' }}>
      {children}
    </div>
  );
}
