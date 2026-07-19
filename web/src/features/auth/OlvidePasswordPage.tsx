// HU-04 · Paso 1 del reset: solicitar el enlace de recuperación

import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { Alert, Button, Campo, Card, CardBody, Input } from '../../core/ui/ui';
import { LogoTile } from '../../core/ui/Logo';

export function OlvidePasswordPage() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await api.post('/api/auth/password/olvide', { email });
      setEnviado(true);
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
          <p className="text-sm text-text-secondary text-center mb-6">Recuperar contraseña</p>

          {enviado ? (
            <div className="text-center">
              <Alert tone="success" icon={<CheckCircle2 size={16} />}>
                Si el correo existe, recibirás un enlace de recuperación válido por 60
                minutos. Revisa tu bandeja.
              </Alert>
              <Link
                to="/login"
                className="mt-4 inline-block text-sm font-medium text-primary-700 hover:text-primary-800 hover:underline"
              >
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={manejarSubmit} className="space-y-4">
              <Campo etiqueta="Correo de tu cuenta">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Campo>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" cargando={cargando} className="w-full">
                {cargando ? 'Enviando…' : 'Enviar enlace'}
              </Button>

              <p className="text-sm text-text-secondary text-center">
                <Link to="/login" className="text-primary-700 hover:text-primary-800 hover:underline">
                  Volver al inicio de sesión
                </Link>
              </p>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
