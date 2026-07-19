// Login de estudiantes para "Rendir examen" desde la web — para quienes no
// tienen la app móvil (p. ej. solo tienen iPhone). Misma cuenta que el
// login docente, pero pide explícitamente contexto 'estudiante'
// (ver AuthContext.login) en vez de dejar que el backend lo derive del rol.

import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthContext';
import { mensajeDeError } from '../../core/api/cliente';
import { Alert, Button, Campo, Card, CardBody, Input } from '../../core/ui/ui';
import { LogoTile } from '../../core/ui/Logo';

export function ExamenLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await login(email, password, 'estudiante');
      navigate('/examen');
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
          <h1 className="text-2xl font-extrabold tracking-tight text-text text-center">
            Rendir examen
          </h1>
          <p className="text-sm text-text-secondary text-center mb-6">
            Ingresa con las credenciales de tu cuenta de estudiante.
          </p>

          <form onSubmit={manejarSubmit} className="space-y-4">
            <Campo etiqueta="Correo">
              <Input
                type="email"
                required
                autoFocus
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

            {error && (
              <Alert tone="danger" icon={<AlertTriangle size={16} />}>
                {error}
              </Alert>
            )}

            <Button type="submit" cargando={cargando} className="w-full">
              {cargando ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>

          <p className="mt-4 text-xs text-text-disabled text-center">
            Esta pantalla es solo para rendir un examen. Si eres docente, ingresa desde el{' '}
            <a href="/login" className="text-primary-700 hover:underline">
              panel docente
            </a>
            .
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
