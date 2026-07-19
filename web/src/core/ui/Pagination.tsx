import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from './IconButton';
import { cn } from './cn';

export function Pagination({
  pagina,
  totalPaginas,
  onCambio,
  className = '',
}: {
  pagina: number;
  totalPaginas: number;
  onCambio: (pagina: number) => void;
  className?: string;
}) {
  if (totalPaginas <= 1) return null;
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <p className="text-sm text-text-secondary">
        Página <span className="font-medium text-text">{pagina}</span> de {totalPaginas}
      </p>
      <div className="flex items-center gap-1">
        <IconButton
          variante="secondary"
          aria-label="Página anterior"
          disabled={pagina <= 1}
          onClick={() => onCambio(pagina - 1)}
        >
          <ChevronLeft size={16} />
        </IconButton>
        <IconButton
          variante="secondary"
          aria-label="Página siguiente"
          disabled={pagina >= totalPaginas}
          onClick={() => onCambio(pagina + 1)}
        >
          <ChevronRight size={16} />
        </IconButton>
      </div>
    </div>
  );
}
