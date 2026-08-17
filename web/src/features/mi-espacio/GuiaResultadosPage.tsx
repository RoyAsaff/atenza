// Guías nativas (16/08) · Resultados de una guía lanzada — nota oficial,
// intentos totales (oficial + repasos), incidencias, y las acciones de
// pausar/reactivar/cancelar del intento oficial. Calca ResultadosPage y
// MonitoreoPage de exámenes.

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { obtenerSocket } from '../../core/realtime/socket';
import { EstadoIntento, FilaResultadoGuia, Guia } from '../../core/tipos';
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

function FilaResultado({
  fila,
  materiaId,
  guiaId,
  puedeGestionar,
}: {
  fila: FilaResultadoGuia;
  materiaId: number;
  guiaId: number;
  puedeGestionar: boolean;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const alTerminar = {
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['guia-resultados', String(guiaId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  };

  const pausar = useMutation({
    mutationFn: () =>
      api.post(
        `/api/materias/${materiaId}/guias/${guiaId}/intentos/${fila.intento_id}/pausar`,
      ),
    ...alTerminar,
  });
  const reactivar = useMutation({
    mutationFn: () =>
      api.post(
        `/api/materias/${materiaId}/guias/${guiaId}/intentos/${fila.intento_id}/reactivar`,
      ),
    ...alTerminar,
  });

  return (
    <Tr>
      <Td className="font-medium">
        {fila.apellidos} {fila.nombres}
      </Td>
      <Td>
        {fila.estado_oficial ? (
          <Badge tone={ESTADO_INTENTO_TONO[fila.estado_oficial].tono}>
            {ESTADO_INTENTO_TONO[fila.estado_oficial].texto}
          </Badge>
        ) : (
          <span className="text-text-disabled">—</span>
        )}
      </Td>
      <Td className="text-text-secondary">
        {fila.nota_obtenida !== null ? (
          `${fila.nota_obtenida}/${fila.nota_total}`
        ) : (
          <span className="text-accent-700">Pendiente</span>
        )}
      </Td>
      <Td className="text-text-secondary">{fila.total_intentos}</Td>
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
        {puedeGestionar && fila.intento_id && (
          <>
            {(fila.estado_oficial === 'en_curso' || fila.estado_oficial === 'desconectado') && (
              <button
                onClick={() => pausar.mutate()}
                disabled={pausar.isPending}
                className="text-sm font-medium text-accent-700 hover:text-accent-800 disabled:opacity-50"
              >
                Pausar
              </button>
            )}
            {fila.estado_oficial === 'pausado' && (
              <button
                onClick={() => reactivar.mutate()}
                disabled={reactivar.isPending}
                className="text-sm font-medium text-primary-700 hover:text-primary-800 disabled:opacity-50"
              >
                Reactivar
              </button>
            )}
          </>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </Td>
    </Tr>
  );
}

export function GuiaResultadosPage() {
  const { id, guiaId } = useParams();
  const materiaId = Number(id);
  const queryClient = useQueryClient();
  const [errorAccion, setErrorAccion] = useState('');

  const { data: guia } = useQuery({
    queryKey: ['guia', guiaId],
    queryFn: async () => {
      const { data } = await api.get<{ guia: Guia & { tema: string } }>(
        `/api/materias/${materiaId}/guias/${guiaId}`,
      );
      return data.guia;
    },
  });

  const { data: resultados, isLoading } = useQuery({
    queryKey: ['guia-resultados', guiaId],
    queryFn: async () => {
      const { data } = await api.get<{ resultados: FilaResultadoGuia[] }>(
        `/api/materias/${materiaId}/guias/${guiaId}/resultados`,
      );
      return data.resultados;
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const { data: pendientes } = useQuery({
    queryKey: ['guia-revision', guiaId],
    queryFn: async () => {
      const { data } = await api.get<{ pendientes: unknown[] }>(
        `/api/materias/${materiaId}/guias/${guiaId}/revision`,
      );
      return data.pendientes.length;
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  // En vivo: los eventos por intento no traen datos suficientes para
  // parchar esta tabla (está agrupada por estudiante, no por intento) —
  // a diferencia de Monitoreo de exámenes, acá se opta por invalidar y
  // volver a pedir (clases chicas, costo bajo) en vez de armar el join.
  useEffect(() => {
    const socket = obtenerSocket();
    const claveResultados = ['guia-resultados', guiaId];
    const claveRevision = ['guia-revision', guiaId];

    const unirseASala = () => {
      socket.emit('monitorear-guia', Number(guiaId));
      queryClient.invalidateQueries({ queryKey: claveResultados });
    };
    unirseASala();
    socket.on('connect', unirseASala);

    const refrescar = () => {
      queryClient.invalidateQueries({ queryKey: claveResultados });
      queryClient.invalidateQueries({ queryKey: claveRevision });
    };
    socket.on('progreso', refrescar);
    socket.on('incidente', refrescar);
    socket.on('intento-actualizado', refrescar);
    socket.on('estado-actualizado', refrescar);

    return () => {
      socket.off('connect', unirseASala);
      socket.off('progreso', refrescar);
      socket.off('incidente', refrescar);
      socket.off('intento-actualizado', refrescar);
      socket.off('estado-actualizado', refrescar);
    };
  }, [guiaId, queryClient]);

  const cancelar = useMutation({
    mutationFn: () => api.post(`/api/materias/${materiaId}/guias/${guiaId}/cancelar`),
    onSuccess: () => {
      setErrorAccion('');
      queryClient.invalidateQueries({ queryKey: ['guia', guiaId] });
      queryClient.invalidateQueries({ queryKey: ['guia-resultados', guiaId] });
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

  const puedeGestionar = guia?.estado === 'lanzada';

  return (
    <div className="space-y-6">
      <div>
        <PageBreadcrumb>
          <Link to={`/materias/${id}`}>‹ Materia</Link>
        </PageBreadcrumb>
        <PageHeader
          eyebrow="Guía"
          title={guia?.tema ?? 'Resultados'}
          description="Nota del intento oficial, intentos totales e incidencias por estudiante."
          actions={
            puedeGestionar ? (
              <>
                <Link
                  to={`/materias/${id}/guias/${guiaId}/monitoreo`}
                  className="inline-flex items-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:bg-surface-hover"
                >
                  Monitoreo en vivo
                </Link>
                <Button variante="danger" onClick={manejarCancelar} disabled={cancelar.isPending}>
                  Cancelar lanzamiento
                </Button>
              </>
            ) : undefined
          }
        />
        {errorAccion && <p className="mt-2 text-sm text-red-600">{errorAccion}</p>}
      </div>

      {!!pendientes && pendientes > 0 && (
        <Alert tone="warning" icon={<ClipboardCheck size={16} />}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Hay {pendientes} respuesta{pendientes === 1 ? '' : 's'} abierta
              {pendientes === 1 ? '' : 's'} esperando revisión — la nota de esos estudiantes
              queda pendiente hasta que las califiques.
            </span>
            <Link
              to={`/materias/${id}/guias/${guiaId}/revision`}
              className="shrink-0 text-sm font-semibold text-primary-700 hover:underline"
            >
              Revisar ahora →
            </Link>
          </div>
        </Alert>
      )}

      <Card>
        <CardHeader
          title={`Estudiantes (${resultados?.length ?? 0})`}
          description="Nota = aciertos / total de preguntas × nota máxima, solo del intento oficial."
        />
        <CardBody>
          {isLoading && (
            <div className="flex items-center gap-2 py-4 text-sm text-text-secondary">
              <Spinner /> Cargando…
            </div>
          )}

          {resultados && resultados.length === 0 && (
            <p className="py-4 text-center text-sm text-text-secondary">
              Todavía no se lanzó esta guía a nadie.
            </p>
          )}

          {resultados && resultados.length > 0 && (
            <Tabla>
              <Thead>
                <Tr>
                  <Th>Estudiante</Th>
                  <Th>Estado</Th>
                  <Th>Nota</Th>
                  <Th>Intentos</Th>
                  <Th>Incidencias</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {resultados.map((fila) => (
                  <FilaResultado
                    key={fila.estudiante_id}
                    fila={fila}
                    materiaId={materiaId}
                    guiaId={Number(guiaId)}
                    puedeGestionar={puedeGestionar}
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
