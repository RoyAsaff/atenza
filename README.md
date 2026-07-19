# ATENZA (EvaluApp)

Plataforma de Gestión Académica y Evaluaciones en Aula — Backlog v1.1.

## Estructura del monorepo

| Carpeta    | Componente                                      | Tecnología                        |
| ---------- | ----------------------------------------------- | --------------------------------- |
| `backend/` | API, tiempo real, notificaciones, PDF, bitácora | Node.js/Express + TS + PostgreSQL |
| `web/`     | Web docente y admin (pendiente de crear)        | React                             |
| `mobile/`  | App estudiantes (pendiente de crear)            | Flutter                           |
| `db/`      | Scripts SQL de roles y permisos de BD           | PostgreSQL                        |

## Requisitos

- Node.js 18+
- Docker (PostgreSQL en contenedor, puerto **5433** para no chocar con el Postgres local)
- Flutter SDK (fase móvil)

## Arranque rápido (desarrollo)

```bash
docker compose up -d          # levanta PostgreSQL
cd backend
npm install
npx prisma migrate dev        # crea las tablas
npm run dev                   # API en http://localhost:3000
```
