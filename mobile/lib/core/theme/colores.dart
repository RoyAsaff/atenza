import 'package:flutter/material.dart';

/// Paleta de marca de Atenza — espejo de web/src/core/ui/tokens.css.
/// Cualquier cambio de marca debe replicarse en ambos lugares.
class AtenzaColores {
  AtenzaColores._();

  // ── Primary (navy) ──
  static const primary50 = Color(0xFFF2F5FA);
  static const primary100 = Color(0xFFE5ECF5);
  static const primary200 = Color(0xFFCBD9EC);
  static const primary300 = Color(0xFFACC2E2);
  static const primary400 = Color(0xFF85A7D6);
  static const primary500 = Color(0xFF5C8BCC);
  static const primary600 = Color(0xFF366DBA);
  static const primary700 = Color(0xFF2D5A9A);
  static const primary800 = Color(0xFF254674);
  static const primary900 = Color(0xFF1C3354);

  // ── Secondary (teal) ──
  static const secondary50 = Color(0xFFF1FAFB);
  static const secondary100 = Color(0xFFE3F5F7);
  static const secondary200 = Color(0xFFC7ECF0);
  static const secondary300 = Color(0xFFA4E3EA);
  static const secondary400 = Color(0xFF76DAE5);
  static const secondary500 = Color(0xFF45D3E3);
  static const secondary600 = Color(0xFF18C5D8);
  static const secondary700 = Color(0xFF14A3B3);
  static const secondary800 = Color(0xFF0F7E8A);
  static const secondary900 = Color(0xFF0C5B64);

  // ── Accent (naranja, uso escaso) ──
  static const accent50 = Color(0xFFFEF4EE);
  static const accent100 = Color(0xFFFDE9DE);
  static const accent200 = Color(0xFFF9D3BD);
  static const accent300 = Color(0xFFF5BA98);
  static const accent400 = Color(0xFFEF9C6C);
  static const accent500 = Color(0xFFE67E41);
  static const accent600 = Color(0xFFCC6124);
  static const accent700 = Color(0xFFA15326);
  static const accent800 = Color(0xFF774122);
  static const accent900 = Color(0xFF54311C);

  // ── Neutral (gris azulado) ──
  static const neutral50 = Color(0xFFF3F7F9);
  static const neutral100 = Color(0xFFE8EEF3);
  static const neutral200 = Color(0xFFD2DDE5);
  static const neutral300 = Color(0xFFBBC9D3);
  static const neutral400 = Color(0xFF9FB0BC);
  static const neutral500 = Color(0xFF8497A4);
  static const neutral600 = Color(0xFF677B89);
  static const neutral700 = Color(0xFF556672);
  static const neutral800 = Color(0xFF404F59);
  static const neutral900 = Color(0xFF2E3A42);

  // ── Semánticos (mismos alias que en web/tokens.css) ──
  static const canvas = neutral50;
  static const surface = Color(0xFFFFFFFF);
  static const surfaceHover = neutral50;
  static const surfaceSunken = neutral100;
  static const borde = neutral200;
  static const bordeHover = neutral300;
  static const texto = neutral900;
  static const textoSecundario = neutral700;
  static const textoMuted = neutral600;
  static const textoDisabled = neutral400;
  static const focus = primary500;

  // ── Estados (mismo mapeo de tono que Badge/Alert en web) ──
  static const exito = secondary800; // success
  static const advertencia = accent700; // warning
  static const peligro = Color(0xFFDC2626); // danger — red-600, igual que web
}
