// Entidad Clase (E4) — espejo del backend

class Clase {
  final int id;
  final DateTime fecha; // solo fecha (viaja como medianoche UTC)
  final String hora; // "HH:MM"
  final String tema;
  final int materiaId;

  const Clase({
    required this.id,
    required this.fecha,
    required this.hora,
    required this.tema,
    required this.materiaId,
  });

  factory Clase.fromJson(Map<String, dynamic> json) => Clase(
        id: json['id'] as int,
        fecha: DateTime.parse(json['fecha'] as String),
        hora: json['hora'] as String,
        tema: json['tema'] as String,
        materiaId: json['materia_id'] as int,
      );

  /// Compara solo la parte de fecha contra hoy (en UTC, como viaja).
  bool get esPasada {
    final ahora = DateTime.now();
    final hoy = DateTime.utc(ahora.year, ahora.month, ahora.day);
    return fecha.isBefore(hoy);
  }
}
