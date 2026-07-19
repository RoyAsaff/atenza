// HU-15 · Llamado de lista: marcar Puntual/Atraso/Licencia/Falta por
// estudiante. Quien no se marque queda como Falta al guardar (Esc. 1);
// guardar de nuevo sobre una clase ya registrada corrige el marcaje
// (Esc. 2) y el backend deja la auditoría con anterior/nuevo.

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api, mensajeDeError } from '../../core/api/cliente';
import { FilaListaAsistencia, Materia, MarcajeAsistencia } from '../../core/tipos';
import { Button, Card, CardBody, PageBreadcrumb, PageHeader, Spinner } from '../../core/ui/ui';

const OPCIONES: { valor: MarcajeAsistencia; texto: string; color: string }[] = [
  { valor: 'puntual', texto: 'Puntual', color: 'bg-secondary-700 border-secondary-700' },
  { valor: 'atrasado', texto: 'Atraso', color: 'bg-accent-600 border-accent-600' },
  { valor: 'licencia', texto: 'Licencia', color: 'bg-primary-700 border-primary-700' },
  { valor: 'falta', texto: 'Falta', color: 'bg-red-600 border-red-600' },
];

export function PasarListaPage() {
  const { id, claseId } = useParams();
  const queryClient = useQueryClient();
  const [marcajes, setMarcajes] = useState<Record<number, MarcajeAsistencia | null>>({});
  const [error, setError] = useState('');
  const [guardadoOk, setGuardadoOk] = useState(false);

  const { data: materia } = useQuery({
    queryKey: ['materia', id],
    queryFn: async () => {
      const { data } = await api.get<{ materia: Materia }>(`/api/materias/${id}`);
      return data.materia;
    },
  });

  const { data: lista, isLoading, isError } = useQuery({
    queryKey: ['lista-asistencia', claseId],
    queryFn: async () => {
      const { data } = await api.get<{ lista: FilaListaAsistencia[] }>(
        `/api/materias/${id}/clases/${claseId}/asistencia`,
      );
      return data.lista;
    },
  });

  useEffect(() => {
    if (!lista) return;
    const inicial: Record<number, MarcajeAsistencia | null> = {};
    for (const fila of lista) inicial[fila.estudiante_id] = fila.marcaje;
    setMarcajes(inicial);
  }, [lista]);

  const guardar = useMutation({
    mutationFn: () => {
      const explicitos = Object.entries(marcajes)
        .filter(([, marcaje]) => marcaje !== null)
        .map(([estudiante_id, marcaje]) => ({
          estudiante_id: Number(estudiante_id),
          marcaje: marcaje as MarcajeAsistencia,
        }));
      return api.post(`/api/materias/${id}/clases/${claseId}/asistencia`, {
        marcajes: explicitos,
      });
    },
    onSuccess: () => {
      setError('');
      setGuardadoOk(true);
      queryClient.invalidateQueries({ queryKey: ['lista-asistencia', claseId] });
      queryClient.invalidateQueries({ queryKey: ['consolidado-asistencia', id] });
    },
    onError: (err: unknown) => {
      setGuardadoOk(false);
      setError(mensajeDeError(err));
    },
  });

  function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    setGuardadoOk(false);
    guardar.mutate();
  }

  return (
    <div className="space-y-4">
      <div>
        <PageBreadcrumb>
          <Link to={`/materias/${id}`}>‹ {materia ? materia.nombre_materia : 'Clases'}</Link>
        </PageBreadcrumb>
        <PageHeader title="Pasar lista" />
      </div>

      <Card>
        <CardBody>
          <form onSubmit={manejarEnvio}>
            {isLoading && (
              <div className="flex items-center gap-2 text-text-secondary">
                <Spinner /> Cargando…
              </div>
            )}
            {isError && <p className="text-red-600">No se pudo cargar la nómina.</p>}

            {lista && lista.length === 0 && (
              <p className="text-text-secondary text-sm py-4 text-center">
                Aún no hay estudiantes inscritos en esta materia.
              </p>
            )}

            {lista && lista.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm text-text-secondary mb-3">
                  Quien no marques quedará como <strong>Falta</strong> al guardar.
                </p>
                {lista.map((fila) => {
                  const seleccionado = marcajes[fila.estudiante_id] ?? null;
                  return (
                    <div
                      key={fila.estudiante_id}
                      className="py-2 border-b border-border last:border-0 flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-text">
                        {fila.apellidos} {fila.nombres}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {OPCIONES.map((op) => (
                          <button
                            key={op.valor}
                            type="button"
                            onClick={() =>
                              setMarcajes((m) => ({ ...m, [fila.estudiante_id]: op.valor }))
                            }
                            className={`text-xs rounded-full px-3 py-1 border transition ${
                              seleccionado === op.valor
                                ? `${op.color} text-white`
                                : 'bg-surface text-text-secondary border-border hover:bg-surface-hover'
                            }`}
                          >
                            {op.texto}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className="pt-4 flex items-center gap-3">
                  <Button type="submit" disabled={guardar.isPending}>
                    {guardar.isPending ? 'Guardando…' : 'Guardar asistencia'}
                  </Button>
                  {guardadoOk && (
                    <span className="text-sm text-secondary-800">Asistencia guardada ✓</span>
                  )}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
