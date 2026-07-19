// Entidad Usuario (espejo del backend, sin password)

class Usuario {
  final int id;
  final String nombres;
  final String apellidos;
  final String email;
  final String? whatsapp;
  final bool emailVerificado;

  const Usuario({
    required this.id,
    required this.nombres,
    required this.apellidos,
    required this.email,
    this.whatsapp,
    required this.emailVerificado,
  });

  String get nombreCompleto => '$nombres $apellidos';

  factory Usuario.fromJson(Map<String, dynamic> json) => Usuario(
        id: json['id'] as int,
        nombres: json['nombres'] as String,
        apellidos: json['apellidos'] as String,
        email: json['email'] as String,
        whatsapp: json['whatsapp'] as String?,
        emailVerificado: (json['email_verificado'] as bool?) ?? false,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'nombres': nombres,
        'apellidos': apellidos,
        'email': email,
        'whatsapp': whatsapp,
        'email_verificado': emailVerificado,
      };
}
