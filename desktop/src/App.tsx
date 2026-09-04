// Raíz de la app — mismo criterio que _Raiz de mobile / Layout de web
// (unificación de identidad, 05/08): mientras haya sesión, se muestra
// SIEMPRE la pantalla de examen (que internamente decide sola si hay un
// examen activo, pausado, o ninguno — ver PantallaSinExamen dentro de
// ExamenCodigoPage). No hay portal/menú propio: esta app solo sirve para
// rendir exámenes de código.

import { useAuth } from './core/auth/AuthContext';
import { useActualizarApp } from './core/actualizacion/useActualizarApp';
import { LoginPage } from './features/login/LoginPage';
import { ExamenCodigoPage } from './features/examen/ExamenCodigoPage';

function PantallaCargando() {
  return <div className="min-h-screen bg-primary-900" />;
}

export default function App() {
  const { sesion, listo } = useAuth();
  // Una sola vez por arranque, en paralelo — nunca bloquea login/uso (ver
  // core/actualizacion/useActualizarApp.ts).
  useActualizarApp();

  if (!listo) return <PantallaCargando />;
  if (!sesion) return <LoginPage />;
  return <ExamenCodigoPage />;
}
