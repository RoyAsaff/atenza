// E5 (extendido, 02/09) · Habilitación tardía: cuando GuardarAsistencia
// corrige a un estudiante que llegó después del lanzamiento (Falta/Licencia
// → Puntual o Atrasado), y hay una evaluación/guía/examen de código YA
// LANZADA en esa clase, se le crea el intento que se hubiera creado si
// hubiera estado presente al lanzar — mismo criterio que
// LanzarEvaluacion/LanzarGuia/LanzarExamenCodigo (orden propio barajado,
// tiempo límite contado desde ahora), calcado tres veces a propósito
// (mismo espíritu que esos tres módulos no comparten código entre sí).
// Idempotente: si el estudiante ya tiene un intento ahí (p.ej. estuvo
// presente al lanzar y alguien tocó su asistencia por error después), no
// hace nada.

import { ConvocatoriaTardia } from '../../domain/entidades/asistencia';
import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';
import { IntentoRepositorio } from '../../domain/repositorios/intento-repositorio';
import { GuiaRepositorio } from '../../domain/repositorios/guia-repositorio';
import { GuiaIntentoRepositorio } from '../../domain/repositorios/guia-intento-repositorio';
import { ExamenCodigoRepositorio } from '../../domain/repositorios/examen-codigo-repositorio';
import { IntentoCodigoRepositorio } from '../../domain/repositorios/intento-codigo-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { TiempoRealEmisor } from '../../domain/repositorios/tiempo-real';

interface Auditoria {
  ip?: string;
  dispositivo?: string;
}

/** Baraja el arreglo (Fisher-Yates) sin mutar el original — misma copia
 * local que gestionar-examen.ts/gestionar-examen-codigo.ts (cada intento
 * tiene su propio orden, propio del estudiante). */
function barajar<T>(items: T[]): T[] {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export class HabilitarLanzamientosTardios {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly intentos: IntentoRepositorio,
    private readonly guias: GuiaRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
    private readonly examenesCodigo: ExamenCodigoRepositorio,
    private readonly intentosCodigo: IntentoCodigoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  /** Para quienes acaban de pasar a Puntual/Atrasado en una clase, los suma
   * a todo lo que ya esté lanzado ahí y que todavía no tenga intento suyo.
   * Recibe la lista completa de estudiantes en vez de uno por uno para no
   * repetir listarPorClase/buscarConPreguntas por cada uno (lo normal es
   * llamar esto una vez por GuardarAsistencia, con 0-2 estudiantes casi
   * siempre, pero el primer pasar-lista de un curso grande puede traer
   * decenas a la vez). Devuelve qué se le habilitó a quién, para avisarle
   * al docente. */
  async ejecutar(
    entrada: Auditoria & {
      clase_id: number;
      estudiante_ids: number[];
      docente_id: number;
    },
  ): Promise<ConvocatoriaTardia[]> {
    if (entrada.estudiante_ids.length === 0) return [];
    const habilitadas: ConvocatoriaTardia[] = [];

    const evaluacionesLanzadas = (await this.evaluaciones.listarPorClase(entrada.clase_id)).filter(
      (e) => e.estado === 'lanzada',
    );
    for (const evaluacion of evaluacionesLanzadas) {
      const conPreguntas = await this.evaluaciones.buscarConPreguntas(evaluacion.id);
      if (!conPreguntas || conPreguntas.preguntas.length === 0) continue;
      const fecha_limite = evaluacion.tiempo_limite_minutos
        ? new Date(Date.now() + evaluacion.tiempo_limite_minutos * 60_000)
        : null;

      for (const estudiante_id of entrada.estudiante_ids) {
        const yaTiene = await this.intentos.buscarPorEvaluacionYEstudiante(
          evaluacion.id,
          estudiante_id,
        );
        if (yaTiene) continue;

        const orden_preguntas = barajar(conPreguntas.preguntas.map((p) => p.id));
        const orden_opciones: Record<string, number[]> = {};
        for (const pregunta of conPreguntas.preguntas) {
          orden_opciones[String(pregunta.id)] = barajar(pregunta.opciones.map((o) => o.id));
        }

        await this.intentos.crear({
          evaluacion_id: evaluacion.id,
          estudiante_id,
          orden_preguntas,
          orden_opciones,
          fecha_limite,
        });

        this.tiempoReal.emitirAEstudiante(estudiante_id, 'evaluacion-lanzada', {
          evaluacion_id: evaluacion.id,
        });
        // Nueva fila en el Monitoreo ya abierto: los eventos por-intento
        // parchean filas existentes (13/08), esta es la única que necesita
        // que el docente vuelva a pedir la tabla completa.
        this.tiempoReal.emitirAEvaluacion(evaluacion.id, 'estudiante-convocado', {
          estudiante_id,
        });

        await this.bitacora.registrar({
          usuario_id: entrada.docente_id,
          rol_contexto: 'docente',
          accion: 'evaluacion_convocado_tardio',
          entidad: 'evaluacion',
          entidad_id: String(evaluacion.id),
          valor_nuevo: { estudiante_id },
          ip: entrada.ip,
          dispositivo: entrada.dispositivo,
        });

        habilitadas.push({ tipo: 'evaluacion', id: evaluacion.id, tema: evaluacion.tema, estudiante_id });
      }
    }

    const guiasLanzadas = (await this.guias.listarPorClase(entrada.clase_id)).filter(
      (g) => g.estado === 'lanzada',
    );
    for (const guia of guiasLanzadas) {
      const preguntas = await this.guias.listarPreguntas(guia.id);
      if (preguntas.length === 0) continue;
      const fecha_limite = guia.tiempo_limite_minutos
        ? new Date(Date.now() + guia.tiempo_limite_minutos * 60_000)
        : null;

      for (const estudiante_id of entrada.estudiante_ids) {
        // Oficial, no repaso — mismo criterio que LanzarGuia: "tomar"
        // reanuda el oficial existente en vez de crear uno nuevo.
        const yaTiene = await this.guiaIntentos.buscarOficialPorEstudianteYGuia(
          guia.id,
          estudiante_id,
        );
        if (yaTiene) continue;

        await this.guiaIntentos.crear({
          guia_id: guia.id,
          estudiante_id,
          es_oficial: true,
          numero_intento: 1,
          fecha_limite,
        });

        this.tiempoReal.emitirAEstudiante(estudiante_id, 'guia-lanzada', { guia_id: guia.id });
        this.tiempoReal.emitirAGuia(guia.id, 'estudiante-convocado', { estudiante_id });

        await this.bitacora.registrar({
          usuario_id: entrada.docente_id,
          rol_contexto: 'docente',
          accion: 'guia_convocado_tardio',
          entidad: 'guia',
          entidad_id: String(guia.id),
          valor_nuevo: { estudiante_id },
          ip: entrada.ip,
          dispositivo: entrada.dispositivo,
        });

        habilitadas.push({ tipo: 'guia', id: guia.id, tema: guia.tema, estudiante_id });
      }
    }

    const examenesCodigoLanzados = (
      await this.examenesCodigo.listarPorClase(entrada.clase_id)
    ).filter((e) => e.estado === 'lanzada');
    for (const examen of examenesCodigoLanzados) {
      const conEjercicios = await this.examenesCodigo.buscarConEjercicios(examen.id);
      if (!conEjercicios || conEjercicios.ejercicios.length === 0) continue;
      const fecha_limite = examen.tiempo_limite_minutos
        ? new Date(Date.now() + examen.tiempo_limite_minutos * 60_000)
        : null;
      const ordenBase = conEjercicios.ejercicios.map((e) => e.id);

      for (const estudiante_id of entrada.estudiante_ids) {
        const yaTiene = await this.intentosCodigo.buscarPorExamenYEstudiante(
          examen.id,
          estudiante_id,
        );
        if (yaTiene) continue;

        await this.intentosCodigo.crear({
          examen_codigo_id: examen.id,
          estudiante_id,
          orden_ejercicios: barajar(ordenBase),
          fecha_limite,
        });

        this.tiempoReal.emitirAEstudiante(estudiante_id, 'examen-codigo-lanzado', {
          examen_codigo_id: examen.id,
        });
        this.tiempoReal.emitirAExamenCodigo(examen.id, 'estudiante-convocado', { estudiante_id });

        await this.bitacora.registrar({
          usuario_id: entrada.docente_id,
          rol_contexto: 'docente',
          accion: 'examen_codigo_convocado_tardio',
          entidad: 'examen_codigo',
          entidad_id: String(examen.id),
          valor_nuevo: { estudiante_id },
          ip: entrada.ip,
          dispositivo: entrada.dispositivo,
        });

        habilitadas.push({ tipo: 'examen_codigo', id: examen.id, tema: examen.tema, estudiante_id });
      }
    }

    return habilitadas;
  }
}
