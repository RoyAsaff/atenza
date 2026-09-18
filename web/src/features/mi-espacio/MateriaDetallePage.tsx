// E3/E4 · Detalle de materia — rediseño (dirección 1b aprobada,
// design_handoff_detalle_materia, 18/09): clases en lista a la izquierda
// ordenadas por fecha con "Pasar lista" a un toque, panel fijo de 320px a
// la derecha con todo lo que describe la materia (código/nómina,
// evaluaciones/consolidado/centralizador). Mismo patrón de dos columnas
// que EvaluacionEditorPage/CentralizadorPage.
//
// PanelClase (seis botones apilados en un modal) desaparece: se reparte
// en un botón visible "Pasar lista" + un Dropdown de acciones, reusado en
// las tres listas (Hoy/Próximas/Pasadas) y — vía navegación directa,
// aceptada como alternativa en el handoff — en el clic de un evento del
// calendario (el Dropdown de este repo se posiciona contra su propio
// trigger, no contra un nodo arbitrario de FullCalendar).

import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { EventClickArg } from '@fullcalendar/core';
import { BookOpen, ClipboardCheck, Code2, ListChecks, MoreHorizontal, Search } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { Clase, InscripcionNomina, Materia } from '../../core/tipos';
import {
  Alert,
  botonClases,
  Button,
  Card,
  cn,
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  EmptyState,
  IconButton,
  Input,
  Modal,
  PageBreadcrumb,
  Skeleton,
  Spinner,
  Tabla,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  useToast,
} from '../../core/ui/ui';
import { ModalConfirmarEliminar } from './FichaEditor';
import './calendario.css';

const CLAVE_VISTA = 'atenza:materia-vista';
// Clase no tiene duración real en el schema (mismo bug/decisión que
// InicioPage y ver-clases-hoy.ts en el backend): valor fijo.
const DURACION_CLASE_MINUTOS = 90;

const DIAS_SEMANA = [
  { iso: 1, texto: 'Lun' },
  { iso: 2, texto: 'Mar' },
  { iso: 3, texto: 'Mié' },
  { iso: 4, texto: 'Jue' },
  { iso: 5, texto: 'Vie' },
  { iso: 6, texto: 'Sáb' },
  { iso: 7, texto: 'Dom' },
];

const DIA_ABREV = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** "2026-08-03T00:00:00.000Z" → "2026-08-03" */
const soloFecha = (iso: string) => iso.slice(0, 10);

function fechaLegible(iso: string): string {
  return new Date(iso).toLocaleDateString('es', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC', // la fecha viaja como medianoche UTC
  });
}

function fechaCorta(iso: string): { dia: string; numero: number } {
  const d = new Date(`${soloFecha(iso)}T00:00:00.000Z`);
  return { dia: DIA_ABREV[d.getUTCDay()], numero: d.getUTCDate() };
}

function sumarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number);
  const total = ((h * 60 + m + minutos) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function leerVistaGuardada(): 'lista' | 'calendario' {
  try {
    return localStorage.getItem(CLAVE_VISTA) === 'calendario' ? 'calendario' : 'lista';
  } catch {
    return 'lista';
  }
}

// ── Menú "···" de una clase: compartido por Hoy/Próximas/Pasadas ────

function MenuClase({
  clase,
  materiaId,
  incluirAsistencia,
  onEditar,
  onEliminar,
  className = '',
}: {
  clase: Clase;
  materiaId: number;
  incluirAsistencia: boolean;
  onEditar: () => void;
  onEliminar: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const base = `/materias/${materiaId}/clases/${clase.id}`;

  return (
    <Dropdown
      trigger={({ abierto }) => (
        <IconButton
          aria-label="Más acciones de la clase"
          tamano="sm"
          className={cn('h-[30px] w-[30px]', abierto && 'bg-surface-hover', className)}
        >
          <MoreHorizontal size={16} />
        </IconButton>
      )}
    >
      {incluirAsistencia && (
        <DropdownItem icono={<ClipboardCheck size={15} />} onSelect={() => navigate(`${base}/asistencia`)}>
          {clase.asistencia_tomada ? 'Ver asistencia' : 'Pasar lista'}
        </DropdownItem>
      )}
      <DropdownItem icono={<ListChecks size={15} />} onSelect={() => navigate(`${base}/evaluaciones`)}>
        Evaluaciones
      </DropdownItem>
      <DropdownItem icono={<Code2 size={15} />} onSelect={() => navigate(`${base}/examenes-codigo`)}>
        Exámenes de código
      </DropdownItem>
      <DropdownItem icono={<BookOpen size={15} />} onSelect={() => navigate(`${base}/guias`)}>
        Guías
      </DropdownItem>
      <DropdownSeparator />
      <DropdownItem onSelect={onEditar}>Editar clase</DropdownItem>
      <DropdownItem peligro onSelect={onEliminar}>
        Eliminar clase
      </DropdownItem>
    </Dropdown>
  );
}

// ── Bloque "Hoy" ──────────────────────────────────────────────────

function BloqueHoy({
  clase,
  materiaId,
  onEditar,
  onEliminar,
}: {
  clase: Clase;
  materiaId: number;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-border-hover border-l-4 border-l-primary-800 bg-surface px-5 py-[18px]">
      <div className="min-w-0">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary-700">
          Hoy · {clase.hora}–{sumarMinutos(clase.hora, DURACION_CLASE_MINUTOS)}
        </p>
        <h3 className="mt-1 text-[19px] font-extrabold tracking-tight text-text">{clase.tema}</h3>
        <p className="mt-0.5 text-sm text-text-secondary">
          {clase.asistencia_tomada
            ? `Asistencia registrada · ${clase.asistencia_resumen?.presentes} de ${clase.asistencia_resumen?.total}`
            : 'Asistencia sin registrar'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
        <Link
          to={`/materias/${materiaId}/clases/${clase.id}/asistencia`}
          className={cn(botonClases('primary', 'lg'), 'h-[42px] px-5 text-[15px] font-bold whitespace-nowrap')}
        >
          Pasar lista
        </Link>
        <MenuClase
          clase={clase}
          materiaId={materiaId}
          incluirAsistencia={false}
          onEditar={onEditar}
          onEliminar={onEliminar}
          className="h-[42px] w-[42px]"
        />
      </div>
    </div>
  );
}

// ── Fila de "Próximas"/"Pasadas" ─────────────────────────────────

function FilaClase({
  clase,
  materiaId,
  variante,
  onEditar,
  onEliminar,
}: {
  clase: Clase;
  materiaId: number;
  variante: 'proxima' | 'pasada-sin-asistencia' | 'pasada-con-asistencia';
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const { dia, numero } = fechaCorta(clase.fecha);
  const conBoton = variante !== 'pasada-con-asistencia';

  return (
    <div
      className={cn(
        'flex items-center gap-[14px] px-4 hover:bg-surface-hover',
        variante === 'proxima' ? 'h-[58px]' : 'h-[54px]',
        variante === 'pasada-sin-asistencia' && 'border-l-[3px] border-l-accent-600 bg-accent-50 pl-[13px]',
      )}
    >
      <div className="w-20 shrink-0">
        <p
          className={cn(
            'text-sm',
            variante === 'pasada-con-asistencia' ? 'font-medium text-text-secondary' : 'font-bold text-text',
          )}
        >
          {dia} {numero}
        </p>
        <p className="font-mono text-[11px] text-text-muted">{clase.hora}</p>
      </div>

      <p
        className={cn(
          'min-w-0 flex-1 truncate text-[15px]',
          variante === 'pasada-con-asistencia' ? 'font-medium text-text-secondary' : 'font-semibold text-text',
        )}
      >
        {clase.tema}
      </p>

      {variante === 'proxima' && clase.tiene_evaluacion_abierta && (
        <span className="hidden shrink-0 items-center gap-1.5 text-[13px] text-text-secondary sm:flex">
          <span className="h-2 w-2 rounded-[3px] bg-accent-600" />
          Evaluación
        </span>
      )}

      {variante === 'pasada-con-asistencia' && (
        <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-text-secondary">
          <span className="h-2 w-2 rounded-[3px] bg-secondary-700" />
          {clase.asistencia_resumen?.presentes} de {clase.asistencia_resumen?.total}
        </span>
      )}

      {conBoton && (
        <Link
          to={`/materias/${materiaId}/clases/${clase.id}/asistencia`}
          className={cn(
            botonClases('secondary', 'sm'),
            'h-8 shrink-0 px-[13px] text-[13px] font-semibold text-link',
            variante === 'pasada-sin-asistencia' && 'border-accent-300 bg-surface font-bold text-accent-700',
          )}
        >
          Pasar lista
        </Link>
      )}

      <MenuClase
        clase={clase}
        materiaId={materiaId}
        incluirAsistencia={!conBoton}
        onEditar={onEditar}
        onEliminar={onEliminar}
        className={variante === 'pasada-sin-asistencia' ? 'text-accent-300' : 'text-text-disabled'}
      />
    </div>
  );
}

function ListaClases({
  titulo,
  contador,
  clases,
  materiaId,
  variante,
  onEditar,
  onEliminar,
}: {
  titulo: string;
  contador: ReactNode;
  clases: Clase[];
  materiaId: number;
  variante: 'proxima' | 'pasada';
  onEditar: (c: Clase) => void;
  onEliminar: (c: Clase) => void;
}) {
  if (clases.length === 0) return null;
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-base font-extrabold tracking-tight text-text">{titulo}</h4>
        {contador}
      </div>
      <div className="mt-2 overflow-hidden rounded-xl border border-border bg-surface">
        {clases.map((c, i) => (
          <div key={c.id} className={i < clases.length - 1 ? 'border-b border-neutral-100' : ''}>
            <FilaClase
              clase={c}
              materiaId={materiaId}
              variante={variante === 'proxima' ? 'proxima' : c.asistencia_tomada ? 'pasada-con-asistencia' : 'pasada-sin-asistencia'}
              onEditar={() => onEditar(c)}
              onEliminar={() => onEliminar(c)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Modal "Editar clase" (reemplaza el modo edición de PanelClase) ──

function ModalEditarClase({
  clase,
  materiaId,
  onCerrar,
}: {
  clase: Clase;
  materiaId: number;
  onCerrar: () => void;
}) {
  const queryClient = useQueryClient();
  const [fecha, setFecha] = useState(soloFecha(clase.fecha));
  const [hora, setHora] = useState(clase.hora);
  const [tema, setTema] = useState(clase.tema);
  const [error, setError] = useState('');

  const guardar = useMutation({
    mutationFn: () => api.patch(`/api/materias/${materiaId}/clases/${clase.id}`, { fecha, hora, tema }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clases', String(materiaId)] });
      onCerrar();
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  return (
    <Modal titulo="Editar clase" onCerrar={onCerrar} maxWidth="max-w-md">
      <form onSubmit={manejarEnvio} className="space-y-3">
        <Input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <Input type="time" required value={hora} onChange={(e) => setHora(e.target.value)} />
        <Input required value={tema} onChange={(e) => setTema(e.target.value)} />
        <div className="flex gap-3 pt-1">
          <Button type="submit" className="flex-1" disabled={guardar.isPending}>
            Guardar
          </Button>
          <Button type="button" variante="secondary" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}

// ── HU-13 · Crear clase individual ───────────────────────────────

function FormNuevaClase({ materiaId }: { materiaId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('08:00');
  const [tema, setTema] = useState('');
  const [error, setError] = useState('');

  const crear = useMutation({
    mutationFn: () => api.post(`/api/materias/${materiaId}/clases`, { fecha, hora, tema }),
    onSuccess: () => {
      setError('');
      setTema('');
      queryClient.invalidateQueries({ queryKey: ['clases', String(materiaId)] });
      toast({ tone: 'success', titulo: 'Clase creada' });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <form onSubmit={manejarEnvio}>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm text-text-secondary">
          Fecha
          <Input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className="mt-1" />
        </label>
        <label className="text-sm text-text-secondary">
          Hora
          <Input type="time" required value={hora} onChange={(e) => setHora(e.target.value)} className="mt-1" />
        </label>
        <label className="text-sm text-text-secondary flex-1 min-w-48">
          Tema
          <Input
            required
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="p. ej. Normalización de bases de datos"
            className="mt-1"
          />
        </label>
        <Button type="submit" disabled={crear.isPending}>
          Crear clase
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </form>
  );
}

// ── HU-14 · Generar calendario del semestre ──────────────────────

function FormGenerarCalendario({ materiaId }: { materiaId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dias, setDias] = useState<number[]>([]);
  const [hora, setHora] = useState('08:00');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [tema, setTema] = useState('Clase');
  const [error, setError] = useState('');

  const generar = useMutation({
    mutationFn: () =>
      api.post<{ total_creadas: number; omitidas: number }>(
        `/api/materias/${materiaId}/clases/generar`,
        { dias_semana: dias, hora, fecha_inicio: inicio, fecha_fin: fin, tema },
      ),
    onSuccess: ({ data }) => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['clases', String(materiaId)] });
      toast({
        tone: 'success',
        titulo: `${data.total_creadas} clases generadas`,
        descripcion:
          data.omitidas > 0 ? `${data.omitidas} omitidas por chocar con clases existentes` : undefined,
      });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  function alternarDia(iso: number) {
    setDias((d) => (d.includes(iso) ? d.filter((x) => x !== iso) : [...d, iso]));
  }

  function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    if (dias.length === 0) {
      setError('Selecciona al menos un día de la semana');
      return;
    }
    generar.mutate();
  }

  return (
    <form onSubmit={manejarEnvio}>
      <p className="text-sm text-text-secondary mb-3">
        Ejemplo: martes y jueves, 08:00, del 03/08 al 30/11. Después puedes editar o
        eliminar clases individuales (feriados, suspensiones).
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {DIAS_SEMANA.map((d) => (
          <button
            key={d.iso}
            type="button"
            onClick={() => alternarDia(d.iso)}
            className={`text-sm rounded-full px-3 py-1 border transition ${
              dias.includes(d.iso)
                ? 'bg-primary-700 text-white border-primary-700'
                : 'bg-surface text-text-secondary border-border hover:bg-surface-hover'
            }`}
          >
            {d.texto}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm text-text-secondary">
          Hora
          <Input type="time" required value={hora} onChange={(e) => setHora(e.target.value)} className="mt-1" />
        </label>
        <label className="text-sm text-text-secondary">
          Desde
          <Input type="date" required value={inicio} onChange={(e) => setInicio(e.target.value)} className="mt-1" />
        </label>
        <label className="text-sm text-text-secondary">
          Hasta
          <Input type="date" required value={fin} onChange={(e) => setFin(e.target.value)} className="mt-1" />
        </label>
        <label className="text-sm text-text-secondary flex-1 min-w-40">
          Tema por defecto
          <Input value={tema} onChange={(e) => setTema(e.target.value)} className="mt-1" />
        </label>
        <Button type="submit" disabled={generar.isPending}>
          {generar.isPending ? 'Generando…' : 'Generar clases'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </form>
  );
}

// ── Modal "+ Agregar clases": pestañas individual / generar varias ──

function ModalAgregarClases({ materiaId, onCerrar }: { materiaId: number; onCerrar: () => void }) {
  const [pestana, setPestana] = useState<'individual' | 'generar'>('individual');

  return (
    <Modal titulo="Agregar clases" onCerrar={onCerrar} maxWidth="max-w-lg">
      <div className="mb-4 flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setPestana('individual')}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
            pestana === 'individual'
              ? 'border-primary-700 text-primary-700'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          Clase individual
        </button>
        <button
          type="button"
          onClick={() => setPestana('generar')}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
            pestana === 'generar'
              ? 'border-primary-700 text-primary-700'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          Generar varias
        </button>
      </div>

      {pestana === 'individual' ? (
        <FormNuevaClase materiaId={materiaId} />
      ) : (
        <FormGenerarCalendario materiaId={materiaId} />
      )}
    </Modal>
  );
}

// ── Panel derecho · Inscripción ──────────────────────────────────

function PanelInscripcion({ materia, setError }: { materia: Materia; setError: (msg: string) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [modalRegenerarAbierto, setModalRegenerarAbierto] = useState(false);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['materia', String(materia.id)] });
    queryClient.invalidateQueries({ queryKey: ['mi-espacio'] });
  };

  const regenerar = useMutation({
    mutationFn: () => api.post(`/api/materias/${materia.id}/codigo/regenerar`),
    onMutate: () => setError(''),
    onSuccess: () => {
      invalidar();
      setModalRegenerarAbierto(false);
      toast({ tone: 'success', titulo: 'Código regenerado' });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  const cambiarEstado = useMutation({
    mutationFn: (activo: boolean) => api.patch(`/api/materias/${materia.id}/codigo`, { activo }),
    onMutate: () => setError(''),
    onSuccess: (_data, activo) => {
      invalidar();
      toast({ tone: 'success', titulo: activo ? 'Inscripciones abiertas' : 'Inscripciones cerradas' });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  async function copiar() {
    await navigator.clipboard.writeText(materia.codigo);
    toast({ tone: 'success', titulo: 'Código copiado' });
  }

  return (
    <Card className="px-5 py-[18px]">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-extrabold text-text">Inscripción</p>

        <div className="flex items-center justify-between gap-[10px]">
          <span
            className={cn(
              'font-mono text-[22px] font-medium tracking-[0.14em]',
              materia.codigo_activo ? 'text-primary-800' : 'text-text-disabled line-through',
            )}
          >
            {materia.codigo}
          </span>
          <Button variante="secondary" tamano="sm" className="h-[34px]" onClick={copiar}>
            Copiar
          </Button>
        </div>

        <div className="flex items-center justify-between gap-[10px]">
          <span className="flex items-center gap-2 text-[13px] text-text-secondary">
            <span
              className={cn('h-2 w-2 shrink-0 rounded-full', materia.codigo_activo ? 'bg-secondary-700' : 'bg-neutral-400')}
            />
            {materia.codigo_activo ? 'Abiertas' : 'Cerradas'}
          </span>
          <span className="text-[13px] font-medium text-link">
            <button
              type="button"
              onClick={() => cambiarEstado.mutate(!materia.codigo_activo)}
              disabled={cambiarEstado.isPending}
              className="hover:underline"
            >
              {materia.codigo_activo ? 'Cerrar' : 'Reabrir'}
            </button>
            {' · '}
            <button type="button" onClick={() => setModalRegenerarAbierto(true)} className="hover:underline">
              Regenerar
            </button>
          </span>
        </div>
      </div>

      {modalRegenerarAbierto && (
        <ModalConfirmarEliminar
          titulo="Generar un código nuevo"
          cuerpo="El código actual dejará de funcionar y nadie podrá usarlo para inscribirse."
          textoBoton="Generar uno nuevo"
          eliminando={regenerar.isPending}
          onConfirmar={() => regenerar.mutate()}
          onCerrar={() => setModalRegenerarAbierto(false)}
        />
      )}
    </Card>
  );
}

// ── Panel derecho · Nómina ────────────────────────────────────────

function PanelNomina({
  nomina,
  onVerNomina,
}: {
  nomina: InscripcionNomina[] | undefined;
  onVerNomina: () => void;
}) {
  const ultimoInscrito = useMemo(() => {
    if (!nomina || nomina.length === 0) return null;
    return nomina.reduce((mas, i) =>
      new Date(i.fecha_inscripcion) > new Date(mas.fecha_inscripcion) ? i : mas,
    );
  }, [nomina]);

  return (
    <Card className="px-5 py-[18px]">
      <div className="flex flex-col gap-[10px]">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-extrabold text-text">Nómina</p>
          <span className="font-mono text-[18px] font-medium text-text">{nomina ? nomina.length : '—'}</span>
        </div>
        <p className="text-[13px] text-text-muted">
          {ultimoInscrito
            ? `Último inscrito: ${ultimoInscrito.estudiante.apellidos}, ${ultimoInscrito.estudiante.nombres} · ${new Date(ultimoInscrito.fecha_inscripcion).toLocaleDateString()}`
            : 'Aún no hay estudiantes inscritos.'}
        </p>
        <button
          type="button"
          onClick={onVerNomina}
          className="self-start text-[13px] font-semibold text-link hover:underline"
        >
          Ver nómina completa
        </button>
      </div>
    </Card>
  );
}

function SeccionNomina({ materiaId, setError }: { materiaId: number; setError: (msg: string) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [buscar, setBuscar] = useState('');
  const [aRetirar, setARetirar] = useState<InscripcionNomina | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['nomina', String(materiaId), buscar],
    queryFn: async () => {
      const { data } = await api.get<{ nomina: InscripcionNomina[] }>(
        `/api/materias/${materiaId}/nomina`,
        { params: buscar ? { buscar } : {} },
      );
      return data.nomina;
    },
  });

  const retirar = useMutation({
    mutationFn: (inscripcionId: number) =>
      api.post(`/api/materias/${materiaId}/inscripciones/${inscripcionId}/retirar`),
    onMutate: () => setError(''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nomina', String(materiaId)] });
      if (aRetirar) toast({ tone: 'success', titulo: `${aRetirar.estudiante.nombres} retirado de la materia` });
      setARetirar(null);
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h4 className="font-semibold text-text">Nómina{data ? ` (${data.length})` : ''}</h4>
        <Input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar por nombre, código o correo…"
          iconoIzq={<Search size={15} />}
          className="w-72 max-w-full"
        />
      </div>

      {isLoading && <Spinner />}

      {data && data.length === 0 && (
        <p className="text-text-secondary text-sm py-4 text-center">
          {buscar
            ? 'Sin resultados para la búsqueda.'
            : 'Aún no hay estudiantes inscritos. Comparte el código de la materia.'}
        </p>
      )}

      {data && data.length > 0 && (
        <Tabla>
          <Thead>
            <Tr>
              <Th>N°</Th>
              <Th>Código</Th>
              <Th>Apellidos y nombres</Th>
              <Th>Correo</Th>
              <Th>Inscrito el</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {data.map((i, indice) => (
              <Tr key={i.id}>
                <Td className="text-text-disabled">{indice + 1}</Td>
                <Td className="font-mono">{i.codigo_estudiante}</Td>
                <Td>
                  {i.estudiante.apellidos} {i.estudiante.nombres}
                </Td>
                <Td className="text-text-secondary">{i.estudiante.email}</Td>
                <Td className="text-text-secondary">{new Date(i.fecha_inscripcion).toLocaleDateString()}</Td>
                <Td alineado="right">
                  <button
                    onClick={() => setARetirar(i)}
                    disabled={retirar.isPending}
                    className="text-red-600 hover:underline disabled:opacity-50"
                  >
                    Retirar
                  </button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Tabla>
      )}

      {aRetirar && (
        <ModalConfirmarEliminar
          titulo={`Retirar a ${aRetirar.estudiante.apellidos} ${aRetirar.estudiante.nombres}`}
          cuerpo="Perderá acceso a la materia. Su historial se conserva."
          textoBoton="Retirar"
          eliminando={retirar.isPending}
          onConfirmar={() => retirar.mutate(aRetirar.id)}
          onCerrar={() => setARetirar(null)}
        />
      )}
    </div>
  );
}

function ModalNomina({
  materiaId,
  nombreMateria,
  setError,
  onCerrar,
}: {
  materiaId: number;
  nombreMateria: string;
  setError: (msg: string) => void;
  onCerrar: () => void;
}) {
  return (
    <Modal titulo={`Nómina · ${nombreMateria}`} onCerrar={onCerrar} maxWidth="max-w-2xl">
      <SeccionNomina materiaId={materiaId} setError={setError} />
    </Modal>
  );
}

// ── Panel derecho · Accesos ───────────────────────────────────────

function FilaAcceso({ to, titulo, derecha }: { to: string; titulo: string; derecha?: ReactNode }) {
  return (
    <Link to={to} className="flex h-12 items-center justify-between gap-[10px] px-5 transition hover:bg-surface-hover">
      <span className="text-sm font-medium text-text">{titulo}</span>
      {derecha}
    </Link>
  );
}

function PanelAccesos({ materiaId, porcentajeAsistencia }: { materiaId: number; porcentajeAsistencia: number | null }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-neutral-100">
        <FilaAcceso to={`/materias/${materiaId}/evaluaciones`} titulo="Evaluaciones" />
      </div>
      <div className="border-b border-neutral-100">
        <FilaAcceso
          to={`/materias/${materiaId}/asistencia`}
          titulo="Consolidado de asistencia"
          derecha={
            porcentajeAsistencia !== null ? (
              <span className="font-mono text-[12px] text-secondary-700">{porcentajeAsistencia}%</span>
            ) : undefined
          }
        />
      </div>
      <FilaAcceso
        to={`/materias/${materiaId}/centralizador`}
        titulo="Centralizador"
        derecha={<span className="font-mono text-[12px] text-text-muted">›</span>}
      />
    </Card>
  );
}

// ── Página ────────────────────────────────────────────────────────

export function MateriaDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const materiaId = Number(id);

  const [vista, setVista] = useState<'lista' | 'calendario'>(leerVistaGuardada);
  const [error, setError] = useState('');
  const [modalAgregarAbierto, setModalAgregarAbierto] = useState(false);
  const [modalNominaAbierto, setModalNominaAbierto] = useState(false);
  const [claseEditando, setClaseEditando] = useState<Clase | null>(null);
  const [claseEliminando, setClaseEliminando] = useState<Clase | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  function cambiarVista(v: 'lista' | 'calendario') {
    setVista(v);
    try {
      localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      // localStorage puede fallar (modo privado, cuota) — la preferencia
      // simplemente no persiste, no es motivo para romper la pantalla.
    }
  }

  const { data: materia, isLoading, isError } = useQuery({
    queryKey: ['materia', id],
    queryFn: async () => {
      const { data } = await api.get<{ materia: Materia }>(`/api/materias/${id}`);
      return data.materia;
    },
  });

  const { data: clases, isLoading: cargandoClases, isError: errorClases } = useQuery({
    queryKey: ['clases', id],
    queryFn: async () => {
      const { data } = await api.get<{ clases: Clase[] }>(`/api/materias/${id}/clases`);
      return data.clases;
    },
  });

  const { data: nomina } = useQuery({
    queryKey: ['nomina', String(materiaId), ''],
    queryFn: async () => {
      const { data } = await api.get<{ nomina: InscripcionNomina[] }>(`/api/materias/${materiaId}/nomina`);
      return data.nomina;
    },
    enabled: Number.isFinite(materiaId),
  });

  const eliminarClase = useMutation({
    mutationFn: (clase: Clase) => api.delete(`/api/materias/${materiaId}/clases/${clase.id}`),
    onMutate: () => setError(''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clases', String(materiaId)] });
      setClaseEliminando(null);
      toast({ tone: 'success', titulo: 'Clase eliminada' });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  const hoy = new Date().toISOString().slice(0, 10);

  const { deHoy, proximas, pasadas } = useMemo(() => {
    const lista = clases ?? [];
    const deHoy = lista.filter((c) => soloFecha(c.fecha) === hoy).sort((a, b) => a.hora.localeCompare(b.hora));
    const proximas = lista
      .filter((c) => soloFecha(c.fecha) > hoy)
      .sort((a, b) => soloFecha(a.fecha).localeCompare(soloFecha(b.fecha)) || a.hora.localeCompare(b.hora));
    const pasadas = lista
      .filter((c) => soloFecha(c.fecha) < hoy)
      .sort((a, b) => soloFecha(b.fecha).localeCompare(soloFecha(a.fecha)) || b.hora.localeCompare(a.hora));
    return { deHoy, proximas, pasadas };
  }, [clases, hoy]);

  const pasadasSinAsistencia = pasadas.filter((c) => !c.asistencia_tomada).length;

  const porcentajeAsistencia = useMemo(() => {
    if (!clases) return null;
    const conAsistencia = clases.filter((c) => c.asistencia_tomada && c.asistencia_resumen);
    if (conAsistencia.length === 0) return null;
    const presentes = conAsistencia.reduce((s, c) => s + (c.asistencia_resumen?.presentes ?? 0), 0);
    const total = conAsistencia.reduce((s, c) => s + (c.asistencia_resumen?.total ?? 0), 0);
    return total > 0 ? Math.round((presentes / total) * 100) : null;
  }, [clases]);

  function manejarClicEvento(info: EventClickArg) {
    const clase = clases?.find((c) => String(c.id) === info.event.id);
    if (clase) navigate(`/materias/${materiaId}/clases/${clase.id}/asistencia`);
  }

  if (isError) {
    return (
      <Alert tone="danger">No se pudo cargar la materia.</Alert>
    );
  }

  const errorVisible = error || (errorClases ? 'No se pudieron cargar las clases.' : '');

  return (
    <div>
      <div className="flex items-start justify-between gap-5 flex-wrap border-b border-border bg-surface px-6 py-[18px]">
        <div className="flex flex-col gap-[5px]">
          <PageBreadcrumb>
            <Link to="/">‹ Mis materias</Link>
          </PageBreadcrumb>
          {isLoading || !materia ? (
            <>
              <Skeleton className="h-6 w-64" />
              <Skeleton className="mt-1 h-4 w-48" />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold tracking-tight text-text">
                {materia.nombre_materia}
                {materia.sigla && <span className="font-semibold text-text-muted"> ({materia.sigla})</span>}
              </h1>
              <p className="text-[15px] text-text-secondary">
                {materia.carrera} · {materia.semestre} · {materia.universidad}
              </p>
            </>
          )}
        </div>

        <div className="inline-flex h-9 overflow-hidden rounded-[9px] border border-border">
          <button
            type="button"
            onClick={() => cambiarVista('lista')}
            className={cn(
              'px-4 text-[13px]',
              vista === 'lista' ? 'bg-primary-800 font-bold text-white' : 'bg-surface font-medium text-text-secondary',
            )}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => cambiarVista('calendario')}
            className={cn(
              'border-l border-border px-4 text-[13px]',
              vista === 'calendario' ? 'bg-primary-800 font-bold text-white' : 'bg-surface font-medium text-text-secondary',
            )}
          >
            Calendario
          </button>
        </div>
      </div>

      {errorVisible && (
        <div className="px-6 pt-4">
          <Alert tone="danger">{errorVisible}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 px-6 pb-6 pt-[22px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5">
          {vista === 'lista' && (isLoading || cargandoClases) && (
            <>
              <Skeleton className="h-24 rounded-xl" />
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[58px] rounded-xl" />
              ))}
            </>
          )}

          {vista === 'lista' && !isLoading && !cargandoClases && (
            <>
              {deHoy.map((c) => (
                <BloqueHoy
                  key={c.id}
                  clase={c}
                  materiaId={materiaId}
                  onEditar={() => setClaseEditando(c)}
                  onEliminar={() => setClaseEliminando(c)}
                />
              ))}

              {clases && clases.length === 0 ? (
                <EmptyState
                  title="Aún no hay clases"
                  description='Usa "Agregar clases" para crear una o generar el calendario del semestre.'
                  action={<Button onClick={() => setModalAgregarAbierto(true)}>Agregar clases</Button>}
                />
              ) : (
                <>
                  <ListaClases
                    titulo="Próximas"
                    contador={
                      <span className="font-mono text-[12px] text-text-muted">
                        {proximas.length} clase{proximas.length === 1 ? '' : 's'}
                      </span>
                    }
                    clases={proximas}
                    materiaId={materiaId}
                    variante="proxima"
                    onEditar={setClaseEditando}
                    onEliminar={setClaseEliminando}
                  />
                  <ListaClases
                    titulo="Pasadas"
                    contador={
                      pasadasSinAsistencia > 0 ? (
                        <span className="font-mono text-[12px] text-accent-600">
                          {pasadasSinAsistencia} sin asistencia
                        </span>
                      ) : undefined
                    }
                    clases={pasadas}
                    materiaId={materiaId}
                    variante="pasada"
                    onEditar={setClaseEditando}
                    onEliminar={setClaseEliminando}
                  />
                </>
              )}
            </>
          )}

          {vista === 'calendario' && (
            <Card>
              <div className="p-4">
                {clases && clases.length > 0 && (
                  <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    locale={esLocale}
                    height="auto"
                    firstDay={1}
                    dayMaxEventRows={3}
                    events={clases.map((c) => {
                      const pasada = soloFecha(c.fecha) < hoy;
                      return {
                        id: String(c.id),
                        title: `${c.hora} ${c.tema}`,
                        start: soloFecha(c.fecha),
                        allDay: true,
                        classNames:
                          pasada && !c.asistencia_tomada
                            ? ['clase-pasada', 'clase-sin-asistencia']
                            : [pasada ? 'clase-pasada' : 'clase-proxima'],
                      };
                    })}
                    eventClick={manejarClicEvento}
                  />
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5 xl:sticky xl:top-5">
          {isLoading || !materia ? (
            <>
              <Skeleton className="h-32 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-36 rounded-lg" />
            </>
          ) : (
            <>
              <PanelInscripcion materia={materia} setError={setError} />
              <PanelNomina nomina={nomina} onVerNomina={() => setModalNominaAbierto(true)} />
              <PanelAccesos materiaId={materiaId} porcentajeAsistencia={porcentajeAsistencia} />
              <Button variante="secondary" className="h-10 w-full text-sm font-semibold" onClick={() => setModalAgregarAbierto(true)}>
                Agregar clases
              </Button>
            </>
          )}
        </div>
      </div>

      {modalAgregarAbierto && (
        <ModalAgregarClases materiaId={materiaId} onCerrar={() => setModalAgregarAbierto(false)} />
      )}

      {modalNominaAbierto && materia && (
        <ModalNomina
          materiaId={materiaId}
          nombreMateria={materia.nombre_materia}
          setError={setError}
          onCerrar={() => setModalNominaAbierto(false)}
        />
      )}

      {claseEditando && (
        <ModalEditarClase clase={claseEditando} materiaId={materiaId} onCerrar={() => setClaseEditando(null)} />
      )}

      {claseEliminando && (
        <ModalConfirmarEliminar
          titulo={`Eliminar la clase del ${fechaLegible(claseEliminando.fecha)}`}
          cuerpo="Se borra la clase y su asistencia. Las evaluaciones, exámenes y guías vinculados se eliminan con ella."
          textoBoton="Eliminar clase"
          eliminando={eliminarClase.isPending}
          onConfirmar={() => eliminarClase.mutate(claseEliminando)}
          onCerrar={() => setClaseEliminando(null)}
        />
      )}
    </div>
  );
}
