// Guías nativas (16/08) · Revisión manual de preguntas abiertas — el
// docente de la clase (no un admin centralizado) califica lo que escribió
// cada estudiante contra la respuesta modelo. Al revisar la última
// pendiente de un intento oficial, se calcula su nota.

import { FilaRevisionGuia } from '../../domain/entidades/guia';
import { NoEncontradoError } from '../../domain/errores';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { GuiaIntentoRepositorio } from '../../domain/repositorios/guia-intento-repositorio';
import { GuiaRepositorio } from '../../domain/repositorios/guia-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { TiempoRealEmisor } from '../../domain/repositorios/tiempo-real';
import { exigirGuiaDeMateria, exigirMateriaPropia } from './gestionar-guias';
import { calcularNotaSiCorresponde } from './rendir-guia';

export class VerRevisionGuia {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    guia_id: number;
    docente_id: number;
  }): Promise<FilaRevisionGuia[]> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    await exigirGuiaDeMateria(this.guias, this.clases, entrada.materia_id, entrada.guia_id);
    return this.guiaIntentos.listarRevisionPendiente(entrada.guia_id);
  }
}

export class RevisarRespuestaGuia {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    guia_id: number;
    guia_respuesta_id: number;
    correcta: boolean;
    docente_id: number;
  }): Promise<void> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    const guia = await exigirGuiaDeMateria(
      this.guias,
      this.clases,
      entrada.materia_id,
      entrada.guia_id,
    );

    // Valida pertenencia consultando la lista de pendientes de ESTA guía
    // en vez de un buscarPorId aparte — de paso confirma que sigue
    // pendiente (evita revisar dos veces por una carrera de clicks).
    const pendientes = await this.guiaIntentos.listarRevisionPendiente(guia.id);
    const objetivo = pendientes.find((p) => p.guia_respuesta_id === entrada.guia_respuesta_id);
    if (!objetivo) throw new NoEncontradoError('Respuesta pendiente de revisión');

    await this.guiaIntentos.revisarRespuesta(
      entrada.guia_respuesta_id,
      entrada.correcta,
      entrada.docente_id,
    );

    const intento = await this.guiaIntentos.buscarPorId(objetivo.guia_intento_id);
    if (!intento) return;
    await calcularNotaSiCorresponde(this.guias, this.guiaIntentos, intento);

    const actualizado = await this.guiaIntentos.buscarPorId(intento.id);
    if (actualizado?.nota_obtenida !== null) {
      this.tiempoReal.emitirAGuia(guia.id, 'intento-actualizado', {
        intento_id: intento.id,
        estado: actualizado!.estado,
      });
    }
  }
}

/** Revisión en lote (18/08) · corrección rápida: filtra por alumno/pregunta
 * y marca varias de una, un solo request. Misma validación de pertenencia
 * que RevisarRespuestaGuia (contra la lista de pendientes de la guía) pero
 * hecha una vez para todo el lote, no por ítem — y la nota de cada alumno
 * afectado se recalcula una sola vez al final, no una vez por respuesta
 * suya que haya venido en el mismo lote. */
export class RevisarRespuestasGuiaLote {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(entrada: {
    materia_id: number;
    guia_id: number;
    revisiones: { guia_respuesta_id: number; correcta: boolean }[];
    docente_id: number;
  }): Promise<void> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    const guia = await exigirGuiaDeMateria(
      this.guias,
      this.clases,
      entrada.materia_id,
      entrada.guia_id,
    );

    const pendientes = await this.guiaIntentos.listarRevisionPendiente(guia.id);
    const pendientesPorId = new Map(pendientes.map((p) => [p.guia_respuesta_id, p]));
    const validas = entrada.revisiones.filter((r) => pendientesPorId.has(r.guia_respuesta_id));
    if (validas.length === 0) return;

    await this.guiaIntentos.revisarRespuestasLote(validas, entrada.docente_id);

    const intentoIds = new Set(
      validas.map((r) => pendientesPorId.get(r.guia_respuesta_id)!.guia_intento_id),
    );
    for (const intento_id of intentoIds) {
      const intento = await this.guiaIntentos.buscarPorId(intento_id);
      if (!intento) continue;
      await calcularNotaSiCorresponde(this.guias, this.guiaIntentos, intento);

      const actualizado = await this.guiaIntentos.buscarPorId(intento_id);
      if (actualizado?.nota_obtenida !== null) {
        this.tiempoReal.emitirAGuia(guia.id, 'intento-actualizado', {
          intento_id,
          estado: actualizado!.estado,
        });
      }
    }
  }
}
