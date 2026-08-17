// Guías nativas (16/08) · Lanzar a la clase — calca LanzarEvaluacion
// (gestionar-examen.ts): exige asistencia tomada, un GuiaIntento oficial
// por presente. A diferencia de examen, acá no hay preguntas/opciones que
// barajar (el cuestionario vive en la página externa) — solo se crea el
// intento y se manda el token de acceso cuando el estudiante lo abre
// (rendir-guia.ts), no de antemano.

import { EstadoInvalidoError } from '../../domain/errores';
import { AsistenciaRepositorio } from '../../domain/repositorios/asistencia-repositorio';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { GuiaRepositorio } from '../../domain/repositorios/guia-repositorio';
import { GuiaIntentoRepositorio } from '../../domain/repositorios/guia-intento-repositorio';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { TiempoRealEmisor } from '../../domain/repositorios/tiempo-real';
import { Guia } from '../../domain/entidades/guia';
import { exigirGuiaDeMateria, exigirMateriaPropia } from './gestionar-guias';

interface Auditoria {
  ip?: string;
  dispositivo?: string;
}

export class LanzarGuia {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly asistencias: AsistenciaRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(
    entrada: Auditoria & { materia_id: number; guia_id: number; docente_id: number },
  ): Promise<Guia> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    const guia = await exigirGuiaDeMateria(
      this.guias,
      this.clases,
      entrada.materia_id,
      entrada.guia_id,
    );
    if (guia.estado === 'externa_legacy') {
      throw new EstadoInvalidoError('Esta guía es externa (de antes) y no se puede lanzar');
    }
    if (guia.estado !== 'publicada') {
      throw new EstadoInvalidoError('La guía ya fue lanzada');
    }

    const asistenciasClase = await this.asistencias.listarPorClase(guia.clase_id);
    if (asistenciasClase.length === 0) {
      throw new EstadoInvalidoError(
        'La clase todavía no tiene asistencia registrada; pasa lista antes de lanzar',
      );
    }
    const presentes = asistenciasClase.filter(
      (a) => a.marcaje === 'puntual' || a.marcaje === 'atrasado',
    );
    if (presentes.length === 0) {
      throw new EstadoInvalidoError('No hay estudiantes Puntuales o con Atraso en esta clase');
    }

    const preguntas = await this.guias.listarPreguntas(guia.id);
    if (preguntas.length === 0) {
      throw new EstadoInvalidoError('La guía no tiene preguntas cargadas');
    }

    const fecha_limite = guia.tiempo_limite_minutos
      ? new Date(Date.now() + guia.tiempo_limite_minutos * 60_000)
      : null;

    for (const asistencia of presentes) {
      await this.guiaIntentos.crear({
        guia_id: guia.id,
        estudiante_id: asistencia.estudiante_id,
        es_oficial: true,
        numero_intento: 1,
        fecha_limite,
      });

      this.tiempoReal.emitirAEstudiante(asistencia.estudiante_id, 'guia-lanzada', {
        guia_id: guia.id,
      });
    }

    const lanzada = await this.guias.cambiarEstado(guia.id, 'lanzada');

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'guia_lanzada',
      entidad: 'guia',
      entidad_id: String(guia.id),
      valor_nuevo: { convocados: presentes.length },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return lanzada;
  }
}
