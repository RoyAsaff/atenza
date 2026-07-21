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

  // Este árbol de rutas (Layout de docente/admin) no es para estudiantes —
  // su app vive en /examen. Sin este chequeo, un estudiante logueado podía
  // entrar a /materias/:id, /suscripcion, etc. tecleando la URL (el backend
  // rechazaba las llamadas a la API, pero la pantalla igual se mostraba).
  if (sesion?.contexto === 'estudiante') return <Navigate to="/examen" replace />;
  if (sesion) return <>{children}</>;
  if (location.pathname === '/') return <LandingPage />;
  return <Navigate to="/login" replace />;
}
