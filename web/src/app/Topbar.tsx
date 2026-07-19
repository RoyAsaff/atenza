import { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { IconButton } from '../core/ui/IconButton';

export function Topbar({
  children,
  onAbrirMenu,
}: {
  children: ReactNode;
  onAbrirMenu?: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-4 sm:px-6">
      {onAbrirMenu && (
        <IconButton aria-label="Abrir menú" className="lg:hidden" onClick={onAbrirMenu}>
          <Menu size={18} />
        </IconButton>
      )}
      <div className="flex flex-1 items-center justify-between gap-2">{children}</div>
    </header>
  );
}
