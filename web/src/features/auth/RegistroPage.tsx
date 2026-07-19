// HU-02 · Registro de cuenta self-service

import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, mensajeDeError } from '../../core/api/cliente';
import { Button, Campo, Card, CardBody, Input } from '../../core/ui/ui';
import { LogoTile } from '../../core/ui/Logo';

export function RegistroPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombres: '',
    apellidos: '',
    email: '',
    whatsapp: '',
    password: '',
    confirmar: '',
  });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [creada, setCreada] = useState(false);

  function campo(
    nombre: keyof typeof form,
    etiqueta: string,
    tipo = 'text',
    opcional = false,
  ) {
    return (
      <Campo
        etiqueta={
          <>
            {etiqueta} {opcional && <span className="text-text-disabled">(opcional)</span>}
          </>
        }
      >
        <Input
          type={tipo}
          required={!opcional}
          value={form[nombre]}
          onChange={(e) => setForm({ ...form, [nombre]: e.target.value })}
        />
      </Campo>
    );
  }

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      return setError('La contraseña debe tener al menos 8 caracteres');
    }
    if (form.password !== form.confirmar) {
      return setError('Las contraseñas no coinciden');
    }

    setCargando(true);
    try {
      await api.post('/api/auth/registro', {
        nombres: form.nombres,
        apellidos: form.apellidos,
        email: form.email,
        whatsapp: form.whatsapp || undefined,
        password: form.password,
      });
      setCreada(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }

  if (creada) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <Card elevado className="w-full max-w-sm">
          <CardBody className="p-8 text-center">
            <h1 className="text-xl font-bold text-secondary-800 mb-2">¡Cuenta creada!</h1>
            <p className="text-sm text-text-secondary">
              Te enviamos un correo de verificación. Ya puedes iniciar sesión…
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
          <p className="text-sm text-text-secondary text-center mb-6">Crear cuenta</p>

          <form onSubmit={manejarSubmit} className="space-y-4">
            {campo('nombres', 'Nombres')}
            {campo('apellidos', 'Apellidos')}
            {campo('email', 'Correo', 'email')}
            {campo('whatsapp', 'WhatsApp', 'tel', true)}
            {campo('password', 'Contraseña (mínimo 8 caracteres)', 'password')}
            {campo('confirmar', 'Confirmar contraseña', 'password')}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" cargando={cargando} className="w-full">
              {cargando ? 'Creando cuenta…' : 'Registrarme'}
            </Button>
          </form>

          <p className="mt-4 text-sm text-text-secondary text-center">
            ¿Ya tienes cuenta?{' '}
            <Link
              to="/login"
              className="font-medium text-primary-700 hover:text-primary-800 hover:underline"
            >
              Inicia sesión
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
