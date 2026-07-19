// E7 · HU-21: modo examen seguro. Pantalla completa (immersiveSticky),
// capturas bloqueadas (FLAG_SECURE), navegación restringida (PopScope)
// e incidentes de salida de pantalla vía WidgetsBindingObserver.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_windowmanager_plus/flutter_windowmanager_plus.dart';
import 'package:provider/provider.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../../core/api/api_cliente.dart';
import '../../../core/theme/colores.dart';
import '../domain/entidades/intento.dart';
import '../domain/repositorios/examen_repositorio.dart';
import 'examen_controller.dart';

// El backend devuelve url_imagen como ruta relativa (p.ej. /uploads/foo.png);
// a diferencia del cliente web (mismo origen), acá hay que anteponer el host
// de la API para que Image.network pueda resolverla.
String _urlImagenCompleta(String url) => url.startsWith('http') ? url : '$apiUrl$url';

class ExamenPage extends StatefulWidget {
  const ExamenPage({super.key});

  @override
  State<ExamenPage> createState() => _ExamenPageState();
}

class _ExamenPageState extends State<ExamenPage> with WidgetsBindingObserver {
  final Map<int, int?> _respuestas = {};
  int _indice = 0;
  Timer? _temporizador;
  Duration? _restante;
  bool _enviando = false;
  String? _error;
  int? _intentoIdInicial;
  bool _kioscoActivo = true;
  bool _contando = true;
  int _numeroCuenta = 5;
  Timer? _timerCuenta;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _activarModoKiosco();
    _inicializarDesdeIntento();
    _iniciarCuentaRegresiva();
    _temporizador = Timer.periodic(const Duration(seconds: 1), (_) => _actualizarRestante());
    _actualizarRestante();
  }

  // Cuenta regresiva de arranque (5→1), en espejo de la que ya tiene la web
  // (RendirExamenPage.tsx) antes de mostrar la primera pregunta.
  void _iniciarCuentaRegresiva() {
    _timerCuenta = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_numeroCuenta <= 1) {
        timer.cancel();
        setState(() => _contando = false);
      } else {
        setState(() => _numeroCuenta--);
      }
    });
  }

  void _inicializarDesdeIntento() {
    final intento = context.read<ExamenController>().intento;
    _intentoIdInicial = intento?.intentoId;
    for (final p in intento?.preguntas ?? const <PreguntaParaRendir>[]) {
      _respuestas[p.id] = p.opcionElegidaId;
    }
  }

  Future<void> _activarModoKiosco() async {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    await FlutterWindowManagerPlus.addFlags(FlutterWindowManagerPlus.FLAG_SECURE);
    await WakelockPlus.enable();
  }

  Future<void> _desactivarModoKiosco() async {
    // SystemUiMode.edgeToEdge no siempre "despierta" las barras tras haber
    // estado en immersiveSticky (quedan pegadas ocultas hasta un gesto del
    // usuario); manual + todos los overlays las fuerza a reaparecer.
    await SystemChrome.setEnabledSystemUIMode(
      SystemUiMode.manual,
      overlays: SystemUiOverlay.values,
    );
    await FlutterWindowManagerPlus.clearFlags(FlutterWindowManagerPlus.FLAG_SECURE);
    await WakelockPlus.disable();
  }

  // /api/intentos/actual excluye 'finalizado'/'cancelado': en cuanto el
  // intento termina, deja de devolverlo (no hay un estado intermedio que
  // leer), así que no podemos esperar a que un rebuild lo detecte. Salimos
  // del kiosco como efecto directo de la acción que cierra el examen.
  // Se espera a que termine (en vez de "fire-and-forget") para que quede
  // aplicado ANTES de que el refresco dispare el swap fuera de esta
  // pantalla — si no, la desactivación quedaba a medias y el dispose() ya
  // no reintentaba (el flag se marcaba en falso apenas se pedía, no cuando
  // se confirmaba hecho).
  Future<void> _salirDeModoKiosco() async {
    if (!_kioscoActivo) return;
    _kioscoActivo = false;
    await _desactivarModoKiosco();
  }

  Future<void> _actualizarRestante() async {
    final controller = context.read<ExamenController>();
    final limite = controller.intento?.fechaLimite;
    if (limite == null) return;
    final restante = limite.difference(DateTime.now());
    if (mounted) {
      setState(() => _restante = restante.isNegative ? Duration.zero : restante);
    }
    if (restante.isNegative) {
      // El servidor autofinaliza al vencer (HU-24 Esc. 1). /actual deja de
      // devolver el intento en cuanto queda finalizado, así que no podemos
      // esperar a leer ese estado: salimos del kiosco ya mismo.
      await _salirDeModoKiosco();
      controller.refrescar();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // HU-21 Esc. 2: multitarea, botón home o apagado de pantalla.
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.detached ||
        state == AppLifecycleState.hidden) {
      _reportarIncidente();
    }
  }

  Future<void> _reportarIncidente() async {
    final intentoId = context.read<ExamenController>().intento?.intentoId ?? _intentoIdInicial;
    if (intentoId == null) return;
    try {
      await context.read<ExamenRepositorio>().reportarIncidente(intentoId);
    } catch (_) {
      // Sin conexión en ese momento: no hay mucho más que hacer localmente.
    }
  }

  Future<void> _elegirOpcion(PreguntaParaRendir pregunta, int opcionId) async {
    setState(() => _respuestas[pregunta.id] = opcionId);
    final intentoId = context.read<ExamenController>().intento?.intentoId;
    if (intentoId == null) return;
    try {
      await context.read<ExamenRepositorio>().guardarRespuesta(intentoId, pregunta.id, opcionId);
    } catch (_) {
      // Se reintenta al enviar el examen (D-06 + HU-21 Esc. 4).
    }
  }

  Future<void> _reintentarPendientes(
    ExamenRepositorio repo,
    List<PreguntaParaRendir> preguntas,
    int intentoId,
  ) async {
    for (final p in preguntas) {
      final elegida = _respuestas[p.id];
      if (elegida != null && elegida != p.opcionElegidaId) {
        await repo.guardarRespuesta(intentoId, p.id, elegida);
      }
    }
  }

  Future<void> _finalizar() async {
    final controller = context.read<ExamenController>();
    final repo = context.read<ExamenRepositorio>();
    final intento = controller.intento;
    if (intento == null) return;
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      await _reintentarPendientes(repo, intento.preguntas, intento.intentoId);
      await repo.finalizar(intento.intentoId);
      await _salirDeModoKiosco();
      await controller.refrescar();
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'No se pudo enviar: revisa tu conexión e intenta de nuevo.');
      }
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _temporizador?.cancel();
    _timerCuenta?.cancel();
    // Red de seguridad para cierres no cubiertos arriba (p. ej. el docente
    // cancela el examen remotamente): garantiza que nunca quede el kiosco
    // encendido tras salir de esta pantalla.
    _salirDeModoKiosco();
    super.dispose();
  }

  String _formatearRestante(Duration d) {
    final horas = d.inHours;
    final minutos = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final segundos = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return horas > 0 ? '$horas:$minutos:$segundos' : '$minutos:$segundos';
  }

  @override
  Widget build(BuildContext context) {
    final intento = context.watch<ExamenController>().intento;

    return PopScope(
      canPop: false, // navegación restringida hasta enviar (HU-21 Esc. 1)
      child: Scaffold(
        backgroundColor: AtenzaColores.primary900,
        body: SafeArea(child: _contenido(intento)),
      ),
    );
  }

  Widget _contenido(IntentoParaRendir? intento) {
    if (intento == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (intento.estado == EstadoIntento.pausado) {
      return const _PantallaPausada();
    }

    if (intento.estado == EstadoIntento.finalizado || intento.estado == EstadoIntento.cancelado) {
      final cancelado = intento.estado == EstadoIntento.cancelado;
      return _PantallaCierre(
        titulo: cancelado ? 'Examen cancelado' : 'Examen finalizado',
        detalle: cancelado
            ? 'El docente canceló el examen. Tus respuestas guardadas hasta el momento quedaron registradas.'
            : 'Tu examen se envió correctamente.',
        onContinuar: () => context.read<ExamenController>().cerrarVistaFinal(),
      );
    }

    if (intento.preguntas.isEmpty) {
      return const Center(
        child: Text('La evaluación no tiene preguntas.', style: TextStyle(color: Colors.white70)),
      );
    }

    if (_contando) {
      return _PantallaCuenta(numero: _numeroCuenta);
    }

    final total = intento.preguntas.length;
    final pregunta = intento.preguntas[_indice.clamp(0, total - 1)];
    final respondidas = _respuestas.values.where((v) => v != null).length;

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  intento.tema,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
              ),
              if (_restante != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: _restante!.inSeconds < 60 ? AtenzaColores.peligro : Colors.white10,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    _formatearRestante(_restante!),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Pregunta ${_indice + 1} de $total · $respondidas respondidas',
            style: const TextStyle(color: Colors.white54, fontSize: 13),
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: (_indice + 1) / total,
              backgroundColor: Colors.white12,
              color: AtenzaColores.primary300,
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 24),
          Expanded(
            child: SingleChildScrollView(
              child: _TarjetaPregunta(
                pregunta: pregunta,
                seleccionada: _respuestas[pregunta.id],
                onElegir: (opcionId) => _elegirOpcion(pregunta, opcionId),
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
            ),
          Row(
            children: [
              if (_indice > 0) ...[
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() => _indice--),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Colors.white24),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: const Text('Anterior'),
                  ),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: FilledButton(
                  onPressed: _enviando
                      ? null
                      : () {
                          if (_indice < total - 1) {
                            setState(() => _indice++);
                          } else {
                            _finalizar();
                          }
                        },
                  style: FilledButton.styleFrom(
                    backgroundColor: AtenzaColores.primary700,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: Text(
                    _indice < total - 1 ? 'Siguiente' : (_enviando ? 'Enviando…' : 'Enviar examen'),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TarjetaPregunta extends StatelessWidget {
  const _TarjetaPregunta({
    required this.pregunta,
    required this.seleccionada,
    required this.onElegir,
  });

  final PreguntaParaRendir pregunta;
  final int? seleccionada;
  final void Function(int opcionId) onElegir;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            pregunta.pregunta,
            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
          ),
          if (pregunta.urlImagen != null) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Image.network(_urlImagenCompleta(pregunta.urlImagen!), fit: BoxFit.cover),
            ),
          ],
          const SizedBox(height: 16),
          ...pregunta.opciones.asMap().entries.map((entrada) {
            final letra = String.fromCharCode(65 + entrada.key); // A, B, C, D
            final opcion = entrada.value;
            final elegida = seleccionada == opcion.id;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () => onElegir(opcion.id),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: elegida ? AtenzaColores.primary600 : Colors.white.withValues(alpha: 0.09),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: elegida ? AtenzaColores.primary300 : Colors.white38,
                      width: elegida ? 1.5 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 26,
                        height: 26,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: elegida ? Colors.white : Colors.white.withValues(alpha: 0.16),
                        ),
                        child: Text(
                          letra,
                          style: TextStyle(
                            color: elegida ? AtenzaColores.primary700 : Colors.white70,
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          opcion.texto,
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: elegida ? FontWeight.w700 : FontWeight.w400,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _PantallaCuenta extends StatelessWidget {
  const _PantallaCuenta({required this.numero});

  final int numero;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'COMENZANDO…',
            style: TextStyle(
              color: Colors.white54,
              fontSize: 13,
              fontWeight: FontWeight.w700,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 28),
          SizedBox(
            width: 160,
            height: 160,
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 350),
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: ScaleTransition(
                  scale: Tween<double>(begin: 1.7, end: 1).animate(
                    CurvedAnimation(parent: animation, curve: Curves.easeOut),
                  ),
                  child: child,
                ),
              ),
              child: Container(
                key: ValueKey(numero),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AtenzaColores.accent500.withValues(alpha: 0.18),
                ),
                child: Text(
                  '$numero',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 64,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PantallaPausada extends StatelessWidget {
  const _PantallaPausada();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.pause_circle_filled, color: AtenzaColores.accent500, size: 64),
            SizedBox(height: 16),
            Text(
              'El docente pausó tu examen',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
            ),
            SizedBox(height: 8),
            Text(
              'Espera: continuarás exactamente donde quedaste en cuanto te reactive.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white70),
            ),
          ],
        ),
      ),
    );
  }
}

class _PantallaCierre extends StatelessWidget {
  const _PantallaCierre({
    required this.titulo,
    required this.detalle,
    required this.onContinuar,
  });

  final String titulo;
  final String detalle;
  final VoidCallback onContinuar;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle, color: AtenzaColores.secondary400, size: 64),
            const SizedBox(height: 16),
            Text(
              titulo,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(detalle, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: onContinuar,
              style: FilledButton.styleFrom(backgroundColor: AtenzaColores.primary700),
              child: const Text('Volver a mis materias'),
            ),
          ],
        ),
      ),
    );
  }
}
