import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';
import type { Tono } from './Badge';

const DURACION_SALIDA_MS = 150;

interface ToastConfig {
  tone?: Tono;
  titulo: ReactNode;
  descripcion?: ReactNode;
  duracion?: number;
}

interface ToastInterno extends ToastConfig {
  id: number;
  saliendo: boolean;
}

const ToastContexto = createContext<{ toast: (c: ToastConfig) => void } | null>(null);

const ICONOS: Partial<Record<Tono, ReactNode>> = {
  success: <CheckCircle2 size={18} className="text-secondary-700" />,
  danger: <XCircle size={18} className="text-red-600" />,
  warning: <AlertTriangle size={18} className="text-accent-700" />,
  info: <Info size={18} className="text-primary-700" />,
};

export function useToast() {
  const ctx = useContext(ToastContexto);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastInterno[]>([]);
  const idRef = useRef(0);

  const cerrar = useCallback((id: number) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, saliendo: true } : t)));
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), DURACION_SALIDA_MS);
  }, []);

  const toast = useCallback(
    (config: ToastConfig) => {
      const id = ++idRef.current;
      setItems((prev) => [...prev, { id, saliendo: false, ...config }]);
      setTimeout(() => cerrar(id), config.duracion ?? 4000);
    },
    [cerrar],
  );

  return (
    <ToastContexto.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => (
          <ToastItem key={item.id} {...item} onCerrar={() => cerrar(item.id)} />
        ))}
      </div>
    </ToastContexto.Provider>
  );
}

function ToastItem({
  tone = 'neutral',
  titulo,
  descripcion,
  saliendo,
  onCerrar,
}: ToastInterno & { onCerrar: () => void }) {
  return (
    <div
      role="status"
      className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border bg-surface px-4 py-3 shadow-md"
      style={{
        animation: `${saliendo ? 'atenza-fade-out' : 'atenza-scale-in'} var(--duration-fast) var(--ease-atenza)`,
      }}
    >
      {ICONOS[tone] && <span className="mt-0.5 shrink-0">{ICONOS[tone]}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">{titulo}</p>
        {descripcion && <p className="mt-0.5 text-sm text-text-secondary">{descripcion}</p>}
      </div>
      <button
        onClick={onCerrar}
        className="-m-1 shrink-0 rounded-md p-1 text-text-disabled transition hover:bg-surface-hover hover:text-text-secondary"
        aria-label="Cerrar"
      >
        <X size={14} />
      </button>
    </div>
  );
}
