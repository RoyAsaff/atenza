import { Loader2 } from 'lucide-react';
import { cn } from './cn';

const TAMANOS = { sm: 14, md: 18, lg: 24 } as const;

export function Spinner({
  tamano = 'md',
  className = '',
}: {
  tamano?: keyof typeof TAMANOS;
  className?: string;
}) {
  return <Loader2 size={TAMANOS[tamano]} className={cn('animate-spin text-text-muted', className)} />;
}
