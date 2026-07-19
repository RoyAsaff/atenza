// Importar preguntas desde Word (.docx): plantilla fija + parser simple.
// Convención que debe seguir el docente en el archivo — sirve tanto si
// escribe "1." / "a)" como texto normal, como si usa el botón de
// numeración/viñetas automáticas de Word:
//   1. Enunciado de la pregunta
//   a) Opción
//   b) Opción en negrita = es la correcta
//   c) Opción
// Recibe el HTML que produce mammoth (conserva <strong>/<b> = negrita,
// que es la señal que usamos para marcar la opción correcta).

const REGEX_PREGUNTA = /^\d+[.)]\s*(.+)$/;
const REGEX_OPCION = /^[a-dA-D][.)]\s*(.+)$/;

export interface PreguntaParseada {
  pregunta: string;
  opciones: { texto: string; es_correcta: boolean }[];
}

export interface ErrorParseoPregunta {
  bloque: string;
  motivo: string;
}

interface ParrafoHtml {
  texto: string;
  tieneNegrita: boolean;
}

function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

interface ItemLista {
  contenidoCrudo: string;
  sublista: ItemLista[] | null;
}

/** Recorre el interior de un <ol> (justo después de la etiqueta de apertura)
 * y devuelve sus <li> de primer nivel; si un <li> contiene un <ol> anidado,
 * ese anidado queda como su `sublista` (así se modela pregunta → opciones). */
function parsearListaOl(html: string, inicioInterior: number): { items: ItemLista[]; finOl: number } {
  const items: ItemLista[] = [];
  let pos = inicioInterior;
  for (;;) {
    const idxCierreOl = html.indexOf('</ol>', pos);
    const idxAperturaLi = html.indexOf('<li>', pos);
    if (idxAperturaLi === -1 || (idxCierreOl !== -1 && idxAperturaLi > idxCierreOl)) {
      return { items, finOl: idxCierreOl === -1 ? html.length : idxCierreOl + '</ol>'.length };
    }

    const inicioLi = idxAperturaLi + '<li>'.length;
    const idxOlAnidado = html.indexOf('<ol>', inicioLi);
    const idxCierreLi = html.indexOf('</li>', inicioLi);

    if (idxOlAnidado !== -1 && (idxCierreLi === -1 || idxOlAnidado < idxCierreLi)) {
      const contenidoCrudo = html.slice(inicioLi, idxOlAnidado);
      const sub = parsearListaOl(html, idxOlAnidado + '<ol>'.length);
      const idxCierreLiReal = html.indexOf('</li>', sub.finOl);
      items.push({ contenidoCrudo, sublista: sub.items });
      pos = idxCierreLiReal === -1 ? sub.finOl : idxCierreLiReal + '</li>'.length;
    } else {
      const fin = idxCierreLi === -1 ? html.length : idxCierreLi;
      items.push({ contenidoCrudo: html.slice(inicioLi, fin), sublista: null });
      pos = idxCierreLi === -1 ? html.length : idxCierreLi + '</li>'.length;
    }
  }
}

/** Convierte <ol><li>pregunta<ol><li>opción</li>...</ol></li>...</ol>
 * (numeración automática de Word) en párrafos sintéticos "1. ..." / "a) ..."
 * — el mismo formato que produce texto tipeado a mano — para que
 * extraerParrafos()/el resto del parser los procese igual sin duplicar la
 * lógica de agrupación. El número/letra en sí no importa (se descarta al
 * parsear), solo la forma "1. " / "a) " que activa el patrón esperado. */
function expandirListasWordAParrafos(html: string): string {
  let resultado = '';
  let cursor = 0;
  const regexAperturaOl = /<ol(?:\s[^>]*)?>/gi;
  let m: RegExpExecArray | null;
  while ((m = regexAperturaOl.exec(html))) {
    if (m.index < cursor) continue;
    resultado += html.slice(cursor, m.index);

    const { items: preguntas, finOl } = parsearListaOl(html, m.index + m[0].length);
    for (const pregunta of preguntas) {
      resultado += `<p>1. ${pregunta.contenidoCrudo}</p>`;
      for (const opcion of pregunta.sublista ?? []) {
        resultado += `<p>a) ${opcion.contenidoCrudo}</p>`;
      }
    }

    cursor = finOl;
    regexAperturaOl.lastIndex = cursor;
  }
  resultado += html.slice(cursor);
  return resultado;
}

/** Separa el HTML de mammoth en párrafos (una línea de Word = un <p>). */
function extraerParrafos(html: string): ParrafoHtml[] {
  const parrafos: ParrafoHtml[] = [];
  const regex = /<p[^>]*>([\s\S]*?)<\/p>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const interno = match[1];
    const texto = decodificarEntidades(interno.replace(/<[^>]+>/g, '')).trim();
    if (!texto) continue;
    parrafos.push({ texto, tieneNegrita: /<(strong|b)[\s>]/i.test(interno) });
  }
  return parrafos;
}

interface BloqueEnConstruccion {
  lineasOriginales: string[];
  pregunta: string;
  opciones: { texto: string; es_correcta: boolean }[];
}

function validarBloque(bloque: BloqueEnConstruccion): PreguntaParseada | ErrorParseoPregunta {
  const bloqueTexto = bloque.lineasOriginales.join('\n');
  if (bloque.opciones.length < 2 || bloque.opciones.length > 4) {
    return { bloque: bloqueTexto, motivo: 'Debe tener entre 2 y 4 opciones' };
  }
  const correctas = bloque.opciones.filter((o) => o.es_correcta).length;
  if (correctas !== 1) {
    return {
      bloque: bloqueTexto,
      motivo:
        correctas === 0
          ? 'Ninguna opción está en negrita (falta marcar la correcta)'
          : 'Hay más de una opción en negrita (debe haber una sola correcta)',
    };
  }
  return { pregunta: bloque.pregunta, opciones: bloque.opciones };
}

export function parsearPlantillaHtml(html: string): {
  preguntas: PreguntaParseada[];
  errores: ErrorParseoPregunta[];
} {
  const preguntas: PreguntaParseada[] = [];
  const errores: ErrorParseoPregunta[] = [];
  let actual: BloqueEnConstruccion | null = null;

  function cerrarActual() {
    if (!actual) return;
    const resultado = validarBloque(actual);
    if ('motivo' in resultado) errores.push(resultado);
    else preguntas.push(resultado);
    actual = null;
  }

  for (const parrafo of extraerParrafos(expandirListasWordAParrafos(html))) {
    const matchPregunta = REGEX_PREGUNTA.exec(parrafo.texto);
    if (matchPregunta) {
      cerrarActual();
      actual = { lineasOriginales: [parrafo.texto], pregunta: matchPregunta[1].trim(), opciones: [] };
      continue;
    }

    const matchOpcion = REGEX_OPCION.exec(parrafo.texto);
    if (matchOpcion && actual) {
      actual.lineasOriginales.push(parrafo.texto);
      actual.opciones.push({ texto: matchOpcion[1].trim(), es_correcta: parrafo.tieneNegrita });
    }
    // Líneas que no matchean ninguna forma (títulos, instrucciones, líneas
    // en blanco) se ignoran: no forman parte de ninguna pregunta.
  }
  cerrarActual();

  return { preguntas, errores };
}
