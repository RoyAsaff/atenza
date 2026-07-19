// Vista "Evaluaciones" a nivel materia (junto a "Código y nómina"): todas
// las evaluaciones de todas las clases en un solo lugar, sin tener que
// entrar clase por clase — y crear una nueva eligiendo a qué clase pertenece.

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ListChecks, Plus } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { Clase, EstadoEvaluacion, EvaluacionConClase, Materia } from '../../core/tipos';
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
  Select,
  Spinner,
} from '../../core/ui/ui';

const ESTADO_TONO: Record<
  EstadoEvaluacion,
  { texto: string; tono: 'neutral' | 'success' | 'info' | 'dark' }
> = {
  borrador: { texto: 'Borrador', tono: 'neutral' },
  lista: { texto: 'Lista', tono: 'success' },
  lanzada: { texto: 'Lanzada', tono: 'info' },
  finalizada: { texto: 'Finalizada', tono: 'dark' },
};

function fechaClaseCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC', // la fecha viaja como medianoche UTC
  });
}

// ── Modal "+ Nueva evaluación": ahora elige a qué clase pertenece ────

function ModalNuevaEvaluacion({
  materiaId,
  clases,
  onCerrar,
}: {
  materiaId: number;
  clases: Clase[];
  onCerrar: () => void;
}) {
  const queryClient = useQueryClient();
  const [claseId, setClaseId] = useState('');
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
      queryClient.invalidateQueries({ queryKey: ['evaluaciones-materia', String(materiaId)] });
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
        <Campo etiqueta="Clase">
          <Select required value={claseId} onChange={(e) => setClaseId(e.target.value)}>
            <option value="" disabled>
              Elige la clase…
            </option>
            {clases.map((c) => (
              <option key={c.id} value={c.id}>
                {fechaClaseCorta(c.fecha)} · {c.hora} · {c.tema}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo etiqueta="Título / tema">
          <Input
            required
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
          <Button type="submit" disabled={crear.isPending || !claseId}>
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

export function EvaluacionesMateriaPage() {
  const { id } = useParams();
  const materiaId = Number(id);
  const [modalAbierto, setModalAbierto] = useState(false);

  const { data: materia } = useQuery({
    queryKey: ['materia', id],
    queryFn: async () => {
      const { data } = await api.get<{ materia: Materia }>(`/api/materias/${id}`);
      return data.materia;
    },
  });

  const { data: clases } = useQuery({
    queryKey: ['clases', id],
    queryFn: async () => {
      const { data } = await api.get<{ clases: Clase[] }>(`/api/materias/${id}/clases`);
      return data.clases;
    },
  });

  const { data: evaluaciones, isLoading, isError } = useQuery({
    queryKey: ['evaluaciones-materia', id],
    queryFn: async () => {
      const { data } = await api.get<{ evaluaciones: EvaluacionConClase[] }>(
        `/api/materias/${id}/evaluaciones`,
      );
      return data.evaluaciones;
    },
  });

  const hayClases = (clases?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <PageBreadcrumb>
          <Link to={`/materias/${id}`}>‹ {materia ? materia.nombre_materia : 'Materia'}</Link>
        </PageBreadcrumb>
        <PageHeader
          eyebrow="Evaluaciones"
          title="Evaluaciones de la materia"
          description="Todas las evaluaciones, de todas las clases, en un solo lugar."
          actions={
            hayClases && (
              <Button onClick={() => setModalAbierto(true)}>
                <Plus size={16} /> Nueva evaluación
              </Button>
            )
          }
        />
        {!hayClases && clases && (
          <p className="mt-2 text-sm text-text-secondary">
            Todavía no tienes clases creadas; crea al menos una desde el calendario de la
            materia para poder agregar una evaluación.
          </p>
        )}
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
              title="Aún no hay evaluaciones"
              description={
                hayClases
                  ? 'Crea la primera con el botón "Nueva evaluación".'
                  : 'Primero crea una clase; cada evaluación pertenece a una.'
              }
              action={
                hayClases ? (
                  <Button onClick={() => setModalAbierto(true)}>
                    <Plus size={16} /> Nueva evaluación
                  </Button>
                ) : undefined
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
                  <p className="text-sm text-text-secondary">
                    {fechaClaseCorta(ev.clase.fecha)} · {ev.clase.tema} · Nota total: {ev.nota}
                  </p>
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

      {modalAbierto && clases && (
        <ModalNuevaEvaluacion
          materiaId={materiaId}
          clases={clases}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
    </div>
  );
}
