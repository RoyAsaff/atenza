// E7 · Ejecución en vivo — espejo de backend/src/domain/entidades/intento.ts

enum EstadoIntento { enCurso, pausado, finalizado, desconectado, cancelado }

EstadoIntento estadoIntentoDesde(String valor) => switch (valor) {
      'en_curso' => EstadoIntento.enCurso,
      'pausado' => EstadoIntento.pausado,
      'finalizado' => EstadoIntento.finalizado,
      'desconectado' => EstadoIntento.desconectado,
      'cancelado' => EstadoIntento.cancelado,
      _ => EstadoIntento.finalizado,
    };

class OpcionParaRendir {
  final int id;
  final String texto;

  const OpcionParaRendir({required this.id, required this.texto});

  factory OpcionParaRendir.fromJson(Map<String, dynamic> json) => OpcionParaRendir(
        id: json['id'] as int,
        texto: json['texto'] as String,
      );
}

class PreguntaParaRendir {
  final int id;
  final String pregunta;
  final String? urlImagen;
  final List<OpcionParaRendir> opciones;
  final int? opcionElegidaId;

  const PreguntaParaRendir({
    required this.id,
    required this.pregunta,
    required this.urlImagen,
    required this.opciones,
    required this.opcionElegidaId,
  });

  factory PreguntaParaRendir.fromJson(Map<String, dynamic> json) => PreguntaParaRendir(
        id: json['id'] as int,
        pregunta: json['pregunta'] as String,
        urlImagen: json['url_imagen'] as String?,
        opciones: (json['opciones'] as List<dynamic>)
            .map((o) => OpcionParaRendir.fromJson(o as Map<String, dynamic>))
            .toList(),
        opcionElegidaId: json['opcion_elegida_id'] as int?,
      );
}

class IntentoParaRendir {
  final int intentoId;
  final int evaluacionId;
  final String tema;
  final int nota;
  final EstadoIntento estado;
  final DateTime? fechaLimite;
  final List<PreguntaParaRendir> preguntas;

  const IntentoParaRendir({
    required this.intentoId,
    required this.evaluacionId,
    required this.tema,
    required this.nota,
    required this.estado,
    required this.fechaLimite,
    required this.preguntas,
  });

  factory IntentoParaRendir.fromJson(Map<String, dynamic> json) => IntentoParaRendir(
        intentoId: json['intento_id'] as int,
        evaluacionId: json['evaluacion_id'] as int,
        tema: json['tema'] as String,
        nota: json['nota'] as int,
        estado: estadoIntentoDesde(json['estado'] as String),
        fechaLimite: json['fecha_limite'] == null
            ? null
            : DateTime.parse(json['fecha_limite'] as String),
        preguntas: (json['preguntas'] as List<dynamic>)
            .map((p) => PreguntaParaRendir.fromJson(p as Map<String, dynamic>))
            .toList(),
      );
}
