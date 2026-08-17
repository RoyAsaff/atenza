// Sidebar (08/08): las materias (dictadas + inscritas) pasan a vivir acá,
// como en Classroom/Moodle, en vez de solo en tarjetas dentro de "Inicio" —
// así cambiar de materia no obliga a volver siempre al home. Van en dos
// grupos colapsables (rol dual, HU-03): "Enseño" e "Inscrito"; si un grupo
// está vacío, no se muestra (el mensaje de bienvenida en "Inicio" ya cubre
// el caso sin ninguna materia). "Mi suscripción" se movió al ícono de
// perfil (UserMenu) — ya no va acá para no duplicarla.

import { ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  ChevronDown,
  GraduationCap,
  LayoutDashboard,
  Layers,
  NotebookText,
  Percent,
  Receipt,
  X,
} from 'lucide-react';
import { LogoLockup } from '../core/ui/Logo';
import { cn } from '../core/ui/cn';
import { IconButton } from '../core/ui/IconButton';
import { api } from '../core/api/cliente';
import { Materia, MateriaInscrita } from '../core/tipos';

const enlaceClase = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'border-primary-700 bg-primary-50 text-primary-800'
      : 'border-transparent text-text-secondary hover:bg-surface-hover hover:text-text',
  );

const enlaceMateria = ({ isActive }: { isActive: boolean }) =>
  cn(
    'block rounded-md border-l-2 px-3 py-1.5 text-sm leading-snug transition',
    isActive
      ? 'border-primary-700 bg-primary-50 font-medium text-primary-800'
      : 'border-transparent text-text-secondary hover:bg-surface-hover hover:text-text',
  );

function GrupoMaterias({
  titulo,
  icono,
  children,
}: {
  titulo: string;
  icono: ReactNode;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-disabled transition hover:text-text-secondary"
      >
        {icono}
        <span className="flex-1 text-left">{titulo}</span>
        <ChevronDown size={13} className={cn('transition', !abierto && '-rotate-90')} />
      </button>
      {abierto && <div className="flex flex-col gap-0.5">{children}</div>}
    </div>
  );
}

function MateriasDelSidebar() {
  const { data } = useQuery({
    queryKey: ['mi-espacio'],
    queryFn: async () => {
      const { data } = await api.get<{
        materias_que_dicto: Materia[];
        materias_inscrito: MateriaInscrita[];
      }>('/api/mi-espacio');
      return data;
    },
  });

  const dictadas = data?.materias_que_dicto ?? [];
  const inscritas = data?.materias_inscrito ?? [];

  if (dictadas.length === 0 && inscritas.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-border pt-3">
      {dictadas.length > 0 && (
        <GrupoMaterias titulo="Enseño" icono={<GraduationCap size={14} />}>
          {dictadas.map((m) => (
            <NavLink
              key={m.id}
              to={`/materias/${m.id}`}
              className={enlaceMateria}
              title={m.nombre_materia}
            >
              <span className="line-clamp-2 break-words">{m.nombre_materia}</span>
            </NavLink>
          ))}
        </GrupoMaterias>
      )}
      {inscritas.length > 0 && (
        <GrupoMaterias titulo="Inscrito" icono={<BookOpen size={14} />}>
          {inscritas.map((m) => (
            <NavLink
              key={m.materia.id}
              to={`/inscrito/${m.materia.id}`}
              className={enlaceMateria}
              title={m.materia.nombre_materia}
            >
              <span className="line-clamp-2 break-words">{m.materia.nombre_materia}</span>
            </NavLink>
          ))}
        </GrupoMaterias>
      )}
    </div>
  );
}

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
        <nav className="flex flex-1 flex-col gap-1 px-3 pb-4" onClick={onCerrar}>
          {esAdmin ? (
            <>
              <NavLink to="/admin/solicitudes" className={enlaceClase}>
                <Receipt size={17} /> Pagos
              </NavLink>
              <NavLink to="/admin/planes" className={enlaceClase}>
                <Layers size={17} /> Planes
              </NavLink>
              <NavLink to="/admin/promociones" className={enlaceClase}>
                <Percent size={17} /> Promociones
              </NavLink>
              <NavLink to="/admin/panel" className={enlaceClase}>
                <LayoutDashboard size={17} /> Panel general
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/" end className={enlaceClase}>
                <NotebookText size={17} /> Inicio
              </NavLink>
              {/* "Mi suscripción" se movió al ícono de perfil (UserMenu,
                  arriba a la derecha); la ruta /suscripcion sigue existiendo,
                  solo ya no hay link directo acá para no duplicarla. */}
              <MateriasDelSidebar />
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
