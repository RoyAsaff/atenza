// HU-04 · Paso 2 del reset: aquí cae el enlace del correo
// (/restablecer-password?token=...). Al confirmar, el backend cierra
// todas las sesiones activas de la cuenta.

import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, mensajeDeError } from '../../core/api/cliente';
import { Button, Campo, Card, CardBody, Input } from '../../core/ui/ui';
import { LogoTile } from '../../core/ui/Logo';

export function RestablecerPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      return setError('La contraseña debe tener al menos 8 caracteres');
    }
    if (password !== confirmar) {
      return setError('Las contraseñas no coinciden');
    }

    setCargando(true);
    try {
      await api.post('/api/auth/password/restablecer', { token, password });
      setListo(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <Card elevado className="w-full max-w-sm">
          <CardBody className="p-8 text-center">
            <p className="text-sm text-red-600">
              Enlace inválido: falta el token. Solicita uno nuevo desde{' '}
              <Link
                to="/password/olvide"
                className="text-primary-700 hover:text-primary-800 hover:underline"
              >
                recuperar contraseña
              </Link>
              .
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (listo) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <Card elevado className="w-full max-w-sm">
          <CardBody className="p-8 text-center">
            <h1 className="text-xl font-bold text-secondary-800 mb-2">Contraseña actualizada</h1>
            <p className="text-sm text-text-secondary">
              Todas tus sesiones anteriores se cerraron. Redirigiendo al login…
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <Card elevado className="w-full max-w-md">
        <CardBody className="p-8">
          <div className="mb-4 flex justify-center">
            <LogoTile size={56} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text text-center">Atenza</h1>
          <p className="text-sm text-text-secondary text-center mb-6">Nueva contraseña</p>

          <form onSubmit={manejarSubmit} className="space-y-4">
            <Campo etiqueta="Nueva contraseña (mínimo 8 caracteres)">
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Campo>
            <Campo etiqueta="Confirmar contraseña">
              <Input
                type="password"
                required
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
            </Campo>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" cargando={cargando} className="w-full">
              {cargando ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
