# Desplegar Atenza (Hetzner)

Guía para dejar `backend/` y `web/` corriendo en un VPS Hetzner con
`docker compose` directo (sin PaaS de por medio). La app móvil
(`mobile/`) se distribuye aparte (Play Store / App Store) — no es parte
de este deploy.

## Topología real

El VPS corre **nginx a nivel de host** (fuera de Docker) como reverse
proxy y terminador de TLS (certbot/Let's Encrypt), y **también hostea
otro proyecto (CIEMSI)** — el certificado de Atenza es multi-dominio
(SAN) y cubre `atenzabo.com`, `api-atenza.atenzabo.com` y
`api-ciemsi.atenzabo.com` en un solo cert.

A diferencia de un esquema de proxy-por-path, acá **frontend y backend
viven en subdominios separados**:

- `atenzabo.com` → nginx del host → contenedor `atenza-web`
  (`web/Dockerfile`, nginx sirviendo el build estático de Vite).
- `api-atenza.atenzabo.com` → nginx del host → contenedor
  `atenza-backend` (Express + Prisma, puerto `3000`).

Por eso `web/Dockerfile` **recibe `VITE_API_URL` con el valor real** en
build time (`https://api-atenza.atenzabo.com`), a diferencia de un
esquema de proxy-por-path donde ese build arg quedaría vacío. Como Vite
inyecta `VITE_*` en el bundle en tiempo de **build, no de runtime**, si
cambia el dominio de la API hay que rebuildear `atenza-web`.

El nginx del host se encarga de rutear cada subdominio a su contenedor
correspondiente vía `server_name` + `proxy_pass` a los puertos internos
expuestos por Docker, y de renovar los certificados con certbot.

## Orquestación: docker compose en el VPS

Producción usa un `docker-compose.yml` propio del servidor (distinto
al de la raíz del repo, que es solo para Postgres en desarrollo local)
con al menos tres servicios: `db` (Postgres), `atenza-backend` y
`atenza-web`. `docker compose up -d` en el VPS levanta/actualiza todo.

## Postgres

Corre como **contenedor Docker en el mismo VPS** (no es un servicio
gestionado externo), con volumen persistente propio para los datos.
Al ser un solo VPS sin failover, hacer **backups periódicos** de ese
volumen (`pg_dump` programado vía cron, o snapshot del volumen) es la
única red de seguridad — no hay nada automático a menos que lo
configures vos.

## Variables de entorno — `atenza-backend`

Basado en `backend/.env.example`, con los valores reales de producción:

| Variable | Valor en producción |
| --- | --- |
| `DATABASE_URL` | Conexión de **migraciones** (usuario con todos los permisos) al Postgres del contenedor `db` |
| `APP_DATABASE_URL` | Conexión de **runtime**, rol restringido `atenza_app` (ver `db/grants.sql`) |
| `PORT` | `3000` (el que expone el contenedor, mapeado internamente para el nginx del host) |
| `APP_URL` | `https://atenzabo.com` — se usa en los links de los correos |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credenciales del admin creado por el seed — **cambiar la password por defecto** |
| `JWT_SECRET` | Generar uno nuevo y aleatorio, nunca el de `.env.example` (`openssl rand -base64 48`) |
| `JWT_EXPIRES_DOCENTE` / `JWT_EXPIRES_ESTUDIANTE` | `8h` / `30d` (igual que dev, ajustable) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Credenciales de [Resend](https://resend.com) (u otro proveedor SMTP) |
| `EMAIL_FROM` | `Atenza <no-responde@atenzabo.com>` — el dominio debe estar verificado en el proveedor de correo |

## Variables de build — `atenza-web`

A diferencia de un esquema de mismo-origen, acá **sí hace falta** setear
un build arg:

| Build arg | Valor en producción |
| --- | --- |
| `VITE_API_URL` | `https://api-atenza.atenzabo.com` — quemado en el bundle estático en build time |

## Volumen persistente: `uploads/`

Los contenedores son efímeros. Sin un volumen montado, las imágenes de
preguntas y los comprobantes de pago (`backend/src/presentation/middlewares/subir-archivos.ts`,
carpeta `uploads/` en la raíz del backend) **se pierden en cada
redeploy**. En el `docker-compose.yml` de producción del VPS, hay que
mantener un volumen montado en `/app/uploads` del contenedor
`atenza-backend`.

## Primer deploy

1. Levantar el servicio `db` (Postgres) en el `docker compose` del VPS.
2. Deployar `atenza-backend` una primera vez (puede fallar el arranque
   si la base está vacía, es esperado).
3. Desde una shell en el VPS con acceso al contenedor/red de Docker:
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
9. Confirmar que el nginx del host tiene bloques `server_name` para
   `atenzabo.com` y `api-atenza.atenzabo.com` apuntando a los puertos
   correctos de cada contenedor, y que certbot renueva el cert SAN
   compartido con CIEMSI sin pisar la config del otro proyecto.

## Verificación local antes de deployar

```bash
cd backend && docker build -t atenza-backend .
cd web && docker build -t atenza-web --build-arg VITE_API_URL=https://api-atenza.atenzabo.com .
```

Si ambos compilan sin errores, el deploy en el VPS (que hace
esencialmente lo mismo vía `docker compose`) debería funcionar igual.

## Nota histórica

Antes de este setup, `web/` estuvo un tiempo en **Railway**. Ese es el
origen del comentario sobre "dominios separados" en `web/Dockerfile` —
sigue aplicando conceptualmente (subdominios separados, no proxy por
path), aunque el hosting actual es Hetzner. Nunca se usó Coolify para
este proyecto — si ves esa mención en commits viejos, está desactualizada.
