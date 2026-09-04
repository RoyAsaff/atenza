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

Esto es para probar un build local — para **repartir una versión nueva a
los estudiantes** ver "Publicar una actualización" abajo, que además firma
el instalador (un build local sin las variables `TAURI_SIGNING_PRIVATE_KEY*`
no lo firma, y el updater rechaza instaladores sin firma).

## Actualización automática

La app se actualiza sola: al arrancar (una sola vez, nunca en medio de la
sesión) chequea si hay una versión nueva contra
`releases/latest/download/latest.json` de este repo en GitHub (es público,
no hace falta servidor propio ni SSH al VPS — ver
`desktop/src/core/actualizacion/`). Si hay una, la descarga en segundo
plano; recién si en ESE momento no hay un examen en curso la instala y
reinicia la app sola. Si el estudiante arrancó un examen mientras se
descargaba, la actualización se descarta y se reintenta en el próximo
arranque en frío — nunca interrumpe un intento activo.

Los instaladores no se firman con cualquier clave: hay un keypair de
actualización propio de Atenza (generado con `tauri signer generate`). La
privada + su contraseña ya están cargadas como secrets del repo en GitHub
(`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) — **no
existen en ningún lado del código ni de este README**. La pública vive en
`src-tauri/tauri.conf.json` (`plugins.updater.pubkey`), esa sí es pública a
propósito. Si esa clave privada se pierde, no se puede firmar una
actualización nueva y hay que generar un keypair nuevo (lo que además
invalida el `pubkey` quemado en todos los instaladores ya repartidos —
tendrían que reinstalarse a mano una última vez).

### Publicar una actualización

1. Subir `version` en `src-tauri/tauri.conf.json` (semver, ej. `0.1.0` →
   `0.2.0`) y commitear a `main`.
2. Correr el workflow **"Publicar app de escritorio"** a mano desde la
   pestaña Actions del repo (`workflow_dispatch` — a propósito no se
   dispara solo con cada push, un instalador nuevo es una decisión
   consciente, mismo criterio que las migraciones de `deploy-backend.yml`).
3. Eso buildea el `.msi`, lo firma, y crea una GitHub Release con el
   instalador + `latest.json`. Quien instale desde cero baja el instalador
   de esa release; quien ya tenga la app abierta la recibe sola la próxima
   vez que la abra (ver arriba).

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
