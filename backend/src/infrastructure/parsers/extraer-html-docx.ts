import mammoth from 'mammoth';

/** Convierte un .docx a HTML conservando negritas (<strong>), que es la
 * señal que usa plantilla-examen-parser.ts para marcar la opción correcta. */
export async function extraerHtmlDocx(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.convertToHtml({ buffer });
  return value;
}
