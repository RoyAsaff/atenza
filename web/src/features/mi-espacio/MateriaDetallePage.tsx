// E3 · HU-11 (código de materia) + HU-12 (nómina) — ahora dentro de un
// modal ("Código y nómina"), porque lo primero que se ve al entrar a la
// materia es el calendario de clases (E4, HU-13/14) con "Pasar lista"
// (HU-15) como acción principal al tocar una clase.

import { FormEvent, ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { EventClickArg } from '@fullcalendar/core';
import {
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  ListChecks,
  Plus,
  Search,
  SquareUser,
} from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { Clase, InscripcionNomina, Materia } from '../../core/tipos';
import {
  Badge,
  Button,
  botonClases,
  Card,
  CardBody,
  Input,
  Modal,
  PageHeader,
  Spinner,
  Tabla,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../core/ui/ui';
import './calendario.css';

const DIAS = [
  { iso: 1, texto: 'Lun' },
  { iso: 2, texto: 'Mar' },
  { iso: 3, texto: 'Mié' },
  { iso: 4, texto: 'Jue' },
  { iso: 5, texto: 'Vie' },
  { iso: 6, texto: 'Sáb' },
  { iso: 7, texto: 'Dom' },
];

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

// ── HU-11 · Código de inscripción ────────────────────────────────

function SeccionCodigo({ materia }: { materia: Materia }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  const alTerminar = {
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['materia', String(materia.id)] });
      queryClient.invalidateQueries({ queryKey: ['mi-espacio'] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  };

  const regenerar = useMutation({
    mutationFn: () => api.post(`/api/materias/${materia.id}/codigo/regenerar`),
    ...alTerminar,
  });

  const cambiarEstado = useMutation({
    mutationFn: (activo: boolean) =>
      api.patch(`/api/materias/${materia.id}/codigo`, { activo }),
    ...alTerminar,
  });

  async function copiar() {
    await navigator.clipboard.writeText(materia.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function manejarRegenerar() {
    if (
      window.confirm(
        'El código actual dejará de funcionar y nadie podrá usarlo para inscribirse. ¿Generar uno nuevo?',
      )
    ) {
      regenerar.mutate();
    }
  }

  return (
    <div>
      <h4 className="font-bold text-text mb-1">Código de inscripción</h4>
      <p className="text-sm text-text-secondary mb-3">
        Compártelo con tus estudiantes para que se unan a la materia.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`font-mono text-2xl font-bold tracking-widest ${
            materia.codigo_activo ? 'text-primary-700' : 'text-text-disabled line-through'
          }`}
        >
          {materia.codigo}
        </span>
        <Badge tone={materia.codigo_activo ? 'success' : 'neutral'}>
          {materia.codigo_activo ? 'Inscripciones abiertas' : 'Inscripciones cerradas'}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Button tamano="sm" onClick={copiar}>
          {copiado ? 'Copiado ✓' : 'Copiar código'}
        </Button>
        <Button
          variante="secondary"
          tamano="sm"
          onClick={manejarRegenerar}
          disabled={regenerar.isPending}
        >
          Regenerar
        </Button>
        <Button
          variante="secondary"
          tamano="sm"
          onClick={() => cambiarEstado.mutate(!materia.codigo_activo)}
          disabled={cambiarEstado.isPending}
        >
          {materia.codigo_activo ? 'Cerrar inscripciones' : 'Reabrir inscripciones'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}

// ── HU-12 · Nómina ────────────────────────────────────────────────

function SeccionNomina({ materiaId }: { materiaId: number }) {
  const queryClient = useQueryClient();
  const [buscar, setBuscar] = useState('');
  const [error, setError] = useState('');

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
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['nomina', String(materiaId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  function manejarRetiro(i: InscripcionNomina) {
    if (
      window.confirm(
        `${i.estudiante.apellidos} ${i.estudiante.nombres} perderá acceso a la materia. ` +
          'Su historial se conserva. ¿Retirar?',
      )
    ) {
      retirar.mutate(i.id);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h4 className="font-semibold text-text">
          Nómina{data ? ` (${data.length})` : ''}
        </h4>
        <Input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar por nombre, código o correo…"
          iconoIzq={<Search size={15} />}
          className="w-72 max-w-full"
        />
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
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
                <Td className="text-text-secondary">
                  {new Date(i.fecha_inscripcion).toLocaleDateString()}
                </Td>
                <Td alineado="right">
                  <button
                    onClick={() => manejarRetiro(i)}
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
    </div>
  );
}

// ── Modal "Código y nómina" ───────────────────────────────────────

function ModalCodigoNomina({ materia, onCerrar }: { materia: Materia; onCerrar: () => void }) {
  return (
    <Modal titulo="Código y nómina" onCerrar={onCerrar} maxWidth="max-w-2xl">
      <SeccionCodigo materia={materia} />
      <hr className="my-5 border-border" />
      <SeccionNomina materiaId={materia.id} />
    </Modal>
  );
}

// ── HU-13 · Crear clase individual ───────────────────────────────

function FormNuevaClase({ materiaId }: { materiaId: number }) {
  const queryClient = useQueryClient();
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('08:00');
  const [tema, setTema] = useState('');
  const [error, setError] = useState('');

  const crear = useMutation({
    mutationFn: () =>
      api.post(`/api/materias/${materiaId}/clases`, { fecha, hora, tema }),
    onSuccess: () => {
      setError('');
      setTema('');
      queryClient.invalidateQueries({ queryKey: ['clases', String(materiaId)] });
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
          <Input
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1"
          />
        </label>
        <label className="text-sm text-text-secondary">
          Hora
          <Input
            type="time"
            required
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="mt-1"
          />
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
  const [dias, setDias] = useState<number[]>([]);
  const [hora, setHora] = useState('08:00');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [tema, setTema] = useState('Clase');
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState('');

  const generar = useMutation({
    mutationFn: () =>
      api.post<{ total_creadas: number; omitidas: number }>(
        `/api/materias/${materiaId}/clases/generar`,
        { dias_semana: dias, hora, fecha_inicio: inicio, fecha_fin: fin, tema },
      ),
    onSuccess: ({ data }) => {
      setError('');
      // HU-14 Esc. 1: mostrar el total generado
      setResumen(
        `Se crearon ${data.total_creadas} clases` +
          (data.omitidas > 0
            ? ` (${data.omitidas} omitidas por chocar con clases existentes)`
            : ''),
      );
      queryClient.invalidateQueries({ queryKey: ['clases', String(materiaId)] });
    },
    onError: (err: unknown) => {
      setResumen('');
      setError(mensajeDeError(err));
    },
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
        {DIAS.map((d) => (
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

      {resumen && <p className="text-sm text-secondary-800 mt-3">{resumen}</p>}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </form>
  );
}

// ── Panel de una clase: Pasar lista (acción principal) + editar/eliminar ──

function PanelClase({
  clase,
  materiaId,
  onCerrar,
}: {
  clase: Clase;
  materiaId: number;
  onCerrar: () => void;
}) {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [fecha, setFecha] = useState(soloFecha(clase.fecha));
  const [hora, setHora] = useState(clase.hora);
  const [tema, setTema] = useState(clase.tema);
  const [error, setError] = useState('');

  const alTerminar = {
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['clases', String(materiaId)] });
      onCerrar();
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  };

  const guardar = useMutation({
    mutationFn: () =>
      api.patch(`/api/materias/${materiaId}/clases/${clase.id}`, { fecha, hora, tema }),
    ...alTerminar,
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/api/materias/${materiaId}/clases/${clase.id}`),
    ...alTerminar,
  });

  function manejarEliminar() {
    if (
      window.confirm(
        `Se eliminará la clase del ${fechaLegible(clase.fecha)} (${clase.hora}). ¿Continuar?`,
      )
    ) {
      eliminar.mutate();
    }
  }

  return (
    <Modal
      titulo={editando ? 'Editar clase' : `${clase.hora} · ${clase.tema}`}
      eyebrow={!editando ? <span className="capitalize">{fechaLegible(clase.fecha)}</span> : undefined}
      onCerrar={onCerrar}
      maxWidth="max-w-md"
    >
      {!editando ? (
        <>
          <Link
            to={`/materias/${materiaId}/clases/${clase.id}/asistencia`}
            onClick={onCerrar}
            className={botonClases('primary', 'lg') + ' w-full'}
          >
            <ClipboardCheck size={18} /> Pasar lista
          </Link>

          <Link
            to={`/materias/${materiaId}/clases/${clase.id}/evaluaciones`}
            onClick={onCerrar}
            className={botonClases('secondary', 'md') + ' mt-2 w-full'}
          >
            <ListChecks size={16} /> Evaluaciones
          </Link>

          <div className="mt-3 flex gap-3">
            <Button variante="secondary" className="flex-1" onClick={() => setEditando(true)}>
              Editar
            </Button>
            <Button
              variante="danger"
              className="flex-1 border border-red-200"
              onClick={manejarEliminar}
              disabled={eliminar.isPending}
            >
              Eliminar
            </Button>
          </div>
          <button
            onClick={onCerrar}
            className="mt-3 w-full text-sm text-text-disabled hover:text-text-secondary"
          >
            Cerrar
          </button>
        </>
      ) : (
        <>
          <div className="space-y-3">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            <Input value={tema} onChange={(e) => setTema(e.target.value)} />
          </div>
          <div className="mt-4 flex gap-3">
            <Button className="flex-1" onClick={() => guardar.mutate()} disabled={guardar.isPending}>
              Guardar
            </Button>
            <Button variante="secondary" className="flex-1" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </div>
        </>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

// ── Modal "+ Agregar clases": pestañas individual / generar varias ──

function ModalAgregarClases({
  materiaId,
  onCerrar,
}: {
  materiaId: number;
  onCerrar: () => void;
}) {
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

function TarjetaAccion({
  icono,
  titulo,
  descripcion,
  to,
  onClick,
}: {
  icono: ReactNode;
  titulo: string;
  descripcion: string;
  to?: string;
  onClick?: () => void;
}) {
  const clases =
    'flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-xs transition hover:border-primary-200 hover:bg-primary-50/60';
  const contenido = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
        {icono}
      </span>
      <span>
        <span className="block text-sm font-semibold text-text">{titulo}</span>
        <span className="block text-xs text-text-secondary">{descripcion}</span>
      </span>
    </>
  );
  return to ? (
    <Link to={to} className={clases}>
      {contenido}
    </Link>
  ) : (
    <button onClick={onClick} className={clases}>
      {contenido}
    </button>
  );
}

export function MateriaDetallePage() {
  const { id } = useParams();
  const [claseSeleccionada, setClaseSeleccionada] = useState<Clase | null>(null);
  const [modalAgregarAbierto, setModalAgregarAbierto] = useState(false);
  const [modalCodigoNominaAbierto, setModalCodigoNominaAbierto] = useState(false);

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

  const materiaId = Number(id);
  const hoy = new Date().toISOString().slice(0, 10);

  function manejarClicEvento(info: EventClickArg) {
    const clase = clases?.find((c) => String(c.id) === info.event.id) ?? null;
    setClaseSeleccionada(clase);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-5 text-text-secondary">
        <Spinner /> Cargando…
      </div>
    );
  }
  if (isError || !materia) {
    return (
      <p className="rounded-lg border border-red-100 bg-red-50 p-5 text-red-600">
        No se pudo cargar la materia.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          to="/"
          className="text-sm font-medium text-primary-700 hover:text-primary-800 hover:underline"
        >
          ← Mis materias
        </Link>
        <div className="mt-1">
          <PageHeader
            title={`${materia.nombre_materia}${materia.sigla ? ` (${materia.sigla})` : ''}`}
            description={`${materia.carrera} · ${materia.semestre} · ${materia.universidad}`}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <TarjetaAccion
            icono={<SquareUser size={18} />}
            titulo="Código y nómina"
            descripcion="Compartir código, ver inscritos"
            onClick={() => setModalCodigoNominaAbierto(true)}
          />
          <TarjetaAccion
            icono={<ListChecks size={18} />}
            titulo="Evaluaciones"
            descripcion="Todas las evaluaciones de la materia"
            to={`/materias/${materia.id}/evaluaciones`}
          />
          <TarjetaAccion
            icono={<ClipboardList size={18} />}
            titulo="Consolidado de asistencia"
            descripcion="Totales y % por estudiante"
            to={`/materias/${materia.id}/asistencia`}
          />
          <TarjetaAccion
            icono={<FileSpreadsheet size={18} />}
            titulo="Centralizador"
            descripcion="Notas de todas las evaluaciones"
            to={`/materias/${materia.id}/centralizador`}
          />
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-text">
              Calendario{clases ? ` (${clases.length} clases)` : ''}
            </h2>
            <Button onClick={() => setModalAgregarAbierto(true)}>
              <Plus size={16} /> Agregar clases
            </Button>
          </div>
          <p className="text-sm text-text-secondary mb-3">
            Toca una clase para pasar lista, editarla o eliminarla.
          </p>

          {cargandoClases && <Spinner />}
          {errorClases && <p className="text-red-600">No se pudieron cargar las clases.</p>}

          {clases && clases.length === 0 && (
            <p className="text-text-secondary text-sm py-4 text-center">
              Aún no hay clases. Usa "+ Agregar clases" para crear una o generar el
              calendario del semestre.
            </p>
          )}

          {clases && clases.length > 0 && (
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale={esLocale}
              height="auto"
              firstDay={1}
              dayMaxEventRows={3}
              events={clases.map((c) => ({
                id: String(c.id),
                title: `${c.hora} ${c.tema}`,
                start: soloFecha(c.fecha),
                allDay: true,
                classNames: [soloFecha(c.fecha) < hoy ? 'clase-pasada' : 'clase-proxima'],
              }))}
              eventClick={manejarClicEvento}
            />
          )}
        </CardBody>
      </Card>

      {claseSeleccionada && (
        <PanelClase
          clase={claseSeleccionada}
          materiaId={materiaId}
          onCerrar={() => setClaseSeleccionada(null)}
        />
      )}

      {modalAgregarAbierto && (
        <ModalAgregarClases
          materiaId={materiaId}
          onCerrar={() => setModalAgregarAbierto(false)}
        />
      )}

      {modalCodigoNominaAbierto && (
        <ModalCodigoNomina
          materia={materia}
          onCerrar={() => setModalCodigoNominaAbierto(false)}
        />
      )}
    </div>
  );
}
