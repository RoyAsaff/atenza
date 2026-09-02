// Copiado de web/src/core/ui/Input.tsx (solo <Input>, el resto de la app
// no necesita Textarea/Select) — ver Button.tsx para el motivo.

import { InputHTMLAttributes } from 'react';
import { cn } from './cn';
import { campoClases, campoInvalidoClases } from './Campo';

export function Input({
  invalido = false,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalido?: boolean }) {
  return <input className={cn(campoClases, invalido && campoInvalidoClases, className)} {...props} />;
}
