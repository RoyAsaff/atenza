// E9 · Smoke test de punta a punta contra la API real (backend corriendo
// en localhost:3000). Crea un docente + estudiante + materia + clase de
// prueba, lanza un examen de código con un caso visible y uno oculto,
// lo rinde como estudiante (Ejecutar + Enviar) y verifica la nota
// calculada del lado docente.
//
// Requisitos antes de correr esto:
//   1. docker compose up -d          (Postgres)
//   2. npx prisma migrate dev        (crea las tablas nuevas)
//   3. grants.sql re-aplicado        (ver README/CONTEXTO.md)
//   4. npx prisma db seed            (Plan.permite_examenes_codigo en Gratis)
//   5. npm run dev                   (backend en :3000)
//   6. Docker Desktop corriendo      (para el sandbox — probar-sandbox.ts primero)
//
// Uso: cd backend && npx tsx scripts/probar-examen-codigo.ts

const BASE = process.env.API_URL ?? 'http://localhost:3000';
const SUFIJO = Date.now(); // evita choques de email si se corre más de una vez

async function api(metodo: string, ruta: string, token?: string, body?: unknown) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const texto = await respuesta.text();
  const datos = texto ? JSON.parse(texto) : undefined;
  if (!respuesta.ok) {
    throw new Error(`${metodo} ${ruta} → ${respuesta.status}: ${JSON.stringify(datos)}`);
  }
  return datos;
}

async function main() {
  console.log('1) Registrando docente y estudiante de prueba...');
  const emailDocente = `docente.e9.${SUFIJO}@test.com`;
  const emailEstudiante = `estudiante.e9.${SUFIJO}@test.com`;
  const password = 'Test1234';

  await api('POST', '/api/auth/registro', undefined, {
    nombres: 'Docente',
    apellidos: 'PruebaE9',
    email: emailDocente,
    password,
  });
  await api('POST', '/api/auth/registro', undefined, {
    nombres: 'Estudiante',
    apellidos: 'PruebaE9',
    email: emailEstudiante,
    password,
  });

  const loginDocente = await api('POST', '/api/auth/login', undefined, {
    email: emailDocente,
    password,
  });
  const tokenDocente: string = loginDocente.token;
  const docenteId: number = loginDocente.usuario.id;

  const loginEstudiante = await api('POST', '/api/auth/login', undefined, {
    email: emailEstudiante,
    password,
    contexto: 'estudiante',
  });
  const tokenEstudiante: string = loginEstudiante.token;
  const estudianteId: number = loginEstudiante.usuario.id;

  console.log('2) Confirmando que el plan Gratis (por defecto al registrarse) ya incluye');
  console.log('   exámenes de código (decisión 01/09: mismo criterio que los de opción múltiple)...');
  const { prisma } = await import('../src/infrastructure/db/prisma');
  const planGratis = await prisma.plan.findFirstOrThrow({ where: { nombre: 'Gratis' } });
  if (!planGratis.permite_examenes_codigo) {
    throw new Error(
      'El plan Gratis no tiene permite_examenes_codigo=true — ¿corriste "npx prisma db seed"?',
    );
  }

  console.log('3) Creando materia, clase, matriculando al estudiante y pasando lista...');
  const { materia } = await api('POST', '/api/materias', tokenDocente, {
    nombre_materia: 'Programación E9',
    carrera: 'Sistemas',
    semestre: '1',
    universidad: 'Universidad de Prueba',
  });
  const hoy = new Date().toISOString().slice(0, 10);
  const { clase } = await api('POST', `/api/materias/${materia.id}/clases`, tokenDocente, {
    fecha: hoy,
    hora: '08:00',
    tema: 'Examen de código',
  });
  await api('POST', '/api/inscripciones', tokenEstudiante, {
    codigo_materia: materia.codigo,
    codigo_estudiante: 'EST001',
  });
  await api('POST', `/api/materias/${materia.id}/clases/${clase.id}/asistencia`, tokenDocente, {
    marcajes: [{ estudiante_id: estudianteId, marcaje: 'puntual' }],
  });

  console.log('4) Creando el examen de código (1 ejercicio: sumar dos enteros)...');
  const { examen } = await api(
    'POST',
    `/api/materias/${materia.id}/clases/${clase.id}/examenes-codigo`,
    tokenDocente,
    { tema: 'Suma de dos enteros', nota: 100 },
  );
  const codigoCorrecto = 'a, b = map(int, input().split())\nprint(a + b)\n';
  await api(
    'POST',
    `/api/materias/${materia.id}/examenes-codigo/${examen.id}/ejercicios`,
    tokenDocente,
    {
      enunciado: 'Lee dos enteros separados por espacio desde stdin e imprime su suma.',
      plantilla_codigo: '# escribe tu solución acá\n',
      nota: 100,
      casos_prueba: [
        { entrada: '2 3\n', salida_esperada: '5', es_oculto: false },
        { entrada: '10 20\n', salida_esperada: '30', es_oculto: true },
      ],
    },
  );
  await api(
    'POST',
    `/api/materias/${materia.id}/examenes-codigo/${examen.id}/guardar`,
    tokenDocente,
  );
  await api(
    'POST',
    `/api/materias/${materia.id}/examenes-codigo/${examen.id}/lanzar`,
    tokenDocente,
  );

  console.log('5) Como estudiante: abriendo el intento...');
  const { intento } = await api('GET', '/api/intentos-codigo/actual', tokenEstudiante);
  if (!intento) throw new Error('No llegó ningún intento activo — ¿se lanzó bien el examen?');
  const ejercicio = intento.ejercicios[0];
  console.log(`   examen "${intento.tema}", ejercicio #${ejercicio.id}, ${ejercicio.total_casos} casos totales`);

  console.log('6) "Ejecutar" (solo casos visibles, no persiste nada)...');
  const { resultados } = await api(
    'POST',
    `/api/intentos-codigo/${intento.intento_id}/ejercicios/${ejercicio.id}/ejecutar`,
    tokenEstudiante,
    { codigo_fuente: codigoCorrecto },
  );
  console.log('   →', resultados);
  if (resultados.length !== 1) throw new Error('Ejecutar debería devolver solo el caso visible');

  console.log('7) "Enviar" (corre TODOS los casos, incluido el oculto, y califica)...');
  const { resultado } = await api(
    'POST',
    `/api/intentos-codigo/${intento.intento_id}/ejercicios/${ejercicio.id}/enviar`,
    tokenEstudiante,
    { codigo_fuente: codigoCorrecto },
  );
  console.log(`   casos_acertados=${resultado.casos_acertados} casos_totales=${resultado.casos_totales}`);
  console.log(`   resultados_visibles (nunca debe traer el caso oculto):`, resultado.resultados_visibles);

  console.log('8) Reportando un incidente de prueba (pérdida de foco)...');
  await api('POST', `/api/intentos-codigo/${intento.intento_id}/incidente`, tokenEstudiante, {
    tipo: 'perdida_foco',
  });

  console.log('9) Finalizando el examen...');
  await api('POST', `/api/intentos-codigo/${intento.intento_id}/finalizar`, tokenEstudiante);

  console.log('10) Como docente: viendo resultados...');
  const { resultados: resultadosDocente } = await api(
    'GET',
    `/api/materias/${materia.id}/examenes-codigo/${examen.id}/resultados`,
    tokenDocente,
  );
  console.log(JSON.stringify(resultadosDocente, null, 2));

  const fila = resultadosDocente.filas[0];
  const ok =
    fila?.casos_acertados === 2 && fila?.casos_totales === 2 && fila?.nota_obtenida === 100 && fila?.incidentes === 1;

  console.log(
    ok
      ? '\n✅ TODO OK — el examen se lanzó, se rindió, se calificó (100/100) y el incidente quedó registrado.'
      : '\n❌ Algo no cuadra con lo esperado (revisar la fila de resultados arriba).',
  );
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error('\n❌ Falló:', error);
  process.exit(1);
});
