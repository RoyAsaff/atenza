// Guías de pre-clase (fusión con PaginaGuias, 05/08; guías nativas 16/08).
// El docente sigue armando el contenido (teoría + cuestionario) en su
// propia página externa — acá pega el link y, desde el 16/08, además
// carga la nota y el manifest de preguntas (una fila por data-quiz-id de
// su HTML) para que la guía se pueda lanzar como un examen. Las guías
// creadas antes de este cambio ("externa_legacy") siguen con el formulario
// simple de siempre — tema + link, sin nota ni preguntas.

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, Plus, Rocket, Trash2, Wand2, X } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { obtenerSocket } from '../../core/realtime/socket';
import {
  FilaCompletadoGuia,
  GuiaDocente,
  GuiaPregunta,
  Materia,
  TipoGuiaPregunta,
} from '../../core/tipos';
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
  Textarea,
} from '../../core/ui/ui';

const ESTADO_GUIA_TONO = {
  publicada: { texto: 'Publicada', tono: 'neutral' as const },
  lanzada: { texto: 'Lanzada', tono: 'info' as const },
  cerrada: { texto: 'Cerrada', tono: 'dark' as const },
  externa_legacy: { texto: 'Externa', tono: 'neutral' as const },
};

interface PreguntaForm {
  referencia: string;
  tipo: TipoGuiaPregunta;
  respuesta_modelo: string;
}

function preguntaVacia(): PreguntaForm {
  return { referencia: '', tipo: 'automatica', respuesta_modelo: '' };
}

// ── Editor del manifest de preguntas (guías nativas) ──────────────

function EditorPreguntas({
  preguntas,
  onCambiar,
}: {
  preguntas: PreguntaForm[];
  onCambiar: (preguntas: PreguntaForm[]) => void;
}) {
  function actualizar(indice: number, cambios: Partial<PreguntaForm>) {
    onCambiar(preguntas.map((p, i) => (i === indice ? { ...p, ...cambios } : p)));
  }
  function quitar(indice: number) {
    onCambiar(preguntas.filter((_, i) => i !== indice));
  }

  return (
    <div className="space-y-3">
      {preguntas.map((pregunta, indice) => (
        <div key={indice} className="rounded-md border border-border p-3">
          <div className="flex items-start gap-2">
            <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                required
                value={pregunta.referencia}
                onChange={(e) => actualizar(indice, { referencia: e.target.value })}
                placeholder="referencia (el data-quiz-id de tu HTML, ej. origen-mc)"
              />
              <Select
                value={pregunta.tipo}
                onChange={(e) => actualizar(indice, { tipo: e.target.value as TipoGuiaPregunta })}
              >
                <option value="automatica">Automática (opción múltiple, etc.)</option>
                <option value="abierta">Abierta (código / análisis)</option>
              </Select>
            </div>
            <button
              type="button"
              onClick={() => quitar(indice)}
              className="mt-2 shrink-0 rounded-md p-1.5 text-text-disabled transition hover:bg-red-50 hover:text-red-600"
              aria-label="Quitar pregunta"
            >
              <X size={16} />
            </button>
          </div>
          {pregunta.tipo === 'abierta' && (
            <div className="mt-2">
              <Textarea
                required
                filas={2}
                value={pregunta.respuesta_modelo}
                onChange={(e) => actualizar(indice, { respuesta_modelo: e.target.value })}
                placeholder="Respuesta modelo — se muestra al revisar, al lado de lo que escriba el estudiante"
              />
            </div>
          )}
        </div>
      ))}
      <Button
        type="button"
        variante="secondary"
        tamano="sm"
        onClick={() => onCambiar([...preguntas, preguntaVacia()])}
      >
        <Plus size={14} /> Agregar pregunta
      </Button>
    </div>
  );
}

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
  const esLegacy = guia?.estado === 'externa_legacy';
  const [tema, setTema] = useState(guia?.tema ?? '');
  const [url, setUrl] = useState(guia?.url ?? '');
  const [nota, setNota] = useState(guia?.nota != null ? String(guia.nota) : '20');
  const [tiempoLimite, setTiempoLimite] = useState(
    guia?.tiempo_limite_minutos != null ? String(guia.tiempo_limite_minutos) : '',
  );
  const [preguntas, setPreguntas] = useState<PreguntaForm[]>(
    guia?.preguntas.length
      ? guia.preguntas.map((p) => ({
          referencia: p.referencia,
          tipo: p.tipo,
          respuesta_modelo: p.respuesta_modelo ?? '',
        }))
      : [preguntaVacia()],
  );
  const [error, setError] = useState('');
  const [errorAnalisis, setErrorAnalisis] = useState('');

  const analizar = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ preguntas: GuiaPregunta[] }>(
        `/api/materias/${materiaId}/guias/analizar`,
        { url },
      );
      return data.preguntas;
    },
    onSuccess: (detectadas) => {
      setErrorAnalisis('');
      const hayCargadas = preguntas.some((p) => p.referencia.trim());
      if (
        hayCargadas &&
        !window.confirm(
          `Se detectaron ${detectadas.length} preguntas — esto reemplaza las que ya cargaste. ¿Continuar?`,
        )
      ) {
        return;
      }
      setPreguntas(
        detectadas.map((p) => ({
          referencia: p.referencia,
          tipo: p.tipo,
          respuesta_modelo: p.respuesta_modelo ?? '',
        })),
      );
    },
    onError: (err: unknown) => setErrorAnalisis(mensajeDeError(err)),
  });

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
      api.post(`/api/materias/${materiaId}/clases/${claseId}/guias`, {
        tema,
        url,
        orden,
        nota: Number(nota),
        tiempo_limite_minutos: tiempoLimite ? Number(tiempoLimite) : undefined,
        preguntas: preguntas.map((p, i) => ({ ...p, orden: i })),
      }),
    ...alTerminar,
  });

  const editarLegacy = useMutation({
    mutationFn: () => api.patch(`/api/materias/${materiaId}/guias/${guia!.id}`, { tema, url }),
    ...alTerminar,
  });

  const editarNativa = useMutation({
    mutationFn: () =>
      api.patch(`/api/materias/${materiaId}/guias/${guia!.id}`, {
        tema,
        url,
        nota: Number(nota),
        tiempo_limite_minutos: tiempoLimite ? Number(tiempoLimite) : undefined,
        preguntas: preguntas.map((p, i) => ({ ...p, orden: i })),
      }),
    ...alTerminar,
  });

  function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    if (guia && esLegacy) editarLegacy.mutate();
    else if (guia) editarNativa.mutate();
    else crear.mutate();
  }

  const enviando = crear.isPending || editarLegacy.isPending || editarNativa.isPending;

  return (
    <Modal
      onCerrar={onCerrar}
      eyebrow={guia ? 'Editar guía' : 'Nueva guía'}
      titulo={guia ? guia.tema : 'Vincular una guía'}
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
          ayuda="El link público de tu guía (la teoría y el cuestionario siguen viviendo ahí, tal cual)."
        >
          <Input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </Campo>

        {!esLegacy && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nota máxima">
                <Input
                  type="number"
                  min={1}
                  step="0.5"
                  required
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                />
              </Campo>
              <Campo etiqueta="Tiempo límite (min)" ayuda="Opcional — vacío = sin límite">
                <Input
                  type="number"
                  min={1}
                  value={tiempoLimite}
                  onChange={(e) => setTiempoLimite(e.target.value)}
                  placeholder="Sin límite"
                />
              </Campo>
            </div>

            <Campo
              etiqueta="Preguntas"
              ayuda='Una fila por cada data-quiz-id de tu página. "Automática" se autocorrige sola (opción múltiple, emparejar, clasificar); "Abierta" la revisás vos con la respuesta modelo.'
            >
              <div className="mb-2 flex items-center gap-3">
                <Button
                  type="button"
                  variante="secondary"
                  tamano="sm"
                  onClick={() => analizar.mutate()}
                  disabled={!url.trim() || analizar.isPending}
                >
                  <Wand2 size={14} />
                  {analizar.isPending ? 'Analizando…' : 'Analizar link'}
                </Button>
                <span className="text-xs text-text-disabled">
                  Baja tu página y detecta las preguntas sola — revisá el resultado igual.
                </span>
              </div>
              {errorAnalisis && <p className="mb-2 text-sm text-red-600">{errorAnalisis}</p>}
              <EditorPreguntas preguntas={preguntas} onCambiar={setPreguntas} />
            </Campo>
          </>
        )}

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

// ── Tarjeta de una guía ────────────────────────────────────────────

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
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const alTerminar = {
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['guias', String(claseId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  };

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/api/materias/${materiaId}/guias/${guia.id}`),
    ...alTerminar,
  });
  const lanzar = useMutation({
    mutationFn: () => api.post(`/api/materias/${materiaId}/guias/${guia.id}/lanzar`),
    ...alTerminar,
  });
  const cancelar = useMutation({
    mutationFn: () => api.post(`/api/materias/${materiaId}/guias/${guia.id}/cancelar`),
    ...alTerminar,
  });

  function manejarEliminar() {
    if (window.confirm(`Se desvinculará "${guia.tema}" de esta clase. ¿Continuar?`)) {
      eliminar.mutate();
    }
  }
  function manejarLanzar() {
    if (
      window.confirm(
        `Se va a lanzar "${guia.tema}" a los estudiantes presentes en esta clase, con nota real. ¿Ya pasaste lista?`,
      )
    ) {
      lanzar.mutate();
    }
  }
  function manejarCancelar() {
    if (
      window.confirm(
        'Se cancela el lanzamiento para todo el curso. Se conservan las respuestas ya guardadas. ¿Continuar?',
      )
    ) {
      cancelar.mutate();
    }
  }

  const estado = ESTADO_GUIA_TONO[guia.estado];
  const esLegacy = guia.estado === 'externa_legacy';
  const puedeEditar = guia.estado === 'publicada' || esLegacy;

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
              <BookOpen size={16} />
            </span>
            <p className="truncate font-medium text-text">{guia.tema}</p>
            <Badge tone={estado.tono}>{estado.texto}</Badge>
            {!esLegacy && guia.nota != null && (
              <span className="shrink-0 text-xs text-text-disabled">/{guia.nota} pts</span>
            )}
          </div>
          <a
            href={guia.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block truncate text-sm text-primary-700 hover:underline"
          >
            {guia.url}
          </a>
          {!esLegacy && (
            <p className="mt-1 text-xs text-text-disabled">
              {guia.preguntas.length} pregunta{guia.preguntas.length === 1 ? '' : 's'} cargada
              {guia.preguntas.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {guia.estado === 'publicada' && (
            <Button variante="primary" tamano="sm" onClick={manejarLanzar} disabled={lanzar.isPending}>
              <Rocket size={14} /> Lanzar
            </Button>
          )}
          {(guia.estado === 'lanzada' || guia.estado === 'cerrada') && (
            <Button
              variante="secondary"
              tamano="sm"
              onClick={() => navigate(`/materias/${materiaId}/guias/${guia.id}/resultados`)}
            >
              Ver resultados
            </Button>
          )}
          {guia.estado === 'lanzada' && (
            <Button
              variante="danger"
              tamano="sm"
              onClick={manejarCancelar}
              disabled={cancelar.isPending}
            >
              Cancelar
            </Button>
          )}
          {puedeEditar && (
            <Button variante="secondary" tamano="sm" onClick={onEditar}>
              Editar
            </Button>
          )}
          {puedeEditar && (
            <Button
              variante="danger"
              tamano="sm"
              onClick={manejarEliminar}
              disabled={eliminar.isPending}
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Quién de la nómina abrió/completó — solo guías externas (legacy);
          las nativas muestran esto de forma mucho más rica en Resultados. */}
      {esLegacy && (
        <>
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
        </>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function GuiasClasePage() {
  const { id, claseId } = useParams();
  const materiaId = Number(id);
  const queryClient = useQueryClient();
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
    refetchInterval: 20000, // respaldo si el socket se cae un momento
    refetchIntervalInBackground: true,
  });

  // 13/08: antes no había ningún aviso en vivo cuando un estudiante
  // completaba una guía — solo se veía refrescando la página a mano. El
  // evento ya trae el nombre del estudiante: se agrega directo a la lista
  // de esa guía puntual, sin pedir de vuelta toda la tabla. (Solo aplica a
  // guías externas — las nativas se siguen en Resultados/Monitoreo.)
  useEffect(() => {
    const socket = obtenerSocket();
    const clave = ['guias', claseId];

    const unirseASala = () => {
      socket.emit('monitorear-guias-clase', Number(claseId));
      // el socket pudo reconectar mientras estaba caído: refrescamos por si nos perdimos algo
      queryClient.invalidateQueries({ queryKey: clave });
    };
    unirseASala();
    socket.on('connect', unirseASala);

    const alCompletar = (payload: FilaCompletadoGuia & { guia_id: number }) => {
      queryClient.setQueryData<GuiaDocente[]>(clave, (prev) =>
        prev?.map((g) => {
          if (g.id !== payload.guia_id) return g;
          if (g.completados.some((c) => c.estudiante_id === payload.estudiante_id)) return g;
          return {
            ...g,
            completados: [
              ...g.completados,
              {
                estudiante_id: payload.estudiante_id,
                nombres: payload.nombres,
                apellidos: payload.apellidos,
                completado_en: payload.completado_en,
              },
            ],
          };
        }),
      );
    };
    socket.on('guia-completada', alCompletar);

    return () => {
      socket.off('connect', unirseASala);
      socket.off('guia-completada', alCompletar);
    };
  }, [claseId, queryClient]);

  return (
    <div className="space-y-6">
      <div>
        <PageBreadcrumb>
          <Link to={`/materias/${id}`}>‹ {materia ? materia.nombre_materia : 'Materia'}</Link>
        </PageBreadcrumb>
        <PageHeader
          eyebrow="Guías"
          title="Guías de pre-clase"
          description="Tu contenido sigue viviendo en tu propia página — acá cargás el link, la nota y qué preguntas cuentan."
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
