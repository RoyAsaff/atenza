// E8 (HU-25/26 detalle) · "Ver examen": el estudiante revisa pregunta
// por pregunta qué respondió y si acertó, con la opción correcta
// resaltada (evaluación ya finalizada y publicada).

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/api/api_cliente.dart';
import '../../../core/theme/colores.dart';
import '../domain/entidades/detalle_intento.dart';
import '../domain/repositorios/resultados_repositorio.dart';

// El backend devuelve url_imagen como ruta relativa (p.ej. /uploads/foo.png);
// a diferencia del cliente web (mismo origen), acá hay que anteponer el host
// de la API para que Image.network pueda resolverla.
String _urlImagenCompleta(String url) => url.startsWith('http') ? url : '$apiUrl$url';

class DetalleIntentoPage extends StatefulWidget {
  const DetalleIntentoPage({
    super.key,
    required this.materiaId,
    required this.evaluacionId,
    required this.tema,
  });

  final int materiaId;
  final int evaluacionId;
  final String tema;

  @override
  State<DetalleIntentoPage> createState() => _DetalleIntentoPageState();
}

class _DetalleIntentoPageState extends State<DetalleIntentoPage> {
  late Future<DetalleIntento> _futuro;

  @override
  void initState() {
    super.initState();
    _futuro = context
        .read<ResultadosRepositorio>()
        .verDetalle(widget.materiaId, widget.evaluacionId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.tema)),
      body: FutureBuilder<DetalleIntento>(
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

          final detalle = snapshot.data!;
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: detalle.preguntas.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, i) =>
                _TarjetaPregunta(pregunta: detalle.preguntas[i], numero: i + 1),
          );
        },
      ),
    );
  }
}

class _TarjetaPregunta extends StatelessWidget {
  const _TarjetaPregunta({required this.pregunta, required this.numero});

  final PreguntaDetalleIntento pregunta;
  final int numero;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AtenzaColores.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AtenzaColores.borde),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: AtenzaColores.neutral100,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  '$numero',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AtenzaColores.textoMuted,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  pregunta.pregunta,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              const SizedBox(width: 8),
              _BadgeEstado(pregunta: pregunta),
            ],
          ),
          if (pregunta.urlImagen != null) ...[
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.only(left: 34),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(_urlImagenCompleta(pregunta.urlImagen!), fit: BoxFit.cover),
              ),
            ),
          ],
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.only(left: 34),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: pregunta.opciones.map((opcion) {
                final elegida = opcion.id == pregunta.opcionElegidaId;
                final Color fondo;
                final Color texto;
                final IconData? icono;
                if (opcion.esCorrecta) {
                  fondo = AtenzaColores.secondary50;
                  texto = AtenzaColores.secondary800;
                  icono = Icons.check_circle;
                } else if (elegida) {
                  fondo = const Color(0xFFFEF2F2);
                  texto = AtenzaColores.peligro;
                  icono = Icons.cancel;
                } else {
                  fondo = Colors.transparent;
                  texto = AtenzaColores.textoSecundario;
                  icono = null;
                }
                return Container(
                  margin: const EdgeInsets.only(bottom: 4),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  decoration: BoxDecoration(
                    color: fondo,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      if (icono != null) ...[
                        Icon(icono, size: 15, color: texto),
                        const SizedBox(width: 6),
                      ],
                      Expanded(
                        child: Text(
                          elegida && !opcion.esCorrecta
                              ? '${opcion.texto} (elegida)'
                              : opcion.texto,
                          style: TextStyle(
                            color: texto,
                            fontWeight: opcion.esCorrecta || elegida
                                ? FontWeight.w600
                                : FontWeight.w400,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _BadgeEstado extends StatelessWidget {
  const _BadgeEstado({required this.pregunta});

  final PreguntaDetalleIntento pregunta;

  @override
  Widget build(BuildContext context) {
    final String texto;
    final Color fondo;
    final Color color;
    if (pregunta.opcionElegidaId == null) {
      texto = 'Sin responder';
      fondo = AtenzaColores.neutral100;
      color = AtenzaColores.textoSecundario;
    } else if (pregunta.acerto) {
      texto = 'Correcta';
      fondo = AtenzaColores.secondary50;
      color = AtenzaColores.secondary800;
    } else {
      texto = 'Incorrecta';
      fondo = const Color(0xFFFEF2F2);
      color = AtenzaColores.peligro;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: fondo, borderRadius: BorderRadius.circular(999)),
      child: Text(
        texto,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}
