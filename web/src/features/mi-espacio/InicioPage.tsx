// "Inicio" (08/08): las materias en sí viven en el sidebar (no se repiten
// acá como directorio) — el cuerpo es un resumen de actividad: próxima
// clase, última evaluación y última guía, una tarjeta por materia. Si la
// cuenta no tiene ninguna materia (ni dicta ni está inscrita), un mensaje
// de bienvenida invitando a usar el "+" del topbar en vez de tarjetas vacías.
//
// Solo aparece la ficha de una materia si tiene una próxima clase
// programada (pedido de Roy, 08/08) — una materia sin clases futuras (p.
// ej. terminó el semestre, o el docente todavía no armó el calendario) no
// aporta nada útil acá y solo agrega ruido.

import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../../core/auth/AuthContext';
import { api } from '../../core/api/cliente';
import {
  EstadoEvaluacion,
  Materia,
  MateriaInscrita,
  ResumenMateriaDocente,
  ResumenMateriaEstudiante,
  ResumenMiEspacio,
} from '../../core/tipos';
import { Badge, Card, CardBody, CardHeader, EmptyState, Spinner } from '../../core/ui/ui';

const ESTADO_TONO: Record<EstadoEvaluacion, { texto: string; tono: 'neutral' | 'success' | 'info' | 'dark' }> = {
  borrador: { texto: 'Borrador', tono: 'neutral' },
  lista: { texto: 'Lista', tono: 'success' },
  lanzada: { texto: 'Lanzada', tono: 'info' },
  finalizada: { texto: 'Finalizada', tono: 'dark' },
};

function fechaClaseLegible(fecha: string): string {
  // La fecha viaja como medianoche UTC (ver esquemaFecha en el backend) —
  // sin forzar UTC acá, en husos negativos se corre un día para atrás.
  return new Date(fecha).toLocaleDateString('es-BO', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function fechaLegible(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-BO', { day: 'numeric', month: 'short' });
}

function FilaResumen({
  icono,
  etiqueta,
  children,
}: {
  icono: ReactNode;
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5 shrink-0 text-text-disabled">{icono}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-text-disabled">{etiqueta}</p>
        <div className="text-text-secondary">{children}</div>
      </div>
    </div>
  );
}

function TarjetaMateriaDictada({ resumen }: { resumen: ResumenMateriaDocente }) {
  return (
    <Card>
      <CardHeader title={resumen.nombre_materia} />
      <CardBody className="space-y-3">
        {/* proxima_clase siempre está presente acá — la ficha ni se */}
        {/* renderiza si no la tiene, ver filtro en InicioPage. */}
        <FilaResumen icono={<Calendar size={16} />} etiqueta="Próxima clase">
          <p>
            {resumen.proxima_clase!.tema} · {fechaClaseLegible(resumen.proxima_clase!.fecha)} ·{' '}
            {resumen.proxima_clase!.hora}
          </p>
        </FilaResumen>

        <FilaResumen icono={<ClipboardList size={16} />} etiqueta="Última evaluación">
          {resumen.ultima_evaluacion ? (
            <p className="flex flex-wrap items-center gap-1.5">
              {resumen.ultima_evaluacion.tema}
              <Badge tone={ESTADO_TONO[resumen.ultima_evaluacion.estado].tono}>
                {ESTADO_TONO[resumen.ultima_evaluacion.estado].texto}
              </Badge>
            </p>
          ) : (
            <p className="text-text-disabled">Todavía no creaste ninguna.</p>
          )}
        </FilaResumen>

        <FilaResumen icono={<BookOpen size={16} />} etiqueta="Última guía">
          {resumen.ultima_guia ? (
            <p>
              {resumen.ultima_guia.tema}{' '}
              <span className="text-text-disabled">· clase {resumen.ultima_guia.clase_tema}</span>
            </p>
          ) : (
            <p className="text-text-disabled">Todavía no creaste ninguna.</p>
          )}
        </FilaResumen>
      </CardBody>
      <div className="border-t border-border px-5 py-3">
        <Link
          to={`/materias/${resumen.materia_id}`}
          className="text-sm font-semibold text-primary-700 hover:underline"
        >
          Ver materia →
        </Link>
      </div>
    </Card>
  );
}

function TarjetaMateriaInscrita({ resumen }: { resumen: ResumenMateriaEstudiante }) {
  return (
    <Card>
      <CardHeader title={resumen.nombre_materia} />
      <CardBody className="space-y-3">
        {/* proxima_clase siempre está presente acá — la ficha ni se */}
        {/* renderiza si no la tiene, ver filtro en InicioPage. */}
        <FilaResumen icono={<Calendar size={16} />} etiqueta="Próxima clase">
          <p>
            {resumen.proxima_clase!.tema} · {fechaClaseLegible(resumen.proxima_clase!.fecha)} ·{' '}
            {resumen.proxima_clase!.hora}
          </p>
        </FilaResumen>

        <FilaResumen icono={<ClipboardList size={16} />} etiqueta="Última evaluación">
          {resumen.ultima_evaluacion ? (
            <p>
              {resumen.ultima_evaluacion.tema}: {resumen.ultima_evaluacion.nota_obtenida}/
              {resumen.ultima_evaluacion.nota_total} pts{' '}
              <span className="text-text-disabled">
                · publicada el {fechaLegible(resumen.ultima_evaluacion.fecha_publicacion)}
              </span>
            </p>
          ) : (
            <p className="text-text-disabled">Todavía no rindes ninguna.</p>
          )}
        </FilaResumen>

        <FilaResumen icono={<BookOpen size={16} />} etiqueta="Última guía">
          {resumen.ultima_guia ? (
            <p className="flex flex-wrap items-center gap-1.5">
              {resumen.ultima_guia.tema}
              {resumen.ultima_guia.completado && (
                <Badge tone="success" punto>
                  <CheckCircle2 size={12} /> Completada
                </Badge>
              )}
            </p>
          ) : (
            <p className="text-text-disabled">Todavía no tienes ninguna.</p>
          )}
        </FilaResumen>
      </CardBody>
      <div className="border-t border-border px-5 py-3">
        <Link
          to={`/inscrito/${resumen.materia_id}`}
          className="text-sm font-semibold text-primary-700 hover:underline"
        >
          Ver materia →
        </Link>
      </div>
    </Card>
  );
}

export function InicioPage() {
  const { sesion } = useAuth();

  const { data: miEspacio, isLoading } = useQuery({
    queryKey: ['mi-espacio'],
    queryFn: async () => {
      const { data } = await api.get<{
        materias_que_dicto: Materia[];
        materias_inscrito: MateriaInscrita[];
      }>('/api/mi-espacio');
      return data;
    },
  });

  const hayMaterias =
    (miEspacio?.materias_que_dicto.length ?? 0) > 0 ||
    (miEspacio?.materias_inscrito.length ?? 0) > 0;

  // Solo se pide el resumen (próxima clase / última evaluación / última
  // guía, ver-resumen.ts) si de verdad hay alguna materia — evita un
  // roundtrip innecesario para una cuenta recién creada.
  const { data: resumen, isLoading: cargandoResumen } = useQuery({
    queryKey: ['mi-espacio-resumen'],
    queryFn: async () => {
      const { data } = await api.get<ResumenMiEspacio>('/api/mi-espacio/resumen');
      return data;
    },
    enabled: hayMaterias,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-text-secondary">
        <Spinner /> Cargando…
      </div>
    );
  }

  if (!hayMaterias) {
    return (
      <EmptyState
        icon={<GraduationCap size={32} />}
        title={`¡Bienvenido a Atenza, ${sesion?.usuario.nombres}!`}
        description='Todavía no tienes ninguna materia. Usa el botón "+" junto a tu perfil, arriba a la derecha, para crear una materia o unirte a una con un código.'
      />
    );
  }

  // Solo se muestra la ficha de una materia si tiene una próxima clase
  // programada — sin eso, no hay nada útil que resumir acá.
  const dictadasConClase = resumen?.dictadas.filter((r) => r.proxima_clase) ?? [];
  const inscritasConClase = resumen?.inscritas.filter((r) => r.proxima_clase) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-text">
          Hola, {sesion?.usuario.nombres} 👋
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Elige una materia en el menú de la izquierda para entrar, o revisa el resumen de acá
          abajo.
        </p>
      </div>

      {cargandoResumen && (
        <div className="flex items-center gap-2 text-text-secondary">
          <Spinner /> Cargando resumen…
        </div>
      )}

      {dictadasConClase.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Enseño
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dictadasConClase.map((r) => (
              <TarjetaMateriaDictada key={r.materia_id} resumen={r} />
            ))}
          </div>
        </section>
      )}

      {inscritasConClase.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Inscrito
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inscritasConClase.map((r) => (
              <TarjetaMateriaInscrita key={r.materia_id} resumen={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
