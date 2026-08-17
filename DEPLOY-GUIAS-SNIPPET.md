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

**⚠️ Requisito crítico si tu progreso vive en `localStorage` por página**
(como el motor de quizzes de estas guías): ese progreso está pensado para
"completaste esto alguna vez en tu vida en este navegador", no sabe nada
de "intentos" de Atenza. Si no lo limpiás al entrar a un lanzamiento
nuevo, cualquier resto de una práctica libre anterior o de un intento
previo (oficial o repaso) ya deja casi todo marcado como resuelto — con
eso, contestar la PRIMERA pregunta nueva alcanza para que tu propio
código crea que ya se terminó todo, dispara `/finalizar` de una, y el
backend cierra el intento antes de que el estudiante siga contestando
(bug real, 17/08: la nota le quedó calculada con una sola respuesta,
todo lo demás rechazado en silencio porque el intento ya estaba
cerrado). Antes de leer/escribir tu progreso, comparar contra qué
`guia_intento` pertenece lo que ya está guardado, y si cambió, limpiarlo:

```js
var claveIntentoActual = TU_PREFIJO_DE_PROGRESO + '_atenza_intento_actual';
if (localStorage.getItem(claveIntentoActual) !== guiaIntentoId) {
  // limpiá acá las claves de progreso de esta página (las tuyas, no las de Atenza)
  localStorage.setItem(claveIntentoActual, guiaIntentoId);
}
```

```html
<script>
(function () {
  var ATENZA_API = 'https://api-atenza.atenzabo.com';

  var params = new URLSearchParams(location.search);
  var token = params.get('atenza_token');
  var guiaIntentoId = params.get('guia_intento');
  if (!token || !guiaIntentoId) return; // acceso público normal, sin Atenza

  // NO swallowees el error acá — el aviso de abajo necesita saber si
  // /finalizar realmente llegó, si no la nota queda mal calculada sin que
  // nadie se entere (bug real, visto en producción el 17/08: una guía sin
  // este script nunca reportó nada, el docente tuvo que cancelar el
  // lanzamiento a mano y a todos les quedó nota 0). Los call-sites de
  // respuesta/incidente sí lo swallowean (fire-and-forget), solo
  // /finalizar necesita reaccionar al resultado.
  function post(path, body) {
    return fetch(ATENZA_API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {}),
    });
  }

  // ── Aviso flotante — la única señal visible de "ya terminaste, podés
  // cerrar la pestaña" o "no se pudo enviar, tocá para reintentar". Sin
  // esto el estudiante llega al 100% local (su barra de progreso de
  // siempre) y no tiene ninguna pista de que además hay que esperar a que
  // se confirme del lado de ATENZA.
  function avisar(texto, ok, onClick) {
    var aviso = document.createElement('div');
    aviso.textContent = texto;
    aviso.style.cssText =
      'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:960;' +
      'padding:12px 22px; border-radius:10px; font-size:14px; font-weight:600; color:#fff;' +
      'box-shadow:0 5px 15px rgba(0,0,0,.25); max-width:90vw; text-align:center; cursor:' +
      (onClick ? 'pointer' : 'default') + ';' +
      'background:' + (ok ? '#78b159' : '#c0392b') + ';'; // ajustá los colores a tu paleta
    if (onClick) aviso.addEventListener('click', function () { aviso.remove(); onClick(); });
    document.body.appendChild(aviso);
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
  // resuelta (junto a marcarResuelto(id, "ok"/"error") en tu código). Si
  // ya tenés un único choke-point tipo marcarResuelto(id, estado), es más
  // seguro engancharte ahí una sola vez (ver ejemplo en "Qué tenés que
  // enganchar vos" más abajo) que acordarte de llamar esto en cada
  // call-site del motor.
  window.atenzaReportarAutomatica = function (referencia, correcta) {
    post('/api/guias/intentos/' + guiaIntentoId + '/respuesta', { referencia: referencia, correcta: correcta }).catch(function () {});
  };
  window.atenzaReportarAbierta = function (referencia, textoLibre) {
    post('/api/guias/intentos/' + guiaIntentoId + '/respuesta', { referencia: referencia, texto_libre: textoLibre }).catch(function () {});
  };

  // ── Incidencias: salir de pantalla completa, cambiar de pestaña, perder foco.
  function reportarIncidente(detalle) {
    post('/api/guias/intentos/' + guiaIntentoId + '/incidente', { detalle: detalle }).catch(function () {});
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

  // ── Finalizar: llamalo cuando el estudiante TERMINÓ DE CONTESTAR el
  // cuestionario (mismo lugar donde antes llamabas al /completar viejo).
  // ⚠️ "Terminó de contestar" NO es lo mismo que "contestó todo bien" —
  // si tu criterio de "100%" cuenta solo las correctas, un estudiante que
  // se equivoca en una sola pregunta de un solo intento nunca llega al
  // 100% y esto no se llama nunca (bug real, 17/08: la guía se quedaba
  // "en curso" para siempre, el docente tenía que cancelar el
  // lanzamiento a mano). Contá preguntas RESPONDIDAS (acertadas o no),
  // no preguntas acertadas.
  // A diferencia de las otras dos, esta SÍ le muestra algo al estudiante
  // y reintenta si falla — es la única señal de que la guía quedó
  // registrada de verdad, no la des por sentada.
  var finalizando = false;
  window.atenzaFinalizarGuia = function () {
    if (finalizando) return;
    finalizando = true;
    post('/api/guias/intentos/' + guiaIntentoId + '/finalizar', {})
      .then(function (res) {
        if (res.ok) {
          avisar('✅ ¡Guía enviada! Ya podés cerrar esta pestaña.', true);
        } else {
          finalizando = false;
          avisar('⚠️ No se pudo enviar tu guía — tocá para reintentar.', false, window.atenzaFinalizarGuia);
        }
      })
      .catch(function () {
        finalizando = false;
        avisar('⚠️ No se pudo enviar tu guía — tocá para reintentar.', false, window.atenzaFinalizarGuia);
      });
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
- **Este snippet es obligatorio en la página, no algo que Atenza aplica
  sola.** Vincular una guía nueva en Atenza (con nota + manifest) no hace
  nada del lado de la página externa — si no pegaste este bloque ahí, el
  lanzamiento igual se crea y el estudiante igual puede "Tomar la guía",
  pero nada de lo que conteste se reporta y termina con nota 0. Antes de
  lanzar una guía nueva en clase, confirmar que su página ya tiene el
  bloque (bug real, 17/08: se lanzó `joins-subconsultas.html` sin haberlo
  pegado nunca ahí — el docente tuvo que cancelar el lanzamiento a mano
  porque nunca llegó el `/finalizar`, y a todos les quedó nota 0/20
  aunque habían contestado todo bien).
