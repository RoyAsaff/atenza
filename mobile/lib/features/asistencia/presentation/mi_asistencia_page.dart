// Diagrama E5 (actor Estudiante): Ver Asistencias — historial propio

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/colores.dart';
import '../../materias/domain/entidades/materia_inscrita.dart';
import '../domain/entidades/mi_asistencia.dart';
import '../domain/repositorios/asistencia_repositorio.dart';

const _DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const _MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

String _fechaLegible(DateTime f) =>
    '${_DIAS[f.weekday - 1]} ${f.day} ${_MESES[f.month - 1]} ${f.year}';

const _etiquetas = {
  Marcaje.puntual: 'Puntual',
  Marcaje.atrasado: 'Atraso',
  Marcaje.licencia: 'Licencia',
  Marcaje.falta: 'Falta',
};

const _colores = <Marcaje, ({Color fondo, Color texto})>{
  Marcaje.puntual: (fondo: AtenzaColores.secondary50, texto: AtenzaColores.secondary800),
  Marcaje.atrasado: (fondo: AtenzaColores.accent50, texto: AtenzaColores.accent800),
  Marcaje.licencia: (fondo: AtenzaColores.primary50, texto: AtenzaColores.primary700),
  Marcaje.falta: (fondo: Color(0xFFFEF2F2), texto: AtenzaColores.peligro),
};

class MiAsistenciaPage extends StatefulWidget {
  const MiAsistenciaPage({super.key, required this.materia});

  final MateriaInscrita materia;

  @override
  State<MiAsistenciaPage> createState() => _MiAsistenciaPageState();
}

class _MiAsistenciaPageState extends State<MiAsistenciaPage>
    with AutomaticKeepAliveClientMixin<MiAsistenciaPage> {
  late Future<List<MiAsistencia>> _futuro;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  void _cargar() {
    _futuro = context
        .read<AsistenciaRepositorio>()
        .listarPorMateria(widget.materia.materiaId);
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
      child: FutureBuilder<List<MiAsistencia>>(
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

            final registros = snapshot.data ?? const <MiAsistencia>[];
            if (registros.isEmpty) {
              return ListView(
                padding: const EdgeInsets.all(24),
                children: const [
                  SizedBox(height: 80),
                  Text(
                    'El docente aún no registró asistencia en esta materia.',
                    textAlign: TextAlign.center,
                  ),
                ],
              );
            }

            final total = registros.length;
            final asistidas = registros
                .where((r) =>
                    r.marcaje == Marcaje.puntual || r.marcaje == Marcaje.atrasado)
                .length;
            final porcentaje = total == 0 ? 0 : (asistidas / total * 100).round();

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _Resumen(total: total, porcentaje: porcentaje),
                const SizedBox(height: 8),
                ...registros.map((r) => _TarjetaAsistencia(registro: r)),
                const SizedBox(height: 24),
              ],
            );
          },
        ),
      );
  }
}

class _Resumen extends StatelessWidget {
  const _Resumen({required this.total, required this.porcentaje});

  final int total;
  final int porcentaje;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AtenzaColores.primary900,
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [
          BoxShadow(
            color: Color(0x261C3354),
            blurRadius: 20,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$porcentaje% de asistencia',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            '$total clases registradas',
            style: const TextStyle(color: Colors.white70),
          ),
        ],
      ),
    );
  }
}

class _TarjetaAsistencia extends StatelessWidget {
  const _TarjetaAsistencia({required this.registro});

  final MiAsistencia registro;

  @override
  Widget build(BuildContext context) {
    final color = _colores[registro.marcaje]!;
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
              '${registro.fecha.day}\n${_MESES[registro.fecha.month - 1]}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: AtenzaColores.primary700,
                height: 1.1,
              ),
            ),
          ),
          title:
              Text(registro.tema, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text('${_fechaLegible(registro.fecha)} · ${registro.hora}'),
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: color.fondo,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              _etiquetas[registro.marcaje]!,
              style: TextStyle(
                color: color.texto,
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
