/* ============================================================
   split — hoja: personalizar un panel

   Qué bloques enseña el Resumen de esta cuenta y en qué orden. Arriba
   los que están puestos, con sus flechas para moverlos; abajo los que
   quedan por poner.

   Se mueve con flechas y no arrastrando: un arrastre dentro de una lista
   que ya se desplaza es de las cosas que peor van en un móvil, y además
   así se puede usar sin ver. Cada flecha es un botón de los grandes.
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

  function fila(id, i, total) {
    var b = bloqueDefinicion(id);
    if (!b) return "";
    return '<div class="pbloque">' +
        '<span class="pbloque__texto">' +
          '<span class="pbloque__nombre">' + esc(b.nombre) + '</span>' +
          '<span class="pbloque__sub">' + esc(b.sub) + '</span>' +
        '</span>' +
        '<span class="pbloque__flechas">' +
          '<button type="button" class="icon-btn" data-subir="' + esc(id) + '" ' +
                  (i === 0 ? 'disabled ' : "") +
                  'aria-label="Subir ' + esc(b.nombre) + '" ' +
                  'data-icon="chevUp" data-icon-size="15"></button>' +
          '<button type="button" class="icon-btn" data-bajar="' + esc(id) + '" ' +
                  (i === total - 1 ? 'disabled ' : "") +
                  'aria-label="Bajar ' + esc(b.nombre) + '" ' +
                  'data-icon="chevDown" data-icon-size="15"></button>' +
        '</span>' +
        '<button type="button" class="icon-btn pbloque__quitar" data-quitar="' + esc(id) + '" ' +
                'aria-label="Quitar ' + esc(b.nombre) + '" ' +
                'data-icon="close" data-icon-size="14"></button>' +
      '</div>';
  }

  function render() {
    var accId = ui.panelEditando;
    var puestos = S.panelDe(accId);
    var todos = bloquesDisponibles(accId);
    var quedan = todos.filter(function (id) { return puestos.indexOf(id) < 0; });
    var cuenta = accId
      ? S.state.accounts.find(function (a) { return a.id === accId; })
      : null;

    $("#sheetPanelTitle").textContent = cuenta ? cuenta.name : "Todo tu dinero";

    $("#sheetPanelBody").innerHTML =
      '<p class="card__sub">Estos son los bloques que ves al deslizar hasta ' +
        (cuenta ? '<strong>' + esc(cuenta.name) + '</strong>' : '<strong>Todo tu dinero</strong>') +
        '. Cada cuenta tiene los suyos.</p>' +

      '<div class="field" style="margin-top:var(--sp-5)">' +
        '<span class="field__label">Los que se ven</span>' +
        (puestos.length
          ? '<div class="pbloques">' +
              puestos.map(function (id, i) { return fila(id, i, puestos.length); }).join("") +
            '</div>'
          : '<p class="field__hint">Ninguno. El panel se queda con la tarjeta y ' +
            'poco más — elige abajo lo que quieras ver.</p>') +
      '</div>' +

      (quedan.length
        ? '<div class="field" style="margin-top:var(--sp-5)">' +
            '<span class="field__label">Por añadir</span>' +
            '<div class="pbloques">' +
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
            '</div>' +
          '</div>'
        : "") +

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
      } else if ((node = e.target.closest("[data-quitar]"))) {
        S.quitarBloque(accId, node.getAttribute("data-quitar"));
      } else if ((node = e.target.closest("[data-subir]"))) {
        S.moverBloque(accId, node.getAttribute("data-subir"), -1);
      } else if ((node = e.target.closest("[data-bajar]"))) {
        S.moverBloque(accId, node.getAttribute("data-bajar"), 1);
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
