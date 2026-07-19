// E7 · HU-22 (monitoreo en vivo) + HU-23 (pausar/reactivar/cancelar,
// global e individual). Se actualiza en vivo por Socket.IO; cualquier
// evento de progreso/incidente/cambio de estado solo dispara un refetch.

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Info, X } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { obtenerSocket } from '../../core/realtime/socket';
import { EstadoEvaluacion, Evaluacion, FilaMonitoreo, EstadoIntento } from '../../core/tipos';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  PageBreadcrumb,
  PageHeader,
  Spinner,
  Tabla,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../core/ui/ui';

const ESTADO_EVALUACION_TONO: Record<
  EstadoEvaluacion,
  { texto: string; tono: 'neutral' | 'success' | 'info' | 'dark' }
> = {
  borrador: { texto: 'Borrador', tono: 'neutral' },
  lista: { texto: 'Lista', tono: 'success' },
  lanzada: { texto: 'Lanzada', tono: 'info' },
  finalizada: { texto: 'Finalizada', tono: 'dark' },
};

const TIPO_INCIDENTE_TEXTO: Record<string, string> = {
  salida_pantalla: 'Salió de la pantalla del examen',
};

const DURACION_ALERTA_MS = 20000;

interface AlertaIncidente {
  id: number;
  nombre: string;
  tipoTexto: string;
  hora: string;
}

/** Doble beep vía Web Audio (sin archivo de sonido): si el navegador bloquea
 * el audio (autoplay), la alerta visual sigue funcionando igual. */
function reproducirSonidoAlerta() {
  try {
    const ContextoAudio = window.AudioContext ?? (window as any).webkitAudioContext;
    const ctx = new ContextoAudio();
    const ahora = ctx.currentTime;
    [0, 0.18].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ahora + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, ahora + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ahora + offset + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ahora + offset);
      osc.stop(ahora + offset + 0.16);
    });
  } catch {
    // Autoplay bloqueado u otro problema de audio: no hay mucho más que hacer.
  }
}

function BannerIncidente({
  alerta,
  onCerrar,
}: {
  alerta: AlertaIncidente;
  onCerrar: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border-2 border-red-400 px-4 py-3 text-red-900"
      style={{ animation: 'atenza-alerta-flash 1.1s ease-in-out infinite' }}
    >
      <AlertTriangle size={22} className="shrink-0 text-red-600" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">¡Incidente detectado!</p>
        <p className="text-sm">
          <strong>{alerta.nombre}</strong> — {alerta.tipoTexto} · {alerta.hora}
        </p>
      </div>
      <button
        onClick={onCerrar}
        className="shrink-0 rounded-md p-1.5 text-red-700 transition hover:bg-red-100"
        aria-label="Cerrar alerta"
      >
        <X size={16} />
      </button>
    </div>
  );
}

const ESTADO_INTENTO_TONO: Record<
  EstadoIntento,
  { texto: string; tono: 'neutral' | 'success' | 'info' | 'warning' | 'dark' }
> = {
  en_curso: { texto: 'En curso', tono: 'success' },
  pausado: { texto: 'Pausado', tono: 'warning' },
  finalizado: { texto: 'Finalizado', tono: 'dark' },
  desconectado: { texto: 'Desconectado', tono: 'neutral' },
  cancelado: { texto: 'Cancelado', tono: 'neutral' },
};

function FilaEstudiante({
  fila,
  materiaId,
  evaluacionId,
}: {
  fila: FilaMonitoreo;
  materiaId: number;
  evaluacionId: number;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const alTerminar = {
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['monitoreo', String(evaluacionId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  };

  const pausar = useMutation({
    mutationFn: () =>
      api.post(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/intentos/${fila.intento_id}/pausar`,
      ),
    ...alTerminar,
  });

  const reactivar = useMutation({
    mutationFn: () =>
      api.post(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/intentos/${fila.intento_id}/reactivar`,
      ),
    ...alTerminar,
  });

  return (
    <Tr>
      <Td className="font-medium">
        {fila.apellidos} {fila.nombres}
      </Td>
      <Td>
        <Badge tone={ESTADO_INTENTO_TONO[fila.estado].tono}>
          {ESTADO_INTENTO_TONO[fila.estado].texto}
        </Badge>
      </Td>
      <Td className="text-text-secondary">
        {fila.respondidas} / {fila.total_preguntas}
      </Td>
      <Td>
        {fila.incidentes > 0 ? (
          <span className="inline-flex items-center gap-1 font-medium text-red-600">
            <AlertTriangle size={14} /> {fila.incidentes}
          </span>
        ) : (
          <span className="text-text-disabled">—</span>
        )}
      </Td>
      <Td alineado="right">
        {(fila.estado === 'en_curso' || fila.estado === 'desconectado') && (
          <button
            onClick={() => pausar.mutate()}
            disabled={pausar.isPending}
            className="text-sm font-medium text-accent-700 hover:text-accent-800 disabled:opacity-50"
          >
            Pausar
          </button>
        )}
        {fila.estado === 'pausado' && (
          <button
            onClick={() => reactivar.mutate()}
            disabled={reactivar.isPending}
            className="text-sm font-medium text-primary-700 hover:text-primary-800 disabled:opacity-50"
          >
            Reactivar
          </button>
        )}
      </Td>
      {error && (
        <Td>
          <span className="text-sm text-red-600">{error}</span>
        </Td>
      )}
    </Tr>
  );
}

export function MonitoreoPage() {
  const { id, evalId } = useParams();
  const materiaId = Number(id);
  const evaluacionId = Number(evalId);
  const queryClient = useQueryClient();
  const [errorAccion, setErrorAccion] = useState('');
  const [alertas, setAlertas] = useState<AlertaIncidente[]>([]);
  const alertaIdRef = useRef(0);

  function cerrarAlerta(id: number) {
    setAlertas((prev) => prev.filter((a) => a.id !== id));
  }

  const { data: evaluacion } = useQuery({
    queryKey: ['evaluacion', String(evaluacionId)],
    queryFn: async () => {
      const { data } = await api.get<{ evaluacion: Evaluacion }>(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}`,
      );
      return data.evaluacion;
    },
  });

  const { data: monitoreo, isLoading, isError } = useQuery({
    queryKey: ['monitoreo', String(evaluacionId)],
    queryFn: async () => {
      const { data } = await api.get<{ monitoreo: FilaMonitoreo[] }>(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/monitoreo`,
      );
      return data.monitoreo;
    },
    refetchInterval: 15000, // respaldo si el socket se cae un momento
  });

  useEffect(() => {
    const socket = obtenerSocket();
    socket.emit('monitorear-evaluacion', evaluacionId);

    const refrescar = () => {
      queryClient.invalidateQueries({ queryKey: ['monitoreo', String(evaluacionId)] });
    };

    const alIncidente = (payload: { intento_id: number; tipo: string; fecha_hora: string }) => {
      const filas = queryClient.getQueryData<FilaMonitoreo[]>(['monitoreo', String(evaluacionId)]);
      const fila = filas?.find((f) => f.intento_id === payload.intento_id);
      const alertaId = ++alertaIdRef.current;
      setAlertas((prev) => [
        ...prev,
        {
          id: alertaId,
          nombre: fila ? `${fila.nombres} ${fila.apellidos}` : `Intento #${payload.intento_id}`,
          tipoTexto: TIPO_INCIDENTE_TEXTO[payload.tipo] ?? 'Reportó un incidente',
          hora: new Date(payload.fecha_hora).toLocaleTimeString(),
        },
      ]);
      reproducirSonidoAlerta();
      setTimeout(
        () => setAlertas((prev) => prev.filter((a) => a.id !== alertaId)),
        DURACION_ALERTA_MS,
      );
      refrescar();
    };

    socket.on('progreso', refrescar);
    socket.on('incidente', alIncidente);
    socket.on('intento-actualizado', refrescar);
    socket.on('estado-actualizado', refrescar);

    return () => {
      socket.off('progreso', refrescar);
      socket.off('incidente', alIncidente);
      socket.off('intento-actualizado', refrescar);
      socket.off('estado-actualizado', refrescar);
    };
  }, [evaluacionId, queryClient]);

  const alTerminarGlobal = {
    onSuccess: () => {
      setErrorAccion('');
      queryClient.invalidateQueries({ queryKey: ['monitoreo', String(evaluacionId)] });
      queryClient.invalidateQueries({ queryKey: ['evaluacion', String(evaluacionId)] });
    },
    onError: (err: unknown) => setErrorAccion(mensajeDeError(err)),
  };

  const pausarTodo = useMutation({
    mutationFn: () =>
      api.post(`/api/materias/${materiaId}/evaluaciones/${evaluacionId}/pausar`),
    ...alTerminarGlobal,
  });
  const reactivarTodo = useMutation({
    mutationFn: () =>
      api.post(`/api/materias/${materiaId}/evaluaciones/${evaluacionId}/reactivar`),
    ...alTerminarGlobal,
  });
  const cancelar = useMutation({
    mutationFn: () =>
      api.post(`/api/materias/${materiaId}/evaluaciones/${evaluacionId}/cancelar`),
    ...alTerminarGlobal,
  });

  function manejarCancelar() {
    if (
      window.confirm(
        'Se cerrará el examen para todo el curso. Las respuestas ya guardadas se conservan. ¿Continuar?',
      )
    ) {
      cancelar.mutate();
    }
  }

  return (
    <div className="space-y-6">
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a) => (
            <BannerIncidente key={a.id} alerta={a} onCerrar={() => cerrarAlerta(a.id)} />
          ))}
        </div>
      )}

      <div>
        <PageBreadcrumb>
          <Link to={`/materias/${id}/evaluaciones/${evalId}`}>‹ {evaluacion?.tema ?? 'Evaluación'}</Link>
        </PageBreadcrumb>
        <PageHeader
          eyebrow="Monitoreo en vivo"
          title={
            <span className="inline-flex flex-wrap items-center gap-3">
              {evaluacion?.tema}
              {evaluacion && (
                <Badge tone={ESTADO_EVALUACION_TONO[evaluacion.estado].tono}>
                  {ESTADO_EVALUACION_TONO[evaluacion.estado].texto}
                </Badge>
              )}
            </span>
          }
          description="Progreso, estado e incidentes de cada estudiante, actualizados en vivo."
          actions={
            evaluacion?.estado === 'lanzada' ? (
              <>
                <Button variante="secondary" onClick={() => pausarTodo.mutate()} disabled={pausarTodo.isPending}>
                  Pausar todo
                </Button>
                <Button variante="secondary" onClick={() => reactivarTodo.mutate()} disabled={reactivarTodo.isPending}>
                  Reactivar todo
                </Button>
                <Button variante="danger" onClick={manejarCancelar} disabled={cancelar.isPending}>
                  Cancelar
                </Button>
              </>
            ) : undefined
          }
        />
        {errorAccion && <p className="mt-2 text-sm text-red-600">{errorAccion}</p>}
      </div>

      {evaluacion && evaluacion.estado !== 'lanzada' && (
        <Alert tone="info" icon={<Info size={16} />}>
          Esta evaluación no está en curso; el monitoreo solo se actualiza mientras está Lanzada.
        </Alert>
      )}

      <Card>
        <CardHeader
          title={`Estudiantes (${monitoreo?.length ?? 0})`}
          description="Progreso = preguntas respondidas / total de preguntas"
        />
        <CardBody>
          {isLoading && (
            <div className="flex items-center gap-2 py-4 text-sm text-text-secondary">
              <Spinner /> Cargando…
            </div>
          )}
          {isError && <p className="text-sm text-red-600">No se pudo cargar el monitoreo.</p>}

          {monitoreo && monitoreo.length === 0 && (
            <p className="py-4 text-center text-sm text-text-secondary">
              Todavía no hay estudiantes convocados a este examen.
            </p>
          )}

          {monitoreo && monitoreo.length > 0 && (
            <Tabla>
              <Thead>
                <Tr>
                  <Th>Estudiante</Th>
                  <Th>Estado</Th>
                  <Th>Progreso</Th>
                  <Th>Incidentes</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {monitoreo.map((fila) => (
                  <FilaEstudiante
                    key={fila.intento_id}
                    fila={fila}
                    materiaId={materiaId}
                    evaluacionId={evaluacionId}
                  />
                ))}
              </Tbody>
            </Tabla>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
