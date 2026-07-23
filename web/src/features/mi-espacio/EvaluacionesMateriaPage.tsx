// Vista "Evaluaciones" a nivel materia (junto a "Código y nómina"): todas
// las evaluaciones de todas las clases en un solo lugar, sin tener que
// entrar clase por clase — y crear una nueva eligiendo a qué clase pertenece.

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ListChecks, Plus, Search } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { Clase, EstadoEvaluacion, EvaluacionConClase, EvaluacionConMateria, Materia } from '../../core/tipos';
import {
  Badge,
  Button,
  Campo,
  Card,
  cn,
  EmptyState,
  Input,
  Modal,
  PageBreadcrumb,
  PageHeader,
  Select,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modo, setModo] = useState<'nueva' | 'reutilizar'>('nueva');
  const [claseId, setClaseId] = useState('');
  const [tema, setTema] = useState('');
  const [nota, setNota] = useState('100');
  const [busqueda, setBusqueda] = useState('');
  const [origenId, setOrigenId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const invalidarYCerrar = (nuevaEvaluacionId: number) => {
    setError('');
    queryClient.invalidateQueries({ queryKey: ['evaluaciones-materia', String(materiaId)] });
    onCerrar();
    navigate(`/materias/${materiaId}/evaluaciones/${nuevaEvaluacionId}`);
  };

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

  const { data: misEvaluaciones, isLoading: cargandoMisEvaluaciones } = useQuery({
    queryKey: ['mis-evaluaciones'],
    queryFn: async () => {
      const { data } = await api.get<{ evaluaciones: EvaluacionConMateria[] }>(
        '/api/mi-espacio/evaluaciones',
      );
      return data.evaluaciones;
    },
    enabled: modo === 'reutilizar',
  });

  const duplicar = useMutation({
    mutationFn: () =>
      api.post<{ evaluacion: { id: number } }>(
        `/api/materias/${materiaId}/clases/${claseId}/evaluaciones/duplicar`,
        { evaluacion_origen_id: origenId },
      ),
    onSuccess: ({ data }) => invalidarYCerrar(data.evaluacion.id),
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  function manejarEnvioNueva(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  function manejarEnvioDuplicar(e: FormEvent) {
    e.preventDefault();
    duplicar.mutate();
  }

  const evaluacionesFiltradas = (misEvaluaciones ?? []).filter((ev) => {
    const texto = `${ev.materia.nombre_materia} ${ev.tema}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  return (
    <Modal
      onCerrar={onCerrar}
      eyebrow="Nueva evaluación"
      titulo="Datos generales"
      maxWidth={modo === 'reutilizar' ? 'max-w-2xl' : 'max-w-lg'}
    >
      <Tabs
        value={modo}
        onValueChange={(v) => {
          setModo(v as 'nueva' | 'reutilizar');
          setError('');
        }}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="nueva">Desde cero</TabsTrigger>
          <TabsTrigger value="reutilizar">Reutilizar existente</TabsTrigger>
        </TabsList>

        <TabsContent value="nueva">
          <p className="mb-4 text-sm text-text-secondary">
            Queda en <span className="font-medium text-text">Borrador</span>, invisible para los
            estudiantes, hasta que la guardes.
          </p>
          <form onSubmit={manejarEnvioNueva} className="space-y-4">
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
            {error && modo === 'nueva' && <p className="text-sm text-red-600">{error}</p>}
          </form>
        </TabsContent>

        <TabsContent value="reutilizar">
          <p className="mb-4 text-sm text-text-secondary">
            Se copian el tema, la nota y todas las preguntas de la evaluación elegida; la copia
            queda en <span className="font-medium text-text">Borrador</span> para que la revises
            antes de lanzarla.
          </p>
          <form onSubmit={manejarEnvioDuplicar} className="space-y-4">
            <Campo etiqueta="Buscar evaluación">
              <Input
                iconoIzq={<Search size={16} />}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Por materia o tema…"
              />
            </Campo>

            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-1">
              {cargandoMisEvaluaciones && (
                <div className="flex items-center gap-2 p-3 text-sm text-text-secondary">
                  <Spinner /> Cargando…
                </div>
              )}
              {!cargandoMisEvaluaciones && evaluacionesFiltradas.length === 0 && (
                <p className="p-3 text-sm text-text-secondary">
                  No se encontraron evaluaciones para reutilizar.
                </p>
              )}
              {evaluacionesFiltradas.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setOrigenId(ev.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition',
                    origenId === ev.id
                      ? 'bg-primary-50 ring-1 ring-primary-200'
                      : 'hover:bg-surface-hover',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{ev.tema}</p>
                    <p className="truncate text-xs text-text-secondary">
                      {ev.materia.nombre_materia} · {fechaClaseCorta(ev.clase.fecha)}
                    </p>
                  </div>
                  <Badge tone={ESTADO_TONO[ev.estado].tono}>{ESTADO_TONO[ev.estado].texto}</Badge>
                </button>
              ))}
            </div>

            <Campo etiqueta="Clase destino">
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

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" disabled={duplicar.isPending || !claseId || !origenId}>
                {duplicar.isPending ? 'Duplicando…' : 'Duplicar evaluación'}
              </Button>
              <Button type="button" variante="ghost" onClick={onCerrar}>
                Cancelar
              </Button>
            </div>
            {error && modo === 'reutilizar' && <p className="text-sm text-red-600">{error}</p>}
          </form>
        </TabsContent>
      </Tabs>
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
