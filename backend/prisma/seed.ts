import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Roles del diagrama: admin y docente_estudiante
  await prisma.rol.upsert({
    where: { nombre_rol: 'admin' },
    update: {},
    create: { nombre_rol: 'admin' },
  });
  await prisma.rol.upsert({
    where: { nombre_rol: 'docente_estudiante' },
    update: {},
    create: { nombre_rol: 'docente_estudiante' },
  });
  console.log('[seed] roles creados/verificados');

  // Cuenta del administrador (única, operador de la plataforma)
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@atenza.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin12345';
  await prisma.usuario.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      nombres: 'Administrador',
      apellidos: 'ATENZA',
      email: adminEmail,
      password: await bcrypt.hash(adminPassword, 10),
      email_verificado: true,
      rol: { connect: { nombre_rol: 'admin' } },
    },
  });
  console.log(`[seed] admin creado/verificado: ${adminEmail}`);

  // Planes SaaS por cuenta (17/07, rediseñado 17/08): de 4 tramos por
  // cantidad de estudiantes a 3 roles fijos — Gratis (permanente, 1
  // materia/50 alumnos), Pro (único plan pago, ilimitado + features
  // premium), Institucional (a medida, sin autoservicio). monto_mensual en
  // Bs; el anual se calcula al vuelo como monto_mensual * 10 (2 meses
  // gratis), no se guarda aparte.
  //
  // Los 3 tramos viejos (Básico/Intermedio/Avanzado) se desactivan en vez
  // de borrarse — evita romper FKs de pagos/usuarios de prueba que ya los
  // referencien (no hay clientes reales todavía, pero no cuesta nada ser
  // cuidadoso).
  await prisma.plan.updateMany({
    where: { nombre: { in: ['Básico', 'Intermedio', 'Avanzado'] } },
    data: { activo: false },
  });

  const planes = [
    {
      nombre: 'Gratis',
      tipo: 'gratuito' as const,
      limite_estudiantes: 50,
      limite_materias: 1,
      permite_import_word: false,
      permite_guias: false,
      // Gratis (a diferencia de Guías/Import Word): mismo criterio que los
      // exámenes de opción múltiple (E7), que ya son gratis — el límite de
      // 1 materia/50 alumnos + el rate-limit de ejecuciones acotan el
      // costo de cómputo real (Docker) de una cuenta sin pagar. Decisión
      // con Roy (01/09): barato de revertir si el costo se vuelve problema.
      permite_examenes_codigo: true,
      monto_mensual: 0,
      orden: 1,
      activo: true,
    },
    {
      nombre: 'Pro',
      tipo: 'pago' as const,
      limite_estudiantes: null,
      limite_materias: null,
      permite_import_word: true,
      permite_guias: true,
      permite_examenes_codigo: true,
      monto_mensual: 99,
      orden: 2,
      activo: true,
    },
    {
      // Ya existía (orden 4 legado) — se actualiza el registro existente
      // en vez de crear uno nuevo, para no romper referencias previas.
      nombre: 'Institucional',
      tipo: 'institucional' as const,
      limite_estudiantes: null,
      limite_materias: null,
      permite_import_word: true,
      permite_guias: true,
      permite_examenes_codigo: true,
      monto_mensual: 0,
      orden: 3,
      activo: true,
    },
  ];
  for (const plan of planes) {
    const existente = await prisma.plan.findFirst({ where: { nombre: plan.nombre } });
    if (existente) {
      await prisma.plan.update({ where: { id: existente.id }, data: plan });
    } else {
      await prisma.plan.create({ data: plan });
    }
  }
  console.log('[seed] planes creados/verificados: Gratis, Pro, Institucional (legados desactivados)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
