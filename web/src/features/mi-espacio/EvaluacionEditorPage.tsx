// E6 · HU-18 (preguntas/opciones/imagen/reordenar) + HU-19 (guardar →
// Lista, demostración aleatorizada, bloqueo de edición si ya se lanzó)

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { HelpCircle, Lock, Plus, Sparkles, Upload } from 'lucide-react';
import { api, mensajeDeError, urlArchivo } from '../../core/api/cliente';
import {
  Demostracion,
  ErrorParseoPregunta,
  EstadoEvaluacion,
  EvaluacionConPreguntas,
  Materia,
  Pregunta,
  PreguntaParseada,
} from '../../core/tipos';
import {
  Alert,
  Badge,
  botonClases,
  Button,
  Campo,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  PageBreadcrumb,
  PageHeader,
  Spinner,
  Textarea,
} from '../../core/ui/ui';

const ESTADO_TONO: Record<
  EstadoEvaluacion,
  { texto: string; tono: 'neutral' | 'success' | 'info' | 'dark' }
> = {
  borrador: { texto: 'Borrador', tono: 'neutral' },
  lista: { texto: 'Lista', tono: 'success' },
  lanzada: { texto: 'Lanzada', tono: 'info' },
  finalizada: { texto: 'Finalizada', tono: 'dark' },
};

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
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState('');

  const alTerminar = {
    onSuccess: () => {
      setError('');
      setEditando(false);
      queryClient.invalidateQueries({ queryKey: ['evaluacion', String(evaluacionId)] });
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  };

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
    ...alTerminar,
  });

  const eliminar = useMutation({
    mutationFn: () =>
      api.delete(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/preguntas/${pregunta.id}`,
      ),
    ...alTerminar,
  });

  function manejarEliminar() {
    if (window.confirm('¿Eliminar esta pregunta? Esta acción no se puede deshacer.')) {
      eliminar.mutate();
    }
  }

  return (
    <div className="rounded-xl border border-border p-4 transition hover:border-border-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-text-muted">
            {numero}
          </span>
          <p className="font-medium text-text">
            {pregunta.pregunta}
            {esVerdaderoFalso(pregunta.opciones) && (
              <Badge tone="neutral" className="ml-2 align-middle">
                V/F
              </Badge>
            )}
          </p>
        </div>
        {editable && (
          <div className="flex shrink-0 items-center rounded-lg border border-border">
            <button
              onClick={() => onMover(-1)}
              disabled={esPrimera}
              className="px-2 py-1 text-text-disabled transition hover:bg-surface-hover hover:text-text disabled:opacity-30"
              title="Subir"
            >
              ▲
            </button>
            <span className="h-4 w-px bg-border" />
            <button
              onClick={() => onMover(1)}
              disabled={esUltima}
              className="px-2 py-1 text-text-disabled transition hover:bg-surface-hover hover:text-text disabled:opacity-30"
              title="Bajar"
            >
              ▼
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
      <ul className="ml-9 mt-2 space-y-1">
        {pregunta.opciones.map((op) => (
          <li
            key={op.id}
            className={`rounded-lg px-2 py-1 text-sm ${
              op.es_correcta
                ? 'bg-secondary-50 font-medium text-secondary-800'
                : 'text-text-secondary'
            }`}
          >
            {op.es_correcta ? '✓ ' : '· '}
            {op.texto}
          </li>
        ))}
      </ul>



      {editable && (
        <div className="ml-9 mt-3 flex gap-4 text-sm">
          <button
            onClick={() => setEditando(true)}
            className="font-medium text-primary-700 hover:text-primary-800"
          >
            Editar
          </button>
          <button
            onClick={manejarEliminar}
            disabled={eliminar.isPending}
            className="font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      )}
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
  onImportado: () => void;
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
      onImportado();
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
  numPreguntas,
  materia,
  tema,
  semestre,
}: {
  numPreguntas: string;
  materia: string;
  tema: string;
  semestre: string;
}): string {
  const nPreguntas = numPreguntas || '[poner aquí el número de preguntas]';
  const nMateria = materia || '[poner aquí la materia]';
  const nTema = tema || '[poner aquí el tema]';
  const nSemestre = semestre || '[poner aquí el semestre]';

  return `Actúa como un docente universitario con experiencia en evaluación del aprendizaje y diseño de ítems de selección múltiple.
Elabora una evaluación con ${nPreguntas} preguntas para la materia de ${nMateria} sobre el tema ${nTema} para estudiantes universitarios de ${nSemestre}.
Las preguntas deben evaluar tanto conocimientos como razonamiento y aplicación.
Cumple estrictamente las siguientes reglas:
•\tNumera las preguntas.
•\tCada pregunta debe tener exactamente cuatro opciones (a, b, c y d).
•\tLa respuesta correcta debe aparecer distribuida de forma equilibrada entre las cuatro letras; evita que siempre sea la misma.
•\tTodas las opciones deben tener una longitud similar; la respuesta correcta no debe ser la más larga ni la más detallada.
•\tTodas las opciones deben tener la misma estructura gramatical.
•\tLos distractores deben ser plausibles y corresponder a errores comunes que cometería un estudiante de la materia.
•\tEvita opciones obviamente falsas o absurdas.
•\tEvita pistas involuntarias como palabras absolutas (siempre, nunca, únicamente, todos) salvo que sean necesarias.
•\tEvita que la respuesta correcta destaque por vocabulario técnico más sofisticado que las demás.
•\tMezcla preguntas de memoria conceptual, interpretación, análisis y resolución de situaciones.
•\tResalta únicamente la respuesta correcta utilizando negrita.
•\tNo incluyas la explicación de las respuestas.
Antes de generar cada pregunta, identifica mentalmente cuál es el error conceptual más probable que cometiese un estudiante. Construye cada distractor representando uno de esos errores frecuentes, de manera que todas las opciones resulten creíbles para quien no domina el tema.
Diseña los ítems siguiendo buenas prácticas de evaluación educativa:
•\tNinguna opción debe poder descartarse por su longitud o redacción.
•\tLa respuesta correcta no debe contener más información que las incorrectas.
•\tLas cuatro opciones deben parecer igualmente posibles.
•\tEvita patrones en la ubicación de la respuesta correcta.
•\tNo reutilices frases del enunciado en la respuesta correcta.
•\tSi una pregunta mide razonamiento, evita que pueda responderse únicamente por definición.
Antes de entregar el resultado, revisa pregunta por pregunta: cuenta los caracteres de cada una de las cuatro opciones. Si la respuesta correcta queda como la más larga (o notoriamente más corta), reescríbela o ajusta los distractores hasta emparejar las longitudes, para no caer en el sesgo de que la opción correcta se note por su tamaño.`;
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
  const [numPreguntas, setNumPreguntas] = useState('20');
  const [tema, setTema] = useState(temaSugerido);
  const [semestre, setSemestre] = useState(semestreSugerido);
  const [copiado, setCopiado] = useState(false);

  const prompt = construirPromptIA({ numPreguntas, materia: materiaNombre, tema, semestre });

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
        Cópialo y pégalo en tu IA favorita (ChatGPT, Claude, Gemini…). Ya pide el mismo formato
        que entiende "Importar de Word": preguntas numeradas, 4 opciones (a-d) y la correcta en{' '}
        <strong>negrita</strong> — solo pega el resultado en un documento Word y luego impórtalo.
      </p>

      <div className="mb-4 flex flex-wrap gap-3">
        <Campo etiqueta="N° de preguntas" className="w-32">
          <Input
            type="number"
            min={1}
            value={numPreguntas}
            onChange={(e) => setNumPreguntas(e.target.value)}
          />
        </Campo>
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

export function EvaluacionEditorPage() {
  const { id, evalId } = useParams();
  const materiaId = Number(id);
  const evaluacionId = Number(evalId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [tema, setTema] = useState('');
  const [nota, setNota] = useState('');
  const [tiempoLimite, setTiempoLimite] = useState('');
  const [errorDatos, setErrorDatos] = useState('');
  const [errorPregunta, setErrorPregunta] = useState('');
  const [errorGuardar, setErrorGuardar] = useState('');
  const [errorDemo, setErrorDemo] = useState('');
  const [errorLanzar, setErrorLanzar] = useState('');
  const [demo, setDemo] = useState<Demostracion | null>(null);
  const [modalPreguntaAbierto, setModalPreguntaAbierto] = useState(false);
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false);
  const [modalPromptAbierto, setModalPromptAbierto] = useState(false);

  const { data: evaluacion, isLoading, isError } = useQuery({
    queryKey: ['evaluacion', String(evaluacionId)],
    queryFn: async () => {
      const { data } = await api.get<{ evaluacion: EvaluacionConPreguntas }>(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}`,
      );
      return data.evaluacion;
    },
  });

  const { data: materia } = useQuery({
    queryKey: ['materia', String(materiaId)],
    queryFn: async () => {
      const { data } = await api.get<{ materia: Materia }>(`/api/materias/${materiaId}`);
      return data.materia;
    },
  });

  useEffect(() => {
    if (evaluacion) {
      setTema(evaluacion.tema);
      setNota(String(evaluacion.nota));
      setTiempoLimite(
        evaluacion.tiempo_limite_minutos ? String(evaluacion.tiempo_limite_minutos) : '',
      );
    }
  }, [evaluacion]);

  const editable = evaluacion
    ? evaluacion.estado === 'borrador' || evaluacion.estado === 'lista'
    : false;

  const actualizarDatos = useMutation({
    mutationFn: () =>
      api.patch(`/api/materias/${materiaId}/evaluaciones/${evaluacionId}`, {
        tema,
        nota: Number(nota),
        tiempo_limite_minutos: tiempoLimite ? Number(tiempoLimite) : null,
      }),
    onSuccess: () => {
      setErrorDatos('');
      queryClient.invalidateQueries({ queryKey: ['evaluacion', String(evaluacionId)] });
    },
    onError: (err: unknown) => setErrorDatos(mensajeDeError(err)),
  });

  // HU-20: lanzar solo a Puntual/Atraso (Esc. 2: si falta asistencia, el
  // backend lo rechaza y acá mostramos el enlace para ir a pasar lista).
  const lanzar = useMutation({
    mutationFn: () =>
      api.post(`/api/materias/${materiaId}/evaluaciones/${evaluacionId}/lanzar`),
    onSuccess: () => {
      setErrorLanzar('');
      queryClient.invalidateQueries({ queryKey: ['evaluacion', String(evaluacionId)] });
      navigate(`/materias/${id}/evaluaciones/${evalId}/monitoreo`);
    },
    onError: (err: unknown) => setErrorLanzar(mensajeDeError(err)),
  });

  function manejarLanzar() {
    if (
      window.confirm(
        'Se lanzará el examen a los estudiantes Puntuales y con Atraso registrados en esta clase. No podrás editarla después. ¿Continuar?',
      )
    ) {
      lanzar.mutate();
    }
  }

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
      setErrorGuardar('');
      queryClient.invalidateQueries({ queryKey: ['evaluacion', String(evaluacionId)] });
    },
    onError: (err: unknown) => setErrorGuardar(mensajeDeError(err)),
  });

  async function verDemostracion() {
    try {
      const { data } = await api.get<{ demostracion: Demostracion }>(
        `/api/materias/${materiaId}/evaluaciones/${evaluacionId}/demostracion`,
      );
      setErrorDemo('');
      setDemo(data.demostracion);
    } catch (err) {
      setErrorDemo(mensajeDeError(err));
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

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-5 text-sm text-text-secondary">
        <Spinner /> Cargando…
      </div>
    );
  }
  if (isError || !evaluacion) {
    return (
      <p className="rounded-lg border border-red-100 bg-red-50 p-5 text-sm text-red-600">
        No se pudo cargar la evaluación.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <PageBreadcrumb>
          <Link to={`/materias/${id}/clases/${evaluacion.clase_id}/evaluaciones`}>
            ‹ Evaluaciones de la clase
          </Link>
        </PageBreadcrumb>
        <PageHeader
          eyebrow="Evaluación"
          title={
            <span className="inline-flex flex-wrap items-center gap-3">
              {evaluacion.tema}
              <Badge tone={ESTADO_TONO[evaluacion.estado].tono}>
                {ESTADO_TONO[evaluacion.estado].texto}
              </Badge>
            </span>
          }
          description={`Nota total: ${evaluacion.nota} · ${evaluacion.preguntas.length} pregunta${evaluacion.preguntas.length === 1 ? '' : 's'}`}
          actions={
            <>
              {evaluacion.estado === 'borrador' && (
                <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
                  {guardar.isPending ? 'Guardando…' : 'Guardar evaluación'}
                </Button>
              )}
              {evaluacion.estado !== 'borrador' && (
                <Button variante="secondary" onClick={verDemostracion}>
                  Realizar demostración
                </Button>
              )}
              {evaluacion.estado === 'lista' && (
                <Button onClick={manejarLanzar} disabled={lanzar.isPending}>
                  {lanzar.isPending ? 'Lanzando…' : 'Lanzar evaluación'}
                </Button>
              )}
              {(evaluacion.estado === 'lanzada' || evaluacion.estado === 'finalizada') && (
                <Link
                  to={`/materias/${id}/evaluaciones/${evalId}/monitoreo`}
                  className={botonClases('accent', 'md')}
                >
                  Ver monitoreo en vivo
                </Link>
              )}
              {evaluacion.estado === 'finalizada' && (
                <Link
                  to={`/materias/${id}/evaluaciones/${evalId}/resultados`}
                  className={botonClases('primary', 'md')}
                >
                  Ver resultados →
                </Link>
              )}
            </>
          }
        />
        {errorGuardar && <p className="mt-2 text-sm text-red-600">{errorGuardar}</p>}
        {errorDemo && <p className="mt-2 text-sm text-red-600">{errorDemo}</p>}
        {errorLanzar && (
          <p className="mt-2 text-sm text-red-600">
            {errorLanzar}{' '}
            <Link
              to={`/materias/${id}/clases/${evaluacion.clase_id}/asistencia`}
              className="font-medium underline"
            >
              Pasar lista →
            </Link>
          </p>
        )}
      </div>

      {!editable && (
        <Alert tone="warning" icon={<Lock size={16} />}>
          Esta evaluación ya fue lanzada: no se puede editar.
        </Alert>
      )}

      {editable && (
        <Card>
          <CardHeader title="Configuración" description="Título y nota total de la evaluación" />
          <CardBody>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                actualizarDatos.mutate();
              }}
              className="flex flex-wrap items-end gap-3"
            >
              <Campo etiqueta="Título / tema" className="min-w-48 flex-1">
                <Input
                  required
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                />
              </Campo>
              <Campo etiqueta="Nota total">
                <Input
                  type="number"
                  min={1}
                  required
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  className="w-28"
                />
              </Campo>
              <Campo etiqueta="Tiempo límite (min)" ayuda="Vacío = sin límite (HU-24)">
                <Input
                  type="number"
                  min={1}
                  value={tiempoLimite}
                  onChange={(e) => setTiempoLimite(e.target.value)}
                  placeholder="Sin límite"
                  className="w-32"
                />
              </Campo>
              <Button type="submit" variante="secondary" disabled={actualizarDatos.isPending}>
                Guardar datos
              </Button>
            </form>
            {evaluacion.preguntas.length > 0 && (
              <p className="mt-3 text-xs text-text-secondary">
                Cada pregunta vale{' '}
                <span className="font-medium text-text">
                  {(evaluacion.nota / evaluacion.preguntas.length).toFixed(2)} puntos
                </span>{' '}
                (nota total ÷ {evaluacion.preguntas.length} preguntas).
              </p>
            )}
            {errorDatos && <p className="mt-3 text-sm text-red-600">{errorDatos}</p>}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title={`Preguntas (${evaluacion.preguntas.length})`}
          description="2 a 4 opciones cada una, con exactamente una correcta"
          actions={
            editable && (
              <>
                <Button variante="secondary" onClick={() => setModalPromptAbierto(true)}>
                  <Sparkles size={16} /> Sugerir prompt IA
                </Button>
                <Button variante="secondary" onClick={() => setModalImportarAbierto(true)}>
                  <Upload size={16} /> Importar de Word
                </Button>
                <Button onClick={() => setModalPreguntaAbierto(true)}>
                  <Plus size={16} /> Agregar pregunta
                </Button>
              </>
            )
          }
        />
        <CardBody className={evaluacion.preguntas.length > 0 ? 'space-y-3' : ''}>
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
        </CardBody>
      </Card>

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
          onImportado={() => {
            setModalImportarAbierto(false);
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
    </div>
  );
}
