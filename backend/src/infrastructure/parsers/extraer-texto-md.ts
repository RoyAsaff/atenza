/** El archivo ya es texto plano (Markdown) — a diferencia de extraerHtmlDocx
 * no hace falta ninguna conversión, solo decodificar el buffer. Se mantiene
 * como función inyectable (misma forma que extraerHtmlDocx) para que
 * PrevisualizarImportacionEjercicios sea testeable sin tocar el filesystem. */
export async function extraerTextoMd(buffer: Buffer): Promise<string> {
  return buffer.toString('utf-8');
}
