// Calcado de web/src/core/auth/AuthContext.tsx — la diferencia central es
// que acá la sesión persiste en disco vía Tauri Store (ver sesion-store.ts)
// en vez de sessionStorage, así que cargarla al arrancar es async: `listo`
// indica cuándo terminó ese chequeo inicial (App.tsx muestra una pantalla
// de carga breve mientras tanto, nunca un parpadeo al login).

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { alTerminarSesion, api } from '../api/cliente';
import { cerrarSocket } from '../realtime/socket';
import { SesionActiva } from '../tipos';
import { guardarSesion, inicializarSesion, limpiarSesion } from './sesion-store';

interface AuthContexto {
  sesion: SesionActiva | null;
  listo: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthContexto | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionActiva | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    inicializarSesion().then((cargada) => {
      setSesion(cargada);
      setListo(true);
    });
  }, []);

  useEffect(() => alTerminarSesion(() => setSesion(null)), []);

  const login = useCallback(async (email: string, password: string) => {
    // Siempre contexto 'estudiante': esta app solo sirve para rendir
    // exámenes de código, nunca para el panel docente.
    const { data } = await api.post('/api/auth/login', {
      email,
      password,
      contexto: 'estudiante',
    });
    const nueva: SesionActiva = {
      token: data.token,
      expira_en: data.expira_en,
      contexto: data.contexto,
      usuario: data.usuario,
    };
    await guardarSesion(nueva);
    setSesion(nueva);
  }, []);

  const logout = useCallback(() => {
    cerrarSocket();
    limpiarSesion();
    setSesion(null);
  }, []);

  return <Ctx.Provider value={{ sesion, listo, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContexto {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
