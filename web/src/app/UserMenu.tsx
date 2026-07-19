import { ChevronDown, LogOut } from 'lucide-react';
import { Dropdown, DropdownItem, DropdownSeparator } from '../core/ui/Dropdown';
import { Badge } from '../core/ui/Badge';

export function UserMenu({
  nombre,
  contexto,
  onSalir,
}: {
  nombre: string;
  contexto: string;
  onSalir: () => void;
}) {
  return (
    <Dropdown
      trigger={({ abierto }) => (
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-text transition hover:bg-surface-hover"
        >
          {nombre}
          <ChevronDown size={14} className={`text-text-muted transition ${abierto ? 'rotate-180' : ''}`} />
        </button>
      )}
    >
      <div className="px-2.5 py-1.5">
        <Badge tone="primary">{contexto}</Badge>
      </div>
      <DropdownSeparator />
      <DropdownItem icono={<LogOut size={15} />} peligro onSelect={onSalir}>
        Salir
      </DropdownItem>
    </Dropdown>
  );
}
