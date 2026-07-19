// E8 · HU-26 Esc. 1/2: el estudiante ve su nota solo si el docente ya
// publicó esa evaluación.

class MiNota {
  final int evaluacionId;
  final String tema;
  final int notaTotal;
  final int aciertos;
  final int totalPreguntas;
  final double notaObtenida;
  final DateTime fechaPublicacion;

  const MiNota({
    required this.evaluacionId,
    required this.tema,
    required this.notaTotal,
    required this.aciertos,
    required this.totalPreguntas,
    required this.notaObtenida,
    required this.fechaPublicacion,
  });

  factory MiNota.fromJson(Map<String, dynamic> json) => MiNota(
        evaluacionId: json['evaluacion_id'] as int,
        tema: json['tema'] as String,
        notaTotal: json['nota_total'] as int,
        aciertos: json['aciertos'] as int,
        totalPreguntas: json['total_preguntas'] as int,
        notaObtenida: (json['nota_obtenida'] as num).toDouble(),
        fechaPublicacion: DateTime.parse(json['fecha_publicacion'] as String),
      );
}
