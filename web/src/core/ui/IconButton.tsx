import { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';
import type { Variante, Tamano } from './Button';

const TAMANOS: Record<Tamano, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
};

const VARIANTES: Record<Variante, string> = {
  primary: 'bg-primary-800 text-white hover:bg-primary-900',
  secondary: 'bg-surface text-text border border-border hover:bg-surface-hover',
  ghost: 'text-text-secondary hover:bg-neutral-100 hover:text-text',
  danger: 'text-red-600 hover:bg-red-50',
  accent: 'bg-accent-600 text-white hover:bg-accent-700',
};

export function IconButton({
  variante = 'ghost',
  tamano = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tamano?: Tamano;
  'aria-label': string;
}) {
  return (
    <button
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANTES[variante],
        TAMANOS[tamano],
        className,
      )}
      {...props}
    />
  );
}
