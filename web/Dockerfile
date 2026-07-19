# Build: SPA estática (Vite).
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite inyecta las variables VITE_* en el bundle en tiempo de BUILD, no de
# runtime — por eso va como build arg. Vacío = mismo origen (Coolify con
# proxy por path); con un valor (ej. Railway, servicios en dominios
# separados) queda "quemado" en los archivos estáticos generados.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Runtime: nginx sirviendo los estáticos, con fallback a index.html
# (React Router es client-side — cualquier ruta desconocida para nginx
# debe caer en la SPA, no en un 404 de nginx).
FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
