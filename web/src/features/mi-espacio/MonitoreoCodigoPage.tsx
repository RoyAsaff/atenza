// E9 · Monitoreo en vivo de un examen de código — calcado de
// MonitoreoPage.tsx (E7), con progreso = ejercicios enviados/total en vez
// de preguntas respondidas, y los 3 tipos de incidente que reporta la app
// de escritorio (pérdida de foco, ventana minimizada, intento de cierre).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Info, MoreHorizontal } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { obtenerSocket } from '../../core/realtime/socket';
import { EstadoEvaluacion, EstadoIntento, ExamenCodigo, FilaMonitoreoCodigo, Materia } from '../../core/tipos';
import { Alert, Dropdown, DropdownItem, DropdownSeparator, IconButton, PageBreadcrumb, cn } from '../../core/ui/ui';

const ESTADO_EXAMEN_TEXTO: Record<EstadoEvaluacion, string> = {
  borrador: 'Borrador',
  lista: 'Lista',
  lanzada: 'Lanzada',
  finalizada: 'Finalizada',
};

const TIPO_INCIDENTE_TEXTO: Record<string, string> = {
  perdida_foco: 'perdió el foco de la ventana',
  ventana_minimizada: 'minimizó la ventana',
  intento_cierre: 'intentó cerrar la ventana',
};

const DURACION_ALERTA_MS = 20000;
const MAX_ITEMS_BITACORA = 100;

type Filtro = 'todos' | 'incidentes' | 'desconectados' | 'pausados' | 'en_curso' | 'finalizados';

const FILTROS: { clave: Filtro; etiqueta: string }[] = [
  { clave: 'todos', etiqueta: 'Todos' },
  { clave: 'incidentes', etiqueta: 'Con incidentes' },
  { clave: 'desconectados', etiqueta: 'Desconectado' },
  { clave: 'pausados', etiqueta: 'Pausados' },
  { clave: 'en_curso', etiqueta: 'En curso' },
  { clave: 'finalizados', etiqueta: 'Finalizados' },
];

const COLOR_NUMERO_FILTRO: Record<Filtro, string> = {
  todos: 'text-text',
  incidentes: 'text-accent-700',
  desconectados: 'text-text-secondary',
  pausados: 'text-text-secondary',
  en_curso: 'text-text-secondary',
  finalizados: 'text-secondary-700',
};

interface ItemIncidente {
  id: number;
  nombre: string;
  texto: string;
  hora: string;
  vez: number;
  nuevo: boolean;
}

function reproducirSonidoAlerta() {
  try {
    const ContextoAudio = window.AudioContext ?? (window as any).webkitAudioContext;
    const ctx = new ContextoAudio();
    const ahora = ctx.currentTime;
    [0, 0.18].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ahora + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, ahora + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ahora + offset + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ahora + offset);
      osc.stop(ahora + offset + 0.16);
    });
  } catch {
    // Autoplay bloqueado u otro problema de audio: no hay mucho más que hacer.
  }
}

const ESTADOS_TIEMPO_DETENIDO: EstadoIntento[] = ['finalizado', 'cancelado'];

function formatearTiempo(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = String(Math.floor((segundos % 3600) / 60)).padStart(2, '0');
  const s = String(segundos % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function formatearHora(fechaIso: string): string {
  return new Date(fechaIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function TiempoFila({ fila }: { fila: FilaMonitoreoCodigo }) {
  const [, forzarTick] = useState(0);
  const detenido = ESTADOS_TIEMPO_DETENIDO.includes(fila.estado);

  useEffect(() => {
    if (detenido) return;
    const id = setInterval(() => forzarTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [detenido]);

  if (detenido) {
    return <span className="text-text-disabled">—</span>;
  }

  if (fila.fecha_limite) {
    const restante = Math.max(
      0,
      Math.round((new Date(fila.fecha_limite).getTime() - Date.now()) / 1000),
    );
    return <span className={restante < 60 ? 'font-medium text-red-600' : ''}>{formatearTiempo(restante)}</span>;
  }

  const transcurrido = Math.max(
    0,
    Math.round((Date.now() - new Date(fila.fecha_inicio).getTime()) / 1000),
  );
  return <span>{formatearTiempo(transcurrido)}</span>;
}

function useRelojGlobal(filas: FilaMonitoreoCodigo[] | undefined) {
  const [, forzarTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forzarTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    if (!filas || filas.length === 0) return null;

    const activas = filas.filter((f) => f.estado !== 'finalizado' && f.estado !== 'cancelado');
    const fuente = activas.length > 0 ? activas : filas;
    const limites = fuente.map((f) => f.fecha_limite).filter((f): f is string => Boolean(f));

    if (limites.length > 0) {
      const maxLimiteMs = Math.max(...limites.map((l) => new Date(l).getTime()));
      const restante = Math.max(0, Math.round((maxLimiteMs - Date.now()) / 1000));
      const cierre = new Date(maxLimiteMs).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return { tiempo: formatearTiempo(restante), subtexto: `Cierra ${cierre}` };
    }

    const minInicioMs = Math.min(...filas.map((f) => new Date(f.fecha_inicio).getTime()));
    const transcurrido = Math.max(0, Math.round((Date.now() - minInicioMs) / 1000));
    return { tiempo: formatearTiempo(transcurrido), subtexto: 'Sin tiempo límite' };
  }, [filas]);
}

function grupoDeFila(fila: FilaMonitoreoCodigo): number {
  if (fila.incidentes > 0) return 0;
  if (fila.estado === 'desconectado') return 1;
  if (fila.estado === 'pausado') return 2;
  if (fila.estado === 'en_curso') return 3;
  return 4; // finalizado / cancelado
}

function coincideFiltro(fila: FilaMonitoreoCodigo, filtro: Filtro): boolean {
  switch (filtro) {
    case 'todos':
      return true;
    case 'incidentes':
      return fila.incidentes > 0;
    case 'desconectados':
      return fila.estado === 'desconectado';
    case 'pausados':
      return fila.estado === 'pausado';
    case 'en_curso':
      return fila.estado === 'en_curso';
    case 'finalizados':
      return fila.estado === 'finalizado' || fila.estado === 'cancelado';
  }
}

const SUFIJO_ESTADO: Partial<Record<EstadoIntento, { texto: string; className: string }>> = {
  pausado: { texto: 'pausado', className: 'text-accent-700' },
  desconectado: { texto: 'desconectado', className: 'text-text-muted' },
  finalizado: { texto: 'entregó', className: 'text-secondary-700' },
  cancelado: { texto: 'cancelado', className: 'text-text-muted' },
};

function FilaEstudiante({
  fila,
  materiaId,
  examenId,
  mostrarAccion,
}: {
  fila: FilaMonitoreoCodigo;
  materiaId: number;
  examenId: number;
  mostrarAccion: boolean;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const alTerminar = {
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['monitoreo-codigo', String(examenId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  };

  const pausar = useMutation({
    mutationFn: () =>
      api.post(
        `/api/materias/${materiaId}/examenes-codigo/${examenId}/intentos/${fila.intento_id}/pausar`,
      ),
    ...alTerminar,
  });

  const reactivar = useMutation({
    mutationFn: () =>
      api.post(
        `/api/materias/${materiaId}/examenes-codigo/${examenId}/intentos/${fila.intento_id}/reactivar`,
      ),
    ...alTerminar,
  });

  const tieneIncidentes = fila.incidentes > 0;
  const finalizado = fila.estado === 'finalizado' || fila.estado === 'cancelado';
  const sufijo = SUFIJO_ESTADO[fila.estado];
  const pct = fila.total_ejercicios > 0 ? Math.min(100, (fila.ejercicios_enviados / fila.total_ejercicios) * 100) : 0;
  const barraColor = finalizado
    ? 'bg-secondary-700'
    : fila.estado === 'pausado' || fila.estado === 'desconectado'
      ? 'bg-neutral-400'
      : 'bg-primary-800';

  return (
    <tr
      className={cn(
        'border-b border-neutral-100 last:border-b-0',
        tieneIncidentes
          ? 'border-l-[3px] border-l-accent-600 bg-accent-50'
          : finalizado
            ? 'bg-secondary-50'
            : 'transition hover:bg-surface-hover',
      )}
    >
      <td
        className={cn(
          'py-2 text-[14px]',
          tieneIncidentes ? 'pl-[13px] pr-4' : 'px-4',
          finalizado ? 'text-text-secondary' : 'text-text',
        )}
      >
        <span className="font-semibold">
          {fila.apellidos}, {fila.nombres}
        </span>
        {sufijo && <span className={cn('ml-1.5 text-[12px] font-semibold', sufijo.className)}>· {sufijo.texto}</span>}
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-[9px]">
          <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div
              className={cn('h-full rounded-full', barraColor)}
              style={{ width: `${pct}%`, transition: 'width var(--duration-base) var(--ease-atenza)' }}
            />
          </div>
          <span className="shrink-0 font-mono text-[12px] text-text-secondary">
            {fila.ejercicios_enviados}/{fila.total_ejercicios}
          </span>
        </div>
      </td>
      <td className="px-4 py-2 font-mono text-[12px] text-text-secondary">
        <TiempoFila fila={fila} />
      </td>
      <td className="px-4 py-2">
        {tieneIncidentes ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2 py-[2px] text-[11px] font-bold text-accent-700">
            <AlertTriangle size={11} />
            {fila.incidentes} {fila.incidentes === 1 ? 'incidente' : 'incidentes'}
          </span>
        ) : (
          <span className="font-mono text-[12px] text-text-disabled">—</span>
        )}
      </td>
      {mostrarAccion && (
        <td className="px-4 py-2 text-right">
          {(fila.estado === 'en_curso' || fila.estado === 'desconectado') && (
            <button
              onClick={() => pausar.mutate()}
              disabled={pausar.isPending}
              className="text-[13px] font-semibold text-accent-700 hover:text-accent-800 disabled:opacity-50"
            >
              Pausar
            </button>
          )}
          {fila.estado === 'pausado' && (
            <button
              onClick={() => reactivar.mutate()}
              disabled={reactivar.isPending}
              className="text-[13px] font-semibold text-link hover:text-primary-800 disabled:opacity-50"
            >
              Reactivar
            </button>
          )}
          {error && <p className="mt-0.5 text-[11px] text-red-600">{error}</p>}
        </td>
      )}
    </tr>
  );
}

function FranjaContadores({
  conteos,
  filtro,
  onFiltro,
}: {
  conteos: Record<Filtro, number>;
  filtro: Filtro;
  onFiltro: (f: Filtro) => void;
}) {
  return (
    <div className="flex snap-x overflow-x-auto border-b border-border bg-surface px-[22px]">
      {FILTROS.map(({ clave, etiqueta }) => {
        const activa = filtro === clave;
        const valor = conteos[clave];
        return (
          <button
            key={clave}
            type="button"
            onClick={() => onFiltro(clave)}
            className={cn(
              'flex shrink-0 snap-start items-baseline gap-[7px] py-[11px] pr-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              activa && 'shadow-[inset_0_-2px_0] shadow-primary-800',
            )}
          >
            <span className={cn('text-[19px] font-extrabold', valor === 0 ? 'text-text-disabled' : COLOR_NUMERO_FILTRO[clave])}>
              {valor}
            </span>
            <span className={cn('text-[13px]', activa ? 'font-semibold text-text' : 'text-text-muted')}>{etiqueta}</span>
          </button>
        );
      })}
    </div>
  );
}

function BitacoraIncidentes({ items }: { items: ItemIncidente[] }) {
  return (
    <div className="flex flex-col gap-[14px]">
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-[15px] py-3">
          <p className="flex items-center gap-1.5 text-sm font-bold text-text">
            <AlertTriangle size={14} className="text-accent-700" />
            Incidentes
          </p>
          <span className="inline-flex items-center rounded-full bg-accent-50 px-2 py-[2px] text-[11px] font-bold text-accent-700">
            {items.length}
          </span>
        </div>
        {items.length === 0 ? (
          <p className="px-[15px] py-6 text-center text-sm text-text-muted">Sin incidentes hasta ahora.</p>
        ) : (
          <div className="max-h-[260px] overflow-y-auto xl:max-h-none xl:overflow-visible">
            {items.map((item, i) => (
              <div
                key={item.id}
                className={cn(
                  'flex gap-[9px] px-[15px] py-[11px]',
                  i < items.length - 1 && 'border-b border-neutral-100',
                  item.nuevo && 'bg-accent-50',
                )}
                style={{ transition: 'background-color var(--duration-base) var(--ease-atenza)' }}
              >
                <span
                  className={cn(
                    'shrink-0 pt-0.5 font-mono text-[11px]',
                    item.nuevo ? 'text-accent-700' : 'text-text-disabled',
                  )}
                >
                  {item.hora}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] leading-[1.45] text-text-secondary">
                    <strong className="font-semibold text-text">{item.nombre}</strong> {item.texto}
                  </p>
                  {item.vez > 1 && <p className="mt-0.5 text-[12px] text-accent-700">{item.vez}ª vez en este examen</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-[13px] leading-[1.5] text-text-muted">
        El registro se llena desde que abriste esta pantalla.
      </p>
    </div>
  );
}

function EsqueletoMonitoreo() {
  return (
    <div className="animate-pulse">
      <div className="flex gap-4 border-b border-border bg-surface px-[22px] py-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-6 w-20 rounded bg-neutral-100" />
        ))}
      </div>
      <div className="mt-[18px] overflow-hidden rounded-xl border border-border bg-surface">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex h-9 items-center gap-4 border-b border-neutral-100 px-4 last:border-b-0">
            <div className="h-3 flex-1 rounded bg-neutral-100" />
            <div className="h-3 w-[136px] rounded bg-neutral-100" />
            <div className="h-3 w-[42px] rounded bg-neutral-100" />
            <div className="h-3 w-[64px] rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonitoreoCodigoPage() {
  const { id, examenId } = useParams();
  const materiaId = Number(id);
  const examenCodigoId = Number(examenId);
  const queryClient = useQueryClient();
  const [errorAccion, setErrorAccion] = useState('');
  const [incidentes, setIncidentes] = useState<ItemIncidente[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const incidenteIdRef = useRef(0);

  const { data: examen } = useQuery({
    queryKey: ['examen-codigo', String(examenCodigoId)],
    queryFn: async () => {
      const { data } = await api.get<{ examen: ExamenCodigo }>(
        `/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}`,
      );
      return data.examen;
    },
  });

  const { data: materia } = useQuery({
    queryKey: ['materia', String(materiaId)],
    queryFn: async () => {
      const { data } = await api.get<{ materia: Materia }>(`/api/materias/${materiaId}`);
      return data.materia;
    },
  });

  const {
    data: monitoreo,
    dataUpdatedAt,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['monitoreo-codigo', String(examenCodigoId)],
    queryFn: async () => {
      const { data } = await api.get<{ monitoreo: FilaMonitoreoCodigo[] }>(
        `/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}/monitoreo`,
      );
      return data.monitoreo;
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    const socket = obtenerSocket();
    const claveMonitoreo = ['monitoreo-codigo', String(examenCodigoId)];

    const unirseASala = () => {
      setConectado(true);
      socket.emit('monitorear-examen-codigo', examenCodigoId);
      queryClient.invalidateQueries({ queryKey: claveMonitoreo });
    };
    unirseASala();
    socket.on('connect', unirseASala);

    const alDesconectar = () => setConectado(false);
    socket.on('disconnect', alDesconectar);

    const parcharFila = (intento_id: number, cambios: Partial<FilaMonitoreoCodigo>) => {
      queryClient.setQueryData<FilaMonitoreoCodigo[]>(claveMonitoreo, (prev) =>
        prev?.map((f) => (f.intento_id === intento_id ? { ...f, ...cambios } : f)),
      );
    };

    const alProgreso = (payload: { intento_id: number; ejercicios_enviados: number }) => {
      parcharFila(payload.intento_id, { ejercicios_enviados: payload.ejercicios_enviados });
    };

    const alIntentoActualizado = (payload: { intento_id: number; estado: FilaMonitoreoCodigo['estado'] }) => {
      parcharFila(payload.intento_id, { estado: payload.estado });
    };

    const alEstadoActualizado = () => {
      queryClient.invalidateQueries({ queryKey: claveMonitoreo });
      queryClient.invalidateQueries({ queryKey: ['examen-codigo', String(examenCodigoId)] });
    };

    const alIncidente = (payload: {
      intento_id: number;
      tipo: string;
      fecha_hora: string;
      incidentes: number;
    }) => {
      const filas = queryClient.getQueryData<FilaMonitoreoCodigo[]>(claveMonitoreo);
      const fila = filas?.find((f) => f.intento_id === payload.intento_id);
      const itemId = ++incidenteIdRef.current;
      setIncidentes((prev) =>
        [
          {
            id: itemId,
            nombre: fila ? `${fila.apellidos}, ${fila.nombres}` : `Intento #${payload.intento_id}`,
            texto: TIPO_INCIDENTE_TEXTO[payload.tipo] ?? 'reportó un incidente',
            hora: formatearHora(payload.fecha_hora),
            vez: payload.incidentes,
            nuevo: true,
          },
          ...prev,
        ].slice(0, MAX_ITEMS_BITACORA),
      );
      reproducirSonidoAlerta();
      setTimeout(() => {
        setIncidentes((prev) => prev.map((it) => (it.id === itemId ? { ...it, nuevo: false } : it)));
      }, DURACION_ALERTA_MS);
      parcharFila(payload.intento_id, { incidentes: payload.incidentes });
    };

    socket.on('progreso', alProgreso);
    socket.on('incidente', alIncidente);
    socket.on('intento-actualizado', alIntentoActualizado);
    socket.on('estado-actualizado', alEstadoActualizado);

    return () => {
      socket.off('connect', unirseASala);
      socket.off('disconnect', alDesconectar);
      socket.off('progreso', alProgreso);
      socket.off('incidente', alIncidente);
      socket.off('intento-actualizado', alIntentoActualizado);
      socket.off('estado-actualizado', alEstadoActualizado);
    };
  }, [examenCodigoId, queryClient]);

  const alTerminarGlobal = {
    onSuccess: () => {
      setErrorAccion('');
      queryClient.invalidateQueries({ queryKey: ['monitoreo-codigo', String(examenCodigoId)] });
      queryClient.invalidateQueries({ queryKey: ['examen-codigo', String(examenCodigoId)] });
    },
    onError: (err: unknown) => setErrorAccion(mensajeDeError(err)),
  };

  const pausarTodo = useMutation({
    mutationFn: () => api.post(`/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}/pausar`),
    ...alTerminarGlobal,
  });
  const reactivarTodo = useMutation({
    mutationFn: () => api.post(`/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}/reactivar`),
    ...alTerminarGlobal,
  });
  const cancelar = useMutation({
    mutationFn: () => api.post(`/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}/cancelar`),
    ...alTerminarGlobal,
  });

  function manejarCancelar() {
    if (
      window.confirm(
        'Se cerrará el examen para todo el curso. Las respuestas ya guardadas se conservan. ¿Continuar?',
      )
    ) {
      cancelar.mutate();
    }
  }

  const reloj = useRelojGlobal(monitoreo);

  const todoPausado = useMemo(() => {
    const filas = monitoreo ?? [];
    const activos = filas.filter(
      (f) => f.estado === 'en_curso' || f.estado === 'pausado' || f.estado === 'desconectado',
    );
    return activos.length > 0 && activos.every((f) => f.estado === 'pausado');
  }, [monitoreo]);

  const conteos = useMemo<Record<Filtro, number>>(() => {
    const filas = monitoreo ?? [];
    return {
      todos: filas.length,
      incidentes: filas.filter((f) => f.incidentes > 0).length,
      desconectados: filas.filter((f) => f.estado === 'desconectado').length,
      pausados: filas.filter((f) => f.estado === 'pausado').length,
      en_curso: filas.filter((f) => f.estado === 'en_curso').length,
      finalizados: filas.filter((f) => f.estado === 'finalizado' || f.estado === 'cancelado').length,
    };
  }, [monitoreo]);

  const filasOrdenadas = useMemo(() => {
    const filas = monitoreo ?? [];
    return [...filas].sort((a, b) => {
      const ga = grupoDeFila(a);
      const gb = grupoDeFila(b);
      if (ga !== gb) return ga - gb;
      if (ga === 0 && a.incidentes !== b.incidentes) return b.incidentes - a.incidentes;
      return a.apellidos.localeCompare(b.apellidos, 'es');
    });
  }, [monitoreo]);

  const filasFiltradas = useMemo(
    () => filasOrdenadas.filter((f) => coincideFiltro(f, filtro)),
    [filasOrdenadas, filtro],
  );

  const enVivo = examen?.estado === 'lanzada';
  const mostrarAccion = enVivo === true;
  const estadoTexto = enVivo
    ? conectado
      ? 'En vivo · lanzada'
      : 'Reconectando… · lanzada'
    : examen
      ? ESTADO_EXAMEN_TEXTO[examen.estado]
      : '';
  const puntoClase = enVivo ? (conectado ? 'bg-secondary-500' : 'bg-accent-600') : 'bg-neutral-300';
  const estadoTextoClase = enVivo ? (conectado ? 'text-secondary-700' : 'text-accent-700') : 'text-text-muted';

  return (
    <div>
      <PageBreadcrumb>
        <Link to={`/materias/${id}/examenes-codigo/${examenId}`}>‹ {examen?.tema ?? 'Examen de código'}</Link>
      </PageBreadcrumb>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex items-center gap-5 bg-surface px-[22px] py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn('h-[7px] w-[7px] shrink-0 rounded-full', puntoClase)} />
              <p className={cn('font-mono text-[10px] font-medium uppercase tracking-[0.1em]', estadoTextoClase)}>
                {estadoTexto}
              </p>
            </div>
            <h1 className="mt-[5px] truncate text-[19px] font-extrabold tracking-tight text-text">
              {examen?.tema}
              {materia && <span className="text-text-secondary"> · {materia.nombre_materia}</span>}
            </h1>
          </div>

          {enVivo && reloj && (
            <div className="flex shrink-0 flex-col items-end">
              <p className={cn('font-mono text-2xl font-medium', conectado ? 'text-text' : 'text-text-muted')}>
                {reloj.tiempo}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-text-muted">{reloj.subtexto}</p>
            </div>
          )}

          {enVivo && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => (todoPausado ? reactivarTodo.mutate() : pausarTodo.mutate())}
                disabled={pausarTodo.isPending || reactivarTodo.isPending}
                className="rounded-lg bg-primary-800 px-[17px] py-2.5 text-sm font-bold text-white transition hover:bg-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {todoPausado ? 'Reactivar todo' : 'Pausar todo'}
              </button>
              <Dropdown
                trigger={() => (
                  <IconButton
                    aria-label="Más acciones"
                    variante="secondary"
                    className="h-[38px] w-[38px] rounded-lg text-text-secondary"
                  >
                    <MoreHorizontal size={18} />
                  </IconButton>
                )}
              >
                {todoPausado ? (
                  <DropdownItem onSelect={() => pausarTodo.mutate()}>Pausar todo</DropdownItem>
                ) : (
                  <DropdownItem onSelect={() => reactivarTodo.mutate()}>Reactivar todo</DropdownItem>
                )}
                <DropdownSeparator />
                <DropdownItem peligro onSelect={manejarCancelar}>
                  Cancelar examen
                </DropdownItem>
              </Dropdown>
            </div>
          )}
        </div>

        {monitoreo && monitoreo.length > 0 && (
          <FranjaContadores conteos={conteos} filtro={filtro} onFiltro={setFiltro} />
        )}
      </div>

      {errorAccion && <p className="mt-2 text-sm text-red-600">{errorAccion}</p>}

      {examen && examen.estado !== 'lanzada' && (
        <Alert tone="info" icon={<Info size={16} />} className="mt-[18px]">
          Este examen no está en curso; el monitoreo solo se actualiza mientras está Lanzado.
        </Alert>
      )}

      {isLoading && <EsqueletoMonitoreo />}
      {isError && <p className="mt-[18px] text-sm text-red-600">No se pudo cargar el monitoreo.</p>}

      {monitoreo && monitoreo.length === 0 && (
        <p className="mt-[18px] py-8 text-center text-sm text-text-secondary">
          Todavía no hay estudiantes convocados a este examen.
        </p>
      )}

      {monitoreo && monitoreo.length > 0 && (
        <div className="mt-[18px] grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col />
                <col style={{ width: 168 }} />
                <col style={{ width: 74 }} />
                <col style={{ width: 96 }} />
                {mostrarAccion && <col style={{ width: 76 }} />}
              </colgroup>
              <thead className="border-b border-border bg-neutral-50">
                <tr>
                  <th className="px-4 py-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                    Estudiante
                  </th>
                  <th className="px-4 py-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                    Ejercicios
                  </th>
                  <th className="px-4 py-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                    Tiempo
                  </th>
                  <th className="px-4 py-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
                    Incidentes
                  </th>
                  {mostrarAccion && <th className="px-4 py-[9px]" />}
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.map((fila) => (
                  <FilaEstudiante
                    key={fila.intento_id}
                    fila={fila}
                    materiaId={materiaId}
                    examenId={examenCodigoId}
                    mostrarAccion={mostrarAccion}
                  />
                ))}
              </tbody>
            </table>
            <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-[9px]">
              <p className="font-mono text-[11px] tracking-[0.04em] text-text-disabled">
                {filasFiltradas.length} {filasFiltradas.length === 1 ? 'estudiante' : 'estudiantes'} · actualizado{' '}
                {dataUpdatedAt
                  ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                  : '—'}
              </p>
            </div>
          </div>

          <BitacoraIncidentes items={incidentes} />
        </div>
      )}
    </div>
  );
}
