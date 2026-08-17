// Layout del panel: sidebar de navegación según contexto (docente o admin)
// + topbar con menú de usuario + banner de estado de la suscripción.
//
// Unificación de identidad en web (05/08, reemplaza los silos /examen y
// /guias): rol dual (HU-03) — la misma cuenta puede estar rindiendo un
// examen como estudiante en otra materia mientras navega el panel de
// docente. Igual que `_Raiz`/`ExamenController` en mobile, un intento
// activo interrumpe CUALQUIER pantalla del panel, sin que el usuario
// tenga que saber a qué URL ir.

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../core/auth/AuthContext';
import { api } from '../core/api/cliente';
import { obtenerSocket } from '../core/realtime/socket';
import { GuiaIntentoParaRendir, IntentoParaRendir, Materia, MateriaInscrita } from '../core/tipos';
import { RendirExamenPage } from '../features/examen/RendirExamenPage';
import { GuiaAvisoOverlay } from '../features/mi-espacio/GuiaAvisoOverlay';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { UserMenu } from './UserMenu';
import { AccionesRapidasMenu } from './AccionesRapidasMenu';
import { BannerSuscripcion } from './BannerSuscripcion';

const EVENTOS_SOCKET_EXAMEN = [
  'evaluacion-lanzada',
  'examen-pausado',
  'examen-reactivado',
  'examen-cancelado',
] as const;

// Guías nativas (17/08): el mismo criterio de auto-push que exámenes, pero
// sin "enGuia" pegajoso — el overlay se apaga solo cuando el servidor deja
// de devolver el intento (ver GuiaAvisoOverlay).
const EVENTOS_SOCKET_GUIA = [
  'guia-lanzada',
  'guia-pausada',
  'guia-reactivada',
  'guia-cancelada',
] as const;

export function Layout() {
  const { sesion, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [enExamen, setEnExamen] = useState(false);

  const esAdmin = sesion?.contexto === 'admin';

  // Encabezado dinámico (08/08): antes decía "Espacio docente" fijo, aunque
  // la cuenta solo tuviera materias inscritas. Se calcula con los mismos
  // datos que ya pide el Sidebar (misma query key, sin fetch de más).
  const { data: miEspacio } = useQuery({
    queryKey: ['mi-espacio'],
    queryFn: async () => {
      const { data } = await api.get<{
        materias_que_dicto: Materia[];
        materias_inscrito: MateriaInscrita[];
      }>('/api/mi-espacio');
      return data;
    },
    enabled: !!sesion && !esAdmin,
  });
  const dicta = (miEspacio?.materias_que_dicto.length ?? 0) > 0;
  const inscrito = (miEspacio?.materias_inscrito.length ?? 0) > 0;
  const tituloEspacio =
    dicta && !inscrito
      ? 'Espacio docente'
      : inscrito && !dicta
        ? 'Espacio de estudiante'
        : 'Mi espacio';

  // Mismo query key que usa RendirExamenPage internamente — comparten
  // caché, no se duplica el fetch cuando ambos están montados.
  const { data: intento } = useQuery({
    queryKey: ['intento-actual'],
    queryFn: async () => {
      const { data } = await api.get<{ intento: IntentoParaRendir | null }>(
        '/api/intentos/actual',
      );
      return data.intento;
    },
    refetchInterval: 15000, // respaldo si el socket se cae un momento
    enabled: !!sesion && !esAdmin,
  });

  // Guías nativas (17/08): mismo query key que usa cualquier otra pantalla
  // que pida "hay algo esperándome ahora" — acá solo el lanzamiento
  // OFICIAL de una guía (un repaso que el propio estudiante ya inició no
  // dispara esto, ver VerGuiaOficialActivo).
  const { data: intentoGuia } = useQuery({
    queryKey: ['guia-actual'],
    queryFn: async () => {
      const { data } = await api.get<{ intento: GuiaIntentoParaRendir | null }>(
        '/api/intentos/guia-actual',
      );
      return data.intento;
    },
    refetchInterval: 15000, // respaldo si el socket se cae un momento
    enabled: !!sesion && !esAdmin,
  });

  useEffect(() => {
    if (!sesion || esAdmin) return;
    const socket = obtenerSocket();
    const refrescar = () => queryClient.invalidateQueries({ queryKey: ['intento-actual'] });
    const refrescarGuia = () => queryClient.invalidateQueries({ queryKey: ['guia-actual'] });
    EVENTOS_SOCKET_EXAMEN.forEach((e) => socket.on(e, refrescar));
    EVENTOS_SOCKET_GUIA.forEach((e) => socket.on(e, refrescarGuia));
    return () => {
      EVENTOS_SOCKET_EXAMEN.forEach((e) => socket.off(e, refrescar));
      EVENTOS_SOCKET_GUIA.forEach((e) => socket.off(e, refrescarGuia));
    };
  }, [sesion, esAdmin, queryClient]);

  // Solo se prende con un intento nuevo; se apaga cuando RendirExamenPage
  // avisa que es seguro volver (onTerminado) — nunca solo porque el
  // servidor dejó de devolver el intento (se aceptaría cortar la pantalla
  // de "enviado"/"cancelado" a mitad de camino).
  useEffect(() => {
    if (intento && !enExamen) setEnExamen(true);
  }, [intento, enExamen]);

  if (!sesion) return null;

  if (enExamen) {
    return <RendirExamenPage onTerminado={() => setEnExamen(false)} />;
  }

  // Un examen en curso siempre gana — más en juego que una guía de repaso.
  if (intentoGuia) {
    return <GuiaAvisoOverlay intento={intentoGuia} />;
  }

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
            {esAdmin ? 'Administración' : tituloEspacio}
          </p>
          <div className="flex items-center gap-2">
            {/* "+" (08/08): crear materia / unirme a una materia, al lado
                del ícono de perfil — reemplaza los botones sueltos que
                antes vivían dentro de "Inicio". */}
            {!esAdmin && <AccionesRapidasMenu />}
            <UserMenu
              nombre={`${sesion.usuario.nombres} ${sesion.usuario.apellidos}`}
              contexto={sesion.contexto}
              onSalir={salir}
            />
          </div>
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
