// Pantalla de examen — calcado de web/src/features/examen/RendirExamenPage.tsx
// (E7, opción múltiple) pero para ejercicios de código: un editor Monaco
// por ejercicio con "Ejecutar" (casos visibles, no persiste) y "Enviar"
// (todos los casos, persiste y califica) en vez de elegir una opción.
//
// El modo kiosko usa la ventana nativa de Tauri (useModoKiosko) en vez de
// la Fullscreen/Visibility API del navegador — mismo principio de fondo
// (detectar y avisar, nunca bloquear solo, HU-21).
//
// Nota sobre "autosave" (plan de E9, sección Editor): el backend NO tiene
// un endpoint de guardado-sin-calificar — "Ejecutar" corre pero no
// persiste, "Enviar" persiste PERO también corre TODOS los casos
// (incluidos ocultos) y cuenta como entrega calificable de ese ejercicio.
// No hay forma de "autosave" cada 15s sin gastar una corrida de sandbox y
// marcar el ejercicio como entregado de nuevo cada vez — así que v1 no
// autoguarda: el código vive en memoria hasta que el estudiante aprieta
// "Ejecutar" o "Enviar" explícitamente. Ver E9 memory para el seguimiento.

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Editor from '@monaco-editor/react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardX,
  Lock,
  PauseCircle,
  Play,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { obtenerSocket } from '../../core/realtime/socket';
import { useAuth } from '../../core/auth/AuthContext';
import { useModoKiosko } from '../../core/kiosco/useModoKiosko';
import {
  EjercicioParaRendir,
  IntentoCodigoParaRendir,
  ResultadoCaso,
  ResultadoEnvio,
  TipoIncidenteCodigo,
} from '../../core/tipos';
import { Button, cn } from '../../core/ui';

const EVENTOS_SOCKET_REFRESCAR = [
  'examen-codigo-lanzado',
  'examen-codigo-pausado',
  'examen-codigo-reactivado',
] as const;

const CINCO_MINUTOS = 300;

const TEXTO_INCIDENTE: Record<TipoIncidenteCodigo, string> = {
  perdida_foco: 'Perdiste el foco de la ventana',
  ventana_minimizada: 'Minimizaste la ventana',
  intento_cierre: 'Intentaste cerrar la ventana',
};

function formatearRestante(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = String(Math.floor((segundos % 3600) / 60)).padStart(2, '0');
  const s = String(segundos % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

// ── Pantallas auxiliares ─────────────────────────────────────────────

function PantallaSinExamen({ onSalir }: { onSalir: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8 text-center shadow-md">
        <ClipboardX size={40} className="mx-auto mb-3 text-text-disabled" />
        <h1 className="text-lg font-bold text-text">No tienes ningún examen activo</h1>
        <p className="mt-1 mb-6 text-sm text-text-secondary">
          Cuando tu docente lance un examen de código, aparecerá acá automáticamente — deja la
          app abierta.
        </p>
        <Button variante="secondary" onClick={onSalir}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}

function PantallaPausada() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary-900 px-6 text-center text-white">
      <PauseCircle size={56} className="mb-4 text-accent-400" />
      <h1 className="text-lg font-bold">El docente pausó tu examen</h1>
      <p className="mt-2 max-w-sm text-sm text-white/70">
        Espera: continuarás exactamente donde quedaste en cuanto te reactive.
      </p>
    </div>
  );
}

function PantallaCancelado({ onAceptar }: { onAceptar: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary-900 px-6 text-center text-white">
      <ShieldAlert size={56} className="mb-4 text-accent-400" />
      <h1 className="text-lg font-bold">El docente canceló el examen</h1>
      <p className="mt-2 max-w-sm text-sm text-white/70">
        Tus ejercicios ya enviados quedaron registrados.
      </p>
      <Button variante="accent" className="mt-6" onClick={onAceptar}>
        Aceptar
      </Button>
    </div>
  );
}

function PantallaEnviado({ motivo, onAceptar }: { motivo: 'estudiante' | 'tiempo'; onAceptar: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary-900 px-6 text-center text-white">
      <CheckCircle2 size={56} className="mb-4 text-secondary-400" />
      <h1 className="text-lg font-bold">{motivo === 'tiempo' ? 'Se envió tu examen' : 'Examen enviado'}</h1>
      <p className="mt-2 text-sm text-white/70">
        {motivo === 'tiempo' ? 'Se acabó el tiempo.' : 'Tu examen se envió correctamente.'}
      </p>
      <Button variante="accent" className="mt-6" onClick={onAceptar}>
        Aceptar
      </Button>
    </div>
  );
}

function PantallaComenzar({ intento, onComenzar }: { intento: IntentoCodigoParaRendir; onComenzar: () => void }) {
  const n = intento.ejercicios.length;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary-900 px-6 text-center text-white">
      <Lock size={40} className="mb-4 text-white/60" />
      <h1 className="text-xl font-extrabold">{intento.tema}</h1>
      <p className="mt-2 text-sm text-white/70">
        {n} ejercicio{n === 1 ? '' : 's'} · Nota total: {intento.nota}
      </p>
      <p className="mt-4 max-w-sm text-sm text-white/70">
        Al comenzar, la ventana pasará a pantalla completa. No la minimices ni cambies de
        aplicación: quedará registrado como incidente y tu docente lo verá.
      </p>
      <Button variante="accent" className="mt-6" onClick={onComenzar}>
        Comenzar examen
      </Button>
    </div>
  );
}

// ── Aviso de incidente ───────────────────────────────────────────────

function AvisoIncidente({
  tipo,
  incidentes,
  onCerrar,
}: {
  tipo: TipoIncidenteCodigo | null;
  incidentes: number;
  onCerrar: () => void;
}) {
  useEffect(() => {
    if (!tipo) return;
    const id = setTimeout(onCerrar, 8000);
    return () => clearTimeout(id);
  }, [tipo, onCerrar]);

  if (!tipo) return null;

  return (
    <div className="fixed right-5 bottom-5 z-30 max-w-sm rounded-2xl border border-accent-600 bg-primary-900 px-4 py-[14px] shadow-lg">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="shrink-0 text-accent-400" />
        <p className="text-[15px] font-bold text-accent-400">{TEXTO_INCIDENTE[tipo]}</p>
      </div>
      <p className="mt-1 text-[14px] leading-[1.45] text-white/75">
        Quedó registrado y tu docente lo verá. Es la {incidentes}ª vez.
      </p>
    </div>
  );
}

function AvisoTiempo({ pendientes, onCerrar }: { pendientes: number; onCerrar: () => void }) {
  useEffect(() => {
    const id = setTimeout(onCerrar, 10000);
    return () => clearTimeout(id);
  }, [onCerrar]);

  return (
    <button
      type="button"
      onClick={onCerrar}
      className="mx-6 mt-3 flex shrink-0 flex-col items-start gap-1 rounded-2xl border border-accent-600 bg-accent-500/16 px-4 py-3 text-left"
    >
      <p className="text-[15px] font-bold text-accent-400">Quedan 5 minutos</p>
      <p className="text-[14px] text-white/75">
        {pendientes > 0
          ? `Tienes ${pendientes} ejercicio${pendientes === 1 ? '' : 's'} sin entregar. Al vencer el tiempo el examen se cierra igual.`
          : 'Al vencer el tiempo el examen se cierra igual.'}
      </p>
    </button>
  );
}

// ── Lista de ejercicios (barra lateral) ───────────────────────────────

function ListaEjercicios({
  ejercicios,
  activoId,
  enviados,
  onSeleccionar,
}: {
  ejercicios: EjercicioParaRendir[];
  activoId: number;
  enviados: Set<number>;
  onSeleccionar: (id: number) => void;
}) {
  return (
    <nav className="flex w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/10 p-3">
      {ejercicios.map((ej, i) => {
        const activo = ej.id === activoId;
        const enviado = enviados.has(ej.id);
        return (
          <button
            key={ej.id}
            type="button"
            onClick={() => onSeleccionar(ej.id)}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition',
              activo ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/[0.08] hover:text-white',
            )}
          >
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                enviado ? 'bg-secondary-400' : 'bg-white/25',
              )}
            />
            <span className="flex-1 truncate font-medium">Ejercicio {i + 1}</span>
            <span className="shrink-0 font-mono text-xs text-white/45">{ej.total_casos} casos</span>
          </button>
        );
      })}
    </nav>
  );
}

// ── Panel de resultados de una corrida ────────────────────────────────

function PanelResultados({ resultados }: { resultados: ResultadoCaso[] }) {
  if (resultados.length === 0) return null;
  const acertados = resultados.filter((r) => r.paso).length;
  return (
    <div className="mt-4 flex flex-col gap-2">
      <p className="text-sm font-semibold text-white/80">
        {acertados} de {resultados.length} casos visibles pasados
      </p>
      {resultados.map((r, i) => (
        <div
          key={r.caso_id}
          className={cn(
            'rounded-lg border px-3 py-2 text-xs',
            r.paso ? 'border-secondary-700/40 bg-secondary-900/10' : 'border-red-800/40 bg-red-900/10',
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn('font-bold', r.paso ? 'text-secondary-400' : 'text-red-400')}>
              Caso {i + 1} · {r.paso ? 'OK' : 'Falló'}
            </span>
            <span className="text-white/40">{r.tiempo_ms} ms</span>
          </div>
          {r.stdout && (
            <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap text-white/70">{r.stdout}</pre>
          )}
          {r.stderr && <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap text-red-400">{r.stderr}</pre>}
        </div>
      ))}
    </div>
  );
}

// ── Vista de un ejercicio ────────────────────────────────────────────

function VistaEjercicio({
  ejercicio,
  codigo,
  onCambiarCodigo,
  resultados,
  ejecutando,
  enviando,
  enviado,
  error,
  onEjecutar,
  onEnviar,
}: {
  ejercicio: EjercicioParaRendir;
  codigo: string;
  onCambiarCodigo: (valor: string) => void;
  resultados: ResultadoCaso[] | null;
  ejecutando: boolean;
  enviando: boolean;
  enviado: boolean;
  error: string;
  onEjecutar: () => void;
  onEnviar: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 overflow-y-auto border-b border-white/10 px-6 py-4" style={{ maxHeight: '30%' }}>
        <p className="whitespace-pre-wrap text-[15px] leading-[1.5] text-white/90">{ejercicio.enunciado}</p>
        {ejercicio.casos_visibles.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {ejercicio.casos_visibles.map((c, i) => (
              <div key={c.id} className="rounded-lg bg-white/[0.06] px-3 py-2 font-mono text-xs text-white/70">
                <span className="text-white/40">Caso {i + 1} — entrada:</span> {c.entrada || '(vacía)'}
                <br />
                <span className="text-white/40">salida esperada:</span> {c.salida_esperada}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language="python"
          theme="vs-dark"
          value={codigo}
          onChange={(v) => onCambiarCodigo(v ?? '')}
          options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true }}
        />
      </div>

      <div className="shrink-0 overflow-y-auto border-t border-white/10 px-6 py-4" style={{ maxHeight: '35%' }}>
        <div className="flex items-center gap-3">
          <Button variante="secondary" cargando={ejecutando} onClick={onEjecutar}>
            <Play size={15} /> Ejecutar
          </Button>
          <Button variante="accent" cargando={enviando} onClick={onEnviar}>
            <Send size={15} /> Enviar ejercicio
          </Button>
          {enviado && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-secondary-400">
              <CheckCircle2 size={15} /> Entregado
            </span>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        {resultados && <PanelResultados resultados={resultados} />}
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────

export function ExamenCodigoPage({ onTerminado }: { onTerminado?: () => void } = {}) {
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  const [comenzado, setComenzado] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [motivoEnviado, setMotivoEnviado] = useState<'estudiante' | 'tiempo'>('estudiante');
  const [cancelado, setCancelado] = useState(false);
  const [restante, setRestante] = useState<number | null>(null);

  const [ejercicioActivoId, setEjercicioActivoId] = useState<number | null>(null);
  const [codigos, setCodigos] = useState<Record<number, string>>({});
  const [resultados, setResultados] = useState<Record<number, ResultadoCaso[] | null>>({});
  const [enviadosSet, setEnviadosSet] = useState<Set<number>>(new Set());
  const [ejecutando, setEjecutando] = useState(false);
  const [enviandoEjercicio, setEnviandoEjercicio] = useState(false);
  const [errorEjercicio, setErrorEjercicio] = useState('');
  const [confirmarFinal, setConfirmarFinal] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [errorFinal, setErrorFinal] = useState('');

  const [incidentes, setIncidentes] = useState(0);
  const [avisoIncidente, setAvisoIncidente] = useState<TipoIncidenteCodigo | null>(null);
  const [avisoCincoMinMostrado, setAvisoCincoMinMostrado] = useState(false);
  const [avisoTiempoVisible, setAvisoTiempoVisible] = useState(false);

  const { data: intento, refetch } = useQuery({
    queryKey: ['intento-codigo-actual'],
    queryFn: async () => {
      const { data } = await api.get<{ intento: IntentoCodigoParaRendir | null }>('/api/intentos-codigo/actual');
      return data.intento;
    },
    refetchInterval: 15000, // respaldo si el socket se cae un momento
    enabled: !enviado,
  });

  // Sincroniza el estado local cuando aparece un intento nuevo/reanudado.
  useEffect(() => {
    if (!intento) return;
    const codigosIniciales: Record<number, string> = {};
    const resultadosIniciales: Record<number, ResultadoCaso[] | null> = {};
    const enviadosIniciales = new Set<number>();
    for (const ej of intento.ejercicios) {
      codigosIniciales[ej.id] = ej.ultimo_codigo ?? ej.plantilla_codigo ?? '';
      resultadosIniciales[ej.id] = ej.ultimo_resultado;
      if (ej.ultimo_codigo !== null) enviadosIniciales.add(ej.id);
    }
    setCodigos(codigosIniciales);
    setResultados(resultadosIniciales);
    setEnviadosSet(enviadosIniciales);
    setEjercicioActivoId((actual) =>
      actual && intento.ejercicios.some((e) => e.id === actual) ? actual : (intento.ejercicios[0]?.id ?? null),
    );
    // Un intento_id distinto es un examen nuevo (el anterior ya terminó) —
    // los contadores del anterior no deben arrastrarse.
    setIncidentes(0);
    setAvisoCincoMinMostrado(false);
    setAvisoTiempoVisible(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intento?.intento_id]);

  // Socket: eventos personales del estudiante (ver gestionar-examen-codigo.ts).
  useEffect(() => {
    const socket = obtenerSocket();
    const refrescar = () => queryClient.invalidateQueries({ queryKey: ['intento-codigo-actual'] });
    const alCancelado = () => {
      setCancelado(true);
      refrescar();
    };
    EVENTOS_SOCKET_REFRESCAR.forEach((e) => socket.on(e, refrescar));
    socket.on('examen-codigo-cancelado', alCancelado);
    return () => {
      EVENTOS_SOCKET_REFRESCAR.forEach((e) => socket.off(e, refrescar));
      socket.off('examen-codigo-cancelado', alCancelado);
    };
  }, [queryClient]);

  // Countdown del tiempo límite — el servidor autofinaliza (barrido de 8s),
  // el cliente solo refleja `fecha_limite`, nunca decide la nota.
  useEffect(() => {
    if (!comenzado || !intento?.fecha_limite || enviado) return;
    const limite = new Date(intento.fecha_limite).getTime();
    function tick() {
      const rest = Math.max(0, Math.round((limite - Date.now()) / 1000));
      setRestante(rest);
      if (rest === 0) {
        setMotivoEnviado('tiempo');
        setEnviado(true);
        refetch();
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [comenzado, intento?.fecha_limite, enviado, refetch]);

  useEffect(() => {
    if (restante !== null && restante > 0 && restante <= CINCO_MINUTOS && !avisoCincoMinMostrado) {
      setAvisoCincoMinMostrado(true);
      setAvisoTiempoVisible(true);
    }
  }, [restante, avisoCincoMinMostrado]);

  // Modo kiosko nativo — arma los listeners de ventana solo mientras el
  // examen está efectivamente en curso.
  const intentoId = intento?.intento_id;
  useModoKiosko(comenzado && !enviado && !cancelado, (tipo) => {
    setIncidentes((n) => n + 1);
    setAvisoIncidente(tipo);
    if (intentoId != null) {
      api.post(`/api/intentos-codigo/${intentoId}/incidente`, { tipo }).catch(() => {});
    }
  });

  function manejarComenzar() {
    setComenzado(true);
  }

  async function manejarEjecutar() {
    if (!intento || ejercicioActivoId == null) return;
    setEjecutando(true);
    setErrorEjercicio('');
    try {
      const { data } = await api.post<{ resultados: ResultadoCaso[] }>(
        `/api/intentos-codigo/${intento.intento_id}/ejercicios/${ejercicioActivoId}/ejecutar`,
        { codigo_fuente: codigos[ejercicioActivoId] ?? '' },
      );
      setResultados((r) => ({ ...r, [ejercicioActivoId]: data.resultados }));
    } catch (err) {
      setErrorEjercicio(mensajeDeError(err));
    } finally {
      setEjecutando(false);
    }
  }

  async function manejarEnviarEjercicio() {
    if (!intento || ejercicioActivoId == null) return;
    setEnviandoEjercicio(true);
    setErrorEjercicio('');
    try {
      const { data } = await api.post<{ resultado: ResultadoEnvio }>(
        `/api/intentos-codigo/${intento.intento_id}/ejercicios/${ejercicioActivoId}/enviar`,
        { codigo_fuente: codigos[ejercicioActivoId] ?? '' },
      );
      setResultados((r) => ({ ...r, [ejercicioActivoId]: data.resultado.resultados_visibles }));
      setEnviadosSet((s) => new Set(s).add(ejercicioActivoId));
    } catch (err) {
      setErrorEjercicio(mensajeDeError(err));
    } finally {
      setEnviandoEjercicio(false);
    }
  }

  async function manejarFinalizarExamen() {
    if (!intento) return;
    setFinalizando(true);
    setErrorFinal('');
    try {
      await api.post(`/api/intentos-codigo/${intento.intento_id}/finalizar`);
      setMotivoEnviado('estudiante');
      setEnviado(true);
    } catch (err) {
      setErrorFinal(mensajeDeError(err));
    } finally {
      setFinalizando(false);
      setConfirmarFinal(false);
    }
  }

  function aceptarCancelado() {
    setCancelado(false);
    setComenzado(false);
    setRestante(null);
    queryClient.invalidateQueries({ queryKey: ['intento-codigo-actual'] });
    onTerminado?.();
  }

  function aceptarEnviado() {
    setEnviado(false);
    setComenzado(false);
    setRestante(null);
    onTerminado?.();
  }

  if (enviado) return <PantallaEnviado motivo={motivoEnviado} onAceptar={aceptarEnviado} />;
  if (cancelado) return <PantallaCancelado onAceptar={aceptarCancelado} />;
  if (!intento) return <PantallaSinExamen onSalir={logout} />;
  if (intento.estado === 'pausado') return <PantallaPausada />;
  if (!comenzado) return <PantallaComenzar intento={intento} onComenzar={manejarComenzar} />;

  const ejercicioActivo = intento.ejercicios.find((e) => e.id === ejercicioActivoId) ?? intento.ejercicios[0];
  const total = intento.ejercicios.length;
  const enviadosCount = enviadosSet.size;
  const bajoTiempo = restante !== null && restante < CINCO_MINUTOS;

  return (
    <div className="flex h-screen flex-col bg-primary-900 text-white">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-6 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-bold text-white">{intento.tema}</h1>
          <p className="text-xs text-white/55">
            {enviadosCount} de {total} entregados
            {incidentes > 0 && ` · ${incidentes} incidente${incidentes === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {restante !== null && (
            <span
              className={cn(
                'flex h-8 items-center rounded-lg px-3 font-mono text-sm font-bold text-white',
                bajoTiempo ? 'bg-red-600' : 'bg-white/10',
              )}
            >
              {formatearRestante(restante)}
            </span>
          )}
          {confirmarFinal ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/70">¿Finalizar el examen?</span>
              <Button variante="secondary" tamano="sm" onClick={() => setConfirmarFinal(false)}>
                Seguir
              </Button>
              <Button variante="accent" tamano="sm" cargando={finalizando} onClick={manejarFinalizarExamen}>
                Sí, finalizar
              </Button>
            </div>
          ) : (
            <Button variante="accent" tamano="sm" onClick={() => setConfirmarFinal(true)}>
              Finalizar examen
            </Button>
          )}
        </div>
      </div>
      {errorFinal && <p className="shrink-0 bg-red-900/30 px-6 py-2 text-sm text-red-300">{errorFinal}</p>}
      {avisoTiempoVisible && (
        <AvisoTiempo pendientes={total - enviadosCount} onCerrar={() => setAvisoTiempoVisible(false)} />
      )}

      <div className="flex min-h-0 flex-1">
        <ListaEjercicios
          ejercicios={intento.ejercicios}
          activoId={ejercicioActivo.id}
          enviados={enviadosSet}
          onSeleccionar={setEjercicioActivoId}
        />
        {ejercicioActivo && (
          <VistaEjercicio
            key={ejercicioActivo.id}
            ejercicio={ejercicioActivo}
            codigo={codigos[ejercicioActivo.id] ?? ''}
            onCambiarCodigo={(valor) => setCodigos((c) => ({ ...c, [ejercicioActivo.id]: valor }))}
            resultados={resultados[ejercicioActivo.id] ?? null}
            ejecutando={ejecutando}
            enviando={enviandoEjercicio}
            enviado={enviadosSet.has(ejercicioActivo.id)}
            error={errorEjercicio}
            onEjecutar={manejarEjecutar}
            onEnviar={manejarEnviarEjercicio}
          />
        )}
      </div>

      <AvisoIncidente tipo={avisoIncidente} incidentes={incidentes} onCerrar={() => setAvisoIncidente(null)} />
    </div>
  );
}
