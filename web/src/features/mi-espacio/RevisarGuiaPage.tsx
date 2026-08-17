// Guías nativas (16/08) · Revisión manual de preguntas abiertas — lo que
// escribió cada estudiante, al lado de la respuesta modelo que cargó el
// docente al publicar. Calificar la última pendiente de un intento
// calcula su nota (backend, revisar-respuestas-guia.ts).

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { FilaRevisionGuia, Guia } from '../../core/tipos';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageBreadcrumb,
  PageHeader,
  Spinner,
} from '../../core/ui/ui';

function TarjetaRevision({
  fila,
  materiaId,
  guiaId,
}: {
  fila: FilaRevisionGuia;
  materiaId: number;
  guiaId: number;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const revisar = useMutation({
    mutationFn: (correcta: boolean) =>
      api.post(
        `/api/materias/${materiaId}/guias/${guiaId}/revision/${fila.guia_respuesta_id}`,
        { correcta },
      ),
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['guia-revision', String(guiaId)] });
      queryClient.invalidateQueries({ queryKey: ['guia-resultados', String(guiaId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  return (
    <div className="p-5">
      <p className="text-sm font-medium text-text">
        {fila.apellidos} {fila.nombres}
        <span className="ml-2 font-mono text-xs text-text-disabled">{fila.pregunta_referencia}</span>
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-surface-sunken p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-disabled">
            Respondió
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-text">
            {fila.texto_libre || <span className="text-text-disabled">(vacío)</span>}
          </p>
        </div>
        <div className="rounded-md border border-border bg-primary-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
            Respuesta modelo
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-text">
            {fila.respuesta_modelo || <span className="text-text-disabled">Sin cargar</span>}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button
          variante="secondary"
          tamano="sm"
          onClick={() => revisar.mutate(true)}
          disabled={revisar.isPending}
          className="border-secondary-600 text-secondary-800 hover:bg-secondary-50"
        >
          <Check size={14} /> Correcta
        </Button>
        <Button
          variante="secondary"
          tamano="sm"
          onClick={() => revisar.mutate(false)}
          disabled={revisar.isPending}
          className="border-red-300 text-red-700 hover:bg-red-50"
        >
          <X size={14} /> Incorrecta
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

export function RevisarGuiaPage() {
  const { id, guiaId } = useParams();
  const materiaId = Number(id);

  const { data: guia } = useQuery({
    queryKey: ['guia', guiaId],
    queryFn: async () => {
      const { data } = await api.get<{ guia: Guia & { tema: string } }>(
        `/api/materias/${materiaId}/guias/${guiaId}`,
      );
      return data.guia;
    },
  });

  const { data: pendientes, isLoading } = useQuery({
    queryKey: ['guia-revision', guiaId],
    queryFn: async () => {
      const { data } = await api.get<{ pendientes: FilaRevisionGuia[] }>(
        `/api/materias/${materiaId}/guias/${guiaId}/revision`,
      );
      return data.pendientes;
    },
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-6">
      <div>
        <PageBreadcrumb>
          <Link to={`/materias/${id}/guias/${guiaId}/resultados`}>‹ {guia?.tema ?? 'Resultados'}</Link>
        </PageBreadcrumb>
        <PageHeader
          eyebrow="Guía"
          title="Revisar respuestas abiertas"
          description="Lo que escribió cada estudiante, al lado de tu respuesta modelo."
        />
      </div>

      <Card>
        <CardHeader title={`Pendientes (${pendientes?.length ?? 0})`} />
        <CardBody className="p-0">
          {isLoading && (
            <div className="flex items-center gap-2 p-5 text-sm text-text-secondary">
              <Spinner /> Cargando…
            </div>
          )}
          {pendientes && pendientes.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon={<Check size={32} />}
                title="No hay nada pendiente de revisar"
                description="Todas las respuestas abiertas de esta guía ya fueron calificadas."
              />
            </div>
          )}
          {pendientes && pendientes.length > 0 && (
            <div className="divide-y divide-border">
              {pendientes.map((fila) => (
                <TarjetaRevision
                  key={fila.guia_respuesta_id}
                  fila={fila}
                  materiaId={materiaId}
                  guiaId={Number(guiaId)}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
