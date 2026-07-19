import { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

type Props = InputHTMLAttributes<HTMLInputElement> & { etiqueta?: ReactNode };

export function Checkbox({ etiqueta, className = '', id, ...props }: Props) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-text">
      <input
        type="checkbox"
        id={id}
        className={cn(
          'h-4 w-4 rounded border-border text-primary-700 accent-primary-700',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          className,
        )}
        {...props}
      />
      {etiqueta}
    </label>
  );
}

export function Radio({ etiqueta, className = '', id, ...props }: Props) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-text">
      <input
        type="radio"
        id={id}
        className={cn(
          'h-4 w-4 border-border text-primary-700 accent-primary-700',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          className,
        )}
        {...props}
      />
      {etiqueta}
    </label>
  );
}
