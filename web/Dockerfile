# Build: SPA estática (Vite).
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime: nginx sirviendo los estáticos, con fallback a index.html
# (React Router es client-side — cualquier ruta desconocida para nginx
# debe caer en la SPA, no en un 404 de nginx).
FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
