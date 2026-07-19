/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL absoluta del backend (ej. "https://api.tudominio.com"), solo
   * necesaria cuando web y backend quedan en dominios distintos (p. ej.
   * Railway, con un servicio por app) — vacío = mismo origen ("/"), que
   * es el caso normal cuando un proxy (Coolify/Traefik) enruta /api al
   * backend bajo el mismo dominio que la web. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
