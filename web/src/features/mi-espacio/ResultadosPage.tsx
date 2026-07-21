// E8 · HU-25 (resultados calculados automáticamente al finalizar) +
// HU-26 (el docente decide cuándo publicarlos a los estudiantes).

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Eye, Hourglass, XCircle } from 'lucide-react';
import { api, mensajeDeError, urlArchivo } from '../../core/api/cliente';
import { DetalleIntento, Evaluacion, Resultados } from '../../core/tipos';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Modal,
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

function TarjetaEstadistica({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-xl border border-border px-2 py-3 text-center sm:px-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-disabled">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold text-text">{valor}</p>
    </div>
  );
}

// ── Modal "Ver examen" ─────────────────────────────────────────────

function ModalDetalleIntento({
  materiaId,
  evaluacionId,
  estudianteId,
  nombreEstudiante,
  onCerrar,
}: {
  materiaId: number;
  evaluacionId: number;
  estudianteId: number;
  nombreEstudiante: string;
  onCerrar: () => void;
}) {
  const {
    data: detalle,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['detalle-intento', String(evaluacionId), String(estudianteId)],
    queryFn: async () => {
      const { data } = await api.get<{ detalle: DetalleIntento }>(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/resultados/${estudianteId}`,
      );
      return data.detalle;
    },
  });

  return (
    <Modal titulo={nombreEstudiante} eyebrow="Ver examen" maxWidth="max-w-2xl" onCerrar={onCerrar}>
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Spinner /> Cargando…
        </div>
      )}
      {isError && <Alert tone="danger">{mensajeDeError(error)}</Alert>}
      {detalle && (
        <div className="space-y-4">
          {detalle.preguntas.map((pregunta, idx) => (
            <div key={pregunta.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-text-muted">
                    {idx + 1}
                  </span>
                  <p className="font-medium text-text">{pregunta.pregunta}</p>
                </div>
                {pregunta.opcion_elegida_id === null ? (
                  <Badge tone="neutral">Sin responder</Badge>
                ) : pregunta.acerto ? (
                  <Badge tone="success">
                    <CheckCircle2 size={12} /> Correcta
                  </Badge>
                ) : (
                  <Badge tone="danger">
                    <XCircle size={12} /> Incorrecta
                  </Badge>
                )}
              </div>
              {pregunta.url_imagen && (
                <img
                  src={urlArchivo(pregunta.url_imagen)}
                  alt=""
                  className="ml-9 mt-2 max-h-32 rounded-xl border border-border"
                />
              )}
              <ul className="ml-9 mt-2 space-y-1">
                {pregunta.opciones.map((opcion) => {
                  const esElegida = opcion.id === pregunta.opcion_elegida_id;
                  const clase = opcion.es_correcta
                    ? 'bg-secondary-50 font-medium text-secondary-800'
                    : esElegida
                      ? 'bg-red-50 font-medium text-red-700'
                      : 'text-text-secondary';
                  return (
                    <li key={opcion.id} className={`rounded-lg px-2 py-1 text-sm ${clase}`}>
                      {opcion.es_correcta ? '✓ ' : esElegida ? '✗ ' : '· '}
                      {opcion.texto}
                      {esElegida && !opcion.es_correcta ? ' (elegida)' : ''}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function ResultadosPage() {
  const { id, evalId } = useParams();
  const materiaId = Number(id);
  const evaluacionId = Number(evalId);
  const queryClient = useQueryClient();
  const [errorPublicar, setErrorPublicar] = useState('');
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<{
    id: number;
    nombre: string;
  } | null>(null);

  const { data: evaluacion } = useQuery({
    queryKey: ['evaluacion', String(evaluacionId)],
    queryFn: async () => {
      const { data } = await api.get<{ evaluacion: Evaluacion }>(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}`,
      );
      return data.evaluacion;
    },
  });

  const {
    data: resultados,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['resultados', String(evaluacionId)],
    queryFn: async () => {
      const { data } = await api.get<{ resultados: Resultados }>(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/resultados`,
      );
      return data.resultados;
    },
  });

  const publicar = useMutation({
    mutationFn: () =>
      api.post(`/api/materias/${materiaId}/evaluaciones/${evaluacionId}/publicar-notas`),
    onSuccess: () => {
      setErrorPublicar('');
      queryClient.invalidateQueries({ queryKey: ['evaluacion', String(evaluacionId)] });
    },
    onError: (err: unknown) => setErrorPublicar(mensajeDeError(err)),
  });

  return (
    <div className="space-y-6">
      <div>
        <PageBreadcrumb>
          <Link to={`/materias/${id}/evaluaciones/${evalId}`}>‹ {evaluacion?.tema ?? 'Evaluación'}</Link>
        </PageBreadcrumb>
        <PageHeader
          eyebrow="Resultados"
          title={
            <span className="inline-flex flex-wrap items-center gap-3">
              {evaluacion?.tema}
              {evaluacion?.publicada && <Badge tone="success">Notas publicadas</Badge>}
            </span>
          }
          description={
            evaluacion?.publicada && evaluacion.fecha_publicacion
              ? `Publicadas el ${new Date(evaluacion.fecha_publicacion).toLocaleString()}`
              : 'Aciertos, nota ponderada e incidentes de cada estudiante.'
          }
          actions={
            evaluacion && !evaluacion.publicada && resultados ? (
              <Button onClick={() => publicar.mutate()} disabled={publicar.isPending}>
                {publicar.isPending ? 'Publicando…' : 'Publicar notas'}
              </Button>
            ) : undefined
          }
        />
        {errorPublicar && <p className="mt-2 text-sm text-red-600">{errorPublicar}</p>}
      </div>

      {isError && (
        <Alert tone="warning" icon={<Hourglass size={16} />}>
          {mensajeDeError(error)}{' '}
          <Link
            to={`/materias/${id}/evaluaciones/${evalId}/monitoreo`}
            className="font-medium underline"
          >
            Ver monitoreo →
          </Link>
        </Alert>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Spinner /> Cargando…
        </div>
      )}

      {resultados && (
        <>
          <Card>
            <CardHeader title="Estadísticas del curso" />
            <CardBody className="grid grid-cols-3 gap-2 sm:gap-3">
              <TarjetaEstadistica etiqueta="Promedio" valor={resultados.estadisticas.promedio} />
              <TarjetaEstadistica etiqueta="Nota máxima" valor={resultados.estadisticas.nota_maxima} />
              <TarjetaEstadistica etiqueta="Nota mínima" valor={resultados.estadisticas.nota_minima} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={`Estudiantes (${resultados.filas.length})`}
              description={`Nota ponderada sobre ${resultados.nota_total}`}
            />
            <CardBody>
              <Tabla>
                <Thead>
                  <Tr>
                    <Th>Estudiante</Th>
                    <Th>Aciertos</Th>
                    <Th>Nota</Th>
                    <Th>Incidentes</Th>
                    <Th alineado="right">Acciones</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {resultados.filas.map((fila) => (
                    <Tr key={fila.estudiante_id}>
                      <Td className="font-medium">
                        {fila.apellidos} {fila.nombres}
                      </Td>
                      <Td className="text-text-secondary">
                        {fila.aciertos} / {fila.total_preguntas}
                      </Td>
                      <Td className="font-medium">{fila.nota_obtenida}</Td>
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
                        <Button
                          variante="secondary"
                          tamano="sm"
                          onClick={() =>
                            setEstudianteSeleccionado({
                              id: fila.estudiante_id,
                              nombre: `${fila.apellidos} ${fila.nombres}`,
                            })
                          }
                        >
                          <Eye size={14} /> Ver examen
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Tabla>
            </CardBody>
          </Card>
        </>
      )}

      {estudianteSeleccionado && (
        <ModalDetalleIntento
          materiaId={materiaId}
          evaluacionId={evaluacionId}
          estudianteId={estudianteSeleccionado.id}
          nombreEstudiante={estudianteSeleccionado.nombre}
          onCerrar={() => setEstudianteSeleccionado(null)}
        />
      )}
    </div>
  );
}
