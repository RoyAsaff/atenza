import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { api } from '../api/cliente';
import { Contexto, SesionActiva } from '../tipos';
import { guardarSesion, limpiarSesion, obtenerSesion } from './almacen-sesion';

interface AuthContexto {
  sesion: SesionActiva | null;
  login: (email: string, password: string, contexto?: Contexto) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthContexto | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionActiva | null>(obtenerSesion);

  const login = useCallback(async (email: string, password: string, contexto?: Contexto) => {
    // Sin `contexto`, el backend lo deriva del rol (admin o docente); la
    // pantalla de "Rendir examen" lo manda explícito ('estudiante').
    const { data } = await api.post('/api/auth/login', { email, password, contexto });
    const nueva: SesionActiva = {
      token: data.token,
      expira_en: data.expira_en,
      contexto: data.contexto,
      usuario: data.usuario,
    };
    guardarSesion(nueva);
    setSesion(nueva);
  }, []);

  const logout = useCallback(() => {
    limpiarSesion();
    setSesion(null);
  }, []);

  return <Ctx.Provider value={{ sesion, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContexto {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
