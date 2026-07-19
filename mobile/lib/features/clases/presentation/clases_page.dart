// "Ver Clase" (diagrama E4, actor Estudiante): calendario de la materia.
// Calendario visual con table_calendar (gratis, BSD): los días con clase
// llevan un punto marcador; al tocar un día se listan sus clases abajo.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:table_calendar/table_calendar.dart';

import '../../../core/theme/colores.dart';
import '../../materias/domain/entidades/materia_inscrita.dart';
import '../domain/entidades/clase.dart';
import '../domain/repositorios/clases_repositorio.dart';

const _MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];
const _DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

String _fechaLegible(DateTime f) =>
    '${_DIAS[f.weekday - 1]} ${f.day} ${_MESES[f.month - 1]} ${f.year}';

bool _mismoDia(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

class ClasesPage extends StatefulWidget {
  const ClasesPage({super.key, required this.materia});

  final MateriaInscrita materia;

  @override
  State<ClasesPage> createState() => _ClasesPageState();
}

class _ClasesPageState extends State<ClasesPage>
    with AutomaticKeepAliveClientMixin<ClasesPage> {
  late Future<List<Clase>> _futuro;
  DateTime _diaFocalizado = DateTime.now();
  DateTime _diaSeleccionado = DateTime.now();

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  void _cargar() {
    _futuro = context
        .read<ClasesRepositorio>()
        .listarPorMateria(widget.materia.materiaId);
  }

  Future<void> _refrescar() async {
    setState(_cargar);
    await _futuro;
  }

  List<Clase> _clasesDelDia(List<Clase> clases, DateTime dia) =>
      clases.where((c) => _mismoDia(c.fecha, dia)).toList();

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return RefreshIndicator(
      onRefresh: _refrescar,
      child: FutureBuilder<List<Clase>>(
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

            final clases = snapshot.data ?? const <Clase>[];
            if (clases.isEmpty) {
              return ListView(
                padding: const EdgeInsets.all(24),
                children: const [
                  SizedBox(height: 80),
                  Text(
                    'El docente aún no publicó el calendario de clases.',
                    textAlign: TextAlign.center,
                  ),
                ],
              );
            }

            final clasesDelDia = _clasesDelDia(clases, _diaSeleccionado);

            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: [
                _Encabezado(materia: widget.materia, total: clases.length),
                const SizedBox(height: 12),
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: TableCalendar<Clase>(
                      locale: 'es_ES',
                      firstDay: DateTime.utc(2020, 1, 1),
                      lastDay: DateTime.utc(2035, 12, 31),
                      focusedDay: _diaFocalizado,
                      selectedDayPredicate: (dia) => _mismoDia(dia, _diaSeleccionado),
                      eventLoader: (dia) => _clasesDelDia(clases, dia),
                      startingDayOfWeek: StartingDayOfWeek.monday,
                      availableCalendarFormats: const {CalendarFormat.month: 'Mes'},
                      onDaySelected: (seleccionado, focalizado) {
                        setState(() {
                          _diaSeleccionado = seleccionado;
                          _diaFocalizado = focalizado;
                        });
                      },
                      onPageChanged: (focalizado) => _diaFocalizado = focalizado,
                      headerStyle: const HeaderStyle(
                        formatButtonVisible: false,
                        titleCentered: true,
                        titleTextStyle:
                            TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                      ),
                      calendarStyle: CalendarStyle(
                        outsideDaysVisible: false,
                        todayDecoration: const BoxDecoration(
                          color: AtenzaColores.primary100,
                          shape: BoxShape.circle,
                        ),
                        todayTextStyle: const TextStyle(
                          color: AtenzaColores.texto,
                          fontWeight: FontWeight.w700,
                        ),
                        selectedDecoration: const BoxDecoration(
                          color: AtenzaColores.primary700,
                          shape: BoxShape.circle,
                        ),
                        markerDecoration: const BoxDecoration(
                          color: AtenzaColores.primary700,
                          shape: BoxShape.circle,
                        ),
                        markersMaxCount: 1,
                      ),
                    ),
                  ),
                ),
                const _TituloSeccion('Clases de este día'),
                if (clasesDelDia.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: Text(
                      'No hay clases este día.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AtenzaColores.textoSecundario),
                    ),
                  )
                else
                  ...clasesDelDia.map((c) => _TarjetaClase(clase: c)),
              ],
            );
          },
        ),
      );
  }
}

class _Encabezado extends StatelessWidget {
  const _Encabezado({required this.materia, required this.total});

  final MateriaInscrita materia;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        '${materia.carrera} · ${materia.semestre} — $total clases',
        style: Theme.of(context)
            .textTheme
            .bodyMedium
            ?.copyWith(color: AtenzaColores.textoSecundario),
      ),
    );
  }
}

class _TituloSeccion extends StatelessWidget {
  const _TituloSeccion(this.texto);

  final String texto;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
      child: Text(
        texto,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: AtenzaColores.texto,
            ),
      ),
    );
  }
}

class _TarjetaClase extends StatelessWidget {
  const _TarjetaClase({required this.clase});

  final Clase clase;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: ListTile(
          leading: Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AtenzaColores.primary50,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              '${clase.fecha.day}\n${_MESES[clase.fecha.month - 1]}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: AtenzaColores.primary700,
                height: 1.1,
              ),
            ),
          ),
          title: Text(
            clase.tema,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          subtitle: Text('${_fechaLegible(clase.fecha)} · ${clase.hora}'),
        ),
      ),
    );
  }
}
