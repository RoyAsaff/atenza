// Errores de dominio: cada uno lleva el código HTTP que le corresponde
// para que la capa de presentación los traduzca sin lógica extra.

export class ErrorDeDominio extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class EmailYaRegistradoError extends ErrorDeDominio {
  constructor() {
    super(409, 'EMAIL_YA_REGISTRADO', 'El correo ya está registrado');
  }
}

export class CredencialesInvalidasError extends ErrorDeDominio {
  constructor() {
    super(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos');
  }
}

export class CuentaDesactivadaError extends ErrorDeDominio {
  constructor() {
    super(403, 'CUENTA_DESACTIVADA', 'La cuenta está desactivada');
  }
}

export class NoAutorizadoError extends ErrorDeDominio {
  constructor(mensaje = 'No autorizado') {
    super(401, 'NO_AUTORIZADO', mensaje);
  }
}

export class TokenInvalidoError extends ErrorDeDominio {
  constructor() {
    super(400, 'TOKEN_INVALIDO', 'El enlace no es válido, ya fue usado o expiró');
  }
}

export class ProhibidoError extends ErrorDeDominio {
  constructor(mensaje = 'No tienes permiso para esta operación') {
    super(403, 'PROHIBIDO', mensaje);
  }
}

export class NoEncontradoError extends ErrorDeDominio {
  constructor(entidad = 'Recurso') {
    super(404, 'NO_ENCONTRADO', `${entidad} no encontrado`);
  }
}

export class EstadoInvalidoError extends ErrorDeDominio {
  constructor(mensaje: string) {
    super(409, 'ESTADO_INVALIDO', mensaje);
  }
}

// ── E3 · Inscripciones ───────────────────────────────────────────

/** HU-10 Esc. 3: código inexistente, regenerado, desactivado o materia inactiva. */
export class CodigoMateriaInvalidoError extends ErrorDeDominio {
  constructor() {
    super(404, 'CODIGO_MATERIA_INVALIDO', 'El código de materia no es válido');
  }
}

/** HU-10 Esc. 2: no se duplica la inscripción y se informa. */
export class YaInscritoError extends ErrorDeDominio {
  constructor() {
    super(409, 'YA_INSCRITO', 'Ya estás inscrito en esta materia');
  }
}

// ── SaaS por cuenta (17/07) ──────────────────────────────────────

/** El plan del docente ya alcanzó su tope de estudiantes activos. */
export class LimiteEstudiantesExcedidoError extends ErrorDeDominio {
  constructor() {
    super(
      403,
      'LIMITE_ESTUDIANTES_EXCEDIDO',
      'El docente alcanzó el límite de estudiantes de su plan actual',
    );
  }
}

/** La cuenta del docente está vencida (fuera de prueba/plan pagado): modo solo lectura. */
export class CuentaVencidaError extends ErrorDeDominio {
  constructor() {
    super(
      403,
      'CUENTA_VENCIDA',
      'La cuenta del docente está vencida. Debe renovar su plan para seguir creando o editando contenido',
    );
  }
}

// ── Rediseño SaaS (17/08): Gratis permanente + Pro único + Promociones ──

/** El plan del docente (Gratis: 1 materia) ya alcanzó su tope de materias. */
export class LimiteMateriasExcedidoError extends ErrorDeDominio {
  constructor() {
    super(403, 'LIMITE_MATERIAS_EXCEDIDO', 'El plan actual alcanzó el límite de materias');
  }
}

/** La función (importar Word / Guías) requiere un plan superior al actual. */
export class FeatureNoDisponibleError extends ErrorDeDominio {
  constructor(mensaje = 'Tu plan actual no incluye esta función') {
    super(403, 'FEATURE_NO_DISPONIBLE', mensaje);
  }
}

/** Código de promoción inexistente, vencido, agotado o no aplicable al ciclo elegido. */
export class PromocionInvalidaError extends ErrorDeDominio {
  constructor(mensaje: string) {
    super(400, 'PROMOCION_INVALIDA', mensaje);
  }
}
