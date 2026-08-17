// Detalle de una materia inscrita (mitad estudiante) — hoy solo muestra
// las guías vinculadas (fusión con PaginaGuias, 05/08); notas/asistencia
// del estudiante quedan mobile-only por ahora (VerMisNotas/VerMiAsistencia
// ya existen en el backend, se puede sumar acá después sin tocar nada del
// servidor).

import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, CheckCircle2 } from 'lucide-react';
import { api } from '../../core/api/cliente';
import { Guia, MateriaInscrita } from '../../core/tipos';
import { Badge, Card, CardBody, EmptyState, PageBreadcrumb, PageHeader, Spinner } from '../../core/ui/ui';

function fechaLegible(iso: string): string {
  return new Date(iso).toLocaleDateString('es-BO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function MateriaInscritaDetallePage() {
  const { id } = useParams();
  const materiaId = Number(id);

  // GET /api/mi-espacio ya trae materias_inscrito completo — reusar esa
  // query en vez de pedir un endpoint de detalle que no existe para esta mitad.
  const { data: miEspacio } = useQuery({
    queryKey: ['mi-espacio'],
    queryFn: async () => {
      const { data } = await api.get<{ materias_inscrito: MateriaInscrita[] }>('/api/mi-espacio');
      return data;
    },
  });
  const materia = miEspacio?.materias_inscrito.find((m) => m.materia.id === materiaId)?.materia;

  const { data: guias, isLoading, isError } = useQuery({
    queryKey: ['mis-guias', materiaId],
    queryFn: async () => {
      const { data } = await api.get<{ guias: Guia[] }>(`/api/materias/${materiaId}/guias`);
      return data.guias;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <PageBreadcrumb>
          <Link to="/">‹ Materias inscritas</Link>
        </PageBreadcrumb>
        <PageHeader
          eyebrow="Materia inscrita"
          title={materia ? materia.nombre_materia : 'Materia'}
          description={
            materia
              ? `${materia.sigla ? `${materia.sigla} · ` : ''}${materia.carrera} · ${materia.semestre}`
              : undefined
          }
        />
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-1 font-semibold text-text">Guías</h2>
          <p className="mb-4 text-sm text-text-secondary">
            Repasa antes de la clase. Las que tu docente lanza en vivo cuentan con nota real —
            las demás son solo práctica.
          </p>

          {isLoading && (
            <p className="flex items-center gap-2 text-sm text-text-secondary">
              <Spinner /> Cargando guías…
            </p>
          )}
          {isError && <p className="text-sm text-red-600">No se pudieron cargar las guías.</p>}

          {guias && guias.length === 0 && (
            <EmptyState
              icon={<BookOpen size={32} />}
              title="Todavía no hay guías asignadas"
              description="Tu docente todavía no vinculó ninguna guía a esta materia."
            />
          )}

          {guias && guias.length > 0 && (
            <ul className="divide-y divide-border">
              {guias.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text">{g.tema}</p>
                    <p className="truncate text-sm text-text-secondary">
                      Clase: {g.clase_tema} · {fechaLegible(g.clase_fecha)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {g.estado === 'externa_legacy' ? (
                      <>
                        {g.completado && (
                          <Badge tone="success" punto>
                            <CheckCircle2 size={14} /> Completada
                          </Badge>
                        )}
                        <a
                          href={g.url_acceso}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-primary-700 transition hover:border-primary-200 hover:bg-primary-50"
                        >
                          Abrir guía →
                        </a>
                      </>
                    ) : (
                      <>
                        {g.nota_obtenida !== null ? (
                          <Badge tone="success" punto>
                            <CheckCircle2 size={14} /> {g.nota_obtenida}/{g.nota} pts
                          </Badge>
                        ) : (
                          g.completado && <Badge tone="info">Pendiente de revisión</Badge>
                        )}
                        {g.estado === 'publicada' ? (
                          <span className="text-sm text-text-disabled">
                            Todavía no se lanzó en clase
                          </span>
                        ) : (
                          <Link
                            to={`/inscrito/${materiaId}/guias/${g.id}/tomar`}
                            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-primary-700 transition hover:border-primary-200 hover:bg-primary-50"
                          >
                            {g.completado ? 'Repasar de nuevo →' : 'Tomar la guía →'}
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
