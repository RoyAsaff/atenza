// Arma la URL final que se le manda al estudiante para abrir una guía
// externa, agregándole los parámetros de acceso (atenza_token, guia,
// guia_intento) SIN romper un eventual fragmento (#ancla) que ya traiga
// la URL guardada por el docente. La regla de una URL es: query (?...)
// siempre antes del fragmento (#...) — pegar los params directo al final
// de una URL con #ancla los deja adentro del hash y el navegador nunca
// se los manda al backend (rompió funciones.html#ejercicios en
// PaginaGuias, 18/08).
export function agregarParametrosDeAcceso(
  url: string,
  params: Record<string, string | number>,
): string {
  const indiceHash = url.indexOf('#');
  const base = indiceHash === -1 ? url : url.slice(0, indiceHash);
  const fragmento = indiceHash === -1 ? '' : url.slice(indiceHash);
  const separador = base.includes('?') ? '&' : '?';
  const query = Object.entries(params)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join('&');
  return `${base}${separador}${query}${fragmento}`;
}
