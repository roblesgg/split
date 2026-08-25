/* ============================================================
   split — hoja: elegir de una lista
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var U = A.U, $ = A.$, $$ = A.$$, esc = A.esc, ui = A.ui, sheets = A.sheets;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function aplicarPick() { return A.aplicarPick.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function opcionesDe() { return A.opcionesDe.apply(null, arguments); }

  /* ============================================================
     Elegir de una lista

     Los <select> abren el menú del sistema: una lista gris, con su propia
     tipografía y sus propias esquinas, que no se parece a nada de lo que
     hay alrededor. En una pantalla cuidada canta más que cualquier otra
     cosa.

     Esto es lo mismo pero en una hoja de la app: cada opción una fila
     tocable, con su emoji o su color si lo tiene, y la elegida marcada.
     De paso se toca mejor con el pulgar que una lista de sistema.
     ============================================================ */

  /* Quién está esperando una elección vive en ui.pickPendiente. */

  /* opciones: [{ value, label, sub, emoji, color }] */
  function pick(titulo, opciones, valor) {
    return new Promise(function (resolver) {
      ui.pickPendiente = { resolver: resolver };

      $("#sheetPickTitle").textContent = titulo;
      $("#sheetPickBody").innerHTML = opciones.map(function (o) {
        var elegida = String(o.value) === String(valor);
        return '<button type="button" class="pick" data-pick="' + esc(o.value) + '" ' +
                 'aria-pressed="' + elegida + '">' +
            (o.emoji
              ? '<span class="pick__cara cat-face"' +
                  (o.color ? ' style="--cat-color:var(--cat-' + o.color + ')"' : '') +
                  '>' + esc(o.emoji) + '</span>'
              : o.color
                ? '<span class="pick__punto" style="background:var(--cat-' +
                    o.color + ')"></span>'
                : '') +
            '<span class="pick__texto">' +
              '<span class="pick__nombre">' + esc(o.label) + '</span>' +
              (o.sub ? '<span class="pick__sub">' + esc(o.sub) + '</span>' : "") +
              /* algunas opciones se ven mejor que se explican */
              (o.muestra
                ? '<span class="emoji-muestra" data-set="' + esc(o.muestra) + '">' +
                    "🍽️🏠☕🚗💰" + '</span>'
                : "") +
            '</span>' +
            (elegida
              ? '<span class="pick__tick" data-icon="check" data-icon-size="16"></span>'
              : '') +
          '</button>';
      }).join("");

      mountIcons($("#sheetPickBody"));
      sheets.pick.show();
    });
  }

  function abrirPick(id, valorActual) {
    var cfg = opcionesDe(id);
    if (!cfg) return;
    pick(cfg.titulo, cfg.lista, valorActual).then(function (v) {
      if (v == null) return;
      aplicarPick(id, v);
    });
  }

  /* Un campo que parece un desplegable pero abre la hoja de arriba. */
  function pickField(id, valor, texto) {
    return '<button type="button" class="field__input field__select" ' +
             'id="' + id + '" data-pick-open="' + esc(id) + '" ' +
             'data-value="' + esc(valor) + '">' +
        '<span class="field__select-txt">' + esc(texto) + '</span>' +
        '<span class="field__select-chev" data-icon="chevDown" data-icon-size="15"></span>' +
      '</button>';
  }

  /* ============================================================
     Cableado
     ============================================================ */

  function wire() {
    /* Los desplegables propios salen en las vistas y también dentro de
       varias hojas, así que se escuchan una sola vez en el documento en
       vez de repetir el mismo enganche en cada sitio. */
    document.addEventListener("click", function (e) {
      var node = e.target.closest("[data-pick-open]");
      if (!node) return;
      abrirPick(node.getAttribute("data-pick-open"), node.getAttribute("data-value"));
    });
    /* Cerrar sin elegir resuelve a null: quien la abrió deja las cosas
       como estaban en vez de quedarse esperando para siempre. */
    sheets.pick.onClose = function () {
      if (!ui.pickPendiente) return;
      var r = ui.pickPendiente.resolver;
      ui.pickPendiente = null;
      r(null);
    };

    $("#sheetPickBody").addEventListener("click", function (e) {
      var node = e.target.closest("[data-pick]");
      if (!node || !ui.pickPendiente) return;
      var r = ui.pickPendiente.resolver;
      ui.pickPendiente = null;
      sheets.pick.close();
      U.haptic("light");
      r(node.getAttribute("data-pick"));
    });
  }


  /* --- lo que usan otros archivos --- */
  A.pick = pick;
  A.pickField = pickField;

  A.wire(wire);
})();
