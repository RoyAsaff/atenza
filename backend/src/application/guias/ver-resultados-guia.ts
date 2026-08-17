// Guías nativas (16/08) · Resultados (nota + intentos por estudiante) y
// monitoreo en vivo (mientras está lanzada) — calcan ver-resultados.ts y
// VerMonitoreo de exámenes.

import { FilaMonitoreoGuia, FilaResultadoGuia } from '../../domain/entidades/guia';
import { ClaseRepositorio } from '../../domain/repositorios/clase-repositorio';
import { GuiaIntentoRepositorio } from '../../domain/repositorios/guia-intento-repositorio';
import { GuiaRepositorio } from '../../domain/repositorios/guia-repositorio';
import { MateriaRepositorio } from '../../domain/repositorios/materia-repositorio';
import { exigirGuiaDeMateria, exigirMateriaPropia } from './gestionar-guias';

export class VerResultadosGuia {
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
  }): Promise<FilaResultadoGuia[]> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    await exigirGuiaDeMateria(this.guias, this.clases, entrada.materia_id, entrada.guia_id);
    return this.guiaIntentos.listarResultados(entrada.guia_id);
  }
}

export class VerMonitoreoGuia {
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
  }): Promise<FilaMonitoreoGuia[]> {
    await exigirMateriaPropia(this.materias, entrada.materia_id, entrada.docente_id);
    await exigirGuiaDeMateria(this.guias, this.clases, entrada.materia_id, entrada.guia_id);
    return this.guiaIntentos.listarMonitoreo(entrada.guia_id);
  }
}
