// E9 · Exámenes de código Python de una clase — calcado de
// EvaluacionesClasePage.tsx (E6), con pestaña "Reutilizar existente" (10/09).

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Code2, Plus, Search } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { EstadoEvaluacion, ExamenCodigo, ExamenCodigoConMateria, Materia } from '../../core/tipos';
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
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../core/ui/ui';

const ESTADO_TONO: Record<EstadoEvaluacion, { texto: string; tono: 'neutral' | 'success' | 'info' | 'dark' }> = {
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

// ── Modal "+ Nuevo examen de código" ──────────────────────────────

function ModalNuevoExamenCodigo({
  materiaId,
  claseId,
  onCerrar,
}: {
  materiaId: number;
  claseId: number;
  onCerrar: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modo, setModo] = useState<'nuevo' | 'reutilizar'>('nuevo');
  const [tema, setTema] = useState('');
  const [nota, setNota] = useState('100');
  const [busqueda, setBusqueda] = useState('');
  const [origenId, setOrigenId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const invalidarYCerrar = (nuevoExamenId: number) => {
    setError('');
    queryClient.invalidateQueries({ queryKey: ['examenes-codigo', String(claseId)] });
    onCerrar();
    navigate(`/materias/${materiaId}/examenes-codigo/${nuevoExamenId}`);
  };

  const crear = useMutation({
    mutationFn: () =>
      api.post<{ examen: ExamenCodigo }>(
        `/api/materias/${materiaId}/clases/${claseId}/examenes-codigo`,
        { tema, nota: Number(nota) },
      ),
    onSuccess: ({ data }) => invalidarYCerrar(data.examen.id),
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  const { data: misExamenes, isLoading: cargandoMisExamenes } = useQuery({
    queryKey: ['mis-examenes-codigo'],
    queryFn: async () => {
      const { data } = await api.get<{ examenes: ExamenCodigoConMateria[] }>(
        '/api/mi-espacio/examenes-codigo',
      );
      return data.examenes;
    },
    enabled: modo === 'reutilizar',
  });

  const duplicar = useMutation({
    mutationFn: () =>
      api.post<{ examen: { id: number } }>(
        `/api/materias/${materiaId}/clases/${claseId}/examenes-codigo/duplicar`,
        { examen_origen_id: origenId },
      ),
    onSuccess: ({ data }) => invalidarYCerrar(data.examen.id),
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  function manejarEnvioNuevo(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  function manejarEnvioDuplicar(e: FormEvent) {
    e.preventDefault();
    duplicar.mutate();
  }

  const examenesFiltrados = (misExamenes ?? []).filter((ex) => {
    const texto = `${ex.materia.nombre_materia} ${ex.tema}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  return (
    <Modal
      onCerrar={onCerrar}
      eyebrow="Nuevo examen de código"
      titulo="Datos generales"
      maxWidth={modo === 'reutilizar' ? 'max-w-2xl' : 'max-w-lg'}
    >
      <Tabs
        value={modo}
        onValueChange={(v) => {
          setModo(v as 'nuevo' | 'reutilizar');
          setError('');
        }}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="nuevo">Desde cero</TabsTrigger>
          <TabsTrigger value="reutilizar">Reutilizar existente</TabsTrigger>
        </TabsList>

        <TabsContent value="nuevo">
          <p className="mb-4 text-sm text-text-secondary">
            Queda en <span className="font-medium text-text">Borrador</span>, invisible para los
            estudiantes, hasta que lo guardes.
          </p>
          <form onSubmit={manejarEnvioNuevo} className="space-y-4">
            <Campo etiqueta="Título / tema">
              <Input
                required
                autoFocus
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="p. ej. Práctica de bucles y funciones"
              />
            </Campo>
            <Campo etiqueta="Nota total" ayuda="Cada ejercicio valdrá su propia nota, hasta sumar esta.">
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
                {crear.isPending ? 'Creando…' : 'Crear examen'}
              </Button>
              <Button type="button" variante="ghost" onClick={onCerrar}>
                Cancelar
              </Button>
            </div>
            {error && modo === 'nuevo' && <p className="text-sm text-red-600">{error}</p>}
          </form>
        </TabsContent>

        <TabsContent value="reutilizar">
          <p className="mb-4 text-sm text-text-secondary">
            Se copian el tema, la nota y todos los ejercicios (con sus casos de prueba) del examen
            elegido en esta clase; la copia queda en{' '}
            <span className="font-medium text-text">Borrador</span> para que la revises antes de
            lanzarla.
          </p>
          <form onSubmit={manejarEnvioDuplicar} className="space-y-4">
            <Campo etiqueta="Buscar examen de código">
              <Input
                iconoIzq={<Search size={16} />}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Por materia o tema…"
              />
            </Campo>

            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-1">
              {cargandoMisExamenes && (
                <div className="flex items-center gap-2 p-3 text-sm text-text-secondary">
                  <Spinner /> Cargando…
                </div>
              )}
              {!cargandoMisExamenes && examenesFiltrados.length === 0 && (
                <p className="p-3 text-sm text-text-secondary">
                  No se encontraron exámenes de código para reutilizar.
                </p>
              )}
              {examenesFiltrados.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setOrigenId(ex.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition',
                    origenId === ex.id
                      ? 'bg-primary-50 ring-1 ring-primary-200'
                      : 'hover:bg-surface-hover',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{ex.tema}</p>
                    <p className="truncate text-xs text-text-secondary">
                      {ex.materia.nombre_materia} · {fechaClaseCorta(ex.clase.fecha)}
                    </p>
                  </div>
                  <Badge tone={ESTADO_TONO[ex.estado].tono}>{ESTADO_TONO[ex.estado].texto}</Badge>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" disabled={duplicar.isPending || !origenId}>
                {duplicar.isPending ? 'Duplicando…' : 'Duplicar examen'}
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

export function ExamenesCodigoClasePage() {
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

  const { data: examenes, isLoading, isError } = useQuery({
    queryKey: ['examenes-codigo', claseId],
    queryFn: async () => {
      const { data } = await api.get<{ examenes: ExamenCodigo[] }>(
        `/api/materias/${id}/clases/${claseId}/examenes-codigo`,
      );
      return data.examenes;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <PageBreadcrumb>
          <Link to={`/materias/${id}`}>‹ {materia ? materia.nombre_materia : 'Materia'}</Link>
        </PageBreadcrumb>
        <PageHeader
          eyebrow="Exámenes de código"
          title="Exámenes de código de la clase"
          description="Ejercicios de Python calificados por casos de prueba, en la app de escritorio segura."
          actions={
            <Button onClick={() => setModalAbierto(true)}>
              <Plus size={16} /> Nuevo examen
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
          <p className="p-5 text-sm text-red-600">No se pudieron cargar los exámenes de código.</p>
        )}

        {examenes && examenes.length === 0 && (
          <div className="p-5">
            <EmptyState
              icon={<Code2 size={32} />}
              title="Aún no hay exámenes de código para esta clase"
              description='Crea el primero con el botón "Nuevo examen".'
              action={
                <Button onClick={() => setModalAbierto(true)}>
                  <Plus size={16} /> Nuevo examen
                </Button>
              }
            />
          </div>
        )}

        {examenes && examenes.length > 0 && (
          <div className="divide-y divide-border">
            {examenes.map((ex) => (
              <Link
                key={ex.id}
                to={`/materias/${id}/examenes-codigo/${ex.id}`}
                className="group flex items-center gap-4 px-5 py-4 transition hover:bg-surface-hover"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <Code2 size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text">{ex.tema}</p>
                  <p className="text-sm text-text-secondary">Nota total: {ex.nota}</p>
                </div>
                <Badge tone={ESTADO_TONO[ex.estado].tono}>{ESTADO_TONO[ex.estado].texto}</Badge>
                <span className="text-text-disabled transition group-hover:translate-x-0.5 group-hover:text-text-muted">
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {modalAbierto && (
        <ModalNuevoExamenCodigo
          materiaId={materiaId}
          claseId={Number(claseId)}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
    </div>
  );
}
