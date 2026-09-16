// E9 · Editor de un examen de código: ejercicios + casos de prueba,
// guardar (Borrador → Lista), lanzar. Calcado de EvaluacionEditorPage.tsx
// (E6/E7), adaptado de "pregunta/opciones" a "ejercicio/casos de prueba" y
// con Monaco para la plantilla de código (Python) de cada ejercicio.
//
// Rediseño (design_handoff_editor_evaluacion, dirección 1b) — mismo
// tratamiento que EvaluacionEditorPage: ficha al costado, autoguardado,
// un único Alert y modal de eliminación. Ver FichaEditor.tsx para las
// piezas compartidas.

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  ChevronDown,
  Code2,
  Eye,
  EyeOff,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import {
  CasoPrueba,
  Ejercicio,
  EjercicioParseado,
  ErrorParseoEjercicio,
  EstadoCuenta,
  ExamenCodigoConEjercicios,
  FilaListaAsistencia,
  FilaMonitoreoCodigo,
  Materia,
} from '../../core/tipos';
import {
  Alert,
  Badge,
  Button,
  Campo,
  Checkbox,
  Dropdown,
  DropdownItem,
  EmptyState,
  Input,
  Modal,
  Spinner,
  Textarea,
  cn,
  useToast,
} from '../../core/ui/ui';
import {
  BloqueAhoraMismo,
  BloqueAntesDeLanzar,
  ComprobacionFicha,
  EncabezadoEditor,
  FichaEstado,
  ModalConfirmarEliminar,
  formatoHora,
} from './FichaEditor';

interface CasoForm {
  entrada: string;
  salida_esperada: string;
  es_oculto: boolean;
}

function casoVacio(): CasoForm {
  return { entrada: '', salida_esperada: '', es_oculto: false };
}

// ── Formulario de ejercicio (crear o editar) ──────────────────────

function FormEjercicio({
  inicial,
  guardando,
  error,
  textoBoton,
  onGuardar,
}: {
  inicial?: Ejercicio;
  guardando: boolean;
  error: string;
  textoBoton: string;
  onGuardar: (datos: {
    enunciado: string;
    plantilla_codigo: string | null;
    nota: number;
    casos_prueba: CasoForm[];
  }) => void;
}) {
  const [enunciado, setEnunciado] = useState(inicial?.enunciado ?? '');
  const [plantilla, setPlantilla] = useState(inicial?.plantilla_codigo ?? '');
  const [nota, setNota] = useState(inicial ? String(inicial.nota) : '100');
  const [casos, setCasos] = useState<CasoForm[]>(
    inicial && inicial.casos_prueba.length > 0
      ? inicial.casos_prueba.map((c) => ({
          entrada: c.entrada,
          salida_esperada: c.salida_esperada,
          es_oculto: c.es_oculto,
        }))
      : [casoVacio()],
  );

  function actualizarCaso(i: number, cambios: Partial<CasoForm>) {
    setCasos((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...cambios } : c)));
  }

  function agregarCaso() {
    setCasos((cs) => [...cs, casoVacio()]);
  }

  function quitarCaso(i: number) {
    if (casos.length <= 1) return;
    setCasos((cs) => cs.filter((_, idx) => idx !== i));
  }

  function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    onGuardar({
      enunciado,
      plantilla_codigo: plantilla.trim() === '' ? null : plantilla,
      nota: Number(nota),
      casos_prueba: casos,
    });
  }

  return (
    <form onSubmit={manejarEnvio} className="space-y-5">
      <Campo etiqueta="Enunciado">
        <Textarea
          required
          value={enunciado}
          onChange={(e) => setEnunciado(e.target.value)}
          filas={4}
          placeholder="Describe el problema que debe resolver el ejercicio…"
        />
      </Campo>

      <Campo etiqueta="Nota" ayuda="Puntos que aporta este ejercicio a la nota total del examen.">
        <Input
          type="number"
          min={1}
          required
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          className="w-28"
        />
      </Campo>

      <div>
        <p className="mb-1.5 text-sm font-medium text-text-secondary">
          Plantilla de código (opcional) <span className="font-normal text-text-disabled">— starter code</span>
        </p>
        <div className="overflow-hidden rounded-xl border border-border">
          <Editor
            height="160px"
            language="python"
            theme="vs"
            value={plantilla}
            onChange={(v) => setPlantilla(v ?? '')}
            options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
          />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-sm font-medium text-text-secondary">
            Casos de prueba <span className="font-normal text-text-disabled">(al menos 1)</span>
          </p>
          <button
            type="button"
            onClick={agregarCaso}
            className="text-sm font-medium text-primary-700 hover:text-primary-800"
          >
            + Agregar caso
          </button>
        </div>
        <div className="space-y-3">
          {casos.map((caso, i) => (
            <div key={i} className="rounded-xl border border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <Checkbox
                  etiqueta="Oculto (solo cuenta al enviar, no lo ve el estudiante)"
                  checked={caso.es_oculto}
                  onChange={(e) => actualizarCaso(i, { es_oculto: e.target.checked })}
                />
                {casos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => quitarCaso(i)}
                    className="shrink-0 rounded-lg p-1 text-text-disabled hover:bg-surface-hover hover:text-red-500"
                    aria-label="Quitar caso"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Campo etiqueta="Entrada (stdin)">
                  <Textarea
                    value={caso.entrada}
                    onChange={(e) => actualizarCaso(i, { entrada: e.target.value })}
                    filas={2}
                    className="font-mono text-xs"
                  />
                </Campo>
                <Campo etiqueta="Salida esperada">
                  <Textarea
                    required
                    value={caso.salida_esperada}
                    onChange={(e) => actualizarCaso(i, { salida_esperada: e.target.value })}
                    filas={2}
                    className="font-mono text-xs"
                  />
                </Campo>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : textoBoton}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

function ModalFormEjercicio({
  titulo,
  inicial,
  guardando,
  error,
  textoBoton,
  onGuardar,
  onCerrar,
}: {
  titulo: string;
  inicial?: Ejercicio;
  guardando: boolean;
  error: string;
  textoBoton: string;
  onGuardar: (datos: {
    enunciado: string;
    plantilla_codigo: string | null;
    nota: number;
    casos_prueba: CasoForm[];
  }) => void;
  onCerrar: () => void;
}) {
  return (
    <Modal onCerrar={onCerrar} eyebrow="Ejercicio" titulo={titulo} maxWidth="max-w-2xl">
      <FormEjercicio
        inicial={inicial}
        guardando={guardando}
        error={error}
        textoBoton={textoBoton}
        onGuardar={onGuardar}
      />
    </Modal>
  );
}

// ── Tarjeta de un ejercicio ya guardado ───────────────────────────

function TarjetaEjercicio({
  ejercicio,
  numero,
  materiaId,
  examenId,
  editable,
  esPrimera,
  esUltima,
  onMover,
}: {
  ejercicio: Ejercicio;
  numero: number;
  materiaId: number;
  examenId: number;
  editable: boolean;
  esPrimera: boolean;
  esUltima: boolean;
  onMover: (direccion: -1 | 1) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editando, setEditando] = useState(false);
  const [mostrarCasos, setMostrarCasos] = useState(false);
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false);
  const [error, setError] = useState('');

  const actualizar = useMutation({
    mutationFn: (datos: {
      enunciado: string;
      plantilla_codigo: string | null;
      nota: number;
      casos_prueba: CasoForm[];
    }) =>
      api.patch(
        `/api/materias/${materiaId}/examenes-codigo/${examenId}/ejercicios/${ejercicio.id}`,
        datos,
      ),
    onSuccess: () => {
      setError('');
      setEditando(false);
      toast({ tone: 'success', titulo: 'Ejercicio actualizado' });
      queryClient.invalidateQueries({ queryKey: ['examen-codigo', String(examenId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  const eliminar = useMutation({
    mutationFn: () =>
      api.delete(
        `/api/materias/${materiaId}/examenes-codigo/${examenId}/ejercicios/${ejercicio.id}`,
      ),
    onSuccess: () => {
      setError('');
      setModalEliminarAbierto(false);
      toast({ tone: 'success', titulo: 'Ejercicio eliminado' });
      queryClient.invalidateQueries({ queryKey: ['examen-codigo', String(examenId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  const visibles = ejercicio.casos_prueba.filter((c: CasoPrueba) => !c.es_oculto);
  const ocultos = ejercicio.casos_prueba.filter((c: CasoPrueba) => c.es_oculto);

  return (
    <div className="rounded-xl border border-border bg-surface p-4 transition hover:border-border-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-text-muted">
            {numero}
          </span>
          <div className="min-w-0">
            <p className="whitespace-pre-wrap text-[15px] font-semibold text-text">{ejercicio.enunciado}</p>
            <p className="mt-1 font-mono text-xs text-text-secondary">
              {ejercicio.casos_prueba.length} caso{ejercicio.casos_prueba.length === 1 ? '' : 's'} ·{' '}
              {visibles.length} visible{visibles.length === 1 ? '' : 's'}
            </p>
            {ocultos.length === 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-warning">
                <Badge tone="warning">Sin casos ocultos</Badge>
                Cualquier estudiante puede pasar este ejercicio con un simple print() de la
                salida esperada. Marca al menos un caso como oculto antes de lanzar.
              </p>
            )}
          </div>
        </div>
        {editable && (
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex items-center overflow-hidden rounded-lg border border-border">
              <button
                onClick={() => onMover(-1)}
                disabled={esPrimera}
                className="flex h-[30px] w-[30px] items-center justify-center text-text-disabled transition hover:bg-surface-hover hover:text-text disabled:opacity-30"
                title="Subir"
              >
                ▲
              </button>
              <span className="h-4 w-px bg-border" />
              <button
                onClick={() => onMover(1)}
                disabled={esUltima}
                className="flex h-[30px] w-[30px] items-center justify-center text-text-disabled transition hover:bg-surface-hover hover:text-text disabled:opacity-30"
                title="Bajar"
              >
                ▼
              </button>
            </div>
            <button
              onClick={() => setEditando(true)}
              className="flex h-[30px] items-center rounded-lg border border-border px-[11px] text-[13px] font-semibold text-text-secondary transition hover:bg-surface-hover"
            >
              Editar
            </button>
            <button
              onClick={() => setModalEliminarAbierto(true)}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-border text-text-disabled transition hover:bg-surface-hover hover:text-red-600"
              aria-label="Eliminar ejercicio"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {ejercicio.plantilla_codigo && (
        <pre className="ml-9 mt-2 max-h-32 overflow-auto rounded-xl border border-border bg-surface-sunken p-3 font-mono text-xs text-text-secondary">
          {ejercicio.plantilla_codigo}
        </pre>
      )}

      <button
        type="button"
        onClick={() => setMostrarCasos((v) => !v)}
        className="ml-9 mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text"
      >
        {mostrarCasos ? <EyeOff size={14} /> : <Eye size={14} />}
        {mostrarCasos ? 'Ocultar casos de prueba' : 'Ver casos de prueba'}
      </button>

      {mostrarCasos && (
        <ul className="ml-9 mt-2 space-y-1.5">
          {ejercicio.casos_prueba.map((caso) => (
            <li key={caso.id} className="rounded-lg border border-border p-2 text-xs">
              <div className="mb-1 flex items-center gap-2">
                <Badge tone={caso.es_oculto ? 'neutral' : 'success'}>
                  {caso.es_oculto ? 'Oculto' : 'Visible'}
                </Badge>
              </div>
              <p className="font-mono text-text-secondary">
                <span className="text-text-disabled">Entrada:</span> {caso.entrada || '(vacía)'}
              </p>
              <p className="font-mono text-text-secondary">
                <span className="text-text-disabled">Salida esperada:</span> {caso.salida_esperada}
              </p>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="ml-9 mt-2 text-sm text-red-600">{error}</p>}

      {editando && (
        <ModalFormEjercicio
          titulo="Editar ejercicio"
          inicial={ejercicio}
          guardando={actualizar.isPending}
          error={error}
          textoBoton="Guardar cambios"
          onGuardar={(datos) => actualizar.mutate(datos)}
          onCerrar={() => setEditando(false)}
        />
      )}

      {modalEliminarAbierto && (
        <ModalConfirmarEliminar
          titulo={`Eliminar el ejercicio ${numero}`}
          cuerpo="Esta acción no se puede deshacer."
          textoBoton="Eliminar ejercicio"
          eliminando={eliminar.isPending}
          onConfirmar={() => eliminar.mutate()}
          onCerrar={() => setModalEliminarAbierto(false)}
        />
      )}
    </div>
  );
}

// ── Modal "a quién lanzar" — igual criterio que EvaluacionEditorPage:
// reusa el GET de asistencia, solo reduce el conjunto de convocados. ──
function ModalSeleccionarPresentes({
  materiaId,
  claseId,
  enviando,
  error,
  onCerrar,
  onConfirmar,
}: {
  materiaId: number;
  claseId: number;
  enviando: boolean;
  error: string;
  onCerrar: () => void;
  onConfirmar: (estudianteIds: number[]) => void;
}) {
  const [seleccionados, setSeleccionados] = useState<Set<number> | null>(null);

  const { data: lista, isLoading } = useQuery({
    queryKey: ['asistencia', String(materiaId), String(claseId)],
    queryFn: async () => {
      const { data } = await api.get<{ lista: FilaListaAsistencia[] }>(
        `/api/materias/${materiaId}/clases/${claseId}/asistencia`,
      );
      return data.lista;
    },
  });

  const presentes = (lista ?? []).filter(
    (f) => f.marcaje === 'puntual' || f.marcaje === 'atrasado',
  );

  useEffect(() => {
    if (lista && seleccionados === null) {
      setSeleccionados(new Set(presentes.map((f) => f.estudiante_id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista]);

  const marcados = seleccionados ?? new Set<number>();
  const todosMarcados = presentes.length > 0 && marcados.size === presentes.length;

  function alternarTodos() {
    setSeleccionados(todosMarcados ? new Set() : new Set(presentes.map((f) => f.estudiante_id)));
  }

  function alternarUno(estudianteId: number) {
    setSeleccionados((prev) => {
      const siguiente = new Set(prev ?? []);
      if (siguiente.has(estudianteId)) siguiente.delete(estudianteId);
      else siguiente.add(estudianteId);
      return siguiente;
    });
  }

  return (
    <Modal
      onCerrar={onCerrar}
      titulo="Lanzar examen de código"
      eyebrow="A quién convocar"
      footer={
        <>
          <Button variante="secondary" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirmar(Array.from(marcados))}
            disabled={enviando || isLoading || marcados.size === 0}
          >
            {enviando
              ? 'Lanzando…'
              : `Lanzar a ${marcados.size} estudiante${marcados.size === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-text-secondary">
          <Spinner /> Cargando asistencia…
        </div>
      ) : presentes.length === 0 ? (
        <div className="space-y-2 py-2 text-sm text-text-secondary">
          <p>No hay estudiantes Puntuales o con Atraso registrados en esta clase.</p>
          <Link to={`/materias/${materiaId}/clases/${claseId}/asistencia`} className="font-medium underline">
            Pasar lista →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <p className="text-sm text-text-secondary">
              {presentes.length} estudiante{presentes.length === 1 ? '' : 's'} presente
              {presentes.length === 1 ? '' : 's'} en esta clase.
            </p>
            <Checkbox
              etiqueta="Seleccionar todos"
              checked={todosMarcados}
              onChange={alternarTodos}
            />
          </div>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {presentes.map((f) => (
              <li
                key={f.estudiante_id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-hover"
              >
                <Checkbox
                  etiqueta={`${f.apellidos}, ${f.nombres}`}
                  checked={marcados.has(f.estudiante_id)}
                  onChange={() => alternarUno(f.estudiante_id)}
                />
                <Badge tone={f.marcaje === 'atrasado' ? 'warning' : 'success'}>
                  {f.marcaje === 'atrasado' ? 'Atraso' : 'Puntual'}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="pt-1 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

// ── Modal "Importar ejercicios (.md)": plantilla fija + parser simple ──

function ModalImportarEjercicios({
  materiaId,
  examenId,
  onImportado,
  onCerrar,
}: {
  materiaId: number;
  examenId: number;
  onImportado: (n: number) => void;
  onCerrar: () => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<{
    ejercicios: EjercicioParseado[];
    errores: ErrorParseoEjercicio[];
  } | null>(null);
  const [excluidos, setExcluidos] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  const previsualizar = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('archivo', archivo as File);
      const { data } = await api.post<{
        ejercicios: EjercicioParseado[];
        errores: ErrorParseoEjercicio[];
      }>(
        `/api/materias/${materiaId}/examenes-codigo/${examenId}/ejercicios/importar/previsualizar`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data;
    },
    onSuccess: (data) => {
      setError('');
      setExcluidos(new Set());
      setResultado(data);
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  const confirmar = useMutation({
    mutationFn: () =>
      api.post(
        `/api/materias/${materiaId}/examenes-codigo/${examenId}/ejercicios/importar/confirmar`,
        { ejercicios: resultado!.ejercicios.filter((_, i) => !excluidos.has(i)) },
      ),
    onSuccess: () => {
      setError('');
      onImportado(resultado!.ejercicios.length - excluidos.size);
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  function alternarExcluido(i: number) {
    setExcluidos((s) => {
      const copia = new Set(s);
      if (copia.has(i)) copia.delete(i);
      else copia.add(i);
      return copia;
    });
  }

  const totalIncluidos = resultado ? resultado.ejercicios.length - excluidos.size : 0;

  return (
    <Modal onCerrar={onCerrar} eyebrow="Ejercicios" titulo="Importar ejercicios (.md)" maxWidth="max-w-2xl">
      {!resultado ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-sunken p-4 text-sm text-text-secondary">
            <p className="mb-2 font-medium text-text">Formato del archivo (.md)</p>
            <pre className="whitespace-pre-wrap rounded-lg bg-surface p-3 text-xs text-text-secondary">
              {'## Ejercicio 1: Título\nNota: 20\n\nEnunciado del problema.\n\nPlantilla:\n```python\ndef resolver(a, b):\n    pass\n```\n\nCasos de prueba:\n- entrada: 2 3 | salida: 5\n- entrada: -1 5 | salida: 4 | oculto'}
            </pre>
            <p className="mt-2">
              Un bloque <strong>"## Ejercicio N: Título"</strong> por ejercicio, con{' '}
              <strong>"Nota: N"</strong> obligatoria, una <strong>"Plantilla:"</strong> en un bloque
              de código Python (opcional), y al menos un caso en{' '}
              <strong>"Casos de prueba:"</strong> — agrega "| oculto" al final de la línea para que
              no lo vea el estudiante. "entrada: (vacía)" es válido para ejercicios que no leen
              nada.
            </p>
          </div>
          <input
            type="file"
            accept=".md"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="block text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text-secondary hover:file:bg-neutral-200"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end border-t border-border pt-4">
            <Button disabled={!archivo || previsualizar.isPending} onClick={() => previsualizar.mutate()}>
              {previsualizar.isPending ? 'Analizando…' : 'Analizar archivo'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {resultado.errores.length > 0 && (
            <Alert tone="warning">
              {resultado.errores.length} ejercicio{resultado.errores.length === 1 ? '' : 's'} no se
              {resultado.errores.length === 1 ? ' pudo' : ' pudieron'} interpretar; corrígelos en el
              Markdown y vuelve a intentar:
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                {resultado.errores.map((e, i) => (
                  <li key={i}>
                    <span className="font-medium">{e.motivo}</span> — {e.bloque.split('\n')[0]}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {resultado.ejercicios.length === 0 ? (
            <EmptyState
              icon={<Code2 size={32} />}
              title="No se entendió ningún ejercicio"
              description="Revisa que el archivo siga la plantilla e inténtalo de nuevo."
            />
          ) : (
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {resultado.ejercicios.map((ej, i) => {
                const excluido = excluidos.has(i);
                const visibles = ej.casos_prueba.filter((c) => !c.es_oculto).length;
                const ocultos = ej.casos_prueba.filter((c) => c.es_oculto).length;
                return (
                  <div
                    key={i}
                    className={`rounded-xl border border-border p-4 transition ${excluido ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="whitespace-pre-wrap font-medium text-text">
                        {i + 1}. {ej.enunciado}
                      </p>
                      <button
                        type="button"
                        onClick={() => alternarExcluido(i)}
                        className="shrink-0 text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        {excluido ? 'Incluir' : 'Quitar'}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      Nota: {ej.nota} · {visibles} caso{visibles === 1 ? '' : 's'} visible
                      {visibles === 1 ? '' : 's'}
                      {ocultos > 0 && ` · ${ocultos} oculto${ocultos === 1 ? '' : 's'}`}
                    </p>
                    {ej.plantilla_codigo && (
                      <pre className="mt-2 max-h-28 overflow-auto rounded-lg bg-surface-sunken p-2 font-mono text-xs text-text-secondary">
                        {ej.plantilla_codigo}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setResultado(null)}
              className="text-sm font-medium text-text-secondary hover:text-text"
            >
              ‹ Elegir otro archivo
            </button>
            <Button
              disabled={totalIncluidos === 0 || confirmar.isPending}
              onClick={() => confirmar.mutate()}
            >
              {confirmar.isPending
                ? 'Importando…'
                : `Importar ${totalIncluidos} ejercicio${totalIncluidos === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Modal "Sugerir prompt IA": arma un prompt listo para pegar en
// ChatGPT/Claude/Gemini, con el mismo formato Markdown que espera "Importar
// ejercicios" — configurable en cantidad, tema y cuántos ejercicios piden
// entrada por teclado (el resto no lee input() pero igual imprime salida). ──

function construirPromptIACodigo({
  cantidad,
  tema,
  conEntrada,
  notaTotal,
}: {
  cantidad: number;
  tema: string;
  conEntrada: number;
  notaTotal: number;
}): string {
  const nTema = tema || '[poner aquí el tema]';
  const sinEntrada = cantidad - conEntrada;
  const notaPorEjercicio = cantidad > 0 ? Math.round(notaTotal / cantidad) : 0;

  return `Actúa como un docente universitario de programación con experiencia en diseño de ejercicios de código y evaluación automática.
Elabora ${cantidad} ejercicios de programación en Python 3 sobre el tema "${nTema}" para estudiantes universitarios, en formato Markdown, siguiendo ESTRICTAMENTE esta plantilla (respeta los encabezados, los dos puntos y el formato de los casos de prueba, uno por ejercicio):

## Ejercicio 1: Título breve del ejercicio
Nota: ${notaPorEjercicio}

Enunciado claro del problema, en una o más líneas.

Plantilla:
\`\`\`python
def resolver(...):
    pass
\`\`\`

Casos de prueba:
- entrada: valores separados por espacio | salida: resultado esperado
- entrada: otro valor | salida: otro resultado esperado | oculto

Reglas que debes cumplir estrictamente:
•\tNumera los ejercicios del 1 al ${cantidad} ("## Ejercicio 1", "## Ejercicio 2", … "## Ejercicio ${cantidad}").
•\tDe los ${cantidad} ejercicios, exactamente ${conEntrada} deben leer datos desde la entrada estándar con input() (explica en el enunciado qué formato de entrada esperan).
•\tLos otros ${sinEntrada} ejercicios NO deben leer nada con input() — resuelven algo fijo o a partir de un dato ya definido en el propio enunciado — pero igual deben imprimir un resultado con print() para poder corregirse; en esos casos su único caso de prueba lleva "entrada: (vacía)".
•\tCada ejercicio debe tener "Nota: ${notaPorEjercicio}" (la suma de las notas debe dar ${notaTotal} en total; ajusta 1 o 2 ejercicios en 1 punto si ${notaTotal} no es múltiplo exacto de ${cantidad}).
•\tCada ejercicio debe tener al menos 2 casos de prueba: 1 visible (sin "| oculto") y 1 oculto (con "| oculto" al final de la línea).
•\tLas salidas deben ser 100% deterministas: no uses random, fecha/hora, ni dependas del orden de un dict o un set — la corrección compara la salida exacta.
•\tSolo biblioteca estándar de Python, nada de librerías externas.
•\tLa sección "Plantilla:" es opcional: inclúyela solo si aporta una firma de función útil como punto de partida; si no aplica, omite por completo esa línea y el bloque de código.
•\tNo agregues nada fuera de esta plantilla (sin introducción, sin explicación final, sin numerar además con "1)").
Antes de entregar el resultado, revisa que cada bloque tenga "Nota:", enunciado, y la sección "Casos de prueba:" con al menos un caso visible y uno oculto, y que la entrada/salida de cada caso sea exactamente lo que produciría el código correcto.`;
}

function ModalPromptIACodigo({
  temaSugerido,
  notaTotal,
  onCerrar,
}: {
  temaSugerido: string;
  notaTotal: number;
  onCerrar: () => void;
}) {
  const [tema, setTema] = useState(temaSugerido);
  const [cantidad, setCantidad] = useState('5');
  const [conEntrada, setConEntrada] = useState('5');
  const [copiado, setCopiado] = useState(false);

  const cantidadNum = Math.max(1, Number(cantidad) || 1);
  const conEntradaNum = Math.min(cantidadNum, Math.max(0, Number(conEntrada) || 0));

  const prompt = construirPromptIACodigo({
    cantidad: cantidadNum,
    tema,
    conEntrada: conEntradaNum,
    notaTotal,
  });

  async function copiar() {
    await navigator.clipboard.writeText(prompt);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <Modal onCerrar={onCerrar} eyebrow="Ejercicios" titulo="Sugerir prompt para IA" maxWidth="max-w-2xl">
      <p className="mb-4 text-sm text-text-secondary">
        Cópialo y pégalo en tu IA favorita (ChatGPT, Claude, Gemini…). Guarda la respuesta en un
        archivo <strong>.md</strong> y luego súbelo con "Importar ejercicios" — mismo formato.
      </p>

      <div className="mb-4 flex flex-wrap gap-3">
        <Campo etiqueta="Tema" className="min-w-48 flex-1">
          <Input
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="p. ej. Recursividad"
          />
        </Campo>
        <Campo etiqueta="Cantidad de ejercicios" className="w-44">
          <Input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
        </Campo>
        <Campo
          etiqueta="Con entrada por teclado"
          ayuda={`De ${cantidadNum}; el resto no lee input() pero igual imprime salida`}
          className="w-64"
        >
          <Input
            type="number"
            min={0}
            max={cantidadNum}
            value={conEntrada}
            onChange={(e) => setConEntrada(e.target.value)}
          />
        </Campo>
      </div>

      <Textarea readOnly filas={16} value={prompt} className="font-mono text-xs" />

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={copiar}>{copiado ? 'Copiado ✓' : 'Copiar prompt'}</Button>
        <Button type="button" variante="ghost" onClick={onCerrar}>
          Cerrar
        </Button>
      </div>
    </Modal>
  );
}

// ── Esqueleto de carga: silueta real (encabezado de una línea, dos
// tarjetas a la izquierda, ficha de 340px a la derecha). ──────────────
function EsqueletoEditor() {
  return (
    <div className="space-y-5">
      <div className="animate-pulse rounded-xl border border-border bg-surface px-6 py-4">
        <div className="h-3 w-40 rounded bg-neutral-100" />
        <div className="mt-2.5 h-6 w-64 rounded bg-neutral-100" />
      </div>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="animate-pulse space-y-3">
          <div className="h-[52px] rounded-xl bg-neutral-100" />
          <div className="h-28 rounded-xl bg-neutral-100" />
          <div className="h-28 rounded-xl bg-neutral-100" />
        </div>
        <div className="hidden animate-pulse flex-col gap-3 xl:flex">
          <div className="h-64 rounded-[14px] bg-neutral-100" />
          <div className="h-[46px] rounded-[10px] bg-neutral-100" />
        </div>
      </div>
    </div>
  );
}

export function ExamenCodigoEditorPage() {
  const { id, examenId } = useParams();
  const materiaId = Number(id);
  const examenCodigoId = Number(examenId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tema, setTema] = useState('');
  const [nota, setNota] = useState('');
  const [tiempoLimite, setTiempoLimite] = useState('');
  const [guardadoEn, setGuardadoEn] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [errorEjercicio, setErrorEjercicio] = useState('');
  const [modalEjercicioAbierto, setModalEjercicioAbierto] = useState(false);
  const [modalLanzarAbierto, setModalLanzarAbierto] = useState(false);
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false);
  const [modalPromptAbierto, setModalPromptAbierto] = useState(false);
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false);
  const evitarAutoguardadoRef = useRef(true);

  const { data: examen, isLoading, isError } = useQuery({
    queryKey: ['examen-codigo', String(examenCodigoId)],
    queryFn: async () => {
      const { data } = await api.get<{ examen: ExamenCodigoConEjercicios }>(
        `/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}`,
      );
      return data.examen;
    },
  });

  // "Importar ejercicios" reusa el mismo feature del plan Pro que "Importar
  // de Word" en evaluaciones (permite_import_word) — misma capacidad
  // ("importar preguntas/ejercicios desde un documento"), sin flag nuevo.
  const { data: estadoCuenta } = useQuery({
    queryKey: ['cuenta-estado'],
    queryFn: async () => {
      const { data } = await api.get<{ estado: EstadoCuenta }>('/api/cuenta/estado');
      return data.estado;
    },
  });
  const permiteImportWord = estadoCuenta?.plan?.permite_import_word ?? false;

  const { data: materia } = useQuery({
    queryKey: ['materia', String(materiaId)],
    queryFn: async () => {
      const { data } = await api.get<{ materia: Materia }>(`/api/materias/${materiaId}`);
      return data.materia;
    },
  });

  const editable = examen ? examen.estado === 'borrador' || examen.estado === 'lista' : false;

  const { data: listaAsistencia } = useQuery({
    queryKey: ['asistencia', String(materiaId), examen ? String(examen.clase_id) : ''],
    queryFn: async () => {
      const { data } = await api.get<{ lista: FilaListaAsistencia[] }>(
        `/api/materias/${materiaId}/clases/${examen!.clase_id}/asistencia`,
      );
      return data.lista;
    },
    enabled: !!examen,
  });
  const presentes = (listaAsistencia ?? []).filter(
    (f) => f.marcaje === 'puntual' || f.marcaje === 'atrasado',
  );

  const { data: monitoreo } = useQuery({
    queryKey: ['monitoreo-codigo', String(examenCodigoId)],
    queryFn: async () => {
      const { data } = await api.get<{ monitoreo: FilaMonitoreoCodigo[] }>(
        `/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}/monitoreo`,
      );
      return data.monitoreo;
    },
    enabled: !!examen && examen.estado === 'lanzada',
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (examen) {
      setTema(examen.tema);
      setNota(String(examen.nota));
      setTiempoLimite(examen.tiempo_limite_minutos ? String(examen.tiempo_limite_minutos) : '');
      evitarAutoguardadoRef.current = true;
    }
  }, [examen]);

  const notaValida = Number(nota) > 0 && !Number.isNaN(Number(nota));
  const temaValido = tema.trim() !== '';
  const configuracionValida = temaValido && notaValida;

  const actualizarDatos = useMutation({
    mutationFn: () =>
      api.patch(`/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}`, {
        tema,
        nota: Number(nota),
        tiempo_limite_minutos: tiempoLimite ? Number(tiempoLimite) : null,
      }),
    onSuccess: () => {
      setGuardadoEn(new Date());
      queryClient.invalidateQueries({ queryKey: ['examen-codigo', String(examenCodigoId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  useEffect(() => {
    if (evitarAutoguardadoRef.current) {
      evitarAutoguardadoRef.current = false;
      return;
    }
    if (!editable || !configuracionValida) return;
    setError('');
    const id = setTimeout(() => actualizarDatos.mutate(), 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tema, nota, tiempoLimite, editable]);

  const lanzar = useMutation({
    mutationFn: (estudianteIds: number[]) =>
      api.post(`/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}/lanzar`, {
        estudiante_ids: estudianteIds,
      }),
    onSuccess: () => {
      setError('');
      setModalLanzarAbierto(false);
      queryClient.invalidateQueries({ queryKey: ['examen-codigo', String(examenCodigoId)] });
      navigate(`/materias/${id}/examenes-codigo/${examenId}/monitoreo`);
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  function abrirModalLanzar() {
    setError('');
    setModalLanzarAbierto(true);
  }

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}`),
    onSuccess: () => {
      if (examen) {
        queryClient.invalidateQueries({ queryKey: ['examenes-codigo', String(examen.clase_id)] });
        navigate(`/materias/${id}/clases/${examen.clase_id}/examenes-codigo`);
      } else {
        navigate(`/materias/${id}`);
      }
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  const agregarEjercicio = useMutation({
    mutationFn: (datos: {
      enunciado: string;
      plantilla_codigo: string | null;
      nota: number;
      casos_prueba: CasoForm[];
    }) =>
      api.post(`/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}/ejercicios`, datos),
    onSuccess: () => {
      setErrorEjercicio('');
      toast({ tone: 'success', titulo: 'Ejercicio agregado' });
      queryClient.invalidateQueries({ queryKey: ['examen-codigo', String(examenCodigoId)] });
    },
    onError: (err: unknown) => setErrorEjercicio(mensajeDeError(err)),
  });

  const reordenar = useMutation({
    mutationFn: (orden: number[]) =>
      api.patch(
        `/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}/ejercicios/reordenar`,
        { orden },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['examen-codigo', String(examenCodigoId)] }),
  });

  const guardar = useMutation({
    mutationFn: () =>
      api.post(`/api/materias/${materiaId}/examenes-codigo/${examenCodigoId}/guardar`),
    onSuccess: () => {
      setError('');
      toast({ tone: 'success', titulo: 'Examen listo para lanzar' });
      queryClient.invalidateQueries({ queryKey: ['examen-codigo', String(examenCodigoId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  function moverEjercicio(ejercicioId: number, direccion: -1 | 1) {
    if (!examen) return;
    const ids = examen.ejercicios.map((e) => e.id);
    const i = ids.indexOf(ejercicioId);
    const j = i + direccion;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reordenar.mutate(ids);
  }

  const puntosPorEjercicio = useMemo(
    () => (examen && examen.ejercicios.length > 0 ? examen.nota / examen.ejercicios.length : 0),
    [examen],
  );

  const comprobaciones: ComprobacionFicha[] = useMemo(() => {
    if (!examen) return [];
    const totalEjercicios = examen.ejercicios.length;
    const sinCasos = examen.ejercicios.filter((e) => e.casos_prueba.length === 0).length;
    return [
      {
        ok: totalEjercicios > 0,
        textoOk: `${totalEjercicios} ejercicio${totalEjercicios === 1 ? '' : 's'} cargados`,
        textoFalta: 'Sin ejercicios: no se puede lanzar',
      },
      {
        ok: sinCasos === 0 && totalEjercicios > 0,
        textoOk: 'Todos los ejercicios tienen casos de prueba',
        textoFalta: `${sinCasos} ejercicio${sinCasos === 1 ? '' : 's'} sin casos de prueba`,
      },
      {
        ok: configuracionValida,
        textoOk: `Nota total ${examen.nota}${
          examen.tiempo_limite_minutos ? ` · ${examen.tiempo_limite_minutos} min` : ''
        }`,
        textoFalta: 'Falta la nota total',
      },
      {
        ok: presentes.length > 0,
        textoOk: `${presentes.length} presente${presentes.length === 1 ? '' : 's'} en la clase de hoy`,
        textoFalta: 'Falta pasar lista de esta clase',
      },
    ];
  }, [examen, configuracionValida, presentes.length]);

  if (isLoading) return <EsqueletoEditor />;
  if (isError || !examen) {
    return (
      <p className="rounded-lg border border-red-100 bg-red-50 p-5 text-sm text-red-600">
        No se pudo cargar el examen de código.
      </p>
    );
  }

  const textoEstadoActual =
    examen.estado === 'borrador'
      ? 'Borrador · falta dejarlo listo'
      : examen.estado === 'lista'
        ? 'Lista · se puede editar y lanzar'
        : examen.estado === 'lanzada'
          ? `Lanzado${examen.fecha_lanzamiento ? ` ${formatoHora(examen.fecha_lanzamiento)}` : ''} · edición cerrada`
          : 'Finalizado · notas al centralizador';

  const sello = !editable ? null : actualizarDatos.isPending ? (
    <span className="font-mono text-[12px] text-text-disabled">Guardando…</span>
  ) : !configuracionValida ? (
    <span className="font-mono text-[12px] text-accent-700">Sin guardar</span>
  ) : guardadoEn ? (
    <span className="font-mono text-[12px] text-text-disabled">Guardado {formatoHora(guardadoEn.toISOString())}</span>
  ) : null;

  const menuItems: { texto: string; onSelect: () => void }[] = [];
  if (examen.estado === 'finalizada') {
    menuItems.push({
      texto: 'Ver monitoreo',
      onSelect: () => navigate(`/materias/${id}/examenes-codigo/${examenId}/monitoreo`),
    });
  }

  const filasEliminar: string[] = [];
  if (examen.ejercicios.length > 0) {
    filasEliminar.push(
      `${examen.ejercicios.length} ejercicio${examen.ejercicios.length === 1 ? '' : 's'}`,
    );
  }
  if (monitoreo) {
    const intentos = monitoreo.length;
    if (intentos > 0) filasEliminar.push(`${intentos} intento${intentos === 1 ? '' : 's'} con sus respuestas`);
    const notas = monitoreo.filter((f) => f.estado === 'finalizado').length;
    if (notas > 0) filasEliminar.push(`${notas} nota${notas === 1 ? '' : 's'}, que salen del centralizador`);
    const incidentes = monitoreo.reduce((acc, f) => acc + f.incidentes, 0);
    if (incidentes > 0) {
      filasEliminar.push(`${incidentes} incidente${incidentes === 1 ? '' : 's'} registrado${incidentes === 1 ? '' : 's'}`);
    }
  }

  return (
    <div className="space-y-5">
      <EncabezadoEditor
        volverA={`/materias/${id}/clases/${examen.clase_id}/examenes-codigo`}
        volverTexto="Exámenes de código de la clase"
        titulo={examen.tema}
        estado={examen.estado}
        sello={sello}
        menu={
          menuItems.length > 0 && (
            <Dropdown
              trigger={() => (
                <button
                  type="button"
                  aria-label="Más acciones"
                  className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-border bg-surface text-text-secondary transition hover:bg-surface-hover"
                >
                  <MoreHorizontal size={16} />
                </button>
              )}
            >
              {menuItems.map((item) => (
                <DropdownItem key={item.texto} onSelect={item.onSelect}>
                  {item.texto}
                </DropdownItem>
              ))}
            </Dropdown>
          )
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="order-2 flex flex-col gap-3 xl:order-1">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface px-[18px] py-[13px]">
            <p className="text-[15px] text-text-secondary">
              {examen.ejercicios.length === 0 ? (
                'Sin ejercicios todavía'
              ) : (
                <>
                  <strong className="text-text">
                    {examen.ejercicios.length} ejercicio{examen.ejercicios.length === 1 ? '' : 's'}
                  </strong>{' '}
                  · {puntosPorEjercicio.toFixed(2).replace('.', ',')} puntos cada uno
                </>
              )}
            </p>
            {editable && (
              <div className="flex items-center gap-2">
                <Dropdown
                  trigger={({ abierto }) => (
                    <button
                      type="button"
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 text-sm font-semibold text-text-secondary transition hover:bg-surface-hover"
                    >
                      Agregar de a muchas
                      <ChevronDown size={14} className={cn('transition', abierto && 'rotate-180')} />
                    </button>
                  )}
                >
                  <DropdownItem icono={<Sparkles size={15} />} onSelect={() => setModalPromptAbierto(true)}>
                    Sugerir prompt IA
                  </DropdownItem>
                  {permiteImportWord ? (
                    <DropdownItem icono={<Upload size={15} />} onSelect={() => setModalImportarAbierto(true)}>
                      Importar ejercicios (.md)
                    </DropdownItem>
                  ) : (
                    <DropdownItem icono={<Upload size={15} />} onSelect={() => navigate('/suscripcion/planes')}>
                      Importar ejercicios (plan Pro)
                    </DropdownItem>
                  )}
                </Dropdown>
                <button
                  type="button"
                  onClick={() => setModalEjercicioAbierto(true)}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-primary-800 px-4 text-sm font-bold text-white transition hover:bg-primary-900"
                >
                  <Plus size={15} /> Agregar ejercicio
                </button>
              </div>
            )}
          </div>

          {examen.ejercicios.length === 0 && (
            <EmptyState
              icon={<Code2 size={32} />}
              title="Aún no hay ejercicios"
              description='Usa "+ Agregar ejercicio" para crear el primero.'
            />
          )}

          {examen.ejercicios.map((ej, i) => (
            <TarjetaEjercicio
              key={ej.id}
              ejercicio={ej}
              numero={i + 1}
              materiaId={materiaId}
              examenId={examenCodigoId}
              editable={editable}
              esPrimera={i === 0}
              esUltima={i === examen.ejercicios.length - 1}
              onMover={(direccion) => moverEjercicio(ej.id, direccion)}
            />
          ))}
        </div>

        <div className="order-1 w-full xl:sticky xl:top-5 xl:order-2">
          <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
            <FichaEstado estado={examen.estado} textoActual={textoEstadoActual} />

            {editable && <BloqueAntesDeLanzar items={comprobaciones} />}
            {examen.estado === 'lanzada' && monitoreo && (
              <BloqueAhoraMismo
                rindiendo={monitoreo.filter((f) => f.estado === 'en_curso').length}
                terminaron={monitoreo.filter((f) => f.estado === 'finalizado').length}
                incidentes={monitoreo.reduce((acc, f) => acc + f.incidentes, 0)}
              />
            )}

            {editable ? (
              <div className="flex flex-col gap-3 px-[18px] py-[15px]">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-muted">
                    Configuración
                  </p>
                  <span className="font-mono text-[11px] text-text-disabled">
                    {actualizarDatos.isPending ? 'GUARDANDO…' : 'GUARDADO'}
                  </span>
                </div>
                <Campo etiqueta="Título / tema">
                  <Input value={tema} onChange={(e) => setTema(e.target.value)} className="h-[38px]" />
                </Campo>
                <div className="flex gap-[10px]">
                  <Campo etiqueta="Nota total" className="flex-1">
                    <Input
                      type="number"
                      min={1}
                      value={nota}
                      onChange={(e) => setNota(e.target.value)}
                      className="h-[38px] font-mono"
                    />
                  </Campo>
                  <Campo etiqueta="Tiempo (min)" className="flex-1">
                    <Input
                      type="number"
                      min={1}
                      value={tiempoLimite}
                      onChange={(e) => setTiempoLimite(e.target.value)}
                      placeholder="Sin límite"
                      className="h-[38px] font-mono"
                    />
                  </Campo>
                </div>
                {examen.ejercicios.length > 0 && (
                  <p className="text-[13px] text-text-muted">
                    Cada ejercicio vale{' '}
                    <span className="font-mono text-text">{puntosPorEjercicio.toFixed(2).replace('.', ',')}</span>{' '}
                    puntos.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-[9px] px-[18px] py-[15px]">
                <p className="text-[15px] text-text-secondary">
                  Título <strong className="text-text">{examen.tema}</strong>
                </p>
                <p className="text-[15px] text-text-secondary">
                  Nota total <strong className="font-mono text-text">{examen.nota}</strong>
                  {examen.tiempo_limite_minutos && (
                    <>
                      {' '}
                      · tiempo <strong className="font-mono text-text">{examen.tiempo_limite_minutos} min</strong>
                    </>
                  )}
                </p>
                <p className="text-[13px] text-text-disabled">La configuración queda fija desde el lanzamiento.</p>
              </div>
            )}
          </div>

          <div className="mt-[14px] flex flex-col gap-[9px]">
            {examen.estado === 'borrador' && (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  guardar.mutate();
                }}
                disabled={guardar.isPending}
                className="flex h-[46px] items-center justify-center rounded-[10px] bg-primary-800 text-[15px] font-bold text-white transition hover:bg-primary-900 disabled:opacity-50"
              >
                {guardar.isPending ? 'Guardando…' : 'Dejar listo para lanzar'}
              </button>
            )}

            {examen.estado === 'lista' && (
              <button
                type="button"
                onClick={abrirModalLanzar}
                disabled={lanzar.isPending}
                className="flex h-[46px] items-center justify-center rounded-[10px] bg-primary-800 text-[15px] font-bold text-white transition hover:bg-primary-900 disabled:opacity-50"
              >
                Lanzar examen
              </button>
            )}
            {examen.estado === 'lista' && (
              <p className="text-[13px] text-text-muted">
                {presentes.length > 0
                  ? `Los ${presentes.length} presentes reciben el examen y la edición se cierra.`
                  : 'Primero hay que pasar lista de esta clase.'}
              </p>
            )}

            {examen.estado === 'lanzada' && (
              <Link
                to={`/materias/${id}/examenes-codigo/${examenId}/monitoreo`}
                className="flex h-[46px] items-center justify-center rounded-[10px] bg-primary-800 text-[15px] font-bold text-white transition hover:bg-primary-900"
              >
                Ver monitoreo en vivo
              </Link>
            )}

            {examen.estado === 'finalizada' && (
              <Link
                to={`/materias/${id}/examenes-codigo/${examenId}/resultados`}
                className="flex h-[46px] items-center justify-center rounded-[10px] bg-primary-800 text-[15px] font-bold text-white transition hover:bg-primary-900"
              >
                Ver resultados →
              </Link>
            )}

            <div className="border-t border-border pt-[13px]">
              <button
                type="button"
                onClick={() => setModalEliminarAbierto(true)}
                className="text-sm font-semibold text-text-muted transition hover:text-text"
              >
                Eliminar examen
              </button>
              <p className="mt-[5px] text-[13px] text-text-disabled">
                Borra ejercicios, intentos, respuestas y notas.
              </p>
            </div>
          </div>
        </div>
      </div>

      {modalPromptAbierto && (
        <ModalPromptIACodigo
          temaSugerido={examen.tema}
          notaTotal={examen.nota}
          onCerrar={() => setModalPromptAbierto(false)}
        />
      )}

      {modalImportarAbierto && (
        <ModalImportarEjercicios
          materiaId={materiaId}
          examenId={examenCodigoId}
          onImportado={(n) => {
            setModalImportarAbierto(false);
            toast({ tone: 'success', titulo: `${n} ejercicio${n === 1 ? '' : 's'} importados` });
            queryClient.invalidateQueries({ queryKey: ['examen-codigo', String(examenCodigoId)] });
          }}
          onCerrar={() => setModalImportarAbierto(false)}
        />
      )}

      {modalEjercicioAbierto && (
        <ModalFormEjercicio
          titulo="Agregar ejercicio"
          guardando={agregarEjercicio.isPending}
          error={errorEjercicio}
          textoBoton="Agregar ejercicio"
          onGuardar={(datos) =>
            agregarEjercicio.mutate(datos, {
              onSuccess: () => setModalEjercicioAbierto(false),
            })
          }
          onCerrar={() => setModalEjercicioAbierto(false)}
        />
      )}

      {modalLanzarAbierto && (
        <ModalSeleccionarPresentes
          materiaId={materiaId}
          claseId={examen.clase_id}
          enviando={lanzar.isPending}
          error={error}
          onCerrar={() => setModalLanzarAbierto(false)}
          onConfirmar={(estudianteIds) => lanzar.mutate(estudianteIds)}
        />
      )}

      {modalEliminarAbierto && (
        <ModalConfirmarEliminar
          titulo={`Eliminar "${examen.tema}"`}
          cuerpo="Se elimina el examen completo. No se puede deshacer."
          filas={filasEliminar}
          confirmacionTexto
          textoBoton="Eliminar examen"
          eliminando={eliminar.isPending}
          error={error}
          onConfirmar={() => eliminar.mutate()}
          onCerrar={() => setModalEliminarAbierto(false)}
        />
      )}
    </div>
  );
}
