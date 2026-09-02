// E9 · Prueba AISLADA del sandbox de Docker (sin tocar la BD ni la API).
// Corre esto primero: es la pieza con más riesgo real (aislamiento de
// código no confiable) y falla rápido si Docker Desktop no está corriendo
// o si dockerode no encuentra el socket/pipe correcto.
//
// Uso: cd backend && npx tsx scripts/probar-sandbox.ts

import { DockerodePythonRunner } from '../src/infrastructure/ejecucion/dockerode-python-runner';

async function main() {
  const runner = new DockerodePythonRunner();
  let huboFallo = false;

  console.log('1) Programa correcto (suma de dos enteros)...');
  const r1 = await runner.ejecutar('a, b = map(int, input().split())\nprint(a + b)\n', [
    { id: 1, entrada: '3 4\n', salida_esperada: '7' },
  ]);
  console.log('   →', r1);
  if (!r1[0].paso) {
    huboFallo = true;
    console.log('   ❌ esperaba que pasara');
  } else {
    console.log('   ✅ pasó como se esperaba');
  }

  console.log('\n2) Respuesta incorrecta (confirma que SÍ detecta un fallo real)...');
  const r2 = await runner.ejecutar('a, b = map(int, input().split())\nprint(a + b)\n', [
    { id: 1, entrada: '3 4\n', salida_esperada: '999' },
  ]);
  console.log('   →', r2);
  if (r2[0].paso) {
    huboFallo = true;
    console.log('   ❌ esperaba que NO pasara');
  } else {
    console.log('   ✅ falló como se esperaba (comparación funciona)');
  }

  console.log('\n3) Bucle infinito — confirma que el timeout por caso corta la ejecución (tarda ~5s)...');
  const inicio = Date.now();
  const r3 = await runner.ejecutar('while True:\n    pass\n', [{ id: 1, entrada: '', salida_esperada: '' }]);
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`   → (${segundos}s) `, r3);
  if (r3[0].paso || !r3[0].stderr.toLowerCase().includes('tiempo')) {
    huboFallo = true;
    console.log('   ❌ esperaba que cortara por tiempo excedido');
  } else {
    console.log('   ✅ cortado por timeout como se esperaba');
  }

  console.log('\n4) Intento de acceso a red — confirma que --network none lo bloquea...');
  const codigoRed = [
    'import socket',
    's = socket.socket(socket.AF_INET, socket.SOCK_STREAM)',
    's.settimeout(3)',
    'try:',
    "    s.connect(('8.8.8.8', 53))",
    "    print('CONECTADO')",
    'except Exception as e:',
    "    print('BLOQUEADO:', e)",
  ].join('\n');
  const r4 = await runner.ejecutar(codigoRed, [{ id: 1, entrada: '', salida_esperada: '' }]);
  console.log('   →', r4);
  if (r4[0].stdout.includes('CONECTADO')) {
    huboFallo = true;
    console.log('   ❌ ¡se conectó a internet! el aislamiento de red no está funcionando');
  } else {
    console.log('   ✅ sin acceso a red (bloqueado o timeout de conexión)');
  }

  console.log('\n5) Fork bomb — confirma que PidsLimit contiene el intento sin tumbar el sandbox...');
  const codigoForkBomb = [
    'import os',
    'try:',
    '    for _ in range(2000):',
    '        os.fork()',
    'except OSError as e:',
    "    print('LIMITADO:', e)",
  ].join('\n');
  const r5 = await runner.ejecutar(codigoForkBomb, [{ id: 1, entrada: '', salida_esperada: '' }]);
  console.log('   →', r5);
  console.log('   (revisar a mano que no haya colgado el proceso ni tardado el timeout completo)');

  console.log(huboFallo ? '\n❌ Alguna prueba no dio el resultado esperado — revisar arriba.' : '\n✅ Todo el sandbox se comportó como se esperaba.');
  process.exit(huboFallo ? 1 : 0);
}

main().catch((error) => {
  console.error('\n❌ Error inesperado (¿Docker Desktop está corriendo?):', error);
  process.exit(1);
});
