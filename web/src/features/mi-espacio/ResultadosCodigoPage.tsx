// E9 · Resultados de un examen de código: nota por casos de prueba
// acertados + código entregado por ejercicio (para revisar plagio o dar
// feedback). Calcado de ResultadosPage.tsx (E8).

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { AlertTriangle, CheckCircle2, Eye, Hourglass, XCircle } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { DetalleIntentoCodigo, ExamenCodigo, ResultadosCodigo } from '../../core/tipos';
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

// ── Modal "Ver código" ─────────────────────────────────────────────

function ModalDetalleIntento({
  materiaId,
  examenId,
  estudianteId,
  nombreEstudiante,
  onCerrar,
}: {
  materiaId: number;
  examenId: number;
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
    queryKey: ['detalle-intento-codigo', String(examenId), String(estudianteId)],
    queryFn: async () => {
      const { data } = await api.get<{ detalle: DetalleIntentoCodigo }>(
        `/api/materias/${materiaId}/examenes-codigo/${examenId}/resultados/${estudianteId}`,
      );
      return data.detalle;
    },
  });

  return (
    <Modal titulo={nombreEstudiante} eyebrow="Ver código entregado" maxWidth="max-w-3xl" onCerrar={onCerrar}>
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Spinner /> Cargando…
        </div>
      )}
      {isError && <Alert tone="danger">{mensajeDeError(error)}</Alert>}
      {detalle && (
        <div className="space-y-5">
          {detalle.ejercicios.map((ejercicio, idx) => (
            <div key={ejercicio.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-text-muted">
                    {idx + 1}
                  </span>
                  <p className="whitespace-pre-wrap font-medium text-text">{ejercicio.enunciado}</p>
                </div>
                {ejercicio.codigo_fuente === null ? (
                  <Badge tone="neutral">Sin entregar</Badge>
                ) : ejercicio.casos_totales === 0 ? (
                  <Badge tone="neutral">Sin casos</Badge>
                ) : ejercicio.casos_acertados === ejercicio.casos_totales ? (
                  <Badge tone="success">
                    <CheckCircle2 size={12} /> {ejercicio.casos_acertados}/{ejercicio.casos_totales}
                  </Badge>
                ) : (
                  <Badge tone="danger">
                    <XCircle size={12} /> {ejercicio.casos_acertados}/{ejercicio.casos_totales}
                  </Badge>
                )}
              </div>

              {ejercicio.codigo_fuente !== null && (
                <div className="ml-9 mt-2 overflow-hidden rounded-xl border border-border">
                  <Editor
                    height={`${Math.min(320, Math.max(100, ejercicio.codigo_fuente.split('\n').length * 19 + 20))}px`}
                    language="python"
                    theme="vs"
                    value={ejercicio.codigo_fuente}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 13,
                      scrollBeyondLastLine: false,
                      domReadOnly: true,
                    }}
                  />
                </div>
              )}

              {ejercicio.resultado_json && ejercicio.resultado_json.length > 0 && (
                <ul className="ml-9 mt-2 space-y-1.5">
                  {ejercicio.resultado_json.map((caso, i) => (
                    <li key={caso.caso_id} className="rounded-lg border border-border p-2 text-xs">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge tone={caso.paso ? 'success' : 'danger'}>
                          {caso.paso ? <CheckCircle2 size={11} /> : <XCircle size={11} />} Caso {i + 1}
                        </Badge>
                        <span className="text-text-disabled">{caso.tiempo_ms} ms</span>
                      </div>
                      {caso.stdout && (
                        <p className="font-mono text-text-secondary">
                          <span className="text-text-disabled">stdout:</span> {caso.stdout}
                        </p>
                      )}
                      {caso.stderr && (
                        <p className="font-mono text-red-600">
                          <span className="text-text-disabled">stderr:</span> {caso.stderr}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function ResultadosCodigoPage() {
  const { id, examenId } = useParams();
  const materiaId = Number(id);
  const examenCodigoId = Number(examenId);
  const queryClient = useQueryClient();
  const [errorPublicar, setErrorPublicar] = useState('');
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<{
    id: number;
    nombre: string;
  } | null>(null);

  const { data: examen } = useQuery({
    queryKey: ['examen-codigo', String(examenCodigoId)],
    queryFn: async () => {
      const { data } = await api.get<{ examen: ExamenCodigo }>(
        `/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}`,
      );
      return data.examen;
    },
  });

  const {
    data: resultados,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['resultados-codigo', String(examenCodigoId)],
    queryFn: async () => {
      const { data } = await api.get<{ resultados: ResultadosCodigo }>(
        `/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}/resultados`,
      );
      return data.resultados;
    },
  });

  const publicar = useMutation({
    mutationFn: () =>
      api.post(`/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}/publicar-notas`),
    onSuccess: () => {
      setErrorPublicar('');
      queryClient.invalidateQueries({ queryKey: ['examen-codigo', String(examenCodigoId)] });
    },
    onError: (err: unknown) => setErrorPublicar(mensajeDeError(err)),
  });

  return (
    <div className="space-y-6">
      <div>
        <PageBreadcrumb>
          <Link to={`/materias/${id}/examenes-codigo/${examenId}`}>‹ {examen?.tema ?? 'Examen de código'}</Link>
        </PageBreadcrumb>
        <PageHeader
          eyebrow="Resultados"
          title={
            <span className="inline-flex flex-wrap items-center gap-3">
              {examen?.tema}
              {examen?.publicada && <Badge tone="success">Notas publicadas</Badge>}
            </span>
          }
          description={
            examen?.publicada && examen.fecha_publicacion
              ? `Publicadas el ${new Date(examen.fecha_publicacion).toLocaleString()}`
              : 'Casos de prueba acertados, nota ponderada e incidentes de cada estudiante.'
          }
          actions={
            examen && !examen.publicada && resultados ? (
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
            to={`/materias/${id}/examenes-codigo/${examenId}/monitoreo`}
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
                    <Th>Casos acertados</Th>
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
                        {fila.casos_acertados} / {fila.casos_totales}
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
                          <Eye size={14} /> Ver código
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
          examenId={examenCodigoId}
          estudianteId={estudianteSeleccionado.id}
          nombreEstudiante={estudianteSeleccionado.nombre}
          onCerrar={() => setEstudianteSeleccionado(null)}
        />
      )}
    </div>
  );
}
