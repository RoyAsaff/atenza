// Guías de pre-clase (fusión con PaginaGuias, 05/08) — el docente sigue
// generando la guía como siempre en PaginaGuias; acá solo pega el link
// para vincularla a esta clase. Sin ciclo borrador/lanzada como
// Evaluación: la guía es visible para inscritos apenas se crea.

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, Plus } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { GuiaDocente, Materia } from '../../core/tipos';
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

// ── Modal "+ Nueva guía" / editar ─────────────────────────────────

function ModalGuia({
  materiaId,
  claseId,
  guia,
  orden,
  onCerrar,
}: {
  materiaId: number;
  claseId: number;
  guia?: GuiaDocente;
  orden: number;
  onCerrar: () => void;
}) {
  const queryClient = useQueryClient();
  const [tema, setTema] = useState(guia?.tema ?? '');
  const [url, setUrl] = useState(guia?.url ?? '');
  const [error, setError] = useState('');

  const alTerminar = {
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['guias', String(claseId)] });
      onCerrar();
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  };

  const crear = useMutation({
    mutationFn: () =>
      api.post(`/api/materias/${materiaId}/clases/${claseId}/guias`, { tema, url, orden }),
    ...alTerminar,
  });

  const editar = useMutation({
    mutationFn: () => api.patch(`/api/materias/${materiaId}/guias/${guia!.id}`, { tema, url }),
    ...alTerminar,
  });

  function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    if (guia) editar.mutate();
    else crear.mutate();
  }

  const enviando = crear.isPending || editar.isPending;

  return (
    <Modal
      onCerrar={onCerrar}
      eyebrow={guia ? 'Editar guía' : 'Nueva guía'}
      titulo={guia ? guia.tema : 'Vincular una guía de PaginaGuias'}
    >
      <form onSubmit={manejarEnvio} className="space-y-4">
        <Campo etiqueta="Título / tema">
          <Input
            required
            autoFocus
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="p. ej. DML: INSERT, UPDATE, DELETE"
          />
        </Campo>
        <Campo
          etiqueta="URL de la guía"
          ayuda="El link público de la guía en PaginaGuias (p. ej. https://croysito.github.io/guias_bd/dml.html)."
        >
          <Input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </Campo>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : guia ? 'Guardar cambios' : 'Vincular guía'}
          </Button>
          <Button type="button" variante="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Tarjeta de una guía + quiénes la completaron ──────────────────

function TarjetaGuia({
  guia,
  materiaId,
  claseId,
  onEditar,
}: {
  guia: GuiaDocente;
  materiaId: number;
  claseId: number;
  onEditar: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/api/materias/${materiaId}/guias/${guia.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['guias', String(claseId)] }),
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  function manejarEliminar() {
    if (window.confirm(`Se desvinculará "${guia.tema}" de esta clase. ¿Continuar?`)) {
      eliminar.mutate();
    }
  }

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
              <BookOpen size={16} />
            </span>
            <p className="truncate font-medium text-text">{guia.tema}</p>
          </div>
          <a
            href={guia.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block truncate text-sm text-primary-700 hover:underline"
          >
            {guia.url}
          </a>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variante="secondary" tamano="sm" onClick={onEditar}>
            Editar
          </Button>
          <Button
            variante="danger"
            tamano="sm"
            onClick={manejarEliminar}
            disabled={eliminar.isPending}
          >
            Desvincular
          </Button>
        </div>
      </div>

      {/* Dato nuevo pedido por Roy: quién de la nómina ya hizo la pre-clase */}
      <div className="mt-3 flex items-center gap-2">
        <Badge tone={guia.completados.length > 0 ? 'success' : 'neutral'}>
          <CheckCircle2 size={14} /> {guia.completados.length} completaron
        </Badge>
      </div>
      {guia.completados.length > 0 && (
        <p className="mt-1 text-xs text-text-secondary">
          {guia.completados.map((c) => `${c.nombres} ${c.apellidos}`).join(', ')}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function GuiasClasePage() {
  const { id, claseId } = useParams();
  const materiaId = Number(id);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guiaEditando, setGuiaEditando] = useState<GuiaDocente | null>(null);

  const { data: materia } = useQuery({
    queryKey: ['materia', id],
    queryFn: async () => {
      const { data } = await api.get<{ materia: Materia }>(`/api/materias/${id}`);
      return data.materia;
    },
  });

  const { data: guias, isLoading, isError } = useQuery({
    queryKey: ['guias', claseId],
    queryFn: async () => {
      const { data } = await api.get<{ guias: GuiaDocente[] }>(
        `/api/materias/${id}/clases/${claseId}/guias`,
      );
      return data.guias;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <PageBreadcrumb>
          <Link to={`/materias/${id}`}>‹ {materia ? materia.nombre_materia : 'Materia'}</Link>
        </PageBreadcrumb>
        <PageHeader
          eyebrow="Guías"
          title="Guías de pre-clase"
          description="Vincula las guías de PaginaGuias que los estudiantes deben repasar antes de esta clase."
          actions={
            <Button onClick={() => setModalAbierto(true)}>
              <Plus size={16} /> Nueva guía
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
        {isError && <p className="p-5 text-sm text-red-600">No se pudieron cargar las guías.</p>}

        {guias && guias.length === 0 && (
          <div className="p-5">
            <EmptyState
              icon={<BookOpen size={32} />}
              title="Aún no hay guías vinculadas a esta clase"
              description='Vincula la primera con el botón "Nueva guía".'
              action={
                <Button onClick={() => setModalAbierto(true)}>
                  <Plus size={16} /> Nueva guía
                </Button>
              }
            />
          </div>
        )}

        {guias && guias.length > 0 && (
          <div className="divide-y divide-border">
            {guias.map((g) => (
              <TarjetaGuia
                key={g.id}
                guia={g}
                materiaId={materiaId}
                claseId={Number(claseId)}
                onEditar={() => setGuiaEditando(g)}
              />
            ))}
          </div>
        )}
      </Card>

      {modalAbierto && (
        <ModalGuia
          materiaId={materiaId}
          claseId={Number(claseId)}
          orden={guias?.length ?? 0}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
      {guiaEditando && (
        <ModalGuia
          materiaId={materiaId}
          claseId={Number(claseId)}
          guia={guiaEditando}
          orden={guiaEditando.orden}
          onCerrar={() => setGuiaEditando(null)}
        />
      )}
    </div>
  );
}
