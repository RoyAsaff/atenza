// Login de la app de escritorio — calcado de web/src/features/auth/
// LoginPage.tsx pero recortado: sin registro ni "olvidé mi contraseña"
// (esta app es solo para rendir exámenes, la cuenta ya existe de antes por
// web/mobile) y siempre contexto 'estudiante' (AuthContext.login lo fija).

import { FormEvent, useState } from 'react';
import { useAuth } from '../../core/auth/AuthContext';
import { mensajeDeError } from '../../core/api/cliente';
import { Button, Campo, Card, CardBody, Input } from '../../core/ui';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card elevado className="w-full max-w-md">
        <CardBody className="p-8">
          <h1 className="text-center text-2xl font-extrabold tracking-tight text-text">Atenza</h1>
          <p className="mb-6 text-center text-sm text-text-secondary">Exámenes de código</p>

          <form onSubmit={manejarSubmit} className="space-y-4">
            <Campo etiqueta="Correo">
              <Input
                type="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Campo>

            <Campo etiqueta="Contraseña">
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Campo>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" cargando={cargando} className="w-full">
              {cargando ? 'Ingresando…' : 'Iniciar sesión'}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
