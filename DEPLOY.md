# Desplegar Atenza (Hetzner + Coolify)

Guía para dejar `backend/` y `web/` corriendo en un VPS Hetzner con
Coolify. La app móvil (`mobile/`) se distribuye aparte (Play Store / App
Store) — no es parte de este deploy.

## Topología recomendada

Tres recursos en Coolify, no un `docker-compose` combinado:

1. **Postgres** — usa el recurso de base de datos propio de Coolify (no
   el `docker-compose.yml` del repo, que es solo para desarrollo local).
   Activa los **backups programados** de Coolify: al ser un solo VPS sin
   failover, es la única red de seguridad.
2. **`atenza-backend`** — aplicación Docker apuntando a `backend/Dockerfile`.
3. **`atenza-web`** — aplicación Docker apuntando a `web/Dockerfile`.

Un solo dominio (p. ej. `atenza.tudominio.com`), con reglas de
enrutamiento en Coolify (Traefik por debajo):

- `/api/*`, `/uploads/*` y `/socket.io/*` → `atenza-backend`
- todo lo demás → `atenza-web`

**Importante:** no olvidar `/uploads/*` — es donde se sirven el QR de
cobro y los comprobantes de pago (`express.static` en
`backend/src/presentation/app.ts`). Si falta esa regla, esas imágenes
dan 404 porque caen en `atenza-web` en vez de en el backend (síntoma:
el QR no se ve ni en `/admin/planes` ni al elegir plan como docente).

Así el frontend sigue funcionando con `baseURL: '/'`
(`web/src/core/api/cliente.ts`) **sin tocar código ni configurar CORS** —
es el mismo esquema que el proxy de Vite en desarrollo
(`web/vite.config.ts`).

## Variables de entorno — `atenza-backend`

Basado en `backend/.env.example`, con los valores reales de producción:

| Variable | Valor en producción |
| --- | --- |
| `DATABASE_URL` | Conexión de **migraciones** (usuario con todos los permisos) al Postgres de Coolify |
| `APP_DATABASE_URL` | Conexión de **runtime**, rol restringido `atenza_app` (ver `db/grants.sql`) |
| `PORT` | `3000` (o el que exponga el contenedor) |
| `APP_URL` | `https://atenza.tudominio.com` — se usa en los links de los correos |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credenciales del admin creado por el seed — **cambiar la password por defecto** |
| `JWT_SECRET` | Generar uno nuevo y aleatorio, nunca el de `.env.example` (`openssl rand -base64 48`) |
| `JWT_EXPIRES_DOCENTE` / `JWT_EXPIRES_ESTUDIANTE` | `8h` / `30d` (igual que dev, ajustable) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Credenciales de [Resend](https://resend.com) (u otro proveedor SMTP) |
| `EMAIL_FROM` | `Atenza <no-responde@tudominio.com>` — el dominio debe estar verificado en el proveedor de correo |

`atenza-web` no necesita ninguna variable de entorno (no usa
`import.meta.env` en ningún lado — confirmado, todo el ruteo a la API es
por path relativo).

## Volumen persistente: `uploads/`

Los contenedores son efímeros. Sin un volumen montado, las imágenes de
preguntas y los comprobantes de pago (`backend/src/presentation/middlewares/subir-archivos.ts`,
carpeta `uploads/` en la raíz del backend) **se pierden en cada
redeploy**. En Coolify, agregar un volumen persistente montado en
`/app/uploads` del contenedor `atenza-backend`.

## Primer deploy

1. Levantar el recurso Postgres en Coolify, copiar sus credenciales a
   `DATABASE_URL`.
2. Deployar `atenza-backend` una primera vez (puede fallar el arranque
   si la base está vacía, es esperado).
3. Desde una shell con acceso a esa base (o un job puntual en Coolify):
   ```bash
   cd backend
   npx prisma migrate deploy   # NO "migrate dev" — deploy es para producción
   ```
4. Ejecutar `db/grants.sql` contra la base de producción (mismo script
   que en local, ver cabecera del archivo para el comando exacto) — sin
   esto `atenza_app` no puede leer/escribir nada.
5. `npx prisma db seed` — crea el rol admin y los 4 planes (Básico,
   Intermedio, Avanzado, Institucional; ajustar montos en
   `backend/prisma/seed.ts` si hace falta antes de correrlo).
6. Reiniciar `atenza-backend` para que arranque limpio.
7. Entrar como admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) y subir el QR de
   cobro en `/admin/planes` — sin esto los docentes no pueden elegir plan
   (`ElegirPlan` devuelve `ESTADO_INVALIDO`).
8. Probar el flujo de correo real: "Olvidé mi contraseña" desde
   `/login` y confirmar que llega el correo (antes solo se veía en la
   consola del backend).

## Verificación local antes de deployar

```bash
cd backend && docker build -t atenza-backend .
cd web && docker build -t atenza-web .
```

Si ambos compilan sin errores, el deploy en Coolify (que hace
exactamente lo mismo) debería funcionar igual.
