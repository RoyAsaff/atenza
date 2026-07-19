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
