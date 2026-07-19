// Guard de la ruta raíz "/": a diferencia de ProtegerRuta (que siempre
// manda a /login sin sesión), acá "/" muestra la landing pública cuando
// no hay sesión — cualquier otra ruta protegida (deep link) sigue
// mandando a /login exactamente como antes.

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../core/auth/AuthContext';
import { LandingPage } from '../features/landing/LandingPage';

export function RaizPublica({ children }: { children: ReactNode }) {
  const { sesion } = useAuth();
  const location = useLocation();

  if (sesion) return <>{children}</>;
  if (location.pathname === '/') return <LandingPage />;
  return <Navigate to="/login" replace />;
}
