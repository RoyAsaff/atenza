// HU-03/HU-10 · "Materias en las que estoy inscrito" + botón para unirse

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/colores.dart';
import '../../auth/presentation/auth_controller.dart';
import '../domain/entidades/materia_inscrita.dart';
import 'detalle_materia_page.dart';
import 'materias_controller.dart';
import 'unirse_materia_page.dart';

class MisMateriasPage extends StatefulWidget {
  const MisMateriasPage({super.key});

  @override
  State<MisMateriasPage> createState() => _MisMateriasPageState();
}

class _MisMateriasPageState extends State<MisMateriasPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MateriasController>().cargar();
    });
  }

  Future<void> _confirmarDeslinde(MateriaInscrita m) async {
    final salir = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Salir de la materia'),
        content: Text(
          'Dejarás de ver ${m.nombreMateria} y sus evaluaciones. '
          'Tu historial se conserva y puedes volver a unirte con el código. '
          '¿Salir?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Salir de la materia'),
          ),
        ],
      ),
    );
    if (salir != true || !mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    try {
      await context.read<MateriasController>().deslindarse(m.inscripcionId);
      messenger.showSnackBar(
        SnackBar(content: Text('Saliste de ${m.nombreMateria}')),
      );
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _confirmarCierre() async {
    final salir = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text('¿Quieres salir de tu cuenta en este dispositivo?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Salir'),
          ),
        ],
      ),
    );
    if (salir == true && mounted) {
      await context.read<AuthController>().cerrarSesion();
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final materias = context.watch<MateriasController>();
    final nombre = auth.sesion?.usuario.nombres ?? '';

    return Scaffold(
      appBar: AppBar(
        title: const Text('ATENZA'),
        actions: [
          IconButton.filledTonal(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout),
            onPressed: _confirmarCierre,
          ),
          const SizedBox(width: 12),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const UnirseMateriaPage()),
        ),
        icon: const Icon(Icons.add),
        label: const Text('Unirme'),
      ),
      body: RefreshIndicator(
        onRefresh: () => context.read<MateriasController>().cargar(),
        child: Builder(
          builder: (context) {
            if (materias.cargando && materias.inscritas.isEmpty) {
              return const Center(child: CircularProgressIndicator());
            }
            if (materias.error != null && materias.inscritas.isEmpty) {
              return ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const SizedBox(height: 80),
                  _EstadoVacio(
                    icono: Icons.error_outline,
                    titulo: 'No pudimos cargar tus materias',
                    detalle: materias.error!,
                    color: AtenzaColores.peligro,
                  ),
                ],
              );
            }
            if (materias.inscritas.isEmpty) {
              return ListView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 96),
                children: [
                  _Encabezado(nombre: nombre, total: 0),
                  const SizedBox(height: 18),
                  const _EstadoVacio(
                    icono: Icons.school_outlined,
                    titulo: 'Aún no tienes materias',
                    detalle:
                        'Usa el botón Unirme para ingresar el código que te dio tu docente.',
                    color: AtenzaColores.primary700,
                  ),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 104),
              itemCount: materias.inscritas.length + 1,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, i) {
                if (i == 0) {
                  return _Encabezado(
                      nombre: nombre, total: materias.inscritas.length);
                }
                final m = materias.inscritas[i - 1];
                return _MateriaCard(
                  materia: m,
                  onDeslindar: () => _confirmarDeslinde(m),
                  // E4/E5/E8: calendario, asistencia y notas juntos en pestañas
                  onAbrir: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => DetalleMateriaPage(materia: m)),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _Encabezado extends StatelessWidget {
  const _Encabezado({required this.nombre, required this.total});

  final String nombre;
  final int total;

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
            nombre.isEmpty ? 'Hola' : 'Hola, $nombre',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            total == 1 ? '1 materia inscrita' : '$total materias inscritas',
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: Colors.white70),
          ),
        ],
      ),
    );
  }
}

class _MateriaCard extends StatelessWidget {
  const _MateriaCard({
    required this.materia,
    required this.onDeslindar,
    required this.onAbrir,
  });

  final MateriaInscrita materia;
  final VoidCallback onDeslindar;
  final VoidCallback onAbrir;

  @override
  Widget build(BuildContext context) {
    final titulo = materia.sigla == null
        ? materia.nombreMateria
        : '${materia.nombreMateria} (${materia.sigla})';

    return Card(
      child: InkWell(
        onTap: onAbrir,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AtenzaColores.primary50,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.menu_book_outlined,
                      color: AtenzaColores.primary700),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        titulo,
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: AtenzaColores.texto,
                                ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${materia.carrera} · ${materia.semestre}',
                        style: const TextStyle(color: AtenzaColores.textoSecundario),
                      ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  onSelected: (opcion) {
                    if (opcion == 'deslindar') onDeslindar();
                  },
                  itemBuilder: (_) => const [
                    PopupMenuItem(
                      value: 'deslindar',
                      child: Text('Salir de la materia'),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 14),
            _DatoMateria(
                icono: Icons.person_outline,
                texto: 'Docente: ${materia.docente}'),
            const SizedBox(height: 8),
            _DatoMateria(
              icono: Icons.confirmation_number_outlined,
              texto: 'Mi código: ${materia.codigoEstudiante}',
            ),
          ],
        ),
        ),
      ),
    );
  }
}

class _DatoMateria extends StatelessWidget {
  const _DatoMateria({required this.icono, required this.texto});

  final IconData icono;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icono, size: 18, color: AtenzaColores.neutral500),
        const SizedBox(width: 8),
        Expanded(
          child: Text(texto,
              style: const TextStyle(color: AtenzaColores.textoSecundario)),
        ),
      ],
    );
  }
}

class _EstadoVacio extends StatelessWidget {
  const _EstadoVacio({
    required this.icono,
    required this.titulo,
    required this.detalle,
    required this.color,
  });

  final IconData icono;
  final String titulo;
  final String detalle;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AtenzaColores.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AtenzaColores.borde),
      ),
      child: Column(
        children: [
          Icon(icono, size: 44, color: color),
          const SizedBox(height: 14),
          Text(
            titulo,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AtenzaColores.texto,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            detalle,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AtenzaColores.textoSecundario),
          ),
        ],
      ),
    );
  }
}
