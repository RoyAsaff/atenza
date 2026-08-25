// Fusión con ATENZA (05/08): guías de pre-clase, autocorregibles, sin
// nota. El check verde es puramente informativo para el estudiante —
// quien realmente usa ese dato es el docente, en el panel de la clase.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/colores.dart';
import '../../materias/domain/entidades/materia_inscrita.dart';
import '../domain/entidades/guia.dart';
import '../domain/repositorios/guias_repositorio.dart';
import 'guia_webview_page.dart';

const _MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

String _fechaLegible(DateTime f) => '${f.day} ${_MESES[f.month - 1]} ${f.year}';

class GuiasPage extends StatefulWidget {
  const GuiasPage({super.key, required this.materia});

  final MateriaInscrita materia;

  @override
  State<GuiasPage> createState() => _GuiasPageState();
}

class _GuiasPageState extends State<GuiasPage>
    with AutomaticKeepAliveClientMixin<GuiasPage> {
  late Future<List<Guia>> _futuro;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  void _cargar() {
    _futuro = context.read<GuiasRepositorio>().listarPorMateria(widget.materia.materiaId);
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
      child: FutureBuilder<List<Guia>>(
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

          final guias = snapshot.data ?? const <Guia>[];
          if (guias.isEmpty) {
            return ListView(
              padding: const EdgeInsets.all(24),
              children: const [
                SizedBox(height: 80),
                Text(
                  'Todavía no hay guías asignadas en esta materia.',
                  textAlign: TextAlign.center,
                ),
              ],
            );
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ...guias.map((g) => _TarjetaGuia(materiaId: widget.materia.materiaId, guia: g)),
              const SizedBox(height: 24),
            ],
          );
        },
      ),
    );
  }
}

class _TarjetaGuia extends StatelessWidget {
  const _TarjetaGuia({required this.materiaId, required this.guia});

  final int materiaId;
  final Guia guia;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: ListTile(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => GuiaWebviewPage(materiaId: materiaId, guia: guia),
            ),
          ),
          leading: Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: guia.completado ? AtenzaColores.secondary100 : AtenzaColores.primary50,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              guia.completado ? Icons.check_circle : Icons.menu_book_outlined,
              color: guia.completado ? AtenzaColores.exito : AtenzaColores.primary700,
            ),
          ),
          title: Text(guia.tema, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(
            'Clase: ${guia.claseTema} · ${_fechaLegible(guia.claseFecha)}',
          ),
          trailing: guia.completado
              ? const Icon(Icons.chevron_right)
              : Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AtenzaColores.primary50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Pendiente',
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
