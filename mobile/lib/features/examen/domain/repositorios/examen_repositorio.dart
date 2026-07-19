import '../entidades/intento.dart';

abstract class ExamenRepositorio {
  /// HU-21 Esc. 1 y 4: abrir o reanudar el examen vigente (o null si no hay ninguno).
  Future<IntentoParaRendir?> obtenerIntentoActual();

  /// HU-21 Esc. 3 (D-06): se guarda de inmediato, pregunta a pregunta.
  Future<void> guardarRespuesta(int intentoId, int preguntaId, int opcionId);

  /// HU-21 Esc. 2: salida de pantalla (multitarea, home, apagado de pantalla).
  Future<void> reportarIncidente(int intentoId, {String? detalle});

  Future<void> finalizar(int intentoId);
}
