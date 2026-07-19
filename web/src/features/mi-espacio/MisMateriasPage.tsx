// HU-03 · "Materias que dicto" (la sección de inscripciones vive en la app móvil)
// SaaS por cuenta (17/07): crear una materia ya no requiere pago propio —
// solo el total de estudiantes de la cuenta define el precio (ver "Mi
// suscripción"). Por eso "+ Nueva materia" crea directo, sin QR ni plazo.

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { GraduationCap, Plus } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { Materia } from '../../core/tipos';
import { Button, Campo, EmptyState, Input, Modal, PageHeader, Spinner } from '../../core/ui/ui';

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

function ModalNuevaMateria({ onCerrar }: { onCerrar: () => void }) {
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

export function MisMateriasPage() {
  const [modalAbierto, setModalAbierto] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['mi-espacio'],
    queryFn: async () => {
      const { data } = await api.get<{ materias_que_dicto: Materia[] }>('/api/mi-espacio');
      return data;
    },
  });

  if (isLoading)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-5 text-text-secondary shadow-xs">
        <Spinner /> Cargando…
      </div>
    );
  if (isError)
    return (
      <p className="rounded-lg border border-red-100 bg-red-50 p-5 text-red-600">
        No se pudieron cargar tus materias.
      </p>
    );

  const materias = data?.materias_que_dicto ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Mi espacio"
        title="Mis materias"
        actions={
          <Button onClick={() => setModalAbierto(true)}>
            <Plus size={16} /> Nueva materia
          </Button>
        }
      />

      {materias.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={<GraduationCap size={32} />}
            title="Aún no tienes materias"
            description='Crea la primera con el botón "Nueva materia".'
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materias.map((m) => (
            <Link
              key={m.id}
              to={`/materias/${m.id}`}
              className="block rounded-2xl border border-border bg-surface p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-50/60 hover:shadow-md"
            >
              <h2 className="font-bold text-text">{m.nombre_materia}</h2>
              <p className="text-sm text-text-secondary mt-1">
                {m.sigla ? `${m.sigla} · ` : ''}
                {m.carrera} · {m.semestre}
              </p>
              <p className="text-sm text-text-secondary">{m.universidad}</p>
              <p className="mt-3 text-sm">
                Código de inscripción:{' '}
                <span
                  className={`font-mono font-bold ${
                    m.codigo_activo ? 'text-primary-700' : 'text-text-disabled line-through'
                  }`}
                >
                  {m.codigo}
                </span>
              </p>
            </Link>
          ))}
        </div>
      )}

      {modalAbierto && <ModalNuevaMateria onCerrar={() => setModalAbierto(false)} />}
    </div>
  );
}
