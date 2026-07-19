// E8 · HU-26 Esc. 1/2: el estudiante ve su nota solo si el docente ya
// la publicó. Sin incidentes acá — esa es información de gestión del
// docente, no se muestra al estudiante.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/colores.dart';
import '../../materias/domain/entidades/materia_inscrita.dart';
import '../domain/entidades/mi_nota.dart';
import '../domain/repositorios/resultados_repositorio.dart';
import 'detalle_intento_page.dart';

const _MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

String _fechaLegible(DateTime f) => '${f.day} ${_MESES[f.month - 1]} ${f.year}';

class MisNotasPage extends StatefulWidget {
  const MisNotasPage({super.key, required this.materia});

  final MateriaInscrita materia;

  @override
  State<MisNotasPage> createState() => _MisNotasPageState();
}

class _MisNotasPageState extends State<MisNotasPage>
    with AutomaticKeepAliveClientMixin<MisNotasPage> {
  late Future<List<MiNota>> _futuro;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  void _cargar() {
    _futuro = context.read<ResultadosRepositorio>().listarPorMateria(widget.materia.materiaId);
  }

  Future<void> _refrescar() async {
    setState(_cargar);
    await _futuro;
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return RefreshIndicator(
      onRefresh: _refrescar,
      child: FutureBuilder<List<MiNota>>(
        future: _futuro,
        builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const SizedBox(height: 80),
                  Text(
                    snapshot.error.toString(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AtenzaColores.peligro),
                  ),
                ],
              );
            }

            final notas = snapshot.data ?? const <MiNota>[];
            if (notas.isEmpty) {
              return ListView(
                padding: const EdgeInsets.all(24),
                children: const [
                  SizedBox(height: 80),
                  Text(
                    'Todavía no hay notas publicadas en esta materia.',
                    textAlign: TextAlign.center,
                  ),
                ],
              );
            }

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ...notas.map(
                  (n) => _TarjetaNota(nota: n, materiaId: widget.materia.materiaId),
                ),
                const SizedBox(height: 24),
              ],
            );
          },
        ),
      );
  }
}

class _TarjetaNota extends StatelessWidget {
  const _TarjetaNota({required this.nota, required this.materiaId});

  final MiNota nota;
  final int materiaId;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: ListTile(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => DetalleIntentoPage(
                materiaId: materiaId,
                evaluacionId: nota.evaluacionId,
                tema: nota.tema,
              ),
            ),
          ),
          leading: Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AtenzaColores.primary50,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              '${nota.notaObtenida}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AtenzaColores.primary700,
              ),
            ),
          ),
          title: Text(nota.tema, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(
            '${nota.aciertos}/${nota.totalPreguntas} aciertos · Publicada el ${_fechaLegible(nota.fechaPublicacion)}',
          ),
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AtenzaColores.primary50,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '${nota.notaObtenida}/${nota.notaTotal}',
              style: TextStyle(
                color: AtenzaColores.primary700,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
