// E9 · Importar ejercicios desde Markdown: plantilla fija + parser simple.
// A diferencia de plantilla-examen-parser.ts (Word) el archivo ya es texto
// plano — sin heurísticas de mammoth/negrita — porque Markdown tiene bloques
// de código nativos que preservan el código tal cual (Word autocorrige
// comillas/guiones y no garantiza indentación, inaceptable para Python).
//
// Convención que debe seguir el docente (o la IA, vía "Sugerir prompt IA"):
//   ## Ejercicio 1: Título breve
//   Nota: 20
//
//   Enunciado del problema, texto libre en una o más líneas.
//
//   Plantilla:
//   ```python
//   def resolver(a, b):
//       pass
//   ```
//
//   Casos de prueba:
//   - entrada: 2 3 | salida: 5
//   - entrada: -1 5 | salida: 4 | oculto
//
// "Nota:" es obligatoria (entero positivo) — sin ella el bloque es un error,
// para no adivinar una nota o dejarla en 0 en silencio. "Plantilla:" + el
// fence son opcionales (mismo campo nullable que Ejercicio.plantilla_codigo).
// "Casos de prueba:" es obligatoria, al menos 1 línea; "entrada" puede ser
// "(vacía)" para un ejercicio que no lee nada de stdin.

export interface CasoParseado {
  entrada: string;
  salida_esperada: string;
  es_oculto: boolean;
}

export interface EjercicioParseado {
  enunciado: string;
  plantilla_codigo: string | null;
  nota: number;
  casos_prueba: CasoParseado[];
}

export interface ErrorParseoEjercicio {
  bloque: string;
  motivo: string;
}

const REGEX_ENCABEZADO = /^##\s*Ejercicio\s+\d+\s*:?\s*(.*)$/gim;
const REGEX_NOTA = /^[ \t]*Nota\s*:\s*(\d+)[ \t]*$/im;
const REGEX_PLANTILLA_INICIO = /^[ \t]*Plantilla\s*:[ \t]*$/im;
const REGEX_FENCE = /```[a-zA-Z0-9]*\r?\n([\s\S]*?)```/;
const REGEX_CASOS_INICIO = /^[ \t]*Casos?\s+de\s+prueba\s*:[ \t]*$/im;
const REGEX_LINEA_CASO =
  /^[-*]\s*entrada\s*:\s*(.*?)\s*\|\s*salidas?(?:\s+esperada)?\s*:\s*(.*?)\s*(\|\s*oculto\s*)?$/i;
const REGEX_ENTRADA_VACIA = /^\(\s*(vac[ií]a|ninguna)\s*\)$/i;

interface BloqueCrudo {
  titulo: string;
  cuerpo: string;
}

/** Separa el texto en un bloque por cada "## Ejercicio N: ..." — el título
 * se conserva (se antepone al enunciado) pero el número en sí se descarta,
 * igual que en el parser de Word con los prefijos "1."/"a)". */
function dividirEnBloques(texto: string): BloqueCrudo[] {
  const encabezados = [...texto.matchAll(REGEX_ENCABEZADO)];
  const bloques: BloqueCrudo[] = [];
  for (let i = 0; i < encabezados.length; i++) {
    const actual = encabezados[i];
    const inicioCuerpo = (actual.index ?? 0) + actual[0].length;
    const finCuerpo = i + 1 < encabezados.length ? (encabezados[i + 1].index ?? texto.length) : texto.length;
    bloques.push({ titulo: actual[1].trim(), cuerpo: texto.slice(inicioCuerpo, finCuerpo) });
  }
  return bloques;
}

function extraerNota(cuerpo: string): { nota: number; resto: string } | null {
  const m = REGEX_NOTA.exec(cuerpo);
  if (!m || m.index === undefined) return null;
  const nota = Number(m[1]);
  if (!Number.isInteger(nota) || nota <= 0) return null;
  return { nota, resto: cuerpo.slice(0, m.index) + cuerpo.slice(m.index + m[0].length) };
}

function extraerPlantilla(cuerpo: string): { plantilla: string | null; resto: string } {
  const mInicio = REGEX_PLANTILLA_INICIO.exec(cuerpo);
  if (!mInicio || mInicio.index === undefined) return { plantilla: null, resto: cuerpo };

  const desdeInicio = cuerpo.slice(mInicio.index + mInicio[0].length);
  const mFence = REGEX_FENCE.exec(desdeInicio);
  if (!mFence || mFence.index === undefined) return { plantilla: null, resto: cuerpo };

  const finAbs = mInicio.index + mInicio[0].length + mFence.index + mFence[0].length;
  return {
    plantilla: mFence[1].replace(/\r\n/g, '\n').replace(/\n$/, ''),
    resto: cuerpo.slice(0, mInicio.index) + cuerpo.slice(finAbs),
  };
}

function extraerCasos(cuerpo: string): { casos: CasoParseado[] | null; resto: string; error?: string } {
  const mInicio = REGEX_CASOS_INICIO.exec(cuerpo);
  if (!mInicio || mInicio.index === undefined) {
    return { casos: null, resto: cuerpo, error: 'Falta la sección "Casos de prueba:"' };
  }

  const resto = cuerpo.slice(0, mInicio.index);
  const seccion = cuerpo.slice(mInicio.index + mInicio[0].length);
  const casos: CasoParseado[] = [];

  for (const lineaCruda of seccion.split('\n')) {
    const linea = lineaCruda.trim();
    if (!linea) continue;
    const m = REGEX_LINEA_CASO.exec(linea);
    if (!m) return { casos: null, resto, error: `No se entendió el caso de prueba: "${linea}"` };

    const entradaCruda = m[1].trim();
    const entrada = REGEX_ENTRADA_VACIA.test(entradaCruda) ? '' : entradaCruda;
    const salida = m[2].trim();
    if (!salida) return { casos: null, resto, error: `Caso de prueba sin salida esperada: "${linea}"` };

    casos.push({ entrada, salida_esperada: salida, es_oculto: Boolean(m[3]) });
  }

  if (casos.length === 0) {
    return { casos: null, resto, error: 'La sección "Casos de prueba" no tiene ningún caso' };
  }
  return { casos, resto };
}

function validarBloque(titulo: string, cuerpo: string): EjercicioParseado | ErrorParseoEjercicio {
  const bloqueTexto = `## Ejercicio: ${titulo}\n${cuerpo.trim()}`;

  const notaResultado = extraerNota(cuerpo);
  if (!notaResultado) {
    return { bloque: bloqueTexto, motivo: 'Falta "Nota: N" (entero positivo) en el ejercicio' };
  }

  const { plantilla, resto: sinPlantilla } = extraerPlantilla(notaResultado.resto);
  const casosResultado = extraerCasos(sinPlantilla);
  if (!casosResultado.casos) {
    return { bloque: bloqueTexto, motivo: casosResultado.error ?? 'Casos de prueba inválidos' };
  }

  const enunciado = [titulo, casosResultado.resto.trim()].filter(Boolean).join('\n\n').trim();
  if (!enunciado) {
    return { bloque: bloqueTexto, motivo: 'Falta el enunciado del ejercicio' };
  }

  return {
    enunciado,
    plantilla_codigo: plantilla,
    nota: notaResultado.nota,
    casos_prueba: casosResultado.casos,
  };
}

export function parsearPlantillaMarkdown(texto: string): {
  ejercicios: EjercicioParseado[];
  errores: ErrorParseoEjercicio[];
} {
  const ejercicios: EjercicioParseado[] = [];
  const errores: ErrorParseoEjercicio[] = [];

  for (const { titulo, cuerpo } of dividirEnBloques(texto)) {
    const resultado = validarBloque(titulo, cuerpo);
    if ('motivo' in resultado) errores.push(resultado);
    else ejercicios.push(resultado);
  }

  return { ejercicios, errores };
}
