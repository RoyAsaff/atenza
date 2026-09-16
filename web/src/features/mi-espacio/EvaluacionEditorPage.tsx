// E6 · HU-18 (preguntas/opciones/imagen/reordenar) + HU-19 (guardar →
// Lista, demostración aleatorizada, bloqueo de edición si ya se lanzó)
//
// Rediseño (design_handoff_editor_evaluacion, dirección 1b): el trabajo
// real (preguntas) va a la izquierda; todo lo que describe o gobierna la
// evaluación (estado, qué falta para lanzar, configuración, acción
// principal) vive en una ficha fija a la derecha — mismo patrón de dos
// columnas que CentralizadorPage. Autoguardado de tema/nota/tiempo (adiós
// "Guardar datos"), un único Alert de errores, y el modal de eliminación
// reemplaza los window.confirm. Ver FichaEditor.tsx para las piezas
// compartidas con ExamenCodigoEditorPage.

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronDown,
  HelpCircle,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { api, mensajeDeError, urlArchivo } from '../../core/api/cliente';
import {
  Demostracion,
  ErrorParseoPregunta,
  EstadoCuenta,
  EvaluacionConPreguntas,
  FilaListaAsistencia,
  FilaMonitoreo,
  Materia,
  Pregunta,
  PreguntaParseada,
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

interface OpcionForm {
  texto: string;
  es_correcta: boolean;
}

function opcionesVacias(): OpcionForm[] {
  return [
    { texto: '', es_correcta: true },
    { texto: '', es_correcta: false },
  ];
}

function opcionesVerdaderoFalso(): OpcionForm[] {
  return [
    { texto: 'Verdadero', es_correcta: true },
    { texto: 'Falso', es_correcta: false },
  ];
}

/** Una pregunta de 2 opciones "Verdadero"/"Falso" es representable con el
 * mismo modelo que selección múltiple (2-4 opciones, una correcta) — no
 * hace falta una columna de "tipo" en el backend, solo detectar el patrón
 * para mostrarlo distinto en el editor. */
function esVerdaderoFalso(opciones: { texto: string }[]): boolean {
  if (opciones.length !== 2) return false;
  const textos = opciones.map((o) => o.texto.trim().toLowerCase()).sort();
  return textos[0] === 'falso' && textos[1] === 'verdadero';
}

// ── Formulario de pregunta (crear o editar), sin el modal que lo envuelve ──

function FormPregunta({
  inicial,
  guardando,
  error,
  textoBoton,
  onGuardar,
}: {
  inicial?: Pregunta;
  guardando: boolean;
  error: string;
  textoBoton: string;
  onGuardar: (datos: { pregunta: string; opciones: OpcionForm[]; imagen: File | null }) => void;
}) {
  const [texto, setTexto] = useState(inicial?.pregunta ?? '');
  const [opciones, setOpciones] = useState<OpcionForm[]>(
    inicial
      ? inicial.opciones.map((o) => ({ texto: o.texto, es_correcta: o.es_correcta }))
      : opcionesVacias(),
  );
  const [tipo, setTipo] = useState<'multiple' | 'vf'>(
    inicial && esVerdaderoFalso(inicial.opciones) ? 'vf' : 'multiple',
  );
  const [imagen, setImagen] = useState<File | null>(null);

  function cambiarTipo(nuevoTipo: 'multiple' | 'vf') {
    if (nuevoTipo === tipo) return;
    setTipo(nuevoTipo);
    setOpciones(nuevoTipo === 'vf' ? opcionesVerdaderoFalso() : opcionesVacias());
  }

  function actualizarTexto(i: number, valor: string) {
    setOpciones((ops) => ops.map((o, idx) => (idx === i ? { ...o, texto: valor } : o)));
  }

  function marcarCorrecta(i: number) {
    setOpciones((ops) => ops.map((o, idx) => ({ ...o, es_correcta: idx === i })));
  }

  function agregarOpcion() {
    if (opciones.length >= 4) return;
    setOpciones((ops) => [...ops, { texto: '', es_correcta: false }]);
  }

  function quitarOpcion(i: number) {
    if (opciones.length <= 2) return;
    setOpciones((ops) => {
      const restante = ops.filter((_, idx) => idx !== i);
      if (!restante.some((o) => o.es_correcta)) restante[0].es_correcta = true;
      return restante;
    });
  }

  function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    onGuardar({ pregunta: texto, opciones, imagen });
  }

  return (
    <form onSubmit={manejarEnvio} className="space-y-5">
      <Campo etiqueta="Enunciado">
        <Textarea
          required
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          filas={3}
        />
      </Campo>

      <div>
        <p className="mb-1.5 text-sm font-medium text-text-secondary">Imagen (opcional)</p>
        {imagen ? (
          <img
            src={URL.createObjectURL(imagen)}
            alt=""
            className="mb-2 max-h-32 rounded-xl border border-border"
          />
        ) : (
          inicial?.url_imagen && (
            <img
              src={urlArchivo(inicial.url_imagen)}
              alt=""
              className="mb-2 max-h-32 rounded-xl border border-border"
            />
          )
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImagen(e.target.files?.[0] ?? null)}
          className="block text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text-secondary hover:file:bg-neutral-200"
        />
        {inicial?.url_imagen && (
          <p className="mt-1 text-xs text-text-disabled">
            Elige otra imagen para reemplazar la actual; si no eliges ninguna, se conserva.
          </p>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-text-secondary">Tipo de pregunta</p>
        <div className="inline-flex rounded-lg bg-surface-sunken p-1">
          <button
            type="button"
            onClick={() => cambiarTipo('multiple')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tipo === 'multiple' ? 'bg-surface text-text shadow-sm' : 'text-text-secondary'
            }`}
          >
            Selección múltiple
          </button>
          <button
            type="button"
            onClick={() => cambiarTipo('vf')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tipo === 'vf' ? 'bg-surface text-text shadow-sm' : 'text-text-secondary'
            }`}
          >
            Verdadero/Falso
          </button>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-text-secondary">
          Opciones{' '}
          <span className="font-normal text-text-disabled">
            {tipo === 'vf' ? '(marca cuál es la correcta)' : '(2 a 4, una correcta)'}
          </span>
        </p>
        <div className="space-y-2">
          {opciones.map((op, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                op.es_correcta ? 'border-secondary-200 bg-secondary-50/60' : 'border-border'
              }`}
            >
              <input
                type="radio"
                name="correcta"
                checked={op.es_correcta}
                onChange={() => marcarCorrecta(i)}
                title="Marcar como correcta"
                className="h-4 w-4 accent-secondary-600"
              />
              <input
                required
                readOnly={tipo === 'vf'}
                value={op.texto}
                onChange={(e) => actualizarTexto(i, e.target.value)}
                placeholder={`Opción ${i + 1}`}
                className={`min-w-0 flex-1 bg-transparent text-sm text-text placeholder:text-text-disabled focus:outline-none ${
                  tipo === 'vf' ? 'cursor-default' : ''
                }`}
              />
              {tipo === 'multiple' && opciones.length > 2 && (
                <button
                  type="button"
                  onClick={() => quitarOpcion(i)}
                  className="shrink-0 rounded-lg p-1 text-text-disabled hover:bg-surface hover:text-red-500"
                  aria-label="Quitar opción"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {tipo === 'multiple' && opciones.length < 4 && (
          <button
            type="button"
            onClick={agregarOpcion}
            className="mt-2 text-sm font-medium text-primary-700 hover:text-primary-800"
          >
            + Agregar opción
          </button>
        )}
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

// ── Modal de pregunta (crear o editar) ────────────────────────────

function ModalFormPregunta({
  titulo,
  inicial,
  guardando,
  error,
  textoBoton,
  onGuardar,
  onCerrar,
}: {
  titulo: string;
  inicial?: Pregunta;
  guardando: boolean;
  error: string;
  textoBoton: string;
  onGuardar: (datos: { pregunta: string; opciones: OpcionForm[]; imagen: File | null }) => void;
  onCerrar: () => void;
}) {
  return (
    <Modal onCerrar={onCerrar} eyebrow="Pregunta" titulo={titulo} maxWidth="max-w-xl">
      <FormPregunta
        inicial={inicial}
        guardando={guardando}
        error={error}
        textoBoton={textoBoton}
        onGuardar={onGuardar}
      />
    </Modal>
  );
}

// ── Tarjeta de una pregunta ya guardada ───────────────────────────

function TarjetaPregunta({
  pregunta,
  numero,
  materiaId,
  evaluacionId,
  editable,
  esPrimera,
  esUltima,
  onMover,
}: {
  pregunta: Pregunta;
  numero: number;
  materiaId: number;
  evaluacionId: number;
  editable: boolean;
  esPrimera: boolean;
  esUltima: boolean;
  onMover: (direccion: -1 | 1) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editando, setEditando] = useState(false);
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false);
  const [error, setError] = useState('');

  const actualizar = useMutation({
    mutationFn: async (datos: {
      pregunta: string;
      opciones: OpcionForm[];
      imagen: File | null;
    }) => {
      await api.patch(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/preguntas/${pregunta.id}`,
        { pregunta: datos.pregunta, opciones: datos.opciones },
      );
      if (datos.imagen) {
        const form = new FormData();
        form.append('imagen', datos.imagen);
        await api.post(
          `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/preguntas/${pregunta.id}/imagen`,
          form,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
      }
    },
    onSuccess: () => {
      setError('');
      setEditando(false);
      toast({ tone: 'success', titulo: 'Pregunta actualizada' });
      queryClient.invalidateQueries({ queryKey: ['evaluacion', String(evaluacionId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  const eliminar = useMutation({
    mutationFn: () =>
      api.delete(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/preguntas/${pregunta.id}`,
      ),
    onSuccess: () => {
      setError('');
      setModalEliminarAbierto(false);
      toast({ tone: 'success', titulo: 'Pregunta eliminada' });
      queryClient.invalidateQueries({ queryKey: ['evaluacion', String(evaluacionId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-4 transition hover:border-border-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-text-muted">
            {numero}
          </span>
          <p className="text-[15px] font-semibold text-text">
            {pregunta.pregunta}
            {esVerdaderoFalso(pregunta.opciones) && (
              <Badge tone="neutral" className="ml-2 align-middle">
                V/F
              </Badge>
            )}
          </p>
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
              aria-label="Eliminar pregunta"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      {pregunta.url_imagen && (
        <img
          src={urlArchivo(pregunta.url_imagen)}
          alt=""
          className="ml-9 mt-2 max-h-32 rounded-xl border border-border"
        />
      )}
      <ul className="ml-9 mt-2 flex flex-col gap-1">
        {pregunta.opciones.map((op) => (
          <li
            key={op.id}
            className={cn(
              'rounded-[7px] px-[9px] py-1 text-sm',
              op.es_correcta ? 'bg-secondary-50 font-semibold text-secondary-800' : 'text-text-secondary',
            )}
          >
            {op.es_correcta ? '✓ ' : '· '}
            {op.texto}
          </li>
        ))}
      </ul>

      {error && <p className="ml-9 mt-2 text-sm text-red-600">{error}</p>}

      {editando && (
        <ModalFormPregunta
          titulo="Editar pregunta"
          inicial={pregunta}
          guardando={actualizar.isPending}
          error={error}
          textoBoton="Guardar cambios"
          onGuardar={(datos) => actualizar.mutate(datos)}
          onCerrar={() => setEditando(false)}
        />
      )}

      {modalEliminarAbierto && (
        <ModalConfirmarEliminar
          titulo={`Eliminar la pregunta ${numero}`}
          cuerpo="Esta acción no se puede deshacer."
          textoBoton="Eliminar pregunta"
          eliminando={eliminar.isPending}
          onConfirmar={() => eliminar.mutate()}
          onCerrar={() => setModalEliminarAbierto(false)}
        />
      )}
    </div>
  );
}

// ── Modal "Importar desde Word": plantilla fija + parser simple ──

function ModalImportarPreguntas({
  materiaId,
  evaluacionId,
  onImportado,
  onCerrar,
}: {
  materiaId: number;
  evaluacionId: number;
  onImportado: (n: number) => void;
  onCerrar: () => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<{
    preguntas: PreguntaParseada[];
    errores: ErrorParseoPregunta[];
  } | null>(null);
  const [excluidas, setExcluidas] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  const previsualizar = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('archivo', archivo as File);
      const { data } = await api.post<{
        preguntas: PreguntaParseada[];
        errores: ErrorParseoPregunta[];
      }>(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/preguntas/importar/previsualizar`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data;
    },
    onSuccess: (data) => {
      setError('');
      setExcluidas(new Set());
      setResultado(data);
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  const confirmar = useMutation({
    mutationFn: () =>
      api.post(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/preguntas/importar/confirmar`,
        { preguntas: resultado!.preguntas.filter((_, i) => !excluidas.has(i)) },
      ),
    onSuccess: () => {
      setError('');
      onImportado(resultado!.preguntas.length - excluidas.size);
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  function alternarExcluida(i: number) {
    setExcluidas((s) => {
      const copia = new Set(s);
      if (copia.has(i)) copia.delete(i);
      else copia.add(i);
      return copia;
    });
  }

  const totalIncluidas = resultado ? resultado.preguntas.length - excluidas.size : 0;

  return (
    <Modal onCerrar={onCerrar} eyebrow="Preguntas" titulo="Importar desde Word" maxWidth="max-w-2xl">
      {!resultado ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-sunken p-4 text-sm text-text-secondary">
            <p className="mb-2 font-medium text-text">Formato del archivo (.docx)</p>
            <pre className="whitespace-pre-wrap rounded-lg bg-surface p-3 text-xs text-text-secondary">
              {'1. Enunciado de la pregunta\na) Opción\nb) Opción correcta (en negrita)\nc) Opción'}
            </pre>
            <p className="mt-2">
              Preguntas numeradas ("1.", "2."...), 2 a 4 opciones con letra (a, b, c, d) y la
              opción correcta en <strong>negrita</strong>. Funciona tanto si escribes los números
              a mano como si usas la numeración automática de Word.
            </p>
            <p className="mt-2">
              También reconoce preguntas de <strong>Verdadero/Falso</strong> (se marcan solas con
              la etiqueta <Badge tone="neutral">V/F</Badge>), incluso si escribiste "a) Verdadero
              b) Falso" en la misma línea.
            </p>
          </div>
          <input
            type="file"
            accept=".docx"
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
              {resultado.errores.length} pregunta{resultado.errores.length === 1 ? '' : 's'} no se
              {resultado.errores.length === 1 ? ' pudo' : ' pudieron'} interpretar; corrígelas en el
              Word y vuelve a intentar:
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                {resultado.errores.map((e, i) => (
                  <li key={i}>
                    <span className="font-medium">{e.motivo}</span> — {e.bloque.split('\n')[0]}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {resultado.preguntas.length === 0 ? (
            <EmptyState
              icon={<HelpCircle size={32} />}
              title="No se entendió ninguna pregunta"
              description="Revisa que el archivo siga la plantilla e inténtalo de nuevo."
            />
          ) : (
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {resultado.preguntas.map((p, i) => {
                const excluida = excluidas.has(i);
                return (
                  <div
                    key={i}
                    className={`rounded-xl border border-border p-4 transition ${excluida ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-text">
                        {i + 1}. {p.pregunta}
                        {esVerdaderoFalso(p.opciones) && (
                          <Badge tone="neutral" className="ml-2 align-middle">
                            V/F
                          </Badge>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => alternarExcluida(i)}
                        className="shrink-0 text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        {excluida ? 'Incluir' : 'Quitar'}
                      </button>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {p.opciones.map((o, j) => (
                        <li
                          key={j}
                          className={`rounded-lg px-2 py-1 text-sm ${
                            o.es_correcta
                              ? 'bg-secondary-50 font-medium text-secondary-800'
                              : 'text-text-secondary'
                          }`}
                        >
                          {o.es_correcta ? '✓ ' : '· '}
                          {o.texto}
                        </li>
                      ))}
                    </ul>
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
              disabled={totalIncluidas === 0 || confirmar.isPending}
              onClick={() => confirmar.mutate()}
            >
              {confirmar.isPending
                ? 'Importando…'
                : `Importar ${totalIncluidas} pregunta${totalIncluidas === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Modal "Sugerir prompt IA": arma un prompt listo para pegar en
// ChatGPT/Claude/Gemini, con el mismo formato (numerada, 4 opciones a-d,
// correcta en negrita) que espera "Importar de Word" ───────────────────

function construirPromptIA({
  materia,
  tema,
  semestre,
}: {
  materia: string;
  tema: string;
  semestre: string;
}): string {
  const nMateria = materia || '[poner aquí la materia]';
  const nTema = tema || '[poner aquí el tema]';
  const nSemestre = semestre || '[poner aquí el semestre]';

  return `Actúa como un docente universitario con experiencia en evaluación del aprendizaje, diseño de ítems de selección múltiple y diseño de ítems de verdadero/falso.
Elabora una evaluación de 20 preguntas para la materia de ${nMateria} sobre el tema ${nTema} para estudiantes universitarios de ${nSemestre}: las primeras 15 preguntas deben ser de selección múltiple y las últimas 5 de verdadero/falso.
Las preguntas deben evaluar tanto conocimientos como razonamiento y aplicación.
Cumple estrictamente las siguientes reglas:
•\tNumera las preguntas de forma continua del 1 al 20.
•\tPreguntas 1 a 15 (selección múltiple): cada una debe tener exactamente cuatro opciones (a, b, c y d).
•\tPreguntas 16 a 20 (verdadero/falso): cada una debe tener exactamente dos opciones, en este orden: "a) Verdadero" y "b) Falso".
•\tEn las preguntas de selección múltiple, la respuesta correcta debe aparecer distribuida de forma equilibrada entre las cuatro letras; evita que siempre sea la misma.
•\tEn las preguntas de verdadero/falso, alterna cuál opción es la correcta; evita que la mayoría sea "Verdadero" o la mayoría "Falso".
•\tLos enunciados de verdadero/falso deben ser afirmaciones claras y de una sola idea; evita dobles negaciones o ambigüedad.
•\tTodas las opciones deben tener una longitud similar; la respuesta correcta no debe ser la más larga ni la más detallada.
•\tTodas las opciones deben tener la misma estructura gramatical.
•\tLos distractores deben ser plausibles y corresponder a errores comunes que cometería un estudiante de la materia.
•\tEvita opciones obviamente falsas o absurdas.
•\tEvita pistas involuntarias como palabras absolutas (siempre, nunca, únicamente, todos) salvo que sean necesarias.
•\tEvita que la respuesta correcta destaque por vocabulario técnico más sofisticado que las demás.
•\tMezcla preguntas de memoria conceptual, interpretación, análisis y resolución de situaciones.
•\tResalta únicamente la respuesta correcta utilizando negrita (en verdadero/falso, resalta "Verdadero" o "Falso", el que corresponda).
•\tNo incluyas la explicación de las respuestas.
Antes de generar cada pregunta, identifica mentalmente cuál es el error conceptual más probable que cometiese un estudiante. Construye cada distractor representando uno de esos errores frecuentes, de manera que todas las opciones resulten creíbles para quien no domina el tema.
Diseña los ítems siguiendo buenas prácticas de evaluación educativa:
•\tNinguna opción debe poder descartarse por su longitud o redacción.
•\tLa respuesta correcta no debe contener más información que las incorrectas.
•\tEn selección múltiple, las cuatro opciones deben parecer igualmente posibles.
•\tEvita patrones en la ubicación de la respuesta correcta.
•\tNo reutilices frases del enunciado en la respuesta correcta.
•\tSi una pregunta mide razonamiento, evita que pueda responderse únicamente por definición.
Antes de entregar el resultado, revisa pregunta por pregunta: cuenta los caracteres de cada opción. Si la respuesta correcta queda como la más larga (o notoriamente más corta), reescríbela o ajusta las demás opciones hasta emparejar las longitudes, para no caer en el sesgo de que la opción correcta se note por su tamaño.`;
}

function ModalPromptIA({
  materiaNombre,
  semestreSugerido,
  temaSugerido,
  onCerrar,
}: {
  materiaNombre: string;
  semestreSugerido: string;
  temaSugerido: string;
  onCerrar: () => void;
}) {
  const [tema, setTema] = useState(temaSugerido);
  const [semestre, setSemestre] = useState(semestreSugerido);
  const [copiado, setCopiado] = useState(false);

  const prompt = construirPromptIA({ materia: materiaNombre, tema, semestre });

  async function copiar() {
    await navigator.clipboard.writeText(prompt);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <Modal
      onCerrar={onCerrar}
      eyebrow="Preguntas"
      titulo="Sugerir prompt para IA"
      maxWidth="max-w-2xl"
    >
      <p className="mb-4 text-sm text-text-secondary">
        Cópialo y pégalo en tu IA favorita (ChatGPT, Claude, Gemini…). Pide 20 preguntas
        numeradas: 15 de selección múltiple (4 opciones a-d) y 5 de verdadero/falso (opciones
        "a) Verdadero" / "b) Falso"), con la correcta siempre en <strong>negrita</strong> — el
        mismo formato que entiende "Importar de Word", solo pega el resultado en un documento
        Word y luego impórtalo.
      </p>

      <div className="mb-4 flex flex-wrap gap-3">
        <Campo etiqueta="Tema" className="min-w-48 flex-1">
          <Input
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="p. ej. Normalización de bases de datos"
          />
        </Campo>
        <Campo etiqueta="Semestre" className="w-40">
          <Input value={semestre} onChange={(e) => setSemestre(e.target.value)} />
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

// ── Modal de demostración (HU-19 Esc. 2) ──────────────────────────

function ModalDemostracion({ demo, onCerrar }: { demo: Demostracion; onCerrar: () => void }) {
  return (
    <Modal
      onCerrar={onCerrar}
      eyebrow="Vista de demostración — no se registra ninguna nota"
      titulo={demo.tema}
      maxWidth="max-w-xl"
    >
      <div className="space-y-6">
        {demo.preguntas.map((p, i) => (
          <div key={p.id}>
            <p className="font-medium text-text">
              {i + 1}. {p.pregunta}
            </p>
            {p.url_imagen && (
              <img
                src={urlArchivo(p.url_imagen)}
                alt=""
                className="mt-2 max-h-40 rounded-xl border border-border"
              />
            )}
            <div className="mt-2 space-y-1.5">
              {p.opciones.map((o) => (
                <label
                  key={o.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary"
                >
                  <input type="radio" name={`demo-${p.id}`} disabled />
                  {o.texto}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── HU-20: elegir a quién lanzar (todos los presentes o solo algunos) ──
// Reusa el GET de asistencia (misma nómina que PasarListaPage) para no
// duplicar el criterio de "presente" (puntual/atrasado) que ya vive en
// el backend; acá solo se ofrece reducir ese conjunto.
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
      titulo="Lanzar evaluación"
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

export function EvaluacionEditorPage() {
  const { id, evalId } = useParams();
  const materiaId = Number(id);
  const evaluacionId = Number(evalId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tema, setTema] = useState('');
  const [nota, setNota] = useState('');
  const [tiempoLimite, setTiempoLimite] = useState('');
  const [guardadoEn, setGuardadoEn] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [errorPregunta, setErrorPregunta] = useState('');
  const [demo, setDemo] = useState<Demostracion | null>(null);
  const [modalPreguntaAbierto, setModalPreguntaAbierto] = useState(false);
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false);
  const [modalPromptAbierto, setModalPromptAbierto] = useState(false);
  const [modalLanzarAbierto, setModalLanzarAbierto] = useState(false);
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false);
  const evitarAutoguardadoRef = useRef(true);

  const { data: evaluacion, isLoading, isError } = useQuery({
    queryKey: ['evaluacion', String(evaluacionId)],
    queryFn: async () => {
      const { data } = await api.get<{ evaluacion: EvaluacionConPreguntas }>(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}`,
      );
      return data.evaluacion;
    },
  });

  // Rediseño SaaS (17/08): "Importar de Word" es feature del plan Pro.
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

  const editable = evaluacion
    ? evaluacion.estado === 'borrador' || evaluacion.estado === 'lista'
    : false;

  // Fila de convocatoria de "Antes de lanzar": misma query que
  // ModalSeleccionarPresentes (mismo queryKey) — al levantarla acá, el
  // modal la encuentra en caché y abre instantáneo.
  const { data: listaAsistencia } = useQuery({
    queryKey: ['asistencia', String(materiaId), evaluacion ? String(evaluacion.clase_id) : ''],
    queryFn: async () => {
      const { data } = await api.get<{ lista: FilaListaAsistencia[] }>(
        `/api/materias/${materiaId}/clases/${evaluacion!.clase_id}/asistencia`,
      );
      return data.lista;
    },
    enabled: !!evaluacion,
  });
  const presentes = (listaAsistencia ?? []).filter(
    (f) => f.marcaje === 'puntual' || f.marcaje === 'atrasado',
  );

  // "Ahora mismo" (estado lanzada) y cifras del modal de eliminación: sin
  // socket ni refetch agresivo, el monitoreo real está a un clic.
  const { data: monitoreo } = useQuery({
    queryKey: ['monitoreo', String(evaluacionId)],
    queryFn: async () => {
      const { data } = await api.get<{ monitoreo: FilaMonitoreo[] }>(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/monitoreo`,
      );
      return data.monitoreo;
    },
    enabled: !!evaluacion && evaluacion.estado === 'lanzada',
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (evaluacion) {
      setTema(evaluacion.tema);
      setNota(String(evaluacion.nota));
      setTiempoLimite(
        evaluacion.tiempo_limite_minutos ? String(evaluacion.tiempo_limite_minutos) : '',
      );
      evitarAutoguardadoRef.current = true;
    }
  }, [evaluacion]);

  const notaValida = Number(nota) > 0 && !Number.isNaN(Number(nota));
  const temaValido = tema.trim() !== '';
  const configuracionValida = temaValido && notaValida;

  const actualizarDatos = useMutation({
    mutationFn: () =>
      api.patch(`/api/materias/${materiaId}/evaluaciones/${evaluacionId}`, {
        tema,
        nota: Number(nota),
        tiempo_limite_minutos: tiempoLimite ? Number(tiempoLimite) : null,
      }),
    onSuccess: () => {
      setGuardadoEn(new Date());
      queryClient.invalidateQueries({ queryKey: ['evaluacion', String(evaluacionId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  // Autoguardado: 800ms de debounce sobre tema/nota/tiempo, sin disparar
  // en el primer render ni cuando los valores vienen de hidratar la query.
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

  // HU-20: lanzar a Puntual/Atraso, con opción de elegir solo algunos
  // (ModalSeleccionarPresentes). Esc. 2: si falta asistencia, el modal ya
  // lo detecta antes de intentar el POST y muestra el enlace a pasar lista.
  const lanzar = useMutation({
    mutationFn: (estudianteIds: number[]) =>
      api.post(`/api/materias/${materiaId}/evaluaciones/${evaluacionId}/lanzar`, {
        estudiante_ids: estudianteIds,
      }),
    onSuccess: () => {
      setError('');
      setModalLanzarAbierto(false);
      queryClient.invalidateQueries({ queryKey: ['evaluacion', String(evaluacionId)] });
      navigate(`/materias/${id}/evaluaciones/${evalId}/monitoreo`);
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  function abrirModalLanzar() {
    setError('');
    setModalLanzarAbierto(true);
  }

  // Deshacer una evaluación (p.ej. lanzada por error): borra en cascada
  // preguntas, intentos, respuestas, incidentes y notas, y deja de contar
  // en el centralizador.
  const eliminar = useMutation({
    mutationFn: () => api.delete(`/api/materias/${materiaId}/evaluaciones/${evaluacionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluaciones-materia', String(materiaId)] });
      queryClient.invalidateQueries({ queryKey: ['centralizador', String(materiaId)] });
      if (evaluacion) {
        queryClient.invalidateQueries({ queryKey: ['evaluaciones', String(evaluacion.clase_id)] });
        navigate(`/materias/${id}/clases/${evaluacion.clase_id}/evaluaciones`);
      } else {
        navigate(`/materias/${id}/evaluaciones`);
      }
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  const agregarPregunta = useMutation({
    mutationFn: async (datos: {
      pregunta: string;
      opciones: OpcionForm[];
      imagen: File | null;
    }) => {
      const { data } = await api.post<{ pregunta: Pregunta }>(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/preguntas`,
        { pregunta: datos.pregunta, opciones: datos.opciones },
      );
      if (datos.imagen) {
        const form = new FormData();
        form.append('imagen', datos.imagen);
        await api.post(
          `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/preguntas/${data.pregunta.id}/imagen`,
          form,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
      }
    },
    onSuccess: () => {
      setErrorPregunta('');
      toast({ tone: 'success', titulo: 'Pregunta agregada' });
      queryClient.invalidateQueries({ queryKey: ['evaluacion', String(evaluacionId)] });
    },
    onError: (err: unknown) => setErrorPregunta(mensajeDeError(err)),
  });

  const reordenar = useMutation({
    mutationFn: (orden: number[]) =>
      api.patch(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/preguntas/reordenar`,
        { orden },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['evaluacion', String(evaluacionId)] }),
  });

  const guardar = useMutation({
    mutationFn: () => api.post(`/api/materias/${materiaId}/evaluaciones/${evaluacionId}/guardar`),
    onSuccess: () => {
      setError('');
      toast({ tone: 'success', titulo: 'Evaluación lista para lanzar' });
      queryClient.invalidateQueries({ queryKey: ['evaluacion', String(evaluacionId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  async function verDemostracion() {
    try {
      const { data } = await api.get<{ demostracion: Demostracion }>(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/demostracion`,
      );
      setError('');
      setDemo(data.demostracion);
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }

  function moverPregunta(preguntaId: number, direccion: -1 | 1) {
    if (!evaluacion) return;
    const ids = evaluacion.preguntas.map((p) => p.id);
    const i = ids.indexOf(preguntaId);
    const j = i + direccion;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reordenar.mutate(ids);
  }

  const puntosPorPregunta = useMemo(
    () => (evaluacion && evaluacion.preguntas.length > 0 ? evaluacion.nota / evaluacion.preguntas.length : 0),
    [evaluacion],
  );

  const comprobaciones: ComprobacionFicha[] = useMemo(() => {
    if (!evaluacion) return [];
    const totalPreguntas = evaluacion.preguntas.length;
    return [
      {
        ok: totalPreguntas > 0,
        textoOk: `${totalPreguntas} pregunta${totalPreguntas === 1 ? '' : 's'} cargadas`,
        textoFalta: 'Sin preguntas: no se puede lanzar',
      },
      {
        ok: configuracionValida,
        textoOk: `Nota total ${evaluacion.nota}${
          evaluacion.tiempo_limite_minutos ? ` · ${evaluacion.tiempo_limite_minutos} min` : ''
        }`,
        textoFalta: 'Falta la nota total',
      },
      {
        ok: presentes.length > 0,
        textoOk: `${presentes.length} presente${presentes.length === 1 ? '' : 's'} en la clase de hoy`,
        textoFalta: 'Falta pasar lista de esta clase',
      },
    ];
  }, [evaluacion, configuracionValida, presentes.length]);

  if (isLoading) return <EsqueletoEditor />;
  if (isError || !evaluacion) {
    return (
      <p className="rounded-lg border border-red-100 bg-red-50 p-5 text-sm text-red-600">
        No se pudo cargar la evaluación.
      </p>
    );
  }

  const textoEstadoActual =
    evaluacion.estado === 'borrador'
      ? 'Borrador · falta dejarla lista'
      : evaluacion.estado === 'lista'
        ? 'Lista · se puede editar y lanzar'
        : evaluacion.estado === 'lanzada'
          ? `Lanzada${evaluacion.fecha_lanzamiento ? ` ${formatoHora(evaluacion.fecha_lanzamiento)}` : ''} · edición cerrada`
          : 'Finalizada · notas al centralizador';

  const sello = !editable ? null : actualizarDatos.isPending ? (
    <span className="font-mono text-[12px] text-text-disabled">Guardando…</span>
  ) : !configuracionValida ? (
    <span className="font-mono text-[12px] text-accent-700">Sin guardar</span>
  ) : guardadoEn ? (
    <span className="font-mono text-[12px] text-text-disabled">Guardado {formatoHora(guardadoEn.toISOString())}</span>
  ) : null;

  const menuItems: { texto: string; onSelect: () => void }[] = [];
  if (evaluacion.estado === 'lanzada' || evaluacion.estado === 'finalizada') {
    menuItems.push({ texto: 'Realizar demostración', onSelect: verDemostracion });
  }
  if (evaluacion.estado === 'finalizada') {
    menuItems.push({
      texto: 'Ver monitoreo',
      onSelect: () => navigate(`/materias/${id}/evaluaciones/${evalId}/monitoreo`),
    });
  }

  const filasEliminar: string[] = [];
  if (evaluacion.preguntas.length > 0) {
    filasEliminar.push(
      `${evaluacion.preguntas.length} pregunta${evaluacion.preguntas.length === 1 ? '' : 's'}`,
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
        volverA={`/materias/${id}/clases/${evaluacion.clase_id}/evaluaciones`}
        volverTexto="Evaluaciones de la clase"
        titulo={evaluacion.tema}
        estado={evaluacion.estado}
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
              {evaluacion.preguntas.length === 0 ? (
                'Sin preguntas todavía'
              ) : (
                <>
                  <strong className="text-text">
                    {evaluacion.preguntas.length} pregunta{evaluacion.preguntas.length === 1 ? '' : 's'}
                  </strong>{' '}
                  · {puntosPorPregunta.toFixed(2).replace('.', ',')} puntos cada una
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
                      Importar de Word
                    </DropdownItem>
                  ) : (
                    <DropdownItem icono={<Upload size={15} />} onSelect={() => navigate('/suscripcion/planes')}>
                      Importar de Word (plan Pro)
                    </DropdownItem>
                  )}
                </Dropdown>
                <button
                  type="button"
                  onClick={() => setModalPreguntaAbierto(true)}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-primary-800 px-4 text-sm font-bold text-white transition hover:bg-primary-900"
                >
                  <Plus size={15} /> Agregar pregunta
                </button>
              </div>
            )}
          </div>

          {evaluacion.preguntas.length === 0 && (
            <EmptyState
              icon={<HelpCircle size={32} />}
              title="Aún no hay preguntas"
              description='Usa "+ Agregar pregunta" para crear la primera.'
            />
          )}

          {evaluacion.preguntas.map((p, i) => (
            <TarjetaPregunta
              key={p.id}
              pregunta={p}
              numero={i + 1}
              materiaId={materiaId}
              evaluacionId={evaluacionId}
              editable={editable}
              esPrimera={i === 0}
              esUltima={i === evaluacion.preguntas.length - 1}
              onMover={(direccion) => moverPregunta(p.id, direccion)}
            />
          ))}
        </div>

        <div className="order-1 w-full xl:sticky xl:top-5 xl:order-2">
          <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
            <FichaEstado estado={evaluacion.estado} textoActual={textoEstadoActual} />

            {editable && <BloqueAntesDeLanzar items={comprobaciones} />}
            {evaluacion.estado === 'lanzada' && monitoreo && (
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
                {evaluacion.preguntas.length > 0 && (
                  <p className="text-[13px] text-text-muted">
                    Cada pregunta vale{' '}
                    <span className="font-mono text-text">{puntosPorPregunta.toFixed(2).replace('.', ',')}</span>{' '}
                    puntos.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-[9px] px-[18px] py-[15px]">
                <p className="text-[15px] text-text-secondary">
                  Título <strong className="text-text">{evaluacion.tema}</strong>
                </p>
                <p className="text-[15px] text-text-secondary">
                  Nota total <strong className="font-mono text-text">{evaluacion.nota}</strong>
                  {evaluacion.tiempo_limite_minutos && (
                    <>
                      {' '}
                      · tiempo <strong className="font-mono text-text">{evaluacion.tiempo_limite_minutos} min</strong>
                    </>
                  )}
                </p>
                <p className="text-[13px] text-text-disabled">La configuración queda fija desde el lanzamiento.</p>
              </div>
            )}
          </div>

          <div className="mt-[14px] flex flex-col gap-[9px]">
            {evaluacion.estado === 'borrador' && (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  guardar.mutate();
                }}
                disabled={guardar.isPending}
                className="flex h-[46px] items-center justify-center rounded-[10px] bg-primary-800 text-[15px] font-bold text-white transition hover:bg-primary-900 disabled:opacity-50"
              >
                {guardar.isPending ? 'Guardando…' : 'Dejar lista para lanzar'}
              </button>
            )}

            {evaluacion.estado === 'lista' && (
              <>
                <button
                  type="button"
                  onClick={abrirModalLanzar}
                  disabled={lanzar.isPending}
                  className="flex h-[46px] items-center justify-center rounded-[10px] bg-primary-800 text-[15px] font-bold text-white transition hover:bg-primary-900 disabled:opacity-50"
                >
                  Lanzar evaluación
                </button>
                <p className="text-[13px] text-text-muted">
                  {presentes.length > 0
                    ? `Los ${presentes.length} presentes reciben el examen y la edición se cierra.`
                    : 'Primero hay que pasar lista de esta clase.'}
                </p>
                <button
                  type="button"
                  onClick={verDemostracion}
                  className="flex h-10 items-center justify-center rounded-[9px] border border-border bg-surface text-sm font-semibold text-text-secondary transition hover:bg-surface-hover"
                >
                  Realizar demostración
                </button>
              </>
            )}

            {evaluacion.estado === 'lanzada' && (
              <Link
                to={`/materias/${id}/evaluaciones/${evalId}/monitoreo`}
                className="flex h-[46px] items-center justify-center rounded-[10px] bg-primary-800 text-[15px] font-bold text-white transition hover:bg-primary-900"
              >
                Ver monitoreo en vivo
              </Link>
            )}

            {evaluacion.estado === 'finalizada' && (
              <Link
                to={`/materias/${id}/evaluaciones/${evalId}/resultados`}
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
                Eliminar evaluación
              </button>
              <p className="mt-[5px] text-[13px] text-text-disabled">
                Borra preguntas, intentos, respuestas y notas.
              </p>
            </div>
          </div>
        </div>
      </div>

      {demo && <ModalDemostracion demo={demo} onCerrar={() => setDemo(null)} />}

      {modalPromptAbierto && (
        <ModalPromptIA
          materiaNombre={materia?.nombre_materia ?? ''}
          semestreSugerido={materia?.semestre ?? ''}
          temaSugerido={evaluacion.tema}
          onCerrar={() => setModalPromptAbierto(false)}
        />
      )}

      {modalImportarAbierto && (
        <ModalImportarPreguntas
          materiaId={materiaId}
          evaluacionId={evaluacionId}
          onImportado={(n) => {
            setModalImportarAbierto(false);
            toast({ tone: 'success', titulo: `${n} pregunta${n === 1 ? '' : 's'} importadas` });
            queryClient.invalidateQueries({ queryKey: ['evaluacion', String(evaluacionId)] });
          }}
          onCerrar={() => setModalImportarAbierto(false)}
        />
      )}

      {modalPreguntaAbierto && (
        <ModalFormPregunta
          titulo="Agregar pregunta"
          guardando={agregarPregunta.isPending}
          error={errorPregunta}
          textoBoton="Agregar pregunta"
          onGuardar={(datos) =>
            agregarPregunta.mutate(datos, {
              onSuccess: () => setModalPreguntaAbierto(false),
            })
          }
          onCerrar={() => setModalPreguntaAbierto(false)}
        />
      )}

      {modalLanzarAbierto && (
        <ModalSeleccionarPresentes
          materiaId={materiaId}
          claseId={evaluacion.clase_id}
          enviando={lanzar.isPending}
          error={error}
          onCerrar={() => setModalLanzarAbierto(false)}
          onConfirmar={(estudianteIds) => lanzar.mutate(estudianteIds)}
        />
      )}

      {modalEliminarAbierto && (
        <ModalConfirmarEliminar
          titulo={`Eliminar "${evaluacion.tema}"`}
          cuerpo="Se elimina la evaluación completa. No se puede deshacer."
          filas={filasEliminar}
          confirmacionTexto
          textoBoton="Eliminar evaluación"
          eliminando={eliminar.isPending}
          error={error}
          onConfirmar={() => eliminar.mutate()}
          onCerrar={() => setModalEliminarAbierto(false)}
        />
      )}
    </div>
  );
}
