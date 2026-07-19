// Layout del panel: sidebar de navegación según contexto (docente o admin)
// + topbar con menú de usuario + banner de estado de la suscripción.

import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../core/auth/AuthContext';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { UserMenu } from './UserMenu';
import { BannerSuscripcion } from './BannerSuscripcion';

export function Layout() {
  const { sesion, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  if (!sesion) return null;
  const esAdmin = sesion.contexto === 'admin';

  function salir() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-canvas">
      <Sidebar
        esAdmin={esAdmin}
        abierto={sidebarAbierto}
        onCerrar={() => setSidebarAbierto(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onAbrirMenu={() => setSidebarAbierto(true)}>
          <p className="hidden text-sm font-medium text-text-secondary sm:block">
            {esAdmin ? 'Administración' : 'Espacio docente'}
          </p>
          <UserMenu
            nombre={`${sesion.usuario.nombres} ${sesion.usuario.apellidos}`}
            contexto={sesion.contexto}
            onSalir={salir}
          />
        </Topbar>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            {!esAdmin && <BannerSuscripcion />}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
