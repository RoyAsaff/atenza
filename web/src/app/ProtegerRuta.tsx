// Guard de rutas: exige sesión y, opcionalmente, un contexto específico

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../core/auth/AuthContext';
import { Contexto } from '../core/tipos';

export function ProtegerRuta({
  children,
  contexto,
  redirigirA = '/login',
}: {
  children: ReactNode;
  contexto?: Contexto;
  redirigirA?: string;
}) {
  const { sesion } = useAuth();

  if (!sesion) return <Navigate to={redirigirA} replace />;
  if (contexto && sesion.contexto !== contexto) return <Navigate to="/" replace />;

  return <>{children}</>;
}
