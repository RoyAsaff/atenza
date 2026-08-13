// Abre la guía (HTML autocontenido publicado en PaginaGuias) dentro de la
// app, sin que el estudiante tenga que salir a un navegador aparte.
//
// A propósito NO usa el patrón global de ExamenController (swap forzoso a
// la raíz del stack) — eso es específico del examen empujado por
// servidor. Acá es un `Navigator.push` normal, igual que DetalleIntentoPage.

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../domain/entidades/guia.dart';

class GuiaWebviewPage extends StatefulWidget {
  const GuiaWebviewPage({super.key, required this.guia});

  final Guia guia;

  @override
  State<GuiaWebviewPage> createState() => _GuiaWebviewPageState();
}

class _GuiaWebviewPageState extends State<GuiaWebviewPage> {
  late final WebViewController _controller;
  bool _cargando = true;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _cargando = true),
          onPageFinished: (_) => setState(() => _cargando = false),
        ),
      )
      // La URL ya trae el token de acceso (?atenza_token=...&guia=...),
      // armado por el backend en VerMisGuias — no hace falta login acá.
      ..loadRequest(Uri.parse(widget.guia.urlAcceso));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.guia.tema)),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_cargando) const Center(child: CircularProgressIndicator()),
        ],
      ),
    );
  }
}
