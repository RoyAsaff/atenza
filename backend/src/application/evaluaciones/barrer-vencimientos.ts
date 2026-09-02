// E8/HU-24 · Barrido periódico en segundo plano (13/08, extendido a guías
// nativas el 16/08). Antes, tanto el vencimiento por tiempo límite como el
// cierre automático de la evaluación ("ya todos terminaron, calificar y
// pasar a finalizada") solo se detectaban de forma perezosa: cuando el
// propio docente pedía Monitoreo o Resultados (ver finalizarSiCorresponde
// en gestionar-examen.ts). Si el docente no estaba mirando esa pantalla
// justo en ese momento — pestaña sin foco (el navegador frena los timers,
// incluido el refetchInterval de React Query), o simplemente no volvió a
// entrar — el panel se quedaba mostrando "en curso" a estudiantes que ya
// habían vencido o terminado, hasta que alguien lo abriera de nuevo. Este
// barrido corre solo, sin depender de que nadie esté poleando (ver index.ts).

import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';
import { IntentoRepositorio } from '../../domain/repositorios/intento-repositorio';
import { GuiaRepositorio } from '../../domain/repositorios/guia-repositorio';
import { GuiaIntentoRepositorio } from '../../domain/repositorios/guia-intento-repositorio';
import { ExamenCodigoRepositorio } from '../../domain/repositorios/examen-codigo-repositorio';
import { IntentoCodigoRepositorio } from '../../domain/repositorios/intento-codigo-repositorio';
import { TiempoRealEmisor } from '../../domain/repositorios/tiempo-real';
import { cerrarSiTerminaron } from './gestionar-examen';
import { calcularNotaSiCorresponde } from '../guias/rendir-guia';
import { cerrarSiTerminaron as cerrarSiTerminaronCodigo } from '../examenes-codigo/gestionar-examen-codigo';

export class BarrerVencimientos {
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

  async ejecutar(): Promise<void> {
    await this.barrerEvaluaciones();
    await this.barrerGuias();
    await this.barrerExamenesCodigo();
  }

  private async barrerEvaluaciones(): Promise<void> {
    // HU-24: intentos que ya pasaron su fecha_limite, de cualquier
    // evaluación — se notifica cada uno al toque, sin esperar a que su
    // propio estudiante vuelva a tocar algo ni a que el docente pida
    // Monitoreo.
    const vencidos = await this.intentos.finalizarVencidosGlobal();
    for (const intento of vencidos) {
      this.tiempoReal.emitirAEvaluacion(intento.evaluacion_id, 'intento-actualizado', {
        intento_id: intento.id,
        estado: intento.estado,
      });
    }

    // E8: por cada evaluación lanzada — no solo las que tuvieron un
    // vencimiento recién — si con esto (o con "Finalizar" manual de cada
    // estudiante, que no dispara este chequeo por su cuenta) ya terminaron
    // todos los convocados, se cierra sola y se califica.
    const lanzadas = await this.evaluaciones.listarLanzadas();
    for (const evaluacion of lanzadas) {
      await cerrarSiTerminaron(
        this.evaluaciones,
        this.intentos,
        this.bitacora,
        this.tiempoReal,
        evaluacion,
      );
    }
  }

  private async barrerGuias(): Promise<void> {
    // Mismo criterio que exámenes: intentos de guía vencidos por tiempo
    // límite, de cualquier guía. Acá además hay que intentar calcular la
    // nota (si es el oficial y no le quedan abiertas pendientes).
    const vencidos = await this.guiaIntentos.finalizarVencidosGlobal();
    for (const intento of vencidos) {
      await calcularNotaSiCorresponde(this.guias, this.guiaIntentos, intento);
      const actualizado = await this.guiaIntentos.buscarPorId(intento.id);
      this.tiempoReal.emitirAGuia(intento.guia_id, 'intento-actualizado', {
        intento_id: intento.id,
        estado: actualizado?.estado ?? intento.estado,
      });
    }

    // Cierre automático de la ventana "en vivo": cuando todos los
    // OFICIALES de una guía lanzada llegan a estado terminal, pasa a
    // "cerrada" — no bloquea repasos, solo apaga el monitoreo en vivo.
    const lanzadas = await this.guias.listarLanzadas();
    for (const guia of lanzadas) {
      const intentosGuia = await this.guiaIntentos.listarPorGuia(guia.id);
      const oficiales = intentosGuia.filter((i) => i.es_oficial);
      const todosTerminaron =
        oficiales.length > 0 &&
        oficiales.every((i) => i.estado === 'finalizado' || i.estado === 'cancelado');
      if (!todosTerminaron) continue;

      await this.guias.cambiarEstado(guia.id, 'cerrada');
      this.tiempoReal.emitirAGuia(guia.id, 'estado-actualizado', {});
    }
  }

  // E9 · Mismo criterio que barrerEvaluaciones: vencidos por tiempo límite
  // de cualquier examen de código, notificados al toque, más cierre
  // automático (y calificación) cuando ya todos los convocados terminaron.
  private async barrerExamenesCodigo(): Promise<void> {
    const vencidos = await this.intentosCodigo.finalizarVencidosGlobal();
    for (const intento of vencidos) {
      this.tiempoReal.emitirAExamenCodigo(intento.examen_codigo_id, 'intento-actualizado', {
        intento_id: intento.id,
        estado: intento.estado,
      });
    }

    const lanzados = await this.examenesCodigo.listarLanzados();
    for (const examen of lanzados) {
      await cerrarSiTerminaronCodigo(
        this.examenesCodigo,
        this.intentosCodigo,
        this.bitacora,
        this.tiempoReal,
        examen,
      );
    }
  }
}
