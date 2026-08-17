# Handoff: Inicio del docente (1b) — Atenza

## Overview
Rediseño de la pantalla de Inicio del panel docente de Atenza (`web/src/features/mi-espacio/InicioPage.tsx`, ruta `/` con sesión iniciada). La pantalla actual lista las clases de hoy en dos secciones ("Enseño" / "Inscrito") con tarjetas idénticas y tres botones del mismo peso por clase. El rediseño (opción **1b**, aprobada por el usuario) reorganiza la pantalla alrededor de la clase que está ocurriendo en este momento y suma una columna de trabajo pendiente.

Alcance de este handoff: **solo InicioPage**. La landing pública (`LandingPage.tsx`) también fue analizada, pero su rediseño no está aprobado todavía y no forma parte de este paquete.

## About the Design Files
Los archivos de este bundle son **referencias de diseño hechas en HTML** — prototipos que muestran el aspecto y comportamiento buscados, no código de producción para copiar. La tarea es **recrear estos diseños dentro del entorno ya existente del repo**: React 18 + TypeScript + Vite, Tailwind CSS v4 con tokens en `@theme` (`web/src/core/ui/tokens.css`), react-router-dom, TanStack Query, lucide-react, y los componentes propios de `web/src/core/ui/` (`Card`, `Button`/`botonClases`, `Badge`, `EmptyState`, `Spinner`).

**No introducir librerías nuevas ni CSS suelto.** Todo el diseño se expresa con clases Tailwind sobre los tokens existentes (`bg-primary-800`, `text-text-secondary`, `border-border`, `shadow-md`, etc.). Los valores hex de abajo están sólo para que puedas mapearlos al token correcto — en el código va el token, nunca el hex.

## Fidelity
**Alta fidelidad.** Colores, tipografía, espaciado y jerarquía son definitivos y salen de los tokens del propio repo. Recrear pixel-perfect usando los componentes existentes.

## Screens / Views

### Inicio — docente con clases hoy (estado principal)

**Purpose:** el docente entra y ve, sin leer, qué clase está dictando ahora y qué acción le toca; en segundo plano, qué le queda del día y qué trabajo tiene pendiente.

**Layout (>= lg, dentro del `<main>` del `Layout.tsx` existente, que ya aporta `max-w-5xl` y padding):**
- Grid de 2 columnas: `grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_296px] gap-6 items-start`.
- Columna izquierda: `flex flex-col gap-[18px]` → saludo, bloque de clase en curso, "Resto del día", "Ya pasó".
- Columna derecha: panel "Requiere tu atención", ancho fijo 296px, `items-start` para que no se estire.
- Por debajo de `lg` la columna derecha pasa a segunda posición en una sola columna (ver "Móvil").

**Componentes:**

**1. Encabezado**
- Fila `flex items-baseline justify-between gap-3`.
- Izquierda: `h1` "Hola, {nombres}" — 22px / `font-extrabold` / `tracking-tight` / `text-text` (#2e3a42). Sin emoji (el 👋 actual se elimina).
- Derecha: fecha y hora — `font-mono` 12px / `font-medium` / `tracking-[0.06em]` / `uppercase` / `text-text-muted` (#677b89). Copy: "Lun 17 ago · 10:34". La hora se actualiza cada 60 s.
- **Se elimina** el párrafo "Elige una materia en el menú de la izquierda…" — describe el sidebar que ya está a la vista.

**2. Bloque de clase en curso** (el elemento central)
- Contenedor: `rounded-2xl bg-primary-800 p-6 flex flex-col gap-[18px]` (radius 14px, fondo #254674).
- Fila de estado: punto de 8px `rounded-full bg-secondary-500` (#45d3e3) + texto `font-mono` 11px / `font-medium` / `tracking-[0.1em]` / `uppercase` / color `secondary-300` (#a4e3ea). Copy: "En curso · termina 11:50".
- Nombre de la materia: 24px / `font-extrabold` / `tracking-tight` / blanco.
- Subtítulo: 15px / `text-primary-200` (#cbd9ec). Copy: "{tema} · {n} estudiantes".
- Acciones, `flex items-center gap-2.5`:
  - Primaria "Pasar lista": `bg-white text-primary-800` 15px `font-bold`, padding 11px/20px, radius 8px.
  - Secundarias "Evaluaciones" y "Guías": `border border-primary-500 text-primary-100` 15px `font-medium`, padding 11px/18px, radius 8px. Fondo transparente.
  - Hover secundarias: `bg-primary-700`.
- Sin iconos dentro de este bloque: el contraste ya da la jerarquía y los iconos ensucian sobre navy.

**3. "Resto del día"**
- Título de sección: 12px / `font-semibold` / `uppercase` / `tracking-[0.06em]` / `text-text-muted`, `mb-2.5`.
- Lista dentro de un `Card` sin padding: `bg-surface border border-border rounded-xl overflow-hidden`.
- Cada fila: `flex items-center gap-4 px-4 py-3.5`, divisor `border-b border-neutral-100` salvo la última.
  - Hora: `font-mono` 13px / `font-medium` / `text-text-secondary` / ancho fijo `w-11`.
  - Centro: nombre de materia 15px `font-semibold text-text`; debajo tema 13px `text-text-muted`.
  - Derecha: "Preparar →" / "Ver →" 14px `font-medium text-link` (#2d5a9a).
  - Toda la fila es un `<Link>`; hover `bg-surface-hover`.
- Las materias donde el usuario está **inscrito** aparecen en la misma lista, con "Inscrito · " como prefijo del tema. No hay sección "Inscrito" separada.

**4. "Ya pasó"**
- Mismo título de sección. Sin card: filas sueltas con `px-4`.
- Hora en `text-text-disabled` (#9fb0bc), nombre + tema en 14px `text-text-muted`, y a la derecha el resultado: "Lista tomada · 30/32" en 13px `font-medium text-secondary-700` (#14a3b3).
- Si la asistencia no se tomó: "Sin lista" en `text-accent-700` (#a15326) y la fila enlaza a pasar lista.

**5. Panel "Requiere tu atención"** (columna derecha)
- `bg-surface border border-border rounded-2xl overflow-hidden`.
- Cabecera: `px-4 py-3.5 border-b border-border`, título 14px `font-bold text-text`.
- Ítems: `px-4 py-3.5 flex flex-col gap-1.5`, divididos por `border-b border-neutral-100`.
  - Badge (`self-start`, `px-2.5 py-[3px] rounded-full` 11px `font-bold uppercase tracking-[0.03em]`):
    - "Evaluación abierta" → `bg-accent-50 text-accent-700`
    - "Por revisar" → `bg-primary-100 text-primary-800`
    - "Asistencia" → `bg-neutral-100 text-neutral-700`
  - Título del ítem: 14px `font-semibold text-text`.
  - Detalle: 13px `text-text-muted`.
- Cada ítem es un `<Link>` a su destino. Máximo 4 ítems; si hay más, un enlace "Ver todo" al pie.
- Si no hay pendientes, el panel entero **no se renderiza** (la columna izquierda pasa a ancho completo).

### Estados

**Sin clase en curso (hay clases hoy, pero ninguna ahora) — ver `3a`**
Mismo bloque, pero en superficie blanca: `bg-surface border border-border rounded-2xl p-[22px]`. El navy se reserva exclusivamente para "está pasando ahora".
- Punto gris `bg-neutral-300`, etiqueta "Próxima clase · en 2 h 25 min" en `text-text-muted`.
- Nombre 21px `font-extrabold text-text`; subtítulo "15:00 · {tema} · {n} estudiantes".
- Acción primaria: **"Preparar clase"** (`bg-primary-800 text-white`), no "Pasar lista". Secundarias con borde `border-border`.

**Día terminado / sin clases hoy — ver `3b`**
Reemplaza el actual "No tienes clases hoy." en `text-text-disabled`.
- Card centrada, `p-6`, `flex flex-col items-center gap-2.5 text-center`.
- Título 19px `font-bold`: "Terminaste el día" (si hubo clases) o "Sin clases hoy" (si el día estaba vacío).
- Descripción 15px `text-text-secondary`, máx. 360px: "3 clases dictadas, 3 listas tomadas. Mañana empiezas con **Cálculo I** a las 08:00."
- Dos acciones: "Revisar entregas (n)" primaria + "Preparar mañana" secundaria. Si no hay entregas pendientes, sólo la segunda, como primaria.

**Cargando — ver `3c`**
Reemplazar `<Spinner /> Cargando clases de hoy…` por un esqueleto que reserve la altura real:
- Bloque `h-[150px] rounded-2xl bg-neutral-100`.
- Card con dos filas de placeholders (barras `rounded bg-neutral-100` / `bg-[#eef3f7]`).
- Sin animación de pulso, o pulso muy sutil (`animate-pulse` de Tailwind es aceptable).

**Cuenta nueva, sin materias — ver `3d`**
Se conserva el `EmptyState` pero con acciones reales:
- Icono `GraduationCap` 30px `opacity-40`, título 19px "Bienvenido a Atenza, {nombres}".
- Descripción: "Crea tu primera materia y comparte el código con tu curso para empezar a pasar lista."
- Botones: "Crear materia" (primario) y "Unirme con un código" (secundario), abriendo los mismos modales que el botón "+" del topbar. **Ya no se describe dónde está el botón "+".**

**Móvil (< lg) — ver `3e`**
- Una sola columna, padding `px-3.5 py-4.5`, `gap-4`.
- Orden: encabezado → bloque en curso → **Requiere tu atención** (carrusel horizontal con `overflow-x-auto`, tarjetas de 236px, `snap-x`) → Resto del día → Ya pasó.
- En el bloque en curso las acciones se apilan: "Pasar lista" a ancho completo, 46px de alto; debajo "Evaluaciones" y "Guías" en fila, `flex-1`, 44px.
- Título de materia baja a 19px; el resto de tamaños se mantiene.
- Ningún objetivo táctil por debajo de 44px.

## Interactions & Behavior
- **Definición de "en curso":** `hora <= ahora < hora + duracion_minutos`. El backend hoy no devuelve duración — ver "Requisitos de backend". Con una tolerancia de 10 min antes de la hora de inicio, para que el bloque ya esté activo cuando el docente entra al aula.
- Sólo puede haber **una** clase en curso. Si por solapamiento hubiera dos, gana la que empezó más tarde.
- El estado se recalcula con un `setInterval` de 60 s (o `useEffect` con timer al próximo cambio de estado), sin refetch de red.
- Al pasar de "en curso" a "terminada", el bloque hace transición al estado `3a` (próxima clase) con `duration-base` (200ms) y `ease-atenza`.
- Hover en filas: `bg-surface-hover`, `duration-fast`.
- Focus visible en todos los `<Link>`: `ring-2 ring-focus` (#5c8bcc), como el resto del panel.
- Error de red: mantener el patrón de manejo de errores existente en el repo (no se rediseña).

## State Management
- `useAuth()` → `sesion.usuario.nombres` (ya existe).
- `useQuery(['mi-espacio'])` → materias dictadas/inscritas (ya existe, decide entre EmptyState y contenido).
- `useQuery(['clases-hoy'])` → `ClasesDeHoy` (ya existe, `enabled: hayMaterias`).
- **Nuevo** `useQuery(['pendientes'])` → alimenta "Requiere tu atención". `enabled: hayDictadas`. Si falla, el panel simplemente no se muestra: no debe romper la pantalla.
- Estado local `ahora: Date` actualizado cada 60 s, del que se derivan clase en curso / próxima / pasadas con `useMemo`.
- Las tres listas (pasadas, en curso, resto) se derivan de **una sola** fuente: `[...dictadas, ...inscritas]` ordenado por hora, cada elemento con su rol. No hay dos listas separadas.

## Requisitos de backend
1. `GET /api/mi-espacio/clases-hoy` — agregar a `ClaseDeHoy`:
   - `duracion_minutos: number` (necesario para saber si la clase está en curso)
   - `rol: 'dictada' | 'inscrita'` (para poder devolver una lista única y ordenada)
   - `total_estudiantes: number`
   - `asistencia_tomada: boolean` + `asistencia_resumen: { presentes: number; total: number } | null`
   - `tiene_evaluacion_abierta: boolean`
2. `GET /api/mi-espacio/pendientes` — **endpoint nuevo**. Devuelve hasta 4 ítems:
   ```ts
   type TipoPendiente = 'evaluacion_abierta' | 'por_revisar' | 'asistencia';
   interface Pendiente {
     tipo: TipoPendiente;
     titulo: string;      // "Práctico 3 — Álgebra Lineal"
     detalle: string;     // "18 de 24 entregaron · cierra hoy 23:59"
     url: string;         // destino del Link
   }
   ```
   - `evaluacion_abierta`: evaluaciones en estado `lanzada` del docente.
   - `por_revisar`: guías con respuestas abiertas sin corregir (`FilaRevisionGuia`) y evaluaciones finalizadas sin publicar.
   - `asistencia`: estudiantes con 2+ faltas consecutivas.
   - Orden: `evaluacion_abierta` → `por_revisar` → `asistencia`.

   Si este endpoint no se implementa en la primera iteración, omitir la columna derecha por completo — el resto del rediseño funciona sin ella.

## Design Tokens
Todos ya existen en `web/src/core/ui/tokens.css`. Usar el token, no el hex.

**Colores usados**

| Uso | Token | Hex |
|---|---|---|
| Bloque en curso | `primary-800` | #254674 |
| Texto sobre navy (secundario) | `primary-200` | #cbd9ec |
| Borde de botón sobre navy | `primary-500` | #5c8bcc |
| Badge "Por revisar" fondo | `primary-100` | #e5ecf5 |
| Punto "en curso" | `secondary-500` | #45d3e3 |
| Etiqueta "En curso" | `secondary-300` | #a4e3ea |
| "Lista tomada" | `secondary-700` | #14a3b3 |
| Badge "Evaluación abierta" | `accent-50` / `accent-700` | #fef4ee / #a15326 |
| Fondo de la app | `canvas` (neutral-50) | #f3f7f9 |
| Superficie | `surface` | #ffffff |
| Divisor interno de listas | `neutral-100` | #e8eef3 |
| Borde | `border` (neutral-200) | #d2dde5 |
| Texto principal | `text` (neutral-900) | #2e3a42 |
| Texto secundario | `text-secondary` (neutral-700) | #556672 |
| Texto atenuado | `text-muted` (neutral-600) | #677b89 |
| Texto deshabilitado | `text-disabled` (neutral-400) | #9fb0bc |
| Enlaces | `link` (primary-700) | #2d5a9a |

**Tipografía** — Plus Jakarta Sans Variable (`--font-sans`) para todo, salvo horas, fecha y etiquetas de estado, que van en `font-mono` (la del sistema; si se quiere fijar, JetBrains Mono, como en el prototipo).

Escala: 24 `extrabold` (materia en curso) · 22 `extrabold` (h1) · 19 `bold` (títulos de estado) · 15 `semibold` (materia en fila) · 15 regular (subtítulo) · 14 (badges de panel, acciones) · 13 (detalles) · 12 `semibold uppercase tracking-[0.06em]` (títulos de sección) · 11 `mono uppercase tracking-[0.1em]` (estado).

**Radios** — `rounded-2xl` 14-16px (bloque en curso, panel) · `rounded-xl` 12px (cards de lista) · `rounded-lg` 8px (botones) · `rounded-full` (badges, puntos).

**Sombras** — `shadow-md` sólo en la tarjeta de la clase en curso de la variante `3a`. El bloque navy no lleva sombra. Las cards de lista, sin sombra (el borde basta).

**Espaciado** — gap 18px entre bloques de la columna izquierda · 24px entre columnas · padding 24px en el bloque en curso · 16px horizontal / 14px vertical en filas de lista.

**Motion** — `--duration-fast` 150ms (hover) · `--duration-base` 200ms (cambios de estado) · `--ease-atenza` `cubic-bezier(0.16, 1, 0.3, 1)`.

## Assets
- `isologo.png` — el isologo real del repo (`web/src/logo/isologo.png`), incluido sólo para que el prototipo se vea correcto. **No copiarlo**: el repo ya lo tiene y ya existe el componente `Logo`.
- Iconos: **lucide-react**, ya instalado. En el prototipo se usaron SVGs estáticos de lucide vía CDN; en el código van los componentes: `ChevronRight`, `GraduationCap`, `Menu`. El bloque en curso no lleva iconos.
- No hay imágenes nuevas.

## Files
- `Inicio-analisis-y-rediseno.dc.html` — prototipo completo. Se abre directo en el navegador. Contiene, de arriba hacia abajo:
  - **1b en detalle** (`3a`–`3e`): los estados y el móvil especificados arriba.
  - **Inicio sin sesión** (`ACTUAL`, `2a`): análisis de la landing pública. **Fuera del alcance de este handoff.**
  - **Pantalla de Inicio** (`ACTUAL`, `1a`, `1b`): reconstrucción del estado actual y las dos direcciones exploradas. **`1b` es la aprobada.** `1a` queda como referencia de lo que se descartó.
- `support.js` y `isologo.png` — necesarios para que el prototipo se renderice.

## Archivos del repo a tocar
- `web/src/features/mi-espacio/InicioPage.tsx` — reescritura completa del `return`; el bloque de queries se conserva y se le suma `['pendientes']`.
- `web/src/core/tipos.ts` — extender `ClaseDeHoy`, agregar `Pendiente`.
- Backend: endpoint `/api/mi-espacio/pendientes` y campos extra en `/api/mi-espacio/clases-hoy`.
- No hace falta tocar `Layout.tsx`, `Sidebar.tsx` ni `tokens.css`.
