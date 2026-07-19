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

  // Planes SaaS por cuenta (acordado con Roy 17/07): tramos por cantidad
  // de estudiantes activos. monto_mensual en Bs; el anual se calcula al
  // vuelo como monto_mensual * 10 (2 meses gratis), no se guarda aparte.
  const planes = [
    { nombre: 'Básico', limite_estudiantes: 50, monto_mensual: 60, orden: 1 },
    { nombre: 'Intermedio', limite_estudiantes: 120, monto_mensual: 120, orden: 2 },
    { nombre: 'Avanzado', limite_estudiantes: 250, monto_mensual: 220, orden: 3 },
    { nombre: 'Institucional', limite_estudiantes: null, monto_mensual: 0, orden: 4 },
  ];
  for (const plan of planes) {
    const existente = await prisma.plan.findFirst({ where: { nombre: plan.nombre } });
    if (existente) {
      await prisma.plan.update({ where: { id: existente.id }, data: plan });
    } else {
      await prisma.plan.create({ data: plan });
    }
  }
  console.log('[seed] planes creados/verificados: Básico, Intermedio, Avanzado, Institucional');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
