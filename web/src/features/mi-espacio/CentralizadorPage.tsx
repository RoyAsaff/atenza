// E8 · HU-27: matriz estudiantes × evaluaciones finalizadas de la
// materia, con el acumulado (Σ nota_obtenida / Σ nota_total) y export a
// Excel (primer precedente de export en el código).

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { Centralizador, FilaCentralizador, Materia } from '../../core/tipos';
import {
  Button,
  Campo,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  EmptyState,
  Input,
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

// Nota final "a mano": el docente elige un subconjunto de las columnas
// (evaluaciones) y una nota base común; cada evaluación aporta su propio
// % (nota_obtenida/nota_total) y esos % se promedian con el mismo peso,
// para recién ahí multiplicar una sola vez por la base (base * promedio
// de %, en vez de promediar "base * %_i" evaluación por evaluación —
// álgebra idéntica, pero con un solo redondeo al final). Quien no rindió
// una evaluación seleccionada aporta 0% (mismo criterio que el Acumulado
// de siempre). Es puramente un cálculo en pantalla: no se guarda ni pega
// en el Excel exportado.
function calcularNotaFinal(
  fila: FilaCentralizador,
  columnas: { evaluacion_id: number; nota_total: number }[],
  notaBase: number,
): number {
  const sumaPorcentajes = columnas.reduce((acc, c) => {
    if (c.nota_total <= 0) return acc;
    const obtenida = fila.celdas[c.evaluacion_id] ?? 0;
    return acc + obtenida / c.nota_total;
  }, 0);
  return Math.round((sumaPorcentajes / columnas.length) * notaBase * 100) / 100;
}

export function CentralizadorPage() {
  const { id } = useParams();
  const materiaId = Number(id);
  const [errorExportar, setErrorExportar] = useState('');
  const [exportando, setExportando] = useState(false);

  const { data: materia } = useQuery({
    queryKey: ['materia', String(materiaId)],
    queryFn: async () => {
      const { data } = await api.get<{ materia: Materia }>(`/api/materias/${materiaId}`);
      return data.materia;
    },
  });

  const { data: centralizador, isLoading } = useQuery({
    queryKey: ['centralizador', String(materiaId)],
    queryFn: async () => {
      const { data } = await api.get<{ centralizador: Centralizador }>(
        `/api/materias/${materiaId}/centralizador`,
      );
      return data.centralizador;
    },
  });

  // Nota final calculada: arranca con todas las evaluaciones marcadas.
  const [seleccionadas, setSeleccionadas] = useState<Set<number> | null>(null);
  const [notaBase, setNotaBase] = useState('');

  useEffect(() => {
    if (centralizador && seleccionadas === null) {
      setSeleccionadas(new Set(centralizador.columnas.map((c) => c.evaluacion_id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centralizador]);

  const marcadas = seleccionadas ?? new Set<number>();
  const columnasSeleccionadas = centralizador?.columnas.filter((c) => marcadas.has(c.evaluacion_id)) ?? [];
  const todasMarcadas =
    !!centralizador && centralizador.columnas.length > 0 && marcadas.size === centralizador.columnas.length;
  const notaBaseNum = Number(notaBase);
  const notaBaseValida = notaBase.trim() !== '' && Number.isFinite(notaBaseNum) && notaBaseNum > 0;
  const mostrarNotaFinal = notaBaseValida && columnasSeleccionadas.length > 0;

  function alternarEvaluacion(evaluacionId: number) {
    setSeleccionadas((prev) => {
      const siguiente = new Set(prev ?? []);
      if (siguiente.has(evaluacionId)) siguiente.delete(evaluacionId);
      else siguiente.add(evaluacionId);
      return siguiente;
    });
  }

  function alternarTodas() {
    if (!centralizador) return;
    setSeleccionadas(
      todasMarcadas ? new Set() : new Set(centralizador.columnas.map((c) => c.evaluacion_id)),
    );
  }

  async function exportar() {
    setExportando(true);
    setErrorExportar('');
    try {
      // responseType 'blob' (en vez de un <a href> plano) para que el
      // interceptor de axios adjunte el Bearer token de la sesión.
      const respuesta = await api.get(`/api/materias/${materiaId}/centralizador/exportar`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(respuesta.data as Blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `centralizador_${materiaId}.xlsx`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorExportar(mensajeDeError(err));
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <PageBreadcrumb>
          <Link to={`/materias/${id}`}>‹ {materia?.nombre_materia ?? 'Materia'}</Link>
        </PageBreadcrumb>
        <PageHeader
          eyebrow="Centralizador"
          title="Notas de la materia"
          description="Matriz de estudiantes × evaluaciones finalizadas, con el acumulado."
          actions={
            centralizador && centralizador.columnas.length > 0 ? (
              <Button onClick={exportar} disabled={exportando}>
                {exportando ? 'Exportando…' : '⬇ Exportar a Excel'}
              </Button>
            ) : undefined
          }
        />
        {errorExportar && <p className="mt-2 text-sm text-red-600">{errorExportar}</p>}
      </div>

      {centralizador && centralizador.columnas.length > 0 && (
        <Card>
          <CardHeader
            title="Calcular nota final"
            description="Elige qué evaluaciones cuentan y una nota base común: el % obtenido en cada una se promedia y recién ahí se multiplica por esa base."
          />
          <CardBody className="space-y-4">
            <Campo etiqueta="Nota base">
              <Input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="ej. 15"
                value={notaBase}
                onChange={(e) => setNotaBase(e.target.value)}
                className="w-28"
              />
            </Campo>
            <div className="space-y-2">
              <Checkbox etiqueta="Seleccionar todas" checked={todasMarcadas} onChange={alternarTodas} />
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {centralizador.columnas.map((columna) => (
                  <Checkbox
                    key={columna.evaluacion_id}
                    etiqueta={`${columna.tema} (/${columna.nota_total})`}
                    checked={marcadas.has(columna.evaluacion_id)}
                    onChange={() => alternarEvaluacion(columna.evaluacion_id)}
                  />
                ))}
              </div>
            </div>
            {!mostrarNotaFinal && (
              <p className="text-sm text-text-disabled">
                Ingresa una nota base y selecciona al menos una evaluación para ver la columna
                "Nota final".
              </p>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title={`Estudiantes (${centralizador?.filas.length ?? 0})`}
          description={`${centralizador?.columnas.length ?? 0} evaluación${centralizador?.columnas.length === 1 ? '' : 'es'} finalizada${centralizador?.columnas.length === 1 ? '' : 's'}`}
        />
        <CardBody>
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Spinner /> Cargando…
            </div>
          )}

          {centralizador && centralizador.columnas.length === 0 && (
            <EmptyState
              icon={<BarChart3 size={32} />}
              title="Todavía no hay evaluaciones finalizadas"
              description="En cuanto termine la primera, aparecerá acá con la nota de cada estudiante."
            />
          )}

          {centralizador && centralizador.columnas.length > 0 && (
            <Tabla>
              <Thead>
                <Tr>
                  <Th>Estudiante</Th>
                  {centralizador.columnas.map((columna) => (
                    <Th key={columna.evaluacion_id}>
                      {columna.tema}
                      <span className="ml-1 font-normal text-text-disabled">/{columna.nota_total}</span>
                    </Th>
                  ))}
                  <Th>Acumulado</Th>
                  {mostrarNotaFinal && <Th>Nota final /{notaBaseNum}</Th>}
                </Tr>
              </Thead>
              <Tbody>
                {centralizador.filas.map((fila) => (
                  <Tr key={fila.estudiante_id}>
                    <Td className="font-medium">
                      {fila.apellidos} {fila.nombres}
                    </Td>
                    {centralizador.columnas.map((columna) => {
                      const nota = fila.celdas[columna.evaluacion_id];
                      return (
                        <Td key={columna.evaluacion_id} className="text-text-secondary">
                          {nota ?? <span className="text-text-disabled">—</span>}
                        </Td>
                      );
                    })}
                    <Td className="font-medium">
                      {fila.acumulado_total > 0
                        ? `${fila.acumulado_obtenido}/${fila.acumulado_total}`
                        : <span className="font-normal text-text-disabled">—</span>}
                    </Td>
                    {mostrarNotaFinal && (
                      <Td className="font-medium">
                        {calcularNotaFinal(fila, columnasSeleccionadas, notaBaseNum)}
                      </Td>
                    )}
                  </Tr>
                ))}
              </Tbody>
            </Tabla>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
