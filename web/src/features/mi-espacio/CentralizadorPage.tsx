// E8 · HU-27: matriz estudiantes × evaluaciones finalizadas de la
// materia, con el acumulado (Σ nota_obtenida / Σ nota_total) y export a
// Excel (primer precedente de export en el código).

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { Centralizador, Materia } from '../../core/tipos';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
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
