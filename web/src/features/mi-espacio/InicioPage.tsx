// "Inicio" (13/08, reemplaza el resumen anterior): el pedido de Roy es ver
// de un vistazo únicamente las clases de HOY — nada de "próxima clase" a
// futuro ni resumen de última evaluación/última guía — con acceso directo
// a las acciones del momento (pasar lista, evaluaciones, guías de esa
// clase puntual). Las materias en sí siguen viviendo en el sidebar, acá
// solo el agenda del día.

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, ClipboardCheck, ClipboardList, GraduationCap } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthContext';
import { api } from '../../core/api/cliente';
import { ClaseDeHoy, ClasesDeHoy, Materia, MateriaInscrita } from '../../core/tipos';
import { botonClases } from '../../core/ui/Button';
import { Card, EmptyState, Spinner } from '../../core/ui/ui';

function ClaseHoyDictada({ clase }: { clase: ClaseDeHoy }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="font-semibold text-text">{clase.nombre_materia}</p>
        <p className="text-sm text-text-secondary">
          {clase.hora} · {clase.tema}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to={`/materias/${clase.materia_id}/clases/${clase.clase_id}/asistencia`}
          className={botonClases('secondary', 'sm')}
        >
          <ClipboardCheck size={15} /> Pasar lista
        </Link>
        <Link
          to={`/materias/${clase.materia_id}/clases/${clase.clase_id}/evaluaciones`}
          className={botonClases('secondary', 'sm')}
        >
          <ClipboardList size={15} /> Evaluaciones
        </Link>
        <Link
          to={`/materias/${clase.materia_id}/clases/${clase.clase_id}/guias`}
          className={botonClases('secondary', 'sm')}
        >
          <BookOpen size={15} /> Guías
        </Link>
      </div>
    </Card>
  );
}

function ClaseHoyInscrita({ clase }: { clase: ClaseDeHoy }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="font-semibold text-text">{clase.nombre_materia}</p>
        <p className="text-sm text-text-secondary">
          {clase.hora} · {clase.tema}
        </p>
      </div>
      <Link to={`/inscrito/${clase.materia_id}`} className={botonClases('secondary', 'sm')}>
        Ver materia →
      </Link>
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

  const hayDictadas = (miEspacio?.materias_que_dicto.length ?? 0) > 0;
  const hayInscritas = (miEspacio?.materias_inscrito.length ?? 0) > 0;
  const hayMaterias = hayDictadas || hayInscritas;

  // Solo se pide si de verdad hay alguna materia — evita un roundtrip
  // innecesario para una cuenta recién creada.
  const { data: clasesHoy, isLoading: cargandoClasesHoy } = useQuery({
    queryKey: ['clases-hoy'],
    queryFn: async () => {
      const { data } = await api.get<ClasesDeHoy>('/api/mi-espacio/clases-hoy');
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-text">
          Hola, {sesion?.usuario.nombres} 👋
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Elige una materia en el menú de la izquierda para entrar, o revisa tus clases de hoy acá
          abajo.
        </p>
      </div>

      {cargandoClasesHoy && (
        <div className="flex items-center gap-2 text-text-secondary">
          <Spinner /> Cargando clases de hoy…
        </div>
      )}

      {!cargandoClasesHoy && hayDictadas && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Enseño
          </h2>
          {clasesHoy && clasesHoy.dictadas.length > 0 ? (
            <div className="space-y-3">
              {clasesHoy.dictadas.map((c) => (
                <ClaseHoyDictada key={c.clase_id} clase={c} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-disabled">No tienes clases hoy.</p>
          )}
        </section>
      )}

      {!cargandoClasesHoy && hayInscritas && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Inscrito
          </h2>
          {clasesHoy && clasesHoy.inscritas.length > 0 ? (
            <div className="space-y-3">
              {clasesHoy.inscritas.map((c) => (
                <ClaseHoyInscrita key={c.clase_id} clase={c} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-disabled">No tienes clases hoy.</p>
          )}
        </section>
      )}
    </div>
  );
}
