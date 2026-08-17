// Guías nativas (16/08) · "Analizar link" — mismo espíritu que Importar de
// Word en evaluaciones: en vez de que el docente cargue el manifest de
// preguntas a mano, Atenza le pide la página al link, la parsea y
// pre-llena la tabla. Funciona mientras la página siga la convención que
// ya usa Roy (`quiz-mc`/`quiz-match`/`quiz-classify`/`quiz-open`,
// `data-quiz-id`) — si no la sigue, simplemente no encuentra nada y el
// docente carga el manifest a mano, que sigue existiendo siempre.
//
// Como esto hace que el SERVIDOR le pida un link arbitrario a quien sea
// (SSRF), se valida que resuelva a una IP pública antes de pedirlo — un
// docente no debería poder usar esto para sondear la red interna del VPS
// (Postgres, otros contenedores, etc.).

import * as cheerio from 'cheerio';
import dns from 'dns/promises';
import { EstadoInvalidoError } from '../../domain/errores';
import { TipoGuiaPregunta } from '../../domain/entidades/guia';

export interface PreguntaDetectada {
  referencia: string;
  tipo: TipoGuiaPregunta;
  respuesta_modelo: string | null;
  orden: number;
}

const TIMEOUT_MS = 8000;
const TOPE_BYTES = 5 * 1024 * 1024; // 5MB — una guía es HTML+CSS+JS, no más

function esIpPrivada(ip: string): boolean {
  // IPv4: loopback, privadas RFC1918, link-local, "esta red".
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = v4.slice(1).map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  // IPv6: loopback, link-local, ULA.
  const v6 = ip.toLowerCase();
  return v6 === '::1' || v6.startsWith('fe80:') || v6.startsWith('fc') || v6.startsWith('fd');
}

/** fetch nativo (Node 20) con timeout y tope de tamaño — no hay cliente
 * HTTP como dependencia en el backend, no hace falta sumar uno solo para
 * esto. El corte de tamaño es por streaming, no confía en que el server
 * externo declare Content-Length correcto. */
async function descargarConLimites(url: URL): Promise<string> {
  const abortar = new AbortController();
  const timeout = setTimeout(() => abortar.abort(), TIMEOUT_MS);
  try {
    const respuesta = await fetch(url, {
      signal: abortar.signal,
      headers: { 'User-Agent': 'AtenzaBot/1.0 (+https://atenzabo.com)' },
      redirect: 'follow',
    });
    if (!respuesta.ok || !respuesta.body) {
      throw new EstadoInvalidoError(`No se pudo descargar esa página (HTTP ${respuesta.status})`);
    }

    const lector = respuesta.body.getReader();
    const decodificador = new TextDecoder();
    let html = '';
    let bytes = 0;
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > TOPE_BYTES) {
        await lector.cancel();
        throw new EstadoInvalidoError('Esa página es demasiado grande para analizarla');
      }
      html += decodificador.decode(value, { stream: true });
    }
    return html;
  } catch (error) {
    if (error instanceof EstadoInvalidoError) throw error;
    throw new EstadoInvalidoError('No se pudo descargar esa página');
  } finally {
    clearTimeout(timeout);
  }
}

async function exigirUrlPublica(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new EstadoInvalidoError('Solo se admiten links http/https');
  }
  let resuelta: string;
  try {
    resuelta = (await dns.lookup(url.hostname)).address;
  } catch {
    throw new EstadoInvalidoError('No se pudo resolver ese link');
  }
  if (esIpPrivada(resuelta)) {
    throw new EstadoInvalidoError('Ese link no es accesible públicamente');
  }
}

/** Saca el texto de la respuesta modelo, sin el título "Respuesta modelo"
 * que ya trae el propio HTML como encabezado visual. */
function textoModelo($: cheerio.CheerioAPI, modelo: ReturnType<typeof $>): string | null {
  if (modelo.length === 0) return null;
  const texto = modelo
    .text()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^Respuesta modelo:?\s*/i, '');
  return texto || null;
}

export class AnalizarGuiaExterna {
  async ejecutar(entrada: { url: string }): Promise<PreguntaDetectada[]> {
    let url: URL;
    try {
      url = new URL(entrada.url);
    } catch {
      throw new EstadoInvalidoError('URL inválida');
    }
    await exigirUrlPublica(url);

    const html = await descargarConLimites(url);

    const $ = cheerio.load(html);
    const preguntas: PreguntaDetectada[] = [];
    const vistas = new Set<string>();

    $('[data-quiz-id]').each((i, el) => {
      const elemento = $(el);
      const referencia = elemento.attr('data-quiz-id')?.trim();
      if (!referencia || vistas.has(referencia)) return;
      vistas.add(referencia);

      const esAbierta = elemento.hasClass('quiz-open');
      preguntas.push({
        referencia,
        tipo: esAbierta ? 'abierta' : 'automatica',
        respuesta_modelo: esAbierta ? textoModelo($, elemento.find('.quiz-open-model')) : null,
        orden: preguntas.length,
      });
    });

    if (preguntas.length === 0) {
      throw new EstadoInvalidoError(
        'No se encontraron preguntas (data-quiz-id) en esa página — cargá el manifest a mano',
      );
    }
    return preguntas;
  }
}
