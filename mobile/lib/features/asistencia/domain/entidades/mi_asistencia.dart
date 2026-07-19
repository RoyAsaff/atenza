// Diagrama E5 (actor Estudiante): Ver Asistencias — historial propio

enum Marcaje { puntual, atrasado, licencia, falta }

Marcaje marcajeDesde(String valor) =>
    Marcaje.values.firstWhere((m) => m.name == valor);

class MiAsistencia {
  final int claseId;
  final DateTime fecha; // solo fecha (viaja como medianoche UTC)
  final String hora; // "HH:MM"
  final String tema;
  final Marcaje marcaje;

  const MiAsistencia({
    required this.claseId,
    required this.fecha,
    required this.hora,
    required this.tema,
    required this.marcaje,
  });

  factory MiAsistencia.fromJson(Map<String, dynamic> json) => MiAsistencia(
        claseId: json['clase_id'] as int,
        fecha: DateTime.parse(json['fecha'] as String),
        hora: json['hora'] as String,
        tema: json['tema'] as String,
        marcaje: marcajeDesde(json['marcaje'] as String),
      );
}
