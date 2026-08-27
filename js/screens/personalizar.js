/* ============================================================
   split — hoja: añadir un bloque al panel

   Colocar y quitar se hace en el propio panel, arrastrando: es donde se
   ven. Lo que no cabe ahí es elegir entre los que NO están puestos, que
   por definición no se ven, y para eso está esta hoja.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, $ = A.$, esc = A.esc, icon = A.icon, ui = A.ui, sheets = A.sheets;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function bloqueDefinicion() { return A.bloqueDefinicion.apply(null, arguments); }
  function bloquesDisponibles() { return A.bloquesDisponibles.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function renderInicio() { return A.renderInicio.apply(null, arguments); }

  /* De qué panel se está hablando vive en ui.panelEditando. */

  function render() {
    var accId = ui.panelEditando;
    var puestos = S.panelDe(accId);
    var quedan = bloquesDisponibles(accId).filter(function (id) {
      return puestos.indexOf(id) < 0;
    });
    var cuenta = accId
      ? S.state.accounts.find(function (a) { return a.id === accId; })
      : null;

    $("#sheetPanelTitle").textContent = "Añadir un bloque";

    $("#sheetPanelBody").innerHTML =
      '<p class="card__sub">A ' +
        (cuenta ? '<strong>' + esc(cuenta.name) + '</strong>' : '<strong>Todo tu dinero</strong>') +
        '. Cada cuenta tiene los suyos.</p>' +

      (quedan.length
        ? '<div class="pbloques" style="margin-top:var(--sp-5)">' +
            quedan.map(function (id) {
              var b = bloqueDefinicion(id);
              return '<button type="button" class="pbloque pbloque--add" ' +
                       'data-poner="' + esc(id) + '">' +
                  '<span class="pbloque__texto">' +
                    '<span class="pbloque__nombre">' + esc(b.nombre) + '</span>' +
                    '<span class="pbloque__sub">' + esc(b.sub) + '</span>' +
                  '</span>' +
                  '<span class="pbloque__mas" data-icon="plus" data-icon-size="16"></span>' +
                '</button>';
            }).join("") +
          '</div>'
        : '<p class="field__hint" style="margin-top:var(--sp-5)">Ya los tienes ' +
          'todos puestos. Para quitar alguno, la equis de su asa.</p>') +

      /* Solo se ofrece cuando significa algo: si nunca lo has tocado, un
         «volver a como estaba» no hace nada y encima da que pensar. */
      (S.panelTocado(accId)
        ? '<div class="field" style="margin-top:var(--sp-6)">' +
            '<button type="button" class="btn btn--ghost" id="panelReset" style="width:100%">' +
              icon("repeat", 16) + 'Volver a como estaba</button>' +
          '</div>'
        : "");

    mountIcons($("#sheetPanelBody"));
  }

  function abrir(accId) {
    ui.panelEditando = accId || null;
    /* Se llega desde el modo colocar y se vuelve a él: cerrar la hoja no
       puede dejarte fuera de lo que estabas haciendo. */
    ui.panelOrdenando = true;
    render();
    sheets.panel.show();
  }

  /* ============================================================
     Cableado
     ============================================================ */

  function wire() {
    var body = $("#sheetPanelBody");

    body.addEventListener("click", function (e) {
      var accId = ui.panelEditando;
      var node;

      if ((node = e.target.closest("[data-poner]"))) {
        S.ponerBloque(accId, node.getAttribute("data-poner"));
      } else if (e.target.closest("#panelReset")) {
        S.resetPanel(accId);
      } else {
        return;
      }

      render();
      /* El Resumen de debajo se repinta a la vez: se está eligiendo qué
         ver, y verlo mientras se elige es la mitad de la gracia. */
      renderInicio();
      U.haptic("light");
    });
  }

  /* --- lo que usan otros archivos --- */
  A.abrirPanel = abrir;

  A.wire(wire);
})();
