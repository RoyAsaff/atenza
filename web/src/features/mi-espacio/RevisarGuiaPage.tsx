// Guías nativas (16/08) · Revisión manual de preguntas abiertas — lo que
// escribió cada estudiante, al lado de la respuesta modelo que cargó el
// docente al publicar. Calificar la última pendiente de un intento
// calcula su nota (backend, revisar-respuestas-guia.ts).
//
// Corrección rápida (18/08): antes cada Correcta/Incorrecta pegaba al
// server al toque (1 click = 1 request + refetch de toda la lista) — con
// varias decenas de pendientes eso es lento. Ahora el click solo "marca"
// localmente (staged, resaltado, nada se guarda todavía); un botón
// "Guardar" manda todo el lote junto en un solo request
// (revisar-respuestas-guia.ts → RevisarRespuestasGuiaLote). Se suman
// filtros por alumno/pregunta y un atajo para marcar de una todo lo que
// está visible como correcta (para el caso común: la mayoría acertó
// igual, se corrigen a mano solo las excepciones antes de guardar).

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Check, CheckCheck, X } from 'lucide-react';
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
  Select,
  Spinner,
} from '../../core/ui/ui';

function TarjetaRevision({
  fila,
  marcada,
  onMarcar,
}: {
  fila: FilaRevisionGuia;
  marcada: boolean | undefined;
  onMarcar: (correcta: boolean) => void;
}) {
  return (
    <div
      className={
        'p-5 transition-colors ' +
        (marcada === true
          ? 'bg-secondary-50'
          : marcada === false
            ? 'bg-red-50'
            : '')
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-text">
          {fila.apellidos} {fila.nombres}
          <span className="ml-2 font-mono text-xs text-text-disabled">{fila.pregunta_referencia}</span>
        </p>
        {marcada !== undefined && (
          <span
            className={
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ' +
              (marcada ? 'bg-secondary-100 text-secondary-800' : 'bg-red-100 text-red-700')
            }
          >
            Sin guardar
          </span>
        )}
      </div>
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
          onClick={() => onMarcar(true)}
          className={
            'border-secondary-600 text-secondary-800 hover:bg-secondary-50' +
            (marcada === true ? ' bg-secondary-100' : '')
          }
        >
          <Check size={14} /> Correcta
        </Button>
        <Button
          variante="secondary"
          tamano="sm"
          onClick={() => onMarcar(false)}
          className={
            'border-red-300 text-red-700 hover:bg-red-50' + (marcada === false ? ' bg-red-100' : '')
          }
        >
          <X size={14} /> Incorrecta
        </Button>
      </div>
    </div>
  );
}

export function RevisarGuiaPage() {
  const { id, guiaId } = useParams();
  const materiaId = Number(id);
  const queryClient = useQueryClient();

  const [filtroAlumno, setFiltroAlumno] = useState('');
  const [filtroPregunta, setFiltroPregunta] = useState('');
  const [marcadas, setMarcadas] = useState<Map<number, boolean>>(new Map());
  const [error, setError] = useState('');

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

  const alumnos = useMemo(() => {
    const mapa = new Map<number, string>();
    for (const f of pendientes ?? []) mapa.set(f.estudiante_id, `${f.apellidos} ${f.nombres}`);
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [pendientes]);

  const preguntas = useMemo(() => {
    const set = new Set((pendientes ?? []).map((f) => f.pregunta_referencia));
    return [...set].sort();
  }, [pendientes]);

  const visibles = useMemo(
    () =>
      (pendientes ?? []).filter(
        (f) =>
          (!filtroAlumno || String(f.estudiante_id) === filtroAlumno) &&
          (!filtroPregunta || f.pregunta_referencia === filtroPregunta),
      ),
    [pendientes, filtroAlumno, filtroPregunta],
  );

  function marcar(guia_respuesta_id: number, correcta: boolean) {
    setMarcadas((prev) => {
      const siguiente = new Map(prev);
      // Click sobre la misma marca ya puesta = deshacerla.
      if (siguiente.get(guia_respuesta_id) === correcta) siguiente.delete(guia_respuesta_id);
      else siguiente.set(guia_respuesta_id, correcta);
      return siguiente;
    });
  }

  function marcarTodasVisibles() {
    setMarcadas((prev) => {
      const siguiente = new Map(prev);
      // Solo completa lo que todavía no tiene marca — no pisa una
      // Incorrecta que el docente ya haya puesto a mano.
      for (const f of visibles) {
        if (!siguiente.has(f.guia_respuesta_id)) siguiente.set(f.guia_respuesta_id, true);
      }
      return siguiente;
    });
  }

  const guardar = useMutation({
    mutationFn: () =>
      api.post(`/api/materias/${materiaId}/guias/${guiaId}/revision/lote`, {
        revisiones: [...marcadas.entries()].map(([guia_respuesta_id, correcta]) => ({
          guia_respuesta_id,
          correcta,
        })),
      }),
    onSuccess: () => {
      setError('');
      setMarcadas(new Map());
      queryClient.invalidateQueries({ queryKey: ['guia-revision', guiaId] });
      queryClient.invalidateQueries({ queryKey: ['guia-resultados', guiaId] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
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
        <CardBody className="space-y-4 p-0">
          {pendientes && pendientes.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-border p-5 pb-4">
              <Select
                className="w-auto min-w-[10rem]"
                value={filtroAlumno}
                onChange={(e) => setFiltroAlumno(e.target.value)}
              >
                <option value="">Todos los alumnos</option>
                {alumnos.map(([id, nombre]) => (
                  <option key={id} value={id}>
                    {nombre}
                  </option>
                ))}
              </Select>
              <Select
                className="w-auto min-w-[10rem]"
                value={filtroPregunta}
                onChange={(e) => setFiltroPregunta(e.target.value)}
              >
                <option value="">Todas las preguntas</option>
                {preguntas.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>

              <div className="ml-auto flex items-center gap-2">
                <Button variante="ghost" tamano="sm" onClick={marcarTodasVisibles}>
                  <CheckCheck size={14} /> Marcar visibles como correcta
                </Button>
                <Button
                  tamano="sm"
                  onClick={() => guardar.mutate()}
                  disabled={marcadas.size === 0 || guardar.isPending}
                >
                  {guardar.isPending ? <Spinner tamano="sm" /> : `Guardar (${marcadas.size})`}
                </Button>
              </div>
            </div>
          )}
          {error && <p className="px-5 text-sm text-red-600">{error}</p>}

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
          {visibles.length > 0 && (
            <div className="divide-y divide-border">
              {visibles.map((fila) => (
                <TarjetaRevision
                  key={fila.guia_respuesta_id}
                  fila={fila}
                  marcada={marcadas.get(fila.guia_respuesta_id)}
                  onMarcar={(correcta) => marcar(fila.guia_respuesta_id, correcta)}
                />
              ))}
            </div>
          )}
          {pendientes && pendientes.length > 0 && visibles.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon={<Check size={32} />}
                title="Nada con estos filtros"
                description="Probá con otro alumno o pregunta."
              />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
