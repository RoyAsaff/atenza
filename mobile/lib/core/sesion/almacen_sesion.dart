// D-03: el modo estudiante mantiene sesión persistente — se guarda en
// disco y sobrevive a cerrar la app (a diferencia de la web docente).

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../features/auth/domain/entidades/sesion.dart';

class AlmacenSesion {
  static const _clave = 'sesion_estudiante';

  Future<SesionActiva?> leer() async {
    final prefs = await SharedPreferences.getInstance();
    final crudo = prefs.getString(_clave);
    if (crudo == null) return null;

    final sesion =
        SesionActiva.fromJson(jsonDecode(crudo) as Map<String, dynamic>);
    if (sesion.expiraEn.isBefore(DateTime.now())) {
      await borrar();
      return null;
    }
    return sesion;
  }

  Future<void> guardar(SesionActiva sesion) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_clave, jsonEncode(sesion.toJson()));
  }

  Future<void> borrar() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_clave);
  }
}
