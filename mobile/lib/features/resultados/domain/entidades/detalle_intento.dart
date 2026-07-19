// E8 (HU-25/26 detalle) · "Ver examen": el estudiante revisa cómo
// respondió una evaluación ya finalizada y publicada, pregunta por
// pregunta, con la opción correcta visible.

class OpcionDetalle {
  final int id;
  final String texto;
  final bool esCorrecta;

  const OpcionDetalle({
    required this.id,
    required this.texto,
    required this.esCorrecta,
  });

  factory OpcionDetalle.fromJson(Map<String, dynamic> json) => OpcionDetalle(
        id: json['id'] as int,
        texto: json['texto'] as String,
        esCorrecta: json['es_correcta'] as bool,
      );
}

class PreguntaDetalleIntento {
  final int id;
  final String pregunta;
  final String? urlImagen;
  final int orden;
  final List<OpcionDetalle> opciones;
  final int? opcionElegidaId;
  final bool acerto;

  const PreguntaDetalleIntento({
    required this.id,
    required this.pregunta,
    required this.urlImagen,
    required this.orden,
    required this.opciones,
    required this.opcionElegidaId,
    required this.acerto,
  });

  factory PreguntaDetalleIntento.fromJson(Map<String, dynamic> json) =>
      PreguntaDetalleIntento(
        id: json['id'] as int,
        pregunta: json['pregunta'] as String,
        urlImagen: json['url_imagen'] as String?,
        orden: json['orden'] as int,
        opciones: (json['opciones'] as List<dynamic>)
            .map((e) => OpcionDetalle.fromJson(e as Map<String, dynamic>))
            .toList(),
        opcionElegidaId: json['opcion_elegida_id'] as int?,
        acerto: json['acerto'] as bool,
      );
}

class DetalleIntento {
  final int intentoId;
  final int evaluacionId;
  final int estudianteId;
  final List<PreguntaDetalleIntento> preguntas;

  const DetalleIntento({
    required this.intentoId,
    required this.evaluacionId,
    required this.estudianteId,
    required this.preguntas,
  });

  factory DetalleIntento.fromJson(Map<String, dynamic> json) => DetalleIntento(
        intentoId: json['intento_id'] as int,
        evaluacionId: json['evaluacion_id'] as int,
        estudianteId: json['estudiante_id'] as int,
        preguntas: (json['preguntas'] as List<dynamic>)
            .map((e) => PreguntaDetalleIntento.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
