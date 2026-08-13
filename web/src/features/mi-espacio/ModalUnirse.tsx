// Modal "Unirme con un código" — extraído de MateriasInscritasPage para que
// también lo pueda abrir el menú "+" del topbar (icono de perfil al lado,
// 08/08).

import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, mensajeDeError } from '../../core/api/cliente';
import { Button, Campo, Input, Modal } from '../../core/ui/ui';

export function ModalUnirse({ onCerrar }: { onCerrar: () => void }) {
  const queryClient = useQueryClient();
  const [codigoMateria, setCodigoMateria] = useState('');
  const [codigoEstudiante, setCodigoEstudiante] = useState('');
  const [error, setError] = useState('');

  const unirse = useMutation({
    mutationFn: () =>
      api.post('/api/inscripciones', {
        codigo_materia: codigoMateria.trim().toUpperCase(),
        codigo_estudiante: codigoEstudiante.trim(),
      }),
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['mi-espacio'] });
      onCerrar();
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    unirse.mutate();
  }

  return (
    <Modal onCerrar={onCerrar} eyebrow="Materias inscritas" titulo="Unirme con un código">
      <form onSubmit={manejarEnvio} className="space-y-4">
        <Campo etiqueta="Código de la materia" ayuda="Te lo comparte tu docente.">
          <Input
            required
            autoFocus
            value={codigoMateria}
            onChange={(e) => setCodigoMateria(e.target.value)}
            className="font-mono uppercase"
            placeholder="p. ej. AB12CD"
          />
        </Campo>
        <Campo etiqueta="Tu código de estudiante">
          <Input
            required
            value={codigoEstudiante}
            onChange={(e) => setCodigoEstudiante(e.target.value)}
          />
        </Campo>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <Button type="button" variante="secondary" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={unirse.isPending}>
            {unirse.isPending ? 'Uniéndome…' : 'Unirme'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
