// Sesión de estudiante devuelta por POST /api/auth/login (HU-01, D-03)

import 'usuario.dart';

class SesionActiva {
  final String token;
  final DateTime expiraEn;
  final Usuario usuario;

  const SesionActiva({
    required this.token,
    required this.expiraEn,
    required this.usuario,
  });

  factory SesionActiva.fromJson(Map<String, dynamic> json) => SesionActiva(
        token: json['token'] as String,
        expiraEn: DateTime.parse(json['expira_en'] as String),
        usuario: Usuario.fromJson(json['usuario'] as Map<String, dynamic>),
      );

  Map<String, dynamic> toJson() => {
        'token': token,
        'expira_en': expiraEn.toIso8601String(),
        'usuario': usuario.toJson(),
      };
}
