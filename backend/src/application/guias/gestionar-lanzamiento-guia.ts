// Guías nativas (16/08) · Pausar/Reactivar (individual) y Cancelar
// (global) del intento OFICIAL — calca PausarIntento/ReactivarIntento/
// CancelarEvaluacion de exámenes (gestionar-examen.ts). A propósito NO se
// construye la versión masiva "pausar/reactivar todo": el intento oficial
// de una guía no tiene la duración/presión de un examen de 2 horas — ver
// razonamiento en el plan (16/08).

import { Guia, GuiaIntento } from '../../domain/entidades/guia';
import { EstadoInvalidoError, NoEncontradoError } from '../../domain/errores';
import { BitacoraRepositorio } from '../../domain/repositorios/bitacora-repositorio';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { GuiaIntentoRepositorio } from '../../domain/repositorios/guia-intento-repositorio';
import { GuiaRepositorio } from '../../domain/repositorios/guia-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { TiempoRealEmisor } from '../../domain/repositorios/tiempo-real';
import { calcularNotaSiCorresponde } from './rendir-guia';
import { exigirGuiaDeMateria, exigirMateriaPropia } from './gestionar-guias';

interface Auditoria {
  ip?: string;
  dispositivo?: string;
}

async function exigirGuiaLanzada(
  guias: GuiaRepositorio,
  clases: ClaseRepositorio,
  materias: MateriaRepositorio,
  materia_id: number,
  guia_id: number,
  docente_id: number,
): Promise<Guia> {
  await exigirMateriaPropia(materias, materia_id, docente_id);
  const guia = await exigirGuiaDeMateria(guias, clases, materia_id, guia_id);
  if (guia.estado !== 'lanzada') {
    throw new EstadoInvalidoError('La guía no está lanzada');
  }
  return guia;
}

async function exigirIntentoDeGuia(
  guiaIntentos: GuiaIntentoRepositorio,
  guia: Guia,
  intento_id: number,
): Promise<GuiaIntento> {
  const intento = await guiaIntentos.buscarPorId(intento_id);
  if (!intento || intento.guia_id !== guia.id || !intento.es_oficial) {
    throw new NoEncontradoError('Intento');
  }
  return intento;
}

export class PausarGuiaIntento {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      guia_id: number;
      intento_id: number;
      docente_id: number;
    },
  ): Promise<void> {
    const guia = await exigirGuiaLanzada(
      this.guias,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.guia_id,
      entrada.docente_id,
    );
    const intento = await exigirIntentoDeGuia(this.guiaIntentos, guia, entrada.intento_id);
    if (intento.estado !== 'en_curso' && intento.estado !== 'desconectado') {
      throw new EstadoInvalidoError('Ese estudiante no está en curso');
    }

    await this.guiaIntentos.cambiarEstado(intento.id, 'pausado');
    this.tiempoReal.emitirAEstudiante(intento.estudiante_id, 'guia-pausada', {
      intento_id: intento.id,
    });
    this.tiempoReal.emitirAGuia(guia.id, 'intento-actualizado', {
      intento_id: intento.id,
      estado: 'pausado',
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'guia_intento_pausado',
      entidad: 'guia_intento',
      entidad_id: String(intento.id),
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}

export class ReactivarGuiaIntento {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(
    entrada: Auditoria & {
      materia_id: number;
      guia_id: number;
      intento_id: number;
      docente_id: number;
    },
  ): Promise<void> {
    const guia = await exigirGuiaLanzada(
      this.guias,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.guia_id,
      entrada.docente_id,
    );
    const intento = await exigirIntentoDeGuia(this.guiaIntentos, guia, entrada.intento_id);
    if (intento.estado !== 'pausado') {
      throw new EstadoInvalidoError('Ese estudiante no está pausado');
    }

    await this.guiaIntentos.cambiarEstado(intento.id, 'en_curso');
    this.tiempoReal.emitirAEstudiante(intento.estudiante_id, 'guia-reactivada', {
      intento_id: intento.id,
    });
    this.tiempoReal.emitirAGuia(guia.id, 'intento-actualizado', {
      intento_id: intento.id,
      estado: 'en_curso',
    });

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'guia_intento_reactivado',
      entidad: 'guia_intento',
      entidad_id: String(intento.id),
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });
  }
}

// ── Cancelar el lanzamiento entero (global) ───────────────────────
// Aborta el intento oficial de todos los presentes — conserva las
// respuestas ya guardadas y califica con lo que había hasta ese momento
// (mismo criterio que CancelarEvaluacion, HU-23 Esc. 2).

export class CancelarGuiaLanzamiento {
  constructor(
    private readonly guias: GuiaRepositorio,
    private readonly clases: ClaseRepositorio,
    private readonly materias: MateriaRepositorio,
    private readonly guiaIntentos: GuiaIntentoRepositorio,
    private readonly bitacora: BitacoraRepositorio,
    private readonly tiempoReal: TiempoRealEmisor,
  ) {}

  async ejecutar(
    entrada: Auditoria & { materia_id: number; guia_id: number; docente_id: number },
  ): Promise<Guia> {
    const guia = await exigirGuiaLanzada(
      this.guias,
      this.clases,
      this.materias,
      entrada.materia_id,
      entrada.guia_id,
      entrada.docente_id,
    );

    const intentos = await this.guiaIntentos.listarPorGuia(guia.id);
    const enCurso = intentos.filter(
      (i) => i.es_oficial && (i.estado === 'en_curso' || i.estado === 'pausado' || i.estado === 'desconectado'),
    );
    for (const intento of enCurso) {
      const cancelado = await this.guiaIntentos.cambiarEstado(intento.id, 'cancelado', {
        fecha_fin: new Date(),
      });
      await calcularNotaSiCorresponde(this.guias, this.guiaIntentos, cancelado);
      this.tiempoReal.emitirAEstudiante(intento.estudiante_id, 'guia-cancelada', {
        intento_id: intento.id,
      });
      this.tiempoReal.emitirAGuia(guia.id, 'intento-actualizado', {
        intento_id: intento.id,
        estado: 'cancelado',
      });
    }

    const cerrada = await this.guias.cambiarEstado(guia.id, 'cerrada');

    await this.bitacora.registrar({
      usuario_id: entrada.docente_id,
      rol_contexto: 'docente',
      accion: 'guia_cancelada',
      entidad: 'guia',
      entidad_id: String(guia.id),
      valor_nuevo: { intentos_cancelados: enCurso.length },
      ip: entrada.ip,
      dispositivo: entrada.dispositivo,
    });

    return cerrada;
  }
}
