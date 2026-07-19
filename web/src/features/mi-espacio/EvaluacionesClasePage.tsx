// E6 · HU-17: evaluaciones de una clase — crear (en modal) y abrir el editor

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ListChecks, Plus } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { Evaluacion, EstadoEvaluacion, Materia } from '../../core/tipos';
import {
  Badge,
  Button,
  Campo,
  Card,
  EmptyState,
  Input,
  Modal,
  PageBreadcrumb,
  PageHeader,
  Spinner,
} from '../../core/ui/ui';

const ESTADO_TONO: Record<EstadoEvaluacion, { texto: string; tono: 'neutral' | 'success' | 'info' | 'dark' }> = {
  borrador: { texto: 'Borrador', tono: 'neutral' },
  lista: { texto: 'Lista', tono: 'success' },
  lanzada: { texto: 'Lanzada', tono: 'info' },
  finalizada: { texto: 'Finalizada', tono: 'dark' },
};

// ── Modal "+ Nueva evaluación" ────────────────────────────────────

function ModalNuevaEvaluacion({
  materiaId,
  claseId,
  onCerrar,
}: {
  materiaId: number;
  claseId: number;
  onCerrar: () => void;
}) {
  const queryClient = useQueryClient();
  const [tema, setTema] = useState('');
  const [nota, setNota] = useState('100');
  const [error, setError] = useState('');

  const crear = useMutation({
    mutationFn: () =>
      api.post(`/api/materias/${materiaId}/clases/${claseId}/evaluaciones`, {
        tema,
        nota: Number(nota),
      }),
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['evaluaciones', String(claseId)] });
      onCerrar();
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <Modal onCerrar={onCerrar} eyebrow="Nueva evaluación" titulo="Datos generales">
      <p className="mb-4 text-sm text-text-secondary">
        Queda en <span className="font-medium text-text">Borrador</span>, invisible para los
        estudiantes, hasta que la guardes.
      </p>
      <form onSubmit={manejarEnvio} className="space-y-4">
        <Campo etiqueta="Título / tema">
          <Input
            required
            autoFocus
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="p. ej. Examen parcial 1"
          />
        </Campo>
        <Campo etiqueta="Nota total" ayuda="Cada pregunta valdrá nota total ÷ n° de preguntas.">
          <Input
            type="number"
            min={1}
            required
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className="w-32"
          />
        </Campo>
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Creando…' : 'Crear evaluación'}
          </Button>
          <Button type="button" variante="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}

export function EvaluacionesClasePage() {
  const { id, claseId } = useParams();
  const materiaId = Number(id);
  const [modalAbierto, setModalAbierto] = useState(false);

  const { data: materia } = useQuery({
    queryKey: ['materia', id],
    queryFn: async () => {
      const { data } = await api.get<{ materia: Materia }>(`/api/materias/${id}`);
      return data.materia;
    },
  });

  const { data: evaluaciones, isLoading, isError } = useQuery({
    queryKey: ['evaluaciones', claseId],
    queryFn: async () => {
      const { data } = await api.get<{ evaluaciones: Evaluacion[] }>(
        `/api/materias/${id}/clases/${claseId}/evaluaciones`,
      );
      return data.evaluaciones;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <PageBreadcrumb>
          <Link to={`/materias/${id}`}>‹ {materia ? materia.nombre_materia : 'Materia'}</Link>
        </PageBreadcrumb>
        <PageHeader
          eyebrow="Evaluaciones"
          title="Evaluaciones de la clase"
          description="Crea exámenes de selección múltiple y prepáralos antes de lanzarlos."
          actions={
            <Button onClick={() => setModalAbierto(true)}>
              <Plus size={16} /> Nueva evaluación
            </Button>
          }
        />
      </div>

      <Card>
        {isLoading && (
          <div className="flex items-center gap-2 p-5 text-sm text-text-secondary">
            <Spinner /> Cargando…
          </div>
        )}
        {isError && (
          <p className="p-5 text-sm text-red-600">No se pudieron cargar las evaluaciones.</p>
        )}

        {evaluaciones && evaluaciones.length === 0 && (
          <div className="p-5">
            <EmptyState
              icon={<ListChecks size={32} />}
              title="Aún no hay evaluaciones para esta clase"
              description='Crea la primera con el botón "Nueva evaluación".'
              action={
                <Button onClick={() => setModalAbierto(true)}>
                  <Plus size={16} /> Nueva evaluación
                </Button>
              }
            />
          </div>
        )}

        {evaluaciones && evaluaciones.length > 0 && (
          <div className="divide-y divide-border">
            {evaluaciones.map((ev) => (
              <Link
                key={ev.id}
                to={`/materias/${id}/evaluaciones/${ev.id}`}
                className="group flex items-center gap-4 px-5 py-4 transition hover:bg-surface-hover"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <ListChecks size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text">{ev.tema}</p>
                  <p className="text-sm text-text-secondary">Nota total: {ev.nota}</p>
                </div>
                <Badge tone={ESTADO_TONO[ev.estado].tono}>{ESTADO_TONO[ev.estado].texto}</Badge>
                <span className="text-text-disabled transition group-hover:translate-x-0.5 group-hover:text-text-muted">
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {modalAbierto && (
        <ModalNuevaEvaluacion
          materiaId={materiaId}
          claseId={Number(claseId)}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
    </div>
  );
}
