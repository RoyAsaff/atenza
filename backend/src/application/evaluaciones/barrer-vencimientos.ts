// E8/HU-24 · Barrido periódico en segundo plano (13/08). Antes, tanto el
// vencimiento por tiempo límite como el cierre automático de la evaluación
// ("ya todos terminaron, calificar y pasar a finalizada") solo se
// detectaban de forma perezosa: cuando el propio docente pedía Monitoreo o
// Resultados (ver finalizarSiCorresponde en gestionar-examen.ts). Si el
// docente no estaba mirando esa pantalla justo en ese momento — pestaña
// sin foco (el navegador frena los timers, incluido el refetchInterval de
// React Query), o simplemente no volvió a entrar — el panel se quedaba
// mostrando "en curso" a estudiantes que ya habían vencido o terminado,
// hasta que alguien lo abriera de nuevo. Este barrido corre solo, sin
// depender de que nadie esté poleando (ver index.ts).

import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { EvaluacionRepositorio } from '../../domain/repositorios/evaluacion-repositorio';
import { IntentoRepositorio } from '../../domain/repositorios/intento-repositorio';
import { TiempoRealEmisor } from '../../domain/repositorios/tiempo-real';
import { cerrarSiTerminaron } from './gestionar-examen';

export class BarrerVencimientos {
  constructor(
    private readonly evaluaciones: EvaluacionRepositorio,
    private readonly intentos: IntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(): Promise<void> {
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
}
