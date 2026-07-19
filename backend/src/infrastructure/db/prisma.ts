import { PrismaClient } from '@prisma/client';

// En runtime la API usa el rol restringido atenza_app (D-10).
// Las migraciones usan DATABASE_URL (postgres) desde la CLI de Prisma.
export const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL },
  },
});
