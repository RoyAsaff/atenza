// Inicio — rediseño 1b (17/08, design_handoff_inicio_docente/README.md):
// de dos listas planas ("Enseño"/"Inscrito") a un layout centrado en la
// clase que está ocurriendo ahora, con "Resto del día"/"Ya pasó" abajo y
// un panel "Requiere tu atención" al costado.
//
// Simplificaciones conscientes respecto del handoff (documentadas también
// en CONTEXTO.md):
// - `duracion_minutos` es un valor FIJO del backend (Clase no tiene
//   duración real en el schema) — la detección de "en curso" no es exacta
//   para clases más cortas/largas que el promedio.
// - El panel de pendientes no incluye la categoría "asistencia" (2+ faltas
//   consecutivas) — no hay método de repo ni regla definida todavía.
// - El estado "Día terminado" no menciona la primera clase de MAÑANA (el
//   backend de "clases de hoy" no trae eso) — se muestra solo el resumen
//   de hoy, sin inventar datos.

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthContext';
import { api } from '../../core/api/cliente';
import { ClaseDeHoy, ClasesDeHoy, Materia, MateriaInscrita, Pendiente, TipoPendiente } from '../../core/tipos';
import { botonClases, Button, Card, EmptyState, Spinner } from '../../core/ui/ui';
import { cn } from '../../core/ui/cn';
import { ModalNuevaMateria } from './ModalNuevaMateria';
import { ModalUnirse } from './ModalUnirse';

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

function fechaHoraCabecera(ahora: Date): string {
  const dia = DIAS[ahora.getDay()];
  const mes = MESES[ahora.getMonth()];
  const hh = String(ahora.getHours()).padStart(2, '0');
  const mm = String(ahora.getMinutes()).padStart(2, '0');
  return `${dia} ${ahora.getDate()} ${mes} · ${hh}:${mm}`;
}

/** "HH:MM" (hora Bolivia literal, sin timezone) + la fecha local del
 * cliente → Date del mismo día, para comparar contra `ahora`. */
function horaAFecha(hora: string, base: Date): Date {
  const [h, m] = hora.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

function minutosDesde(minutos: number): number {
  return minutos * 60 * 1000;
}

const TOLERANCIA_INICIO_MIN = 10;

interface EstadoDia {
  enCurso: ClaseDeHoy | null;
  proxima: ClaseDeHoy | null;
  restoDelDia: ClaseDeHoy[];
  yaPaso: ClaseDeHoy[];
}

function calcularEstadoDia(clases: ClaseDeHoy[], ahora: Date): EstadoDia {
  const conTiempos = clases.map((c) => {
    const inicio = horaAFecha(c.hora, ahora);
    const fin = new Date(inicio.getTime() + minutosDesde(c.duracion_minutos));
    const toleranciaInicio = new Date(inicio.getTime() - minutosDesde(TOLERANCIA_INICIO_MIN));
    return { clase: c, inicio, fin, toleranciaInicio };
  });

  const enCursoCandidatas = conTiempos
    .filter((c) => c.toleranciaInicio <= ahora && ahora < c.fin)
    .sort((a, b) => b.clase.hora.localeCompare(a.clase.hora)); // más tardía gana
  const enCurso = enCursoCandidatas[0]?.clase ?? null;

  const futuras = conTiempos
    .filter((c) => ahora < c.toleranciaInicio)
    .sort((a, b) => a.clase.hora.localeCompare(b.clase.hora));
  const proxima = enCurso ? null : futuras[0]?.clase ?? null;
  const restoDelDia = (enCurso ? futuras : futuras.slice(1)).map((c) => c.clase);

  const yaPaso = conTiempos
    .filter((c) => ahora >= c.fin)
    .sort((a, b) => a.clase.hora.localeCompare(b.clase.hora))
    .map((c) => c.clase);

  return { enCurso, proxima, restoDelDia, yaPaso };
}

const ETIQUETAS_PENDIENTE: Record<TipoPendiente, { texto: string; className: string }> = {
  evaluacion_abierta: { texto: 'Evaluación abierta', className: 'bg-accent-50 text-accent-700' },
  por_revisar: { texto: 'Por revisar', className: 'bg-primary-100 text-primary-800' },
};

function TarjetaPendiente({ pendiente, className }: { pendiente: Pendiente; className?: string }) {
  const etiqueta = ETIQUETAS_PENDIENTE[pendiente.tipo];
  return (
    <Link
      to={pendiente.url}
      className={cn(
        'flex flex-col gap-1.5 px-4 py-3.5 transition hover:bg-surface-hover',
        className,
      )}
    >
      <span
        className={cn(
          'self-start rounded-full px-2.5 py-[3px] text-[11px] font-bold uppercase tracking-[0.03em]',
          etiqueta.className,
        )}
      >
        {etiqueta.texto}
      </span>
      <p className="text-sm font-semibold text-text">{pendiente.titulo}</p>
      <p className="text-xs text-text-muted">{pendiente.detalle}</p>
    </Link>
  );
}

function PanelPendientesDesktop({ pendientes }: { pendientes: Pendiente[] }) {
  if (pendientes.length === 0) return null;
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface lg:block">
      <div className="border-b border-border px-4 py-3.5">
        <p className="text-sm font-bold text-text">Requiere tu atención</p>
      </div>
      <div className="divide-y divide-neutral-100">
        {pendientes.map((p, i) => (
          <TarjetaPendiente key={i} pendiente={p} />
        ))}
      </div>
    </div>
  );
}

function CarruselPendientesMobile({ pendientes }: { pendientes: Pendiente[] }) {
  if (pendientes.length === 0) return null;
  return (
    <div className="-mx-3.5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3.5 pb-1 lg:hidden">
      {pendientes.map((p, i) => (
        <TarjetaPendiente
          key={i}
          pendiente={p}
          className="w-[236px] shrink-0 snap-start rounded-xl border border-border bg-surface"
        />
      ))}
    </div>
  );
}

function BloqueClaseActual({ clase }: { clase: ClaseDeHoy }) {
  const esDictada = clase.rol === 'dictada';
  const hora = horaAFecha(clase.hora, new Date());
  const fin = new Date(hora.getTime() + minutosDesde(clase.duracion_minutos));
  const horaFin = `${String(fin.getHours()).padStart(2, '0')}:${String(fin.getMinutes()).padStart(2, '0')}`;
  // Docente: acciones de gestión de la clase (/materias/...). Estudiante
  // inscrito: no dicta esta clase, así que nada de "Pasar lista" — solo un
  // acceso a la materia inscrita (/inscrito/...).
  const base = esDictada
    ? `/materias/${clase.materia_id}/clases/${clase.clase_id}`
    : `/inscrito/${clase.materia_id}`;

  return (
    <div
      className="flex flex-col gap-[18px] rounded-2xl bg-primary-800 p-6"
      style={{ transition: 'all var(--duration-base) var(--ease-atenza)' }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-secondary-500" />
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-secondary-300">
          En curso · termina {horaFin}
        </span>
      </div>
      <div>
        <p className="text-2xl font-extrabold tracking-tight text-white lg:text-2xl">
          {clase.nombre_materia}
        </p>
        <p className="mt-1 text-[15px] text-primary-200">
          {clase.tema}
          {esDictada ? ` · ${clase.total_estudiantes} estudiantes` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {esDictada ? (
          <>
            <Link
              to={`${base}/asistencia`}
              className="rounded-lg bg-white px-5 py-[11px] text-[15px] font-bold text-primary-800 transition hover:bg-primary-50 max-lg:w-full max-lg:text-center max-lg:py-3"
            >
              Pasar lista
            </Link>
            <div className="flex flex-1 gap-2.5 lg:flex-none">
              <Link
                to={`${base}/evaluaciones`}
                className="flex-1 rounded-lg border border-primary-500 px-[18px] py-[11px] text-center text-[15px] font-medium text-primary-100 transition hover:bg-primary-700 lg:flex-none"
              >
                Evaluaciones
              </Link>
              <Link
                to={`${base}/guias`}
                className="flex-1 rounded-lg border border-primary-500 px-[18px] py-[11px] text-center text-[15px] font-medium text-primary-100 transition hover:bg-primary-700 lg:flex-none"
              >
                Guías
              </Link>
            </div>
          </>
        ) : (
          <Link
            to={base}
            className="rounded-lg bg-white px-5 py-[11px] text-[15px] font-bold text-primary-800 transition hover:bg-primary-50 max-lg:w-full max-lg:text-center max-lg:py-3"
          >
            Ver materia
          </Link>
        )}
      </div>
    </div>
  );
}

function BloqueProximaClase({ clase, ahora }: { clase: ClaseDeHoy; ahora: Date }) {
  const esDictada = clase.rol === 'dictada';
  const inicio = horaAFecha(clase.hora, ahora);
  const minutosFaltan = Math.max(0, Math.round((inicio.getTime() - ahora.getTime()) / 60000));
  const horas = Math.floor(minutosFaltan / 60);
  const minutos = minutosFaltan % 60;
  const etiquetaFaltan = horas > 0 ? `en ${horas} h ${minutos} min` : `en ${minutos} min`;
  const base = esDictada
    ? `/materias/${clase.materia_id}/clases/${clase.clase_id}`
    : `/inscrito/${clase.materia_id}`;

  return (
    <div
      className="flex flex-col gap-[18px] rounded-2xl border border-border bg-surface p-[22px] shadow-md"
      style={{ transition: 'all var(--duration-base) var(--ease-atenza)' }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-neutral-300" />
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted">
          Próxima clase · {etiquetaFaltan}
        </span>
      </div>
      <div>
        <p className="text-[21px] font-extrabold tracking-tight text-text">{clase.nombre_materia}</p>
        <p className="mt-1 text-[15px] text-text-secondary">
          {clase.hora} · {clase.tema}
          {esDictada ? ` · ${clase.total_estudiantes} estudiantes` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {esDictada ? (
          <>
            <Link to={`${base}/evaluaciones`} className={botonClases('primary')}>
              Preparar clase
            </Link>
            <Link to={`${base}/evaluaciones`} className={botonClases('secondary')}>
              Evaluaciones
            </Link>
            <Link to={`${base}/guias`} className={botonClases('secondary')}>
              Guías
            </Link>
          </>
        ) : (
          <Link to={base} className={botonClases('primary')}>
            Ver materia
          </Link>
        )}
      </div>
    </div>
  );
}

function FilaRestoDelDia({ clase, esUltima }: { clase: ClaseDeHoy; esUltima: boolean }) {
  const esDictada = clase.rol === 'dictada';
  const destino = esDictada ? `/materias/${clase.materia_id}` : `/inscrito/${clase.materia_id}`;
  return (
    <Link
      to={destino}
      className={cn(
        'flex items-center gap-4 px-4 py-3.5 transition hover:bg-surface-hover',
        !esUltima && 'border-b border-neutral-100',
      )}
    >
      <span className="w-11 shrink-0 font-mono text-[13px] font-medium text-text-secondary">
        {clase.hora}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-text">{clase.nombre_materia}</p>
        <p className="truncate text-[13px] text-text-muted">
          {esDictada ? clase.tema : `Inscrito · ${clase.tema}`}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium text-link">
        {esDictada ? 'Preparar →' : 'Ver →'}
      </span>
    </Link>
  );
}

function FilaYaPaso({ clase }: { clase: ClaseDeHoy }) {
  const puedePasarLista = clase.rol === 'dictada' && !clase.asistencia_tomada;
  const contenido = (
    <>
      <span className="w-11 shrink-0 font-mono text-[13px] font-medium text-text-disabled">
        {clase.hora}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-muted">
          {clase.nombre_materia} · {clase.tema}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 text-[13px] font-medium',
          clase.asistencia_tomada ? 'text-secondary-700' : 'text-accent-700',
        )}
      >
        {clase.asistencia_tomada
          ? `Lista tomada · ${clase.asistencia_resumen?.presentes}/${clase.asistencia_resumen?.total}`
          : clase.rol === 'dictada'
            ? 'Sin lista'
            : '—'}
      </span>
    </>
  );

  if (puedePasarLista) {
    return (
      <Link
        to={`/materias/${clase.materia_id}/clases/${clase.clase_id}/asistencia`}
        className="flex items-center gap-4 px-4 py-2 transition hover:bg-surface-hover"
      >
        {contenido}
      </Link>
    );
  }
  return <div className="flex items-center gap-4 px-4 py-2">{contenido}</div>;
}

function EsqueletoCarga() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_296px]">
      <div className="flex flex-col gap-[18px]">
        <div className="h-[150px] animate-pulse rounded-2xl bg-neutral-100" />
        <Card>
          <div className="space-y-3 p-4">
            <div className="h-4 w-2/3 rounded bg-neutral-100" />
            <div className="h-4 w-1/2 rounded bg-[#eef3f7]" />
          </div>
        </Card>
      </div>
    </div>
  );
}

export function InicioPage() {
  const { sesion } = useAuth();
  const [ahora, setAhora] = useState(() => new Date());
  const [modal, setModal] = useState<'crear' | 'unirse' | null>(null);

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

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

  const { data: clasesHoy, isLoading: cargandoClasesHoy } = useQuery({
    queryKey: ['clases-hoy'],
    queryFn: async () => {
      const { data } = await api.get<ClasesDeHoy>('/api/mi-espacio/clases-hoy');
      return data;
    },
    enabled: hayMaterias,
  });

  // El panel de pendientes es un "extra": si falla, no debe romper Inicio.
  const { data: pendientesData } = useQuery({
    queryKey: ['pendientes'],
    queryFn: async () => {
      const { data } = await api.get<{ pendientes: Pendiente[] }>('/api/mi-espacio/pendientes');
      return data.pendientes;
    },
    enabled: hayDictadas,
    retry: false,
  });
  const pendientes = pendientesData ?? [];

  const todasHoy = useMemo<ClaseDeHoy[]>(() => {
    if (!clasesHoy) return [];
    return [...clasesHoy.dictadas, ...clasesHoy.inscritas].sort((a, b) =>
      a.hora.localeCompare(b.hora),
    );
  }, [clasesHoy]);

  const { enCurso, proxima, restoDelDia, yaPaso } = useMemo(
    () => calcularEstadoDia(todasHoy, ahora),
    [todasHoy, ahora],
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-text-secondary">
        <Spinner /> Cargando…
      </div>
    );
  }

  if (!hayMaterias) {
    return (
      <>
        <EmptyState
          icon={<GraduationCap size={30} className="opacity-40" />}
          title={`Bienvenido a Atenza, ${sesion?.usuario.nombres}`}
          description="Crea tu primera materia y comparte el código con tu curso para empezar a pasar lista."
          action={
            <div className="flex justify-center gap-3">
              <Button onClick={() => setModal('crear')}>Crear materia</Button>
              <Button variante="secondary" onClick={() => setModal('unirse')}>
                Unirme con un código
              </Button>
            </div>
          }
        />
        {modal === 'crear' && <ModalNuevaMateria onCerrar={() => setModal(null)} />}
        {modal === 'unirse' && <ModalUnirse onCerrar={() => setModal(null)} />}
      </>
    );
  }

  const destacada = enCurso ?? proxima;
  const diaTerminado = !cargandoClasesHoy && todasHoy.length > 0 && !destacada;
  const sinClasesHoy = !cargandoClasesHoy && todasHoy.length === 0;
  const listasTomadasHoy = todasHoy.filter((c) => c.asistencia_tomada).length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_296px]">
        <div className="flex flex-col gap-[18px]">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-[22px] font-extrabold tracking-tight text-text">
              Hola, {sesion?.usuario.nombres}
            </h1>
            <span className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-muted">
              {fechaHoraCabecera(ahora)}
            </span>
          </div>

          {cargandoClasesHoy && <EsqueletoCarga />}

          {!cargandoClasesHoy && enCurso && <BloqueClaseActual clase={enCurso} />}
          {!cargandoClasesHoy && !enCurso && proxima && (
            <BloqueProximaClase clase={proxima} ahora={ahora} />
          )}

          {!cargandoClasesHoy && (diaTerminado || sinClasesHoy) && (
            <Card>
              <div className="flex flex-col items-center gap-2.5 p-6 text-center">
                <p className="text-[19px] font-bold text-text">
                  {sinClasesHoy ? 'Sin clases hoy' : 'Terminaste el día'}
                </p>
                {!sinClasesHoy && (
                  <p className="max-w-[360px] text-[15px] text-text-secondary">
                    {todasHoy.length} clase{todasHoy.length === 1 ? '' : 's'} hoy,{' '}
                    {listasTomadasHoy} lista{listasTomadasHoy === 1 ? '' : 's'} tomada
                    {listasTomadasHoy === 1 ? '' : 's'}.
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Móvil: el panel de pendientes va entre el bloque destacado y "Resto del día" */}
          {!cargandoClasesHoy && <CarruselPendientesMobile pendientes={pendientes} />}

          {!cargandoClasesHoy && restoDelDia.length > 0 && (
            <section>
              <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                Resto del día
              </h2>
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                {restoDelDia.map((c, i) => (
                  <FilaRestoDelDia
                    key={c.clase_id}
                    clase={c}
                    esUltima={i === restoDelDia.length - 1}
                  />
                ))}
              </div>
            </section>
          )}

          {!cargandoClasesHoy && yaPaso.length > 0 && (
            <section>
              <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                Ya pasó
              </h2>
              <div>
                {yaPaso.map((c) => (
                  <FilaYaPaso key={c.clase_id} clase={c} />
                ))}
              </div>
            </section>
          )}
        </div>

        <PanelPendientesDesktop pendientes={pendientes} />
      </div>

      {modal === 'crear' && <ModalNuevaMateria onCerrar={() => setModal(null)} />}
      {modal === 'unirse' && <ModalUnirse onCerrar={() => setModal(null)} />}
    </div>
  );
}
