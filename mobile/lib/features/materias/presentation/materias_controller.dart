import 'package:flutter/foundation.dart';

import '../domain/entidades/materia_inscrita.dart';
import '../domain/repositorios/materias_repositorio.dart';

class MateriasController extends ChangeNotifier {
  final MateriasRepositorio _materias;

  bool cargando = false;
  String? error;
  List<MateriaInscrita> inscritas = const [];

  MateriasController(this._materias);

  Future<void> cargar() async {
    cargando = true;
    error = null;
    notifyListeners();
    try {
      inscritas = await _materias.misMateriasInscritas();
    } catch (e) {
      error = e.toString();
    } finally {
      cargando = false;
      notifyListeners();
    }
  }

  /// Devuelve el nombre de la materia a la que se unió (HU-10 Esc. 1).
  Future<String> unirse({
    required String codigoMateria,
    required String codigoEstudiante,
  }) async {
    final nombre = await _materias.unirse(
      codigoMateria: codigoMateria,
      codigoEstudiante: codigoEstudiante,
    );
    await cargar();
    return nombre;
  }

  /// Deslindar Materia: salirse por cuenta propia (conserva historial).
  Future<void> deslindarse(int inscripcionId) async {
    await _materias.deslindarse(inscripcionId);
    await cargar();
  }
}
