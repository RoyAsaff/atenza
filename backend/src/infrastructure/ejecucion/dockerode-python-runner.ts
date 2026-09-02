// E9 (01/09) · Ejecutor sandboxed de Python — Docker-outside-of-Docker.
//
// `atenza-backend` monta el socket de Docker del host (pendiente de Roy en
// el docker-compose.yml del servidor, fuera de este repo — ver plan) y
// lanza un contenedor efímero de `python:3.12-slim` por CADA ENVÍO (no uno
// por caso de prueba): adentro corre `runner.py`, que a su vez invoca el
// código del estudiante como subproceso una vez por caso, con su propio
// timeout, y junta todo en un único JSON que imprime a stdout. Nosotros
// leemos ese stdout, comparamos contra `salida_esperada` (que NUNCA entra
// al contenedor) y devolvemos el `ResultadoCaso[]` ya truncado.
//
// Aislamiento: sin red (NetworkMode: none), memoria y PIDs acotados,
// filesystem raíz de solo lectura (todo lo escribible vive en tmpfs),
// usuario no-root, sin capabilities.
//
// Los archivos se inyectan vía `exec` + stdin (`cat > archivo`), NO vía
// `putArchive` — la API de copia de Docker (`CopyToContainer`) rechaza
// CUALQUIER escritura de plano si el contenedor tiene `ReadonlyRootfs`,
// sin importar que el destino sea un tmpfs montado y realmente escribible
// (probado: falla con "container rootfs is marked read-only" incluso
// después de `start()`, con el tmpfs ya activo). Un `exec` corriendo
// DENTRO del contenedor sí puede escribir en el tmpfs con normalidad —
// solo la ruta de copia especial de Docker tiene ese bloqueo ciego.
import Docker from 'dockerode';
import { CasoParaEjecutar, EjecutorCodigo } from '../../domain/servicios/ejecutor-codigo';
import { ResultadoCaso } from '../../domain/entidades/intento-codigo';

const IMAGEN_PYTHON = 'python:3.12-slim';
const TIMEOUT_POR_CASO_MS = 5_000; // aplicado DENTRO del contenedor, por runner.py
const TIMEOUT_BUFFER_MS = 5_000; // margen para el arranque del intérprete + overhead
const TIMEOUT_MAX_MS = 60_000; // techo duro sin importar cuántos casos haya
const MEMORIA_BYTES = 256 * 1024 * 1024;
const PIDS_LIMIT = 64;
const MAX_SALIDA_CHARS = 4_000; // truncado antes de guardar en RespuestaCodigo.resultado_json

// Corre dentro del contenedor. No confía en el código del estudiante:
// cada caso es un subprocess.run() aparte, con timeout propio — si un caso
// cuelga o se pasa de tiempo, se anota el error para ESE caso y se sigue
// con el resto (no se cae, no bloquea a los demás).
const RUNNER_PY = `
import json, subprocess, time

with open('/sandbox/casos.json') as f:
    casos = json.load(f)

TIMEOUT_S = ${TIMEOUT_POR_CASO_MS / 1000}
resultados = []
for caso in casos:
    inicio = time.monotonic()
    stdout, stderr = '', ''
    try:
        proc = subprocess.run(
            ['python3', '/sandbox/main.py'],
            input=caso['entrada'],
            capture_output=True,
            text=True,
            timeout=TIMEOUT_S,
        )
        stdout, stderr = proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        stderr = 'Tiempo de ejecucion excedido'
    except Exception as e:
        stderr = 'Error al ejecutar: ' + str(e)
    tiempo_ms = int((time.monotonic() - inicio) * 1000)
    resultados.append({'id': caso['id'], 'stdout': stdout, 'stderr': stderr, 'tiempo_ms': tiempo_ms})

print(json.dumps(resultados))
`.trim();

interface FilaRunner {
  id: number;
  stdout: string;
  stderr: string;
  tiempo_ms: number;
}

function truncar(texto: string): string {
  return texto.length > MAX_SALIDA_CHARS ? texto.slice(0, MAX_SALIDA_CHARS) + '\n… (truncado)' : texto;
}

function resultadoFallback(casos: CasoParaEjecutar[], mensaje: string): ResultadoCaso[] {
  return casos.map((c) => ({ caso_id: c.id, paso: false, stdout: '', stderr: mensaje, tiempo_ms: 0 }));
}

/** Junta un stream Duplex de docker-modem hasta que termina. */
function leerStreamCompleto(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const trozos: Buffer[] = [];
    stream.on('data', (t: Buffer) => trozos.push(t));
    stream.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')));
    stream.on('error', reject);
  });
}

export class DockerodePythonRunner implements EjecutorCodigo {
  private readonly docker: Docker;
  private imagenLista: Promise<void> | null = null;

  // Sin socketPath explícito, dockerode autodetecta el correcto por
  // plataforma (usa DOCKER_HOST si está seteado; si no, el pipe con
  // nombre de Windows en dev local o /var/run/docker.sock en Linux —
  // que es exactamente el que queda montado en el contenedor de
  // atenza-backend en producción). Pasar socketPath solo para forzar
  // un valor puntual (ver DOCKER_SOCKET_PATH en dependencias.ts).
  constructor(socketPath?: string) {
    this.docker = socketPath ? new Docker({ socketPath }) : new Docker();
  }

  /** Descarga la imagen una sola vez (memoiza la promesa) si todavía no
   * está localmente — evita que el primer envío de cada estudiante falle
   * con "No such image" en una máquina donde nadie corrió `docker pull`
   * a mano todavía. */
  private async asegurarImagen(): Promise<void> {
    if (!this.imagenLista) {
      this.imagenLista = (async () => {
        try {
          await this.docker.getImage(IMAGEN_PYTHON).inspect();
        } catch {
          const stream = await this.docker.pull(IMAGEN_PYTHON);
          await new Promise<void>((resolve, reject) => {
            this.docker.modem.followProgress(stream, (err) => (err ? reject(err) : resolve()));
          });
        }
      })();
    }
    return this.imagenLista;
  }

  /** Escribe `contenido` en `ruta` DENTRO del contenedor vía `sh -c "cat > ruta"`
   * con stdin — ver comentario de cabecera sobre por qué no se usa putArchive. */
  private async escribirArchivo(
    container: Docker.Container,
    ruta: string,
    contenido: string,
  ): Promise<void> {
    const exec = await container.exec({
      Cmd: ['sh', '-c', `cat > ${ruta}`],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({ hijack: true, stdin: true });
    const fin = leerStreamCompleto(stream);
    stream.end(contenido, 'utf8');
    await fin;
  }

  async ejecutar(codigo: string, casos: CasoParaEjecutar[]): Promise<ResultadoCaso[]> {
    if (casos.length === 0) return [];

    await this.asegurarImagen();

    // Cmd es un placeholder ocioso: necesitamos el contenedor VIVO (con sus
    // mounts tmpfs ya armados por runc) antes de poder escribirle nada.
    const container = await this.docker.createContainer({
      Image: IMAGEN_PYTHON,
      Cmd: ['sleep', '3600'],
      WorkingDir: '/sandbox',
      User: 'nobody',
      NetworkDisabled: true,
      HostConfig: {
        NetworkMode: 'none',
        Memory: MEMORIA_BYTES,
        MemorySwap: MEMORIA_BYTES, // = Memory: sin swap adicional
        PidsLimit: PIDS_LIMIT,
        ReadonlyRootfs: true,
        // Todo lo escribible vive en tmpfs — nada toca el filesystem del host.
        Tmpfs: { '/sandbox': 'rw,size=16m,mode=1777', '/tmp': 'rw,size=16m,mode=1777' },
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        AutoRemove: false, // lo removemos nosotros en el finally
      },
    });

    try {
      await container.start();

      const casosJson = JSON.stringify(casos.map((c) => ({ id: c.id, entrada: c.entrada })));
      await this.escribirArchivo(container, '/sandbox/main.py', codigo);
      await this.escribirArchivo(container, '/sandbox/runner.py', RUNNER_PY);
      await this.escribirArchivo(container, '/sandbox/casos.json', casosJson);

      const exec = await container.exec({
        Cmd: ['python3', '/sandbox/runner.py'],
        AttachStdout: true,
        AttachStderr: true,
        Tty: true, // simplifica leer la salida: sin demux de stdout/stderr multiplexado
      });
      const streamExec = await exec.start({ hijack: true, stdin: false, Tty: true });

      const timeoutMs = Math.min(casos.length * TIMEOUT_POR_CASO_MS + TIMEOUT_BUFFER_MS, TIMEOUT_MAX_MS);
      const resultado = await Promise.race([
        leerStreamCompleto(streamExec),
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), timeoutMs)),
      ]);

      if (resultado === 'timeout') {
        // Se mata el CONTENEDOR entero en el finally (no hay "exec kill"
        // simple/portable) — se lleva puesto runner.py y cualquier hijo colgado.
        return resultadoFallback(casos, 'Tiempo de ejecución total excedido');
      }

      let filas: FilaRunner[];
      try {
        // Con Tty:true la salida es texto plano; el runner imprime un único
        // JSON como última línea (por si algo más escribió a stdout antes).
        const ultimaLinea = resultado.trim().split('\n').pop() ?? '';
        filas = JSON.parse(ultimaLinea);
      } catch {
        return resultadoFallback(casos, 'El sandbox no devolvió un resultado válido');
      }

      const porId = new Map(filas.map((f) => [f.id, f]));
      return casos.map((caso): ResultadoCaso => {
        const fila = porId.get(caso.id);
        if (!fila) {
          return { caso_id: caso.id, paso: false, stdout: '', stderr: 'Sin resultado', tiempo_ms: 0 };
        }
        const stdout = truncar(fila.stdout ?? '');
        const stderr = truncar(fila.stderr ?? '');
        const paso = !fila.stderr && stdout.trim() === caso.salida_esperada.trim();
        return { caso_id: caso.id, paso, stdout, stderr, tiempo_ms: fila.tiempo_ms };
      });
    } finally {
      await container.remove({ force: true }).catch(() => {});
    }
  }
}
