import { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

export type Variante = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
export type Tamano = 'sm' | 'md' | 'lg';

const VARIANTES_BOTON: Record<Variante, string> = {
  primary: 'bg-primary-800 text-white hover:bg-primary-900 active:bg-primary-900 shadow-xs',
  secondary:
    'bg-surface text-text border border-border hover:bg-surface-hover hover:border-border-hover',
  ghost: 'text-text-secondary hover:bg-neutral-100 hover:text-text',
  danger: 'text-red-600 hover:bg-red-50',
  accent: 'bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800 shadow-xs',
};

const TAMANOS_BOTON: Record<Tamano, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

/** Clases de botón reutilizables tanto en <button> como en <Link>. */
export function botonClases(variante: Variante = 'primary', tamano: Tamano = 'md') {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:pointer-events-none',
    VARIANTES_BOTON[variante],
    TAMANOS_BOTON[tamano],
  );
}

export function Button({
  variante = 'primary',
  tamano = 'md',
  cargando = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
}) {
  return (
    <button
      className={cn(botonClases(variante, tamano), className)}
      disabled={disabled || cargando}
      {...props}
    >
      {cargando && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
