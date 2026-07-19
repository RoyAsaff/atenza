# Build: compila TS y genera el cliente de Prisma con todas las deps.
FROM node:20-alpine AS build
# node:20-alpine no trae OpenSSL — Prisma lo necesita para elegir el
# binario del motor correcto (sin esto, detecta mal la versión y puede
# fallar al conectar en runtime, aunque el build "pase" igual).
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

# Runtime: solo deps de producción + lo ya compilado — imagen liviana.
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
# El cliente de Prisma generado en el build no sobrevive un "npm ci
# --omit=dev" limpio (necesita el CLI, que es devDependency) — se copia
# ya generado encima de las deps de producción recién instaladas.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/index.js"]
