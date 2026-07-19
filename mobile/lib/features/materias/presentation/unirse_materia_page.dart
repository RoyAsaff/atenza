// HU-10 · Unirse a una materia con código
// El código de estudiante se pide aquí porque pertenece a la
// inscripción, no a la cuenta (D-04).

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/colores.dart';
import 'materias_controller.dart';

class UnirseMateriaPage extends StatefulWidget {
  const UnirseMateriaPage({super.key});

  @override
  State<UnirseMateriaPage> createState() => _UnirseMateriaPageState();
}

class _UnirseMateriaPageState extends State<UnirseMateriaPage> {
  final _form = GlobalKey<FormState>();
  final _codigoMateria = TextEditingController();
  final _codigoEstudiante = TextEditingController();
  bool _enviando = false;
  String? _error;

  @override
  void dispose() {
    _codigoMateria.dispose();
    _codigoEstudiante.dispose();
    super.dispose();
  }

  Future<void> _unirse() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      final nombre = await context.read<MateriasController>().unirse(
            codigoMateria: _codigoMateria.text.trim().toUpperCase(),
            codigoEstudiante: _codigoEstudiante.text.trim(),
          );
      if (!mounted) return;
      // Capturar el messenger ANTES de hacer pop de esta página
      final messenger = ScaffoldMessenger.of(context);
      Navigator.of(context).pop();
      messenger.showSnackBar(SnackBar(content: Text('Te uniste a $nombre')));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Unirse a una materia')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AtenzaColores.surface,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AtenzaColores.borde),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x141C3354),
                  blurRadius: 18,
                  offset: Offset(0, 10),
                ),
              ],
            ),
            child: Form(
              key: _form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AtenzaColores.primary50,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: const Icon(
                      Icons.qr_code_2_outlined,
                      color: AtenzaColores.primary700,
                      size: 30,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Código de acceso',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                          color: AtenzaColores.texto,
                        ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Pide a tu docente el código de la materia e ingrésalo junto con tu código de estudiante.',
                    style: TextStyle(
                        color: AtenzaColores.textoSecundario, height: 1.35),
                  ),
                  const SizedBox(height: 22),
                  TextFormField(
                    controller: _codigoMateria,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      labelText: 'Código de la materia',
                      hintText: 'p. ej. K3XW7Q',
                      prefixIcon: Icon(Icons.key_outlined),
                    ),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Obligatorio' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _codigoEstudiante,
                    decoration: const InputDecoration(
                      labelText: 'Tu código de estudiante',
                      helperText: 'El que usa tu institución para esta materia',
                      prefixIcon: Icon(Icons.badge_outlined),
                    ),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Obligatorio' : null,
                    onFieldSubmitted: (_) => _unirse(),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: Colors.red.shade100),
                      ),
                      child: Text(
                        _error!,
                        style: TextStyle(color: Colors.red.shade700),
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: _enviando ? null : _unirse,
                    icon: const Icon(Icons.login),
                    label: Text(_enviando ? 'Uniéndome...' : 'Unirme'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
