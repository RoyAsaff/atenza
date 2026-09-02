/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL absoluta del backend (ej. "https://api-atenza.atenzabo.com") — a
   * diferencia de web, acá siempre es obligatoria: la app no tiene "mismo
   * origen" propio. Ver .env (producción) y .env.development (local). */
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
