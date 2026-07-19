import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';
import { campoClases, campoInvalidoClases } from './Campo';

type ConIcono = { iconoIzq?: ReactNode; invalido?: boolean };

export function Input({
  invalido = false,
  iconoIzq,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & ConIcono) {
  if (iconoIzq) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-disabled">
          {iconoIzq}
        </span>
        <input
          className={cn(campoClases, 'pl-9', invalido && campoInvalidoClases, className)}
          {...props}
        />
      </div>
    );
  }
  return <input className={cn(campoClases, invalido && campoInvalidoClases, className)} {...props} />;
}

export function Textarea({
  invalido = false,
  filas = 4,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalido?: boolean; filas?: number }) {
  return (
    <textarea
      rows={filas}
      className={cn(campoClases, 'min-h-0', invalido && campoInvalidoClases, className)}
      {...props}
    />
  );
}

export function Select({
  invalido = false,
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalido?: boolean }) {
  return (
    <div className="relative">
      <select
        className={cn(campoClases, 'appearance-none pr-9', invalido && campoInvalidoClases, className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute inset-y-0 right-3 my-auto text-text-muted"
      />
    </div>
  );
}
