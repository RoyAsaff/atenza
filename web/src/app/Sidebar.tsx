import { NavLink } from 'react-router-dom';
import { CreditCard, LayoutDashboard, Layers, NotebookText, Receipt, X } from 'lucide-react';
import { LogoLockup } from '../core/ui/Logo';
import { cn } from '../core/ui/cn';
import { IconButton } from '../core/ui/IconButton';

const enlaceClase = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'border-primary-700 bg-primary-50 text-primary-800'
      : 'border-transparent text-text-secondary hover:bg-surface-hover hover:text-text',
  );

export function Sidebar({
  esAdmin,
  abierto,
  onCerrar,
}: {
  esAdmin: boolean;
  abierto: boolean;
  onCerrar: () => void;
}) {
  return (
    <>
      {abierto && (
        <div className="fixed inset-0 z-30 bg-neutral-900/50 lg:hidden" onClick={onCerrar} />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface transition-transform duration-200 ease-out',
          'lg:static lg:translate-x-0',
          abierto ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-4 py-5">
          <LogoLockup />
          <IconButton aria-label="Cerrar menú" className="lg:hidden" onClick={onCerrar}>
            <X size={18} />
          </IconButton>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3" onClick={onCerrar}>
          {esAdmin ? (
            <>
              <NavLink to="/admin/solicitudes" className={enlaceClase}>
                <Receipt size={17} /> Pagos
              </NavLink>
              <NavLink to="/admin/planes" className={enlaceClase}>
                <Layers size={17} /> Planes
              </NavLink>
              <NavLink to="/admin/panel" className={enlaceClase}>
                <LayoutDashboard size={17} /> Panel general
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/" end className={enlaceClase}>
                <NotebookText size={17} /> Mis materias
              </NavLink>
              <NavLink to="/suscripcion" className={enlaceClase}>
                <CreditCard size={17} /> Mi suscripción
              </NavLink>
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
