// Modal "Nueva materia" — extraído de MisMateriasPage para que también lo
// pueda abrir el menú "+" del topbar (icono de perfil al lado, 08/08).
// SaaS por cuenta (17/07): crear una materia ya no requiere pago propio —
// solo el total de estudiantes de la cuenta define el precio (ver "Mi
// suscripción"). Por eso "Crear materia" crea directo, sin QR ni plazo.

import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, mensajeDeError } from '../../core/api/cliente';
import { Button, Campo, Input, Modal } from '../../core/ui/ui';

interface FormMateria {
  nombre_materia: string;
  sigla: string;
  carrera: string;
  semestre: string;
  universidad: string;
}

const FORM_INICIAL: FormMateria = {
  nombre_materia: '',
  sigla: '',
  carrera: '',
  semestre: '',
  universidad: 'UAB',
};

export function ModalNuevaMateria({ onCerrar }: { onCerrar: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormMateria>(FORM_INICIAL);
  const [error, setError] = useState('');

  const crear = useMutation({
    mutationFn: () =>
      api.post('/api/materias', { ...form, sigla: form.sigla || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mi-espacio'] });
      onCerrar();
    },
    onError: (err) => setError(mensajeDeError(err)),
  });

  function campo(nombre: keyof FormMateria, etiqueta: string, opcional = false) {
    return (
      <Campo etiqueta={`${etiqueta}${opcional ? ' (opcional)' : ''}`}>
        <Input
          required={!opcional}
          value={form[nombre]}
          onChange={(e) => setForm({ ...form, [nombre]: e.target.value })}
        />
      </Campo>
    );
  }

  function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    setError('');
    crear.mutate();
  }

  return (
    <Modal onCerrar={onCerrar} eyebrow="Mis materias" titulo="Nueva materia">
      <form onSubmit={manejarEnvio} className="space-y-4">
        {campo('nombre_materia', 'Nombre de la materia')}
        {campo('sigla', 'Sigla', true)}
        {campo('carrera', 'Carrera')}
        {campo('semestre', 'Gestión / semestre')}
        {campo('universidad', 'Universidad')}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <Button type="button" variante="secondary" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={crear.isPending}>
            {crear.isPending ? 'Creando…' : 'Crear materia'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
