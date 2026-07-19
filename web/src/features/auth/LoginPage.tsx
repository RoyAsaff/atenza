// HU-01 · Login del panel web (contextos docente y admin)

import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthContext';
import { mensajeDeError } from '../../core/api/cliente';
import { Alert, Button, Campo, Card, CardBody, Input } from '../../core/ui/ui';
import { LogoTile } from '../../core/ui/Logo';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const sesionTerminada = params.get('motivo') === 'sesion_terminada';

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <Card elevado className="w-full max-w-md">
        <CardBody className="p-8">
          <div className="mb-4 flex justify-center">
            <LogoTile size={56} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text text-center">Atenza</h1>
          <p className="text-sm text-text-secondary text-center mb-6">
            Panel docente y administración
          </p>

          {sesionTerminada && (
            <Alert tone="warning" icon={<AlertTriangle size={16} />} className="mb-4">
              Tu sesión terminó (expiró o se inició sesión en otro dispositivo).
            </Alert>
          )}

          <form onSubmit={manejarSubmit} className="space-y-4">
            <Campo etiqueta="Correo">
              <Input
                type="email"
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

          <p className="mt-4 text-sm text-text-secondary text-center">
            ¿No tienes cuenta?{' '}
            <Link
              to="/registro"
              className="font-medium text-primary-700 hover:text-primary-800 hover:underline"
            >
              Regístrate
            </Link>
            {' · '}
            <Link
              to="/password/olvide"
              className="text-primary-700 hover:text-primary-800 hover:underline"
            >
              Olvidé mi contraseña
            </Link>
          </p>

          <p className="mt-3 text-xs text-text-disabled text-center">
            El panel docente pide credenciales en cada ingreso y admite una sola sesión activa.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
