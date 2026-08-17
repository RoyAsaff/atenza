# Snippet para páginas de guía nativa

Este bloque reemplaza al script "ATENZA · guía completada" que ya tenés en
tus páginas (el que solo llamaba a `/completar`). Pegalo en su lugar. No
toca tu motor de quiz existente (`data-quiz-id`, `marcarResuelto`,
`actualizarProgreso`) — solo agrega los reportes en vivo y la pantalla
completa.

**Requisito:** cada `data-quiz-id` que quieras que cuente para la nota
tiene que estar cargado como `GuiaPregunta` en Atenza (al crear/editar la
guía) con la MISMA referencia. Las preguntas `quiz-open` (textarea + "ver
respuesta modelo") no se autocalifican — se reportan como pendientes y las
revisás vos en Atenza.

```html
<script>
(function () {
  var ATENZA_API = 'https://api-atenza.atenzabo.com';

  var params = new URLSearchParams(location.search);
  var token = params.get('atenza_token');
  var guiaIntentoId = params.get('guia_intento');
  if (!token || !guiaIntentoId) return; // acceso público normal, sin Atenza

  function post(path, body) {
    return fetch(ATENZA_API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {}),
    }).catch(function () {});
  }

  // ── Pantalla completa: se pide en un click real del usuario, no solo.
  var pantallaBtn = document.createElement('button');
  pantallaBtn.textContent = 'Comenzar en pantalla completa';
  pantallaBtn.className = 'atenza-comenzar-btn'; // dale tu propio estilo
  document.body.prepend(pantallaBtn);

  var comenzado = false;
  pantallaBtn.addEventListener('click', function () {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () {});
    }
    comenzado = true;
    pantallaBtn.remove();
  });

  // ── Reportar cada pregunta contestada — engancha al motor que ya tenés.
  // Llamá a estas dos funciones desde donde ya marcás una pregunta como
  // resuelta (junto a marcarResuelto(id, "ok"/"error") en tu código).
  window.atenzaReportarAutomatica = function (referencia, correcta) {
    post('/api/guias/intentos/' + guiaIntentoId + '/respuesta', { referencia: referencia, correcta: correcta });
  };
  window.atenzaReportarAbierta = function (referencia, textoLibre) {
    post('/api/guias/intentos/' + guiaIntentoId + '/respuesta', { referencia: referencia, texto_libre: textoLibre });
  };

  // ── Incidencias: salir de pantalla completa, cambiar de pestaña, perder foco.
  function reportarIncidente(detalle) {
    post('/api/guias/intentos/' + guiaIntentoId + '/incidente', { detalle: detalle });
  }
  document.addEventListener('visibilitychange', function () {
    if (comenzado && document.hidden) reportarIncidente('visibilitychange');
  });
  document.addEventListener('fullscreenchange', function () {
    if (comenzado && !document.fullscreenElement) reportarIncidente('salida_pantalla_completa');
  });
  window.addEventListener('blur', function () {
    if (comenzado) reportarIncidente('blur');
  });
  window.addEventListener('beforeunload', function (e) {
    if (comenzado) { e.preventDefault(); e.returnValue = ''; }
  });

  // ── Finalizar: llamalo cuando el estudiante termina el 100% del
  // cuestionario (mismo lugar donde antes llamabas al /completar viejo).
  window.atenzaFinalizarGuia = function () {
    post('/api/guias/intentos/' + guiaIntentoId + '/finalizar', {});
  };
})();
</script>
```

## Qué tenés que enganchar vos

En tu motor de quiz actual (`marcarResuelto` o donde corrijas cada
pregunta), agregá una línea:

```js
// quiz-mc / quiz-match / quiz-classify (se autocorrigen):
window.atenzaReportarAutomatica && window.atenzaReportarAutomatica(id, esCorrecta);

// quiz-open (textarea + "ver respuesta modelo"):
window.atenzaReportarAbierta && window.atenzaReportarAbierta(id, textarea.value);
```

Y al completar el 100% (donde antes llamabas al `/completar` viejo):

```js
window.atenzaFinalizarGuia && window.atenzaFinalizarGuia();
```

## Notas

- El token (`atenza_token` + `guia_intento`) llega en la URL cuando el
  estudiante entra desde "Tomar la guía" en Atenza — acceso directo sin
  esos parámetros sigue funcionando como una guía pública normal, sin
  reportar nada (mismo comportamiento de siempre).
- No hace falta tocar nada del `/completar` viejo para guías
  `externa_legacy` — este snippet es solo para guías nuevas, creadas con
  nota y manifest de preguntas en Atenza.
