// Pantalla de materia con pestañas (Calendario / Asistencia / Notas),
// en vez de navegación separada por menú — así el estudiante ve todo
// junto al entrar a la materia.

import 'package:flutter/material.dart';

import '../../../core/theme/colores.dart';
import '../../asistencia/presentation/mi_asistencia_page.dart';
import '../../clases/presentation/clases_page.dart';
import '../../resultados/presentation/mis_notas_page.dart';
import '../domain/entidades/materia_inscrita.dart';

class DetalleMateriaPage extends StatelessWidget {
  const DetalleMateriaPage({super.key, required this.materia});

  final MateriaInscrita materia;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: Text(materia.nombreMateria),
          bottom: const TabBar(
            labelColor: AtenzaColores.primary700,
            unselectedLabelColor: AtenzaColores.textoSecundario,
            indicatorColor: AtenzaColores.primary700,
            tabs: [
              Tab(text: 'Calendario'),
              Tab(text: 'Asistencia'),
              Tab(text: 'Notas'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            ClasesPage(materia: materia),
            MiAsistenciaPage(materia: materia),
            MisNotasPage(materia: materia),
          ],
        ),
      ),
    );
  }
}
