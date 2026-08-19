// E7 · HU-21: modo examen seguro. Pantalla completa (immersiveSticky),
// capturas bloqueadas (FLAG_SECURE), navegación restringida (PopScope)
// e incidentes de salida de pantalla vía WidgetsBindingObserver.
//
// Rediseño (ver design_handoff_rendir_examen, ya aplicado en la web —
// web/src/features/examen/RendirExamenPage.tsx): una pregunta por
// pantalla se mantiene igual (siempre fue así acá), y se le suman las
// mismas tres piezas que a la web: indicador de guardado real (nunca se
// traga el error), mapa de preguntas en una hoja inferior, y pantalla de
// repaso antes de enviar. El modo seguro nativo (FLAG_SECURE +
// immersiveSticky + wakelock) no se toca — ya es mejor que cualquier cosa
// lograble en un navegador, así que acá no hace falta el "no prometer
// pantalla completa" que sí aplicó en Safari/iOS.

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

const _cincoMinutosSeg = 300;

enum _EstadoCelda { respondida, blanco }

_EstadoCelda _celdaEstado(PreguntaParaRendir p, Map<int, int?> respuestas) =>
    respuestas[p.id] != null ? _EstadoCelda.respondida : _EstadoCelda.blanco;

String _formatearRestante(Duration d) {
  final horas = d.inHours;
  final minutos = d.inMinutes.remainder(60).toString().padLeft(2, '0');
  final segundos = d.inSeconds.remainder(60).toString().padLeft(2, '0');
  return horas > 0 ? '$horas:$minutos:$segundos' : '$minutos:$segundos';
}

class ExamenPage extends StatefulWidget {
  const ExamenPage({super.key});

  @override
  State<ExamenPage> createState() => _ExamenPageState();
}

class _ExamenPageState extends State<ExamenPage> with WidgetsBindingObserver {
  final Map<int, int?> _respuestas = {};
  int _indice = 0;
  Timer? _temporizador;
  Timer? _timerReintento;
  Duration? _restante;
  bool _enviando = false;
  String? _error;
  int? _intentoIdInicial;
  bool _kioscoActivo = true;
  bool _contando = true;
  int _numeroCuenta = 5;
  Timer? _timerCuenta;

  // Indicador de guardado (nunca más se traga el error en silencio).
  final Set<int> _guardando = {};
  final Set<int> _sinGuardar = {};

  // Incidentes: contador + aviso visible al estudiante (antes solo se
  // reportaba al backend, sin decírselo).
  int _incidentes = 0;
  bool _avisoIncidenteVisible = false;
  Timer? _timerAvisoIncidente;

  // Aviso de "quedan 5 minutos", una sola vez.
  bool _avisoCincoMinMostrado = false;
  bool _avisoTiempoVisible = false;

  // 'pregunta' | 'repaso' — pantalla de repaso antes de enviar.
  String _pantalla = 'pregunta';

  // Cierre local: independiente de que /api/intentos/actual siga
  // devolviendo el intento (ver ExamenController.marcarPantallaFinal).
  bool _enviado = false;
  String _motivoEnviado = 'estudiante'; // 'estudiante' | 'tiempo'
  bool _cancelado = false;

  late final ExamenController _controller;
  int _ultimaSenalCancelado = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _controller = context.read<ExamenController>();
    _ultimaSenalCancelado = _controller.senalCancelado;
    _controller.addListener(_alCambiarControlador);
    _activarModoKiosco();
    _inicializarDesdeIntento();
    _iniciarCuentaRegresiva();
    _temporizador = Timer.periodic(const Duration(seconds: 1), (_) => _actualizarRestante());
    _actualizarRestante();
    _timerReintento = Timer.periodic(const Duration(seconds: 10), (_) => _reintentarAutomatico());
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

  // 'examen-cancelado' llega por socket a ExamenController (ver
  // conectar()); acá solo se detecta el cambio de señal — no depende de
  // releer `intento.estado`, que puede llegar null antes de que le dé
  // tiempo (el backend excluye 'cancelado' de /actual).
  void _alCambiarControlador() {
    final actual = _controller.senalCancelado;
    if (actual == _ultimaSenalCancelado) return;
    _ultimaSenalCancelado = actual;
    if (_enviado || _cancelado) return;
    _salirDeModoKiosco();
    if (mounted) setState(() => _cancelado = true);
    _controller.marcarPantallaFinal();
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

  Future<void> _salirDeModoKiosco() async {
    if (!_kioscoActivo) return;
    _kioscoActivo = false;
    await _desactivarModoKiosco();
  }

  Future<void> _actualizarRestante() async {
    if (_enviado || _cancelado) return;
    final controller = context.read<ExamenController>();
    final limite = controller.intento?.fechaLimite;
    if (limite == null) return;
    final restante = limite.difference(DateTime.now());
    final vencido = restante.isNegative;
    if (mounted) {
      setState(() {
        _restante = vencido ? Duration.zero : restante;
        if (!vencido && !_avisoCincoMinMostrado && restante.inSeconds <= _cincoMinutosSeg) {
          _avisoCincoMinMostrado = true;
          _avisoTiempoVisible = true;
        }
      });
    }
    if (vencido) {
      // El servidor autofinaliza al vencer (HU-24 Esc. 1). Hay que marcar
      // el cierre local ANTES de refrescar: /actual ya no va a devolver
      // el intento, y sin el flag local la app volvería directo a
      // MisMateriasPage sin que el estudiante se entere de que se envió.
      await _salirDeModoKiosco();
      if (mounted) {
        setState(() {
          _motivoEnviado = 'tiempo';
          _enviado = true;
        });
      }
      controller.marcarPantallaFinal();
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
    if (mounted) {
      setState(() {
        _incidentes++;
        _avisoIncidenteVisible = true;
      });
      _timerAvisoIncidente?.cancel();
      _timerAvisoIncidente = Timer(const Duration(seconds: 8), () {
        if (mounted) setState(() => _avisoIncidenteVisible = false);
      });
    }
    try {
      await context.read<ExamenRepositorio>().reportarIncidente(intentoId);
    } catch (_) {
      // Sin conexión en ese momento: no hay mucho más que hacer localmente.
    }
  }

  /// POST de una respuesta, actualizando los sets de guardado — se usa
  /// desde _elegirOpcion, el reintento automático y _reintentarPendientes.
  /// Nunca se traga el error en silencio: siempre queda reflejado en
  /// _sinGuardar.
  Future<void> _guardarRespuesta(int intentoId, int preguntaId, int opcionId) async {
    if (mounted) setState(() => _guardando.add(preguntaId));
    try {
      await context.read<ExamenRepositorio>().guardarRespuesta(intentoId, preguntaId, opcionId);
      if (mounted) {
        setState(() {
          _guardando.remove(preguntaId);
          _sinGuardar.remove(preguntaId);
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _guardando.remove(preguntaId);
          _sinGuardar.add(preguntaId);
        });
      }
    }
  }

  Future<void> _elegirOpcion(PreguntaParaRendir pregunta, int opcionId) async {
    setState(() => _respuestas[pregunta.id] = opcionId);
    final intentoId = context.read<ExamenController>().intento?.intentoId;
    if (intentoId == null) return;
    await _guardarRespuesta(intentoId, pregunta.id, opcionId);
  }

  /// Reintento automático cada 10 s mientras haya respuestas sin guardar,
  /// además del reintento al enviar (_reintentarPendientes).
  Future<void> _reintentarAutomatico() async {
    if (_sinGuardar.isEmpty) return;
    final intentoId = context.read<ExamenController>().intento?.intentoId;
    if (intentoId == null) return;
    for (final preguntaId in _sinGuardar.toList()) {
      final opcionId = _respuestas[preguntaId];
      if (opcionId != null) await _guardarRespuesta(intentoId, preguntaId, opcionId);
    }
  }

  Future<void> _reintentarPendientes(List<PreguntaParaRendir> preguntas, int intentoId) async {
    for (final p in preguntas) {
      final elegida = _respuestas[p.id];
      if (elegida != null && (elegida != p.opcionElegidaId || _sinGuardar.contains(p.id))) {
        await _guardarRespuesta(intentoId, p.id, elegida);
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
      await _reintentarPendientes(intento.preguntas, intento.intentoId);
      await repo.finalizar(intento.intentoId);
      await _salirDeModoKiosco();
      if (mounted) {
        setState(() {
          _motivoEnviado = 'estudiante';
          _enviado = true;
        });
      }
      controller.marcarPantallaFinal();
      await controller.refrescar();
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'No se pudo enviar: revisa tu conexión e intenta de nuevo.');
      }
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<void> _abrirMapa(IntentoParaRendir intento) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => _HojaMapa(
        preguntas: intento.preguntas,
        respuestas: _respuestas,
        indiceActual: _indice,
        onIrAPregunta: (i) {
          Navigator.of(ctx).pop();
          setState(() {
            _indice = i;
            _pantalla = 'pregunta';
          });
        },
        onRevisar: () {
          Navigator.of(ctx).pop();
          setState(() => _pantalla = 'repaso');
        },
      ),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.removeListener(_alCambiarControlador);
    _temporizador?.cancel();
    _timerCuenta?.cancel();
    _timerReintento?.cancel();
    _timerAvisoIncidente?.cancel();
    // Red de seguridad para cierres no cubiertos arriba (p. ej. el docente
    // cancela el examen remotamente): garantiza que nunca quede el kiosco
    // encendido tras salir de esta pantalla.
    _salirDeModoKiosco();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final intento = context.watch<ExamenController>().intento;

    return PopScope(
      // Navegación restringida hasta enviar (HU-21 Esc. 1); dentro del
      // repaso, "atrás" vuelve a la pregunta en vez de no hacer nada.
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _pantalla == 'repaso') {
          setState(() => _pantalla = 'pregunta');
        }
      },
      child: Scaffold(
        backgroundColor: AtenzaColores.primary900,
        body: SafeArea(child: _contenido(intento)),
      ),
    );
  }

  Widget _contenido(IntentoParaRendir? intentoDelControlador) {
    // Cierre local primero: sobrevive aunque /actual ya haya dejado de
    // devolver el intento (ver ExamenController.marcarPantallaFinal).
    if (_enviado) {
      return _PantallaCierre(
        titulo: _motivoEnviado == 'tiempo' ? 'Se envió tu examen' : 'Examen enviado',
        detalle: _motivoEnviado == 'tiempo'
            ? 'Se acabó el tiempo.'
            : 'Tu examen se envió correctamente.',
        onContinuar: () => context.read<ExamenController>().cerrarVistaFinal(),
      );
    }
    if (_cancelado) {
      return _PantallaCierre(
        titulo: 'Examen cancelado',
        detalle:
            'El docente canceló el examen. Tus respuestas guardadas hasta el momento quedaron registradas.',
        onContinuar: () => context.read<ExamenController>().cerrarVistaFinal(),
      );
    }

    final intento = intentoDelControlador;
    if (intento == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (intento.estado == EstadoIntento.pausado) {
      return const _PantallaPausada();
    }

    // Red de seguridad: no debería llegar acá dado el cierre local de
    // arriba, pero por si /actual todavía devolviera un intento ya cerrado.
    if (intento.estado == EstadoIntento.finalizado || intento.estado == EstadoIntento.cancelado) {
      final cancelado = intento.estado == EstadoIntento.cancelado;
      return _PantallaCierre(
        titulo: cancelado ? 'Examen cancelado' : 'Examen enviado',
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
    final estados = intento.preguntas.map((p) => _celdaEstado(p, _respuestas)).toList();
    final respondidas = estados.where((e) => e == _EstadoCelda.respondida).length;

    return Stack(
      children: [
        _pantalla == 'repaso'
            ? _PantallaRepaso(
                intento: intento,
                respuestas: _respuestas,
                restante: _restante,
                sinGuardar: _sinGuardar,
                enviando: _enviando,
                onVolver: () => setState(() => _pantalla = 'pregunta'),
                onIrAPregunta: (i) => setState(() {
                  _indice = i;
                  _pantalla = 'pregunta';
                }),
                onEnviar: _finalizar,
              )
            : _vistaPregunta(intento, total, estados, respondidas),
        if (_avisoIncidenteVisible)
          _AvisoIncidente(
            incidentes: _incidentes,
            onCerrar: () => setState(() => _avisoIncidenteVisible = false),
          ),
      ],
    );
  }

  Widget _vistaPregunta(
    IntentoParaRendir intento,
    int total,
    List<_EstadoCelda> estados,
    int respondidas,
  ) {
    final pregunta = intento.preguntas[_indice.clamp(0, total - 1)];
    final esUltima = _indice == total - 1;

    return Column(
      children: [
        _Cabecera(
          tema: intento.tema,
          indice: _indice,
          total: total,
          restante: _restante,
          respondidas: respondidas,
          guardando: _guardando,
          sinGuardar: _sinGuardar,
        ),
        if (_avisoTiempoVisible)
          _AvisoTiempo(
            pendientes: total - respondidas,
            onCerrar: () => setState(() => _avisoTiempoVisible = false),
          ),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(18, 20, 18, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _TarjetaPregunta(
                  pregunta: pregunta,
                  seleccionada: _respuestas[pregunta.id],
                  onElegir: (opcionId) => _elegirOpcion(pregunta, opcionId),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                ],
              ],
            ),
          ),
        ),
        _BarraInferior(
          indice: _indice,
          esUltima: esUltima,
          respondidas: respondidas,
          total: total,
          estados: estados,
          onAnterior: () => setState(() => _indice = (_indice - 1).clamp(0, total - 1)),
          onSiguiente: () => setState(() => _indice = (_indice + 1).clamp(0, total - 1)),
          onIrARepaso: () => setState(() => _pantalla = 'repaso'),
          onAbrirMapa: () => _abrirMapa(intento),
        ),
      ],
    );
  }
}

// ── Indicador de guardado ────────────────────────────────────────────

class _IndicadorGuardado extends StatelessWidget {
  const _IndicadorGuardado({required this.guardando, required this.sinGuardar});

  final Set<int> guardando;
  final Set<int> sinGuardar;

  @override
  Widget build(BuildContext context) {
    if (sinGuardar.isNotEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: AtenzaColores.peligro, borderRadius: BorderRadius.circular(8)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            '${sinGuardar.length} sin guardar',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
          ),
        ]),
      );
    }
    if (guardando.isNotEmpty) {
      return Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 6,
          height: 6,
          decoration: const BoxDecoration(color: AtenzaColores.accent400, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        const Text('Guardando…', style: TextStyle(color: AtenzaColores.accent400, fontSize: 13)),
      ]);
    }
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 6,
        height: 6,
        decoration: const BoxDecoration(color: AtenzaColores.secondary400, shape: BoxShape.circle),
      ),
      const SizedBox(width: 6),
      const Text('Guardado', style: TextStyle(color: AtenzaColores.secondary400, fontSize: 13)),
    ]);
  }
}

// ── Cabecera ─────────────────────────────────────────────────────────

class _Cabecera extends StatelessWidget {
  const _Cabecera({
    required this.tema,
    required this.indice,
    required this.total,
    required this.restante,
    required this.respondidas,
    required this.guardando,
    required this.sinGuardar,
  });

  final String tema;
  final int indice;
  final int total;
  final Duration? restante;
  final int respondidas;
  final Set<int> guardando;
  final Set<int> sinGuardar;

  @override
  Widget build(BuildContext context) {
    final bajoTiempo = restante != null && restante!.inSeconds < _cincoMinutosSeg;
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Colors.white10))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  tema,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15),
                ),
              ),
              if (restante != null) ...[
                const SizedBox(width: 12),
                Container(
                  height: 30,
                  padding: const EdgeInsets.symmetric(horizontal: 11),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: bajoTiempo ? AtenzaColores.peligro : Colors.white10,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _formatearRestante(restante!),
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 11),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              RichText(
                text: TextSpan(
                  style: const TextStyle(color: Colors.white60, fontSize: 13),
                  children: [
                    const TextSpan(text: 'Pregunta '),
                    TextSpan(
                      text: '${indice + 1}',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                    ),
                    TextSpan(text: ' de $total'),
                  ],
                ),
              ),
              _IndicadorGuardado(guardando: guardando, sinGuardar: sinGuardar),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: total > 0 ? respondidas / total : 0,
              minHeight: 5,
              backgroundColor: Colors.white12,
              color: AtenzaColores.secondary400,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Aviso de tiempo (5 minutos restantes) ───────────────────────────

class _AvisoTiempo extends StatefulWidget {
  const _AvisoTiempo({required this.pendientes, required this.onCerrar});

  final int pendientes;
  final VoidCallback onCerrar;

  @override
  State<_AvisoTiempo> createState() => _AvisoTiempoState();
}

class _AvisoTiempoState extends State<_AvisoTiempo> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(seconds: 10), widget.onCerrar);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: widget.onCerrar,
      child: Container(
        margin: const EdgeInsets.fromLTRB(18, 12, 18, 0),
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 14),
        decoration: BoxDecoration(
          color: AtenzaColores.accent500.withValues(alpha: 0.16),
          border: Border.all(color: AtenzaColores.accent600),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Quedan 5 minutos',
              style: TextStyle(color: AtenzaColores.accent400, fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 4),
            Text(
              widget.pendientes > 0
                  ? 'Tienes ${widget.pendientes} pregunta${widget.pendientes == 1 ? '' : 's'} en blanco. Al vencer el tiempo se envía automáticamente.'
                  : 'Al vencer el tiempo se envía automáticamente.',
              style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.35),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Aviso de incidente ───────────────────────────────────────────────

class _AvisoIncidente extends StatelessWidget {
  const _AvisoIncidente({required this.incidentes, required this.onCerrar});

  final int incidentes;
  final VoidCallback onCerrar;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 18,
      right: 18,
      bottom: 96,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onCerrar,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: AtenzaColores.primary900,
              border: Border.all(color: AtenzaColores.accent600),
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(color: Color(0x8C1C3354), offset: Offset(0, 10), blurRadius: 28),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(children: [
                  Icon(Icons.warning_amber_rounded, color: AtenzaColores.accent400, size: 16),
                  SizedBox(width: 8),
                  Text(
                    'Saliste del examen',
                    style: TextStyle(color: AtenzaColores.accent400, fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ]),
                const SizedBox(height: 4),
                Text(
                  'Quedó registrado y tu docente lo verá. Es la $incidentesª vez.',
                  style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.3),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Celda del mapa (hoja y repaso) ──────────────────────────────────

class _CeldaMapa extends StatelessWidget {
  const _CeldaMapa({
    required this.numero,
    required this.estado,
    required this.actual,
    required this.onTap,
    this.alto = 52,
  });

  final int numero;
  final _EstadoCelda estado;
  final bool actual;
  final VoidCallback onTap;
  final double alto;

  @override
  Widget build(BuildContext context) {
    final respondida = estado == _EstadoCelda.respondida;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: alto,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: respondida ? AtenzaColores.primary600 : AtenzaColores.accent500.withValues(alpha: 0.2),
          border: respondida ? null : Border.all(color: AtenzaColores.accent600),
          borderRadius: BorderRadius.circular(12),
          boxShadow: actual
              ? const [BoxShadow(color: AtenzaColores.secondary400, spreadRadius: 2, blurRadius: 0)]
              : null,
        ),
        child: Text(
          '$numero',
          style: TextStyle(
            color: respondida ? Colors.white : AtenzaColores.accent400,
            fontWeight: FontWeight.w700,
            fontSize: 16,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ),
    );
  }
}

// ── Hoja del mapa de preguntas (bottom sheet) ───────────────────────

class _HojaMapa extends StatelessWidget {
  const _HojaMapa({
    required this.preguntas,
    required this.respuestas,
    required this.indiceActual,
    required this.onIrAPregunta,
    required this.onRevisar,
  });

  final List<PreguntaParaRendir> preguntas;
  final Map<int, int?> respuestas;
  final int indiceActual;
  final void Function(int) onIrAPregunta;
  final VoidCallback onRevisar;

  @override
  Widget build(BuildContext context) {
    final total = preguntas.length;
    final respondidas = preguntas.where((p) => respuestas[p.id] != null).length;
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 20),
        decoration: const BoxDecoration(
          color: AtenzaColores.primary900,
          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(999)),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Tus preguntas',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17),
                ),
                Text(
                  '$respondidas respondidas · ${total - respondidas} en blanco',
                  style: const TextStyle(color: Colors.white60, fontSize: 14),
                ),
              ],
            ),
            const SizedBox(height: 15),
            GridView.count(
              crossAxisCount: 5,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 9,
              crossAxisSpacing: 9,
              childAspectRatio: 1,
              children: List.generate(preguntas.length, (i) {
                final p = preguntas[i];
                return _CeldaMapa(
                  numero: i + 1,
                  estado: _celdaEstado(p, respuestas),
                  actual: i == indiceActual,
                  onTap: () => onIrAPregunta(i),
                );
              }),
            ),
            const SizedBox(height: 15),
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: const BoxDecoration(color: AtenzaColores.primary600, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 6),
                  const Text('Respondida', style: TextStyle(color: Colors.white60, fontSize: 13)),
                ]),
                Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: AtenzaColores.accent500.withValues(alpha: 0.2),
                      border: Border.all(color: AtenzaColores.accent600),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Text('En blanco', style: TextStyle(color: Colors.white60, fontSize: 13)),
                ]),
                Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: const BoxDecoration(
                      color: AtenzaColores.primary600,
                      shape: BoxShape.circle,
                      boxShadow: [BoxShadow(color: AtenzaColores.secondary400, spreadRadius: 2, blurRadius: 0)],
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Text('Actual', style: TextStyle(color: Colors.white60, fontSize: 13)),
                ]),
              ],
            ),
            const SizedBox(height: 15),
            SizedBox(
              width: double.infinity,
              height: 54,
              child: FilledButton(
                onPressed: onRevisar,
                style: FilledButton.styleFrom(
                  backgroundColor: AtenzaColores.accent500,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
                ),
                child: const Text('Revisar y enviar', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Barra inferior ───────────────────────────────────────────────────

class _BarraInferior extends StatelessWidget {
  const _BarraInferior({
    required this.indice,
    required this.esUltima,
    required this.respondidas,
    required this.total,
    required this.estados,
    required this.onAnterior,
    required this.onSiguiente,
    required this.onIrARepaso,
    required this.onAbrirMapa,
  });

  final int indice;
  final bool esUltima;
  final int respondidas;
  final int total;
  final List<_EstadoCelda> estados;
  final VoidCallback onAnterior;
  final VoidCallback onSiguiente;
  final VoidCallback onIrARepaso;
  final VoidCallback onAbrirMapa;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        border: const Border(top: BorderSide(color: Colors.white10)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              if (indice > 0) ...[
                SizedBox(
                  width: 54,
                  height: 54,
                  child: OutlinedButton(
                    onPressed: onAnterior,
                    style: OutlinedButton.styleFrom(
                      padding: EdgeInsets.zero,
                      side: const BorderSide(color: Colors.white30),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
                    ),
                    child: const Icon(Icons.chevron_left, color: Colors.white, size: 24),
                  ),
                ),
                const SizedBox(width: 11),
              ],
              Expanded(
                child: SizedBox(
                  height: 54,
                  child: FilledButton(
                    onPressed: esUltima ? onIrARepaso : onSiguiente,
                    style: FilledButton.styleFrom(
                      backgroundColor: AtenzaColores.accent500,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
                    ),
                    child: Text(
                      esUltima ? 'Revisar y enviar' : 'Siguiente',
                      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 11),
          SizedBox(
            height: 44,
            width: double.infinity,
            child: OutlinedButton(
              onPressed: onAbrirMapa,
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.white24),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(11)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ...estados.take(4).map((e) => Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 1.5),
                        child: Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            color: e == _EstadoCelda.respondida ? AtenzaColores.primary600 : Colors.white24,
                            shape: BoxShape.circle,
                          ),
                        ),
                      )),
                  const SizedBox(width: 9),
                  Flexible(
                    child: Text(
                      '$respondidas de $total respondidas',
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w600),
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Text('ver todas', style: TextStyle(color: Colors.white38, fontSize: 13)),
                  const Icon(Icons.keyboard_arrow_up, color: Colors.white38, size: 15),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Pantalla de repaso ───────────────────────────────────────────────

class _PantallaRepaso extends StatelessWidget {
  const _PantallaRepaso({
    required this.intento,
    required this.respuestas,
    required this.restante,
    required this.sinGuardar,
    required this.enviando,
    required this.onVolver,
    required this.onIrAPregunta,
    required this.onEnviar,
  });

  final IntentoParaRendir intento;
  final Map<int, int?> respuestas;
  final Duration? restante;
  final Set<int> sinGuardar;
  final bool enviando;
  final VoidCallback onVolver;
  final void Function(int) onIrAPregunta;
  final VoidCallback onEnviar;

  @override
  Widget build(BuildContext context) {
    final total = intento.preguntas.length;
    final pendientes = intento.preguntas.where((p) => respuestas[p.id] == null).toList();
    final nPendientes = pendientes.length;
    final hayGuardado = sinGuardar.isEmpty;
    final bajoTiempo = restante != null && restante!.inSeconds < _cincoMinutosSeg;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              InkWell(
                onTap: onVolver,
                borderRadius: BorderRadius.circular(9),
                child: Container(
                  width: 44,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: Colors.white10, borderRadius: BorderRadius.circular(9)),
                  child: const Icon(Icons.chevron_left, color: Colors.white, size: 20),
                ),
              ),
              if (restante != null)
                Container(
                  height: 30,
                  padding: const EdgeInsets.symmetric(horizontal: 11),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: bajoTiempo ? AtenzaColores.peligro : Colors.white10,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _formatearRestante(restante!),
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Antes de enviar',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.2,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  nPendientes == 0
                      ? 'Respondiste las $total preguntas.'
                      : 'Te quedan $nPendientes pregunta${nPendientes == 1 ? '' : 's'} sin responder. Una vez enviado no podrás volver a abrirlo.',
                  style: const TextStyle(color: Colors.white70, fontSize: 16, height: 1.5),
                ),
                if (nPendientes > 0) ...[
                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.06),
                      border: Border.all(color: Colors.white12),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'TOCA PARA IR',
                          style: TextStyle(
                            color: Colors.white54,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1,
                          ),
                        ),
                        const SizedBox(height: 12),
                        GridView.count(
                          crossAxisCount: 4,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          childAspectRatio: 1,
                          children: pendientes.map((p) {
                            final i = intento.preguntas.indexWhere((q) => q.id == p.id);
                            return _CeldaMapa(
                              numero: i + 1,
                              estado: _EstadoCelda.blanco,
                              actual: false,
                              onTap: () => onIrAPregunta(i),
                              alto: 56,
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
                  decoration: BoxDecoration(
                    color: hayGuardado
                        ? AtenzaColores.secondary400.withValues(alpha: 0.12)
                        : AtenzaColores.peligro.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: hayGuardado ? AtenzaColores.secondary400 : Colors.redAccent,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          hayGuardado
                              ? 'Tus ${total - nPendientes} respuestas están guardadas'
                              : '${sinGuardar.length} respuestas no se han guardado — se reintentará al enviar',
                          style: TextStyle(
                            color: hayGuardado ? AtenzaColores.secondary400 : Colors.redAccent,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 16),
          child: Column(
            children: [
              SizedBox(
                width: double.infinity,
                height: 54,
                child: FilledButton(
                  onPressed: enviando ? null : onEnviar,
                  style: FilledButton.styleFrom(
                    backgroundColor: AtenzaColores.accent500,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
                  ),
                  child: Text(
                    enviando ? 'Enviando…' : (nPendientes == 0 ? 'Enviar examen' : 'Enviar de todas formas'),
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: OutlinedButton(
                  onPressed: enviando ? null : onVolver,
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.white30),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
                  ),
                  child: const Text(
                    'Seguir respondiendo',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Pregunta + opciones ─────────────────────────────────────────────

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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          pregunta.pregunta,
          style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w600, height: 1.4),
        ),
        if (pregunta.urlImagen != null) ...[
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 180),
              child: Image.network(_urlImagenCompleta(pregunta.urlImagen!), fit: BoxFit.contain, width: double.infinity),
            ),
          ),
        ],
        const SizedBox(height: 16),
        ...pregunta.opciones.asMap().entries.map((entrada) {
          final letra = String.fromCharCode(65 + entrada.key); // A, B, C, D
          final opcion = entrada.value;
          final elegida = seleccionada == opcion.id;
          return Padding(
            padding: const EdgeInsets.only(bottom: 11),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => onElegir(opcion.id),
              child: Container(
                constraints: const BoxConstraints(minHeight: 62),
                padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
                decoration: BoxDecoration(
                  color: elegida ? AtenzaColores.primary600 : Colors.white.withValues(alpha: 0.09),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: elegida ? AtenzaColores.primary400 : Colors.white.withValues(alpha: 0.28),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: elegida ? Colors.white : Colors.white.withValues(alpha: 0.15),
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
                    const SizedBox(width: 13),
                    Expanded(
                      child: Text(
                        opcion.texto,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          height: 1.35,
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
