// HU-16 · Consolidado de asistencia por materia: totales por estudiante
// y porcentaje de asistencia (respaldo del historial al cierre del semestre)

import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../core/api/cliente';
import { FilaConsolidadoAsistencia, Materia } from '../../core/tipos';
import {
  Card,
  CardBody,
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

export function ConsolidadoAsistenciaPage() {
  const { id } = useParams();

  const { data: materia } = useQuery({
    queryKey: ['materia', id],
    queryFn: async () => {
      const { data } = await api.get<{ materia: Materia }>(`/api/materias/${id}`);
      return data.materia;
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['consolidado-asistencia', id],
    queryFn: async () => {
      const { data } = await api.get<{ consolidado: FilaConsolidadoAsistencia[] }>(
        `/api/materias/${id}/asistencia/consolidado`,
      );
      return data.consolidado;
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <PageBreadcrumb>
          <Link to={`/materias/${id}`}>‹ {materia ? materia.nombre_materia : 'Materia'}</Link>
        </PageBreadcrumb>
        <PageHeader title="Consolidado de asistencia" />
      </div>

      <Card>
        <CardBody>
          {isLoading && (
            <div className="flex items-center gap-2 text-text-secondary">
              <Spinner /> Cargando…
            </div>
          )}
          {isError && <p className="text-red-600">No se pudo cargar el consolidado.</p>}

          {data && data.length === 0 && (
            <p className="text-text-secondary text-sm py-4 text-center">
              Aún no hay estudiantes inscritos en esta materia.
            </p>
          )}

          {data && data.length > 0 && (
            <Tabla>
              <Thead>
                <Tr>
                  <Th>Apellidos y nombres</Th>
                  <Th alineado="center">Puntual</Th>
                  <Th alineado="center">Atraso</Th>
                  <Th alineado="center">Licencia</Th>
                  <Th alineado="center">Falta</Th>
                  <Th alineado="center">Clases</Th>
                  <Th alineado="center">% Asistencia</Th>
                </Tr>
              </Thead>
              <Tbody>
                {data.map((fila) => (
                  <Tr key={fila.estudiante_id}>
                    <Td>
                      {fila.apellidos} {fila.nombres}
                    </Td>
                    <Td alineado="center">{fila.puntual}</Td>
                    <Td alineado="center">{fila.atrasado}</Td>
                    <Td alineado="center">{fila.licencia}</Td>
                    <Td alineado="center">{fila.falta}</Td>
                    <Td alineado="center">{fila.total_clases}</Td>
                    <Td alineado="center" className="font-medium">
                      {fila.porcentaje_asistencia}%
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
