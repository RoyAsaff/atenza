// Guías de pre-clase (fusión con ATENZA, 05/08). La guía en sí sigue
// siendo el HTML autocontenido de PaginaGuias — acá solo vive el link de
// acceso (con el token ya incluido) y si el estudiante ya la completó
// (formativo, sin nota).

class Guia {
  final int id;
  final String tema;
  final int orden;
  final String urlAcceso;
  final bool completado;
  final int claseId;
  final String claseTema;
  final DateTime claseFecha;

  const Guia({
    required this.id,
    required this.tema,
    required this.orden,
    required this.urlAcceso,
    required this.completado,
    required this.claseId,
    required this.claseTema,
    required this.claseFecha,
  });

  factory Guia.fromJson(Map<String, dynamic> json) => Guia(
        id: json['id'] as int,
        tema: json['tema'] as String,
        orden: json['orden'] as int,
        urlAcceso: json['url_acceso'] as String,
        completado: json['completado'] as bool,
        claseId: json['clase_id'] as int,
        claseTema: json['clase_tema'] as String,
        claseFecha: DateTime.parse(json['clase_fecha'] as String),
      );
}
