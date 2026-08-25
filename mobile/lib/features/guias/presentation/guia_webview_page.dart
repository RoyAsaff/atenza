// Abre la guía (HTML autocontenido publicado en PaginaGuias) dentro de la
// app, sin que el estudiante tenga que salir a un navegador aparte.
//
// A propósito NO usa el patrón global de ExamenController (swap forzoso a
// la raíz del stack) — eso es específico del examen empujado por
// servidor. Acá es un `Navigator.push` normal, igual que DetalleIntentoPage.
//
// La url_acceso del listado (GuiasPage) siempre llega vacía para guías
// nativas — armarEstadoNativa (gestionar-guias.ts) lo hace a propósito,
// el link real con el token hay que pedirlo a /tomar recién al entrar
// (mismo espíritu que TomarGuiaPage.tsx en web). Cargar esa url vacía
// directo en el WebView dejaba la pantalla en blanco (bug real, 24/08).

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../core/theme/colores.dart';
import '../domain/entidades/guia.dart';
import '../domain/repositorios/guias_repositorio.dart';

class GuiaWebviewPage extends StatefulWidget {
  const GuiaWebviewPage({super.key, required this.materiaId, required this.guia});

  final int materiaId;
  final Guia guia;

  @override
  State<GuiaWebviewPage> createState() => _GuiaWebviewPageState();
}

class _GuiaWebviewPageState extends State<GuiaWebviewPage> {
  WebViewController? _controller;
  bool _cargando = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _iniciar();
  }

  Future<void> _iniciar() async {
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      final urlAcceso = await context.read<GuiasRepositorio>().tomar(
            widget.materiaId,
            widget.guia.id,
          );
      final controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageStarted: (_) => setState(() => _cargando = true),
            onPageFinished: (_) => setState(() => _cargando = false),
          ),
        )
        ..loadRequest(Uri.parse(urlAcceso));
      if (!mounted) return;
      setState(() => _controller = controller);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _cargando = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.guia.tema)),
      body: _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AtenzaColores.peligro),
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton(onPressed: _iniciar, child: const Text('Reintentar')),
                  ],
                ),
              ),
            )
          : Stack(
              children: [
                if (_controller != null) WebViewWidget(controller: _controller!),
                if (_cargando) const Center(child: CircularProgressIndicator()),
              ],
            ),
    );
  }
}
