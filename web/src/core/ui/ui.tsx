// Shim de compatibilidad: el kit de UI se dividió en core/ui/*.tsx (ver
// index.ts). Este archivo re-exporta todo para no romper los imports de
// páginas que aún no fueron migradas al nuevo path; se borra al final de
// la migración por rondas (ver plan de rediseño).
export * from './index';
