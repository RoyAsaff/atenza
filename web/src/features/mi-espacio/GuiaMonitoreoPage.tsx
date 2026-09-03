// Guías nativas (17/08) · Monitoreo en vivo de un lanzamiento — mismo
// espíritu que MonitoreoPage de exámenes (progreso/estado/incidentes por
// estudiante, actualizado por socket, respaldo por polling). A propósito
// NO tiene "Pausar todo"/"Reactivar todo": el intento oficial de una guía
// no tiene la duración/presión de un examen de 2 horas — ver razonamiento
// en el plan de guías nativas (16/08). Solo pausar/reactivar individual +
// cancelar global, calcado de GuiaResultadosPage.

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Info, X } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { obtenerSocket } from '../../core/realtime/socket';
import { EstadoGuia, EstadoIntento, FilaMonitoreoGuia, Guia } from '../../core/tipos';
import {
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

const ESTADO_GUIA_TONO: Record<
  EstadoGuia,
  { texto: string; tono: 'neutral' | 'info' | 'dark' }
> = {
  publicada: { texto: 'Publicada', tono: 'neutral' },
  lanzada: { texto: 'Lanzada', tono: 'info' },
  cerrada: { texto: 'Cerrada', tono: 'dark' },
  externa_legacy: { texto: 'Externa', tono: 'neutral' },
};

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

const DURACION_ALERTA_MS = 20000;

interface AlertaIncidente {
  id: number;
  nombre: string;
  hora: string;
}

/** Doble beep vía Web Audio (sin archivo de sonido) — calco exacto del de
 * MonitoreoPage de exámenes. Si el navegador bloquea el audio (autoplay),
 * la alerta visual sigue funcionando igual. */
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

function BannerIncidente({ alerta, onCerrar }: { alerta: AlertaIncidente; onCerrar: () => void }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border-2 border-red-400 px-4 py-3 text-red-900"
      style={{ animation: 'atenza-alerta-flash 1.1s ease-in-out infinite' }}
    >
      <AlertTriangle size={22} className="shrink-0 text-red-600" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">¡Incidente detectado!</p>
        <p className="text-sm">
          <strong>{alerta.nombre}</strong> — salió de la guía · {alerta.hora}
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

function FilaEstudiante({
  fila,
  materiaId,
  guiaId,
}: {
  fila: FilaMonitoreoGuia;
  materiaId: number;
  guiaId: number;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const alTerminar = {
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['guia-monitoreo', String(guiaId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  };

  const pausar = useMutation({
    mutationFn: () =>
      api.post(`/api/materias/${materiaId}/guias/${guiaId}/intentos/${fila.intento_id}/pausar`),
    ...alTerminar,
  });
  const reactivar = useMutation({
    mutationFn: () =>
      api.post(`/api/materias/${materiaId}/guias/${guiaId}/intentos/${fila.intento_id}/reactivar`),
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

export function GuiaMonitoreoPage() {
  const { id, guiaId } = useParams();
  const materiaId = Number(id);
  const queryClient = useQueryClient();
  const [errorAccion, setErrorAccion] = useState('');
  const [alertas, setAlertas] = useState<AlertaIncidente[]>([]);
  const alertaIdRef = useRef(0);

  function cerrarAlerta(idAlerta: number) {
    setAlertas((prev) => prev.filter((a) => a.id !== idAlerta));
  }

  const { data: guia } = useQuery({
    queryKey: ['guia', guiaId],
    queryFn: async () => {
      const { data } = await api.get<{ guia: Guia & { tema: string } }>(
        `/api/materias/${materiaId}/guias/${guiaId}`,
      );
      return data.guia;
    },
  });

  const { data: monitoreo, isLoading, isError } = useQuery({
    queryKey: ['guia-monitoreo', guiaId],
    queryFn: async () => {
      const { data } = await api.get<{ monitoreo: FilaMonitoreoGuia[] }>(
        `/api/materias/${materiaId}/guias/${guiaId}/monitoreo`,
      );
      return data.monitoreo;
    },
    refetchInterval: 15000, // respaldo si el socket se cae un momento
    refetchIntervalInBackground: true,
  });

  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    const socket = obtenerSocket();
    const claveMonitoreo = ['guia-monitoreo', guiaId];

    const unirseASala = () => {
      setConectado(true);
      socket.emit('monitorear-guia', Number(guiaId));
      queryClient.invalidateQueries({ queryKey: claveMonitoreo });
    };
    unirseASala();
    socket.on('connect', unirseASala);

    const alDesconectar = () => setConectado(false);
    socket.on('disconnect', alDesconectar);

    const parcharFila = (intento_id: number, cambios: Partial<FilaMonitoreoGuia>) => {
      queryClient.setQueryData<FilaMonitoreoGuia[]>(claveMonitoreo, (prev) =>
        prev?.map((f) => (f.intento_id === intento_id ? { ...f, ...cambios } : f)),
      );
    };

    const alProgreso = (payload: { intento_id: number; respondidas: number }) => {
      parcharFila(payload.intento_id, { respondidas: payload.respondidas });
    };

    const alIntentoActualizado = (payload: {
      intento_id: number;
      estado: FilaMonitoreoGuia['estado'];
    }) => {
      parcharFila(payload.intento_id, { estado: payload.estado });
    };

    // Cambio a nivel GUÍA (se cerró sola al terminar todos) — refetch
    // completo, poco frecuente, también refresca la insignia del encabezado.
    const alEstadoActualizado = () => {
      queryClient.invalidateQueries({ queryKey: claveMonitoreo });
      queryClient.invalidateQueries({ queryKey: ['guia', guiaId] });
    };

    const alIncidente = (payload: {
      intento_id: number;
      tipo: string;
      fecha_hora: string;
      incidentes: number;
    }) => {
      const filas = queryClient.getQueryData<FilaMonitoreoGuia[]>(claveMonitoreo);
      const fila = filas?.find((f) => f.intento_id === payload.intento_id);
      const alertaId = ++alertaIdRef.current;
      setAlertas((prev) => [
        ...prev,
        {
          id: alertaId,
          nombre: fila ? `${fila.nombres} ${fila.apellidos}` : `Intento #${payload.intento_id}`,
          hora: new Date(payload.fecha_hora).toLocaleTimeString(),
        },
      ]);
      reproducirSonidoAlerta();
      setTimeout(
        () => setAlertas((prev) => prev.filter((a) => a.id !== alertaId)),
        DURACION_ALERTA_MS,
      );
      parcharFila(payload.intento_id, { incidentes: payload.incidentes });
    };

    // Habilitación tardía (02/09): alguien se sumó a mitad de camino
    // (corrigieron su asistencia) — no hay fila que parchear, hay que
    // pedirla de vuelta completa (poco frecuente, igual que estado-actualizado).
    const alEstudianteConvocado = () => {
      queryClient.invalidateQueries({ queryKey: claveMonitoreo });
    };

    socket.on('progreso', alProgreso);
    socket.on('incidente', alIncidente);
    socket.on('intento-actualizado', alIntentoActualizado);
    socket.on('estado-actualizado', alEstadoActualizado);
    socket.on('estudiante-convocado', alEstudianteConvocado);

    return () => {
      socket.off('connect', unirseASala);
      socket.off('disconnect', alDesconectar);
      socket.off('progreso', alProgreso);
      socket.off('incidente', alIncidente);
      socket.off('intento-actualizado', alIntentoActualizado);
      socket.off('estado-actualizado', alEstadoActualizado);
      socket.off('estudiante-convocado', alEstudianteConvocado);
    };
  }, [guiaId, queryClient]);

  const cancelar = useMutation({
    mutationFn: () => api.post(`/api/materias/${materiaId}/guias/${guiaId}/cancelar`),
    onSuccess: () => {
      setErrorAccion('');
      queryClient.invalidateQueries({ queryKey: ['guia', guiaId] });
      queryClient.invalidateQueries({ queryKey: ['guia-monitoreo', guiaId] });
    },
    onError: (err: unknown) => setErrorAccion(mensajeDeError(err)),
  });

  function manejarCancelar() {
    if (
      window.confirm(
        'Se cancela el lanzamiento para todo el curso. Se conservan las respuestas ya guardadas. ¿Continuar?',
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
          <Link to={`/materias/${id}/guias/${guiaId}/resultados`}>‹ {guia?.tema ?? 'Guía'}</Link>
        </PageBreadcrumb>
        <PageHeader
          eyebrow="Monitoreo en vivo"
          title={
            <span className="inline-flex flex-wrap items-center gap-3">
              {guia?.tema}
              {guia && (
                <Badge tone={ESTADO_GUIA_TONO[guia.estado].tono}>
                  {ESTADO_GUIA_TONO[guia.estado].texto}
                </Badge>
              )}
              <Badge tone={conectado ? 'success' : 'warning'} punto>
                {conectado ? 'En vivo' : 'Reconectando…'}
              </Badge>
            </span>
          }
          description="Progreso, estado e incidentes de cada estudiante, actualizados en vivo."
          actions={
            guia?.estado === 'lanzada' ? (
              <Button variante="danger" onClick={manejarCancelar} disabled={cancelar.isPending}>
                Cancelar
              </Button>
            ) : undefined
          }
        />
        {errorAccion && <p className="mt-2 text-sm text-red-600">{errorAccion}</p>}
      </div>

      {guia && guia.estado !== 'lanzada' && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-sm text-text-secondary">
          <Info size={16} className="mt-0.5 shrink-0" />
          Esta guía no está lanzada; el monitoreo solo se actualiza mientras está en vivo — mirá{' '}
          <Link
            to={`/materias/${id}/guias/${guiaId}/resultados`}
            className="font-medium text-primary-700 hover:underline"
          >
            Resultados
          </Link>{' '}
          para la nota final.
        </div>
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
              Todavía no se lanzó esta guía a nadie.
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
                    guiaId={Number(guiaId)}
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
