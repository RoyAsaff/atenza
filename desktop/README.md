# ATENZA — App de escritorio (exámenes de código)

E9: Tauri (Rust + WebView nativo) + React/TS/Tailwind — mismo stack que
`web/`, sin paquete compartido todavía (los tipos/cliente se duplican a
mano, ver comentarios en `src/core/`). Su único trabajo es rendir un examen
de código: login (contexto `estudiante`) → esperar a que el docente lance
un examen → resolver ejercicios en Monaco → enviar → ver el resultado.

```
src/
  core/
    tipos.ts          # DTOs mínimos, calcado del shape "para rendir" del backend
    api/cliente.ts     # axios + interceptor de sesión (401 → limpia sesión)
    auth/               # sesión persistida en disco (Tauri Store, no sessionStorage)
    realtime/socket.ts # mismo patrón que web
    kiosco/             # useModoKiosko: fullscreen + detecta foco/minimizado/cierre
    ui/                 # subconjunto mínimo de web/src/core/ui (Button/Card/Input/Campo)
  features/
    login/
    examen/ExamenCodigoPage.tsx   # la pantalla — calco de web/RendirExamenPage.tsx
src-tauri/    # lado Rust: solo registra los plugins (store, opener), sin lógica propia
```

## Primera vez (requisitos del sistema)

Tauri necesita, además de Node:

- **Rust** (`rustup`, canal stable) — `winget install Rustlang.Rustup`.
- **Windows**: workload "Desktop development with C++" de Visual Studio
  (o Build Tools) para el linker MSVC, y el runtime WebView2 (ya viene
  instalado en Windows 11).

```bash
cd desktop
npm install
```

## Ejecutar en desarrollo

```bash
npm run tauri dev
```

`.env.development` apunta a `http://localhost:3000` (backend local, `cd
backend && npm run dev`). `.env` (producción, `https://api-atenza.
atenzabo.com`) es el que se usa en `npm run tauri build` — no está en git
(no es secreto, es solo la URL pública del backend, pero sigue la misma
convención que el resto del repo de no versionar `.env`); si cloneás este
repo de cero, recreá `desktop/.env` con `VITE_API_URL=https://api-atenza.
atenzabo.com` antes de buildear para producción.

## Buildear el instalador

```bash
npm run tauri build
```

Genera el `.msi`/`.exe` (NSIS) en `src-tauri/target/release/bundle/`. El
ícono de la app todavía es el placeholder que genera `create-tauri-app`
(`src-tauri/icons/`) — reemplazar con `npm run tauri icon <ruta-al-logo>`
cuando haya un ícono de Atenza en alta resolución.

## Decisiones aplicadas (ver plan completo en el epic E9)

- Sesión persistida en disco (Tauri Store), igual que mobile
  (`shared_preferences`) — a diferencia de web, que no la recuerda entre
  ingresos (D-03, ahí sí aplica porque es un panel compartido).
- Kiosko: solo detecta y avisa (pérdida de foco, minimizado, intento de
  cierre) — nunca bloquea Alt+Tab/tecla Windows a nivel de SO. El docente
  decide qué hacer con cada incidente, mismo principio que el resto de
  Atenza (E7, Guías nativas).
- **Sin autosave de borrador**: el backend no tiene un endpoint de
  "guardar sin calificar" — "Ejecutar" no persiste y "Enviar" persiste
  PERO también califica. El código vive solo en memoria hasta que el
  estudiante aprieta uno de los dos. Ver el comentario al inicio de
  `ExamenCodigoPage.tsx`.
