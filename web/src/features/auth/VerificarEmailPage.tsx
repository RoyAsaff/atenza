// HU-04 · Destino del enlace de verificación (/verificar-email?token=...)

import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { Alert, Card, CardBody, Spinner } from '../../core/ui/ui';
import { LogoTile } from '../../core/ui/Logo';

export function VerificarEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [estado, setEstado] = useState<'verificando' | 'ok' | 'error'>('verificando');
  const [error, setError] = useState('');
  const ejecutado = useRef(false);

  useEffect(() => {
    if (!token) {
      setEstado('error');
      setError('Enlace inválido: falta el token');
      return;
    }
    if (ejecutado.current) return; // evita doble llamada en StrictMode
    ejecutado.current = true;

    api
      .post('/api/auth/verificar-email', { token })
      .then(() => setEstado('ok'))
      .catch((err) => {
        setEstado('error');
        setError(mensajeDeError(err));
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <Card elevado className="w-full max-w-sm">
        <CardBody className="p-8 text-center">
          <div className="mb-4 flex justify-center">
            <LogoTile size={56} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text mb-4">Atenza</h1>

          {estado === 'verificando' && (
            <p className="flex items-center justify-center gap-2 text-text-secondary">
              <Spinner /> Verificando tu correo…
            </p>
          )}

          {estado === 'ok' && (
            <>
              <Alert tone="success" icon={<CheckCircle2 size={16} />}>
                ¡Correo verificado correctamente!
              </Alert>
              <Link
                to="/login"
                className="mt-4 inline-block text-sm font-medium text-primary-700 hover:text-primary-800 hover:underline"
              >
                Iniciar sesión
              </Link>
            </>
          )}

          {estado === 'error' && (
            <>
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </p>
              <Link
                to="/login"
                className="mt-4 inline-block text-sm font-medium text-primary-700 hover:text-primary-800 hover:underline"
              >
                Volver al inicio
              </Link>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
