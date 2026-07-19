// ATENZA — app de estudiantes
// Composición de dependencias (espejo de backend/presentation/dependencias.ts)

import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'core/api/api_cliente.dart';
import 'core/sesion/almacen_sesion.dart';
import 'core/theme/colores.dart';
import 'features/asistencia/data/asistencia_repositorio_api.dart';
import 'features/asistencia/domain/repositorios/asistencia_repositorio.dart';
import 'features/auth/data/auth_repositorio_api.dart';
import 'features/auth/presentation/auth_controller.dart';
import 'features/auth/presentation/login_page.dart';
import 'features/clases/data/clases_repositorio_api.dart';
import 'features/clases/domain/repositorios/clases_repositorio.dart';
import 'features/examen/data/examen_repositorio_api.dart';
import 'features/examen/data/examen_socket_service.dart';
import 'features/examen/domain/repositorios/examen_repositorio.dart';
import 'features/examen/presentation/examen_controller.dart';
import 'features/examen/presentation/examen_page.dart';
import 'features/materias/data/materias_repositorio_api.dart';
import 'features/materias/presentation/materias_controller.dart';
import 'features/materias/presentation/mis_materias_page.dart';
import 'features/resultados/data/resultados_repositorio_api.dart';
import 'features/resultados/domain/repositorios/resultados_repositorio.dart';

/// Navigator raíz de la app: se usa para volver al inicio del stack de
/// navegación cuando se lanza un examen (ver `_alCambiarExamen` más abajo),
/// ya que MisMateriasPage y sus pantallas hijas empujan rutas propias.
final navegadorClave = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('es_ES'); // meses/días en español (calendario de clases)

  final almacen = AlmacenSesion();
  late final AuthController auth;

  final api = ApiCliente(obtenerToken: () => auth.token);
  auth = AuthController(AuthRepositorioApi(api), almacen);
  api.alExpirarSesion = auth.sesionExpirada;

  final materias = MateriasController(MateriasRepositorioApi(api));

  // E7: examen en vivo — repo REST + socket de push (lanzar/pausar/
  // reactivar/cancelar) compuestos en un único controller.
  final examenRepositorio = ExamenRepositorioApi(api);
  final examen = ExamenController(examenRepositorio, ExamenSocketService());

  auth.restaurarSesion(); // HU-01 Esc. 4: sesión persistente

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: auth),
        ChangeNotifierProvider.value(value: materias),
        ChangeNotifierProvider.value(value: examen),
        Provider<ClasesRepositorio>.value(value: ClasesRepositorioApi(api)),
        Provider<AsistenciaRepositorio>.value(
          value: AsistenciaRepositorioApi(api),
        ),
        Provider<ResultadosRepositorio>.value(
          value: ResultadosRepositorioApi(api),
        ),
        Provider<ExamenRepositorio>.value(value: examenRepositorio),
      ],
      child: const AtenzaApp(),
    ),
  );
}

class AtenzaApp extends StatelessWidget {
  const AtenzaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navegadorClave,
      title: 'ATENZA',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: AtenzaColores.primary700,
          brightness: Brightness.light,
          primary: AtenzaColores.primary800,
          secondary: AtenzaColores.secondary800,
          tertiary: AtenzaColores.accent600,
          surface: AtenzaColores.surface,
          error: AtenzaColores.peligro,
        ),
        scaffoldBackgroundColor: AtenzaColores.canvas,
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          centerTitle: false,
          elevation: 0,
          scrolledUnderElevation: 0,
          backgroundColor: AtenzaColores.canvas,
          foregroundColor: AtenzaColores.texto,
          titleTextStyle: TextStyle(
            color: AtenzaColores.texto,
            fontSize: 20,
            fontWeight: FontWeight.w800,
          ),
        ),
        cardTheme: CardThemeData(
          color: AtenzaColores.surface,
          elevation: 0,
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: AtenzaColores.borde),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AtenzaColores.surfaceHover,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: AtenzaColores.borde),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: AtenzaColores.borde),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: AtenzaColores.focus, width: 1.4),
          ),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: AtenzaColores.primary800,
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(52),
            textStyle:
                const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
        ),
        snackBarTheme: SnackBarThemeData(
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      home: const _Raiz(),
    );
  }
}

/// Mientras haya un examen lanzado/en curso (ExamenController.intento no
/// nulo), esta pantalla reemplaza a toda la app en modo kiosco (HU-21
/// Esc. 1), sin importar dónde estuviera navegando el estudiante.
class _Raiz extends StatefulWidget {
  const _Raiz();

  @override
  State<_Raiz> createState() => _RaizState();
}

class _RaizState extends State<_Raiz> {
  late final AuthController _auth;
  late final ExamenController _examen;

  @override
  void initState() {
    super.initState();
    _auth = context.read<AuthController>();
    _examen = context.read<ExamenController>();
    _auth.addListener(_sincronizarExamen);
    _examen.addListener(_alCambiarExamen);
    _sincronizarExamen();
  }

  void _sincronizarExamen() {
    final token = _auth.token;
    if (_auth.estado == EstadoAuth.autenticado && token != null) {
      _examen.conectar(token);
    } else if (_auth.estado == EstadoAuth.sinSesion) {
      _examen.desconectar();
    }
  }

  void _alCambiarExamen() {
    // Si el estudiante estaba navegando dentro de MisMateriasPage (rutas
    // empujadas sobre la raíz), esas pantallas quedarían tapando el swap a
    // ExamenPage. Volvemos al inicio del stack para que sea visible sin
    // importar en qué vista estuviera (HU-21 Esc. 1).
    if (_examen.intento != null) {
      navegadorClave.currentState?.popUntil((route) => route.isFirst);
    }
  }

  @override
  void dispose() {
    _auth.removeListener(_sincronizarExamen);
    _examen.removeListener(_alCambiarExamen);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final examen = context.watch<ExamenController>();

    if (auth.estado == EstadoAuth.cargando) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (auth.estado == EstadoAuth.sinSesion) {
      return const LoginPage();
    }
    if (examen.intento != null) {
      return const ExamenPage();
    }
    return const MisMateriasPage();
  }
}
