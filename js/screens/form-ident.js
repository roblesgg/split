/* ============================================================
   split — la identidad de una ficha: icono SVG, nombre y color

   Categoría, apartado y límite. Cara = icono vectorial integrado,
   no emoji.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, ui = A.ui, mountIcons = A.mountIcons;

  /* Cuál cajón está abierto: null, "icon" o "color". */

  function caraSvg(d, size) {
    return '<span class="cat-face cat-face--svg" aria-hidden="true" ' +
           'style="--cat-color:var(--cat-' + d.color + ')" ' +
           'data-icon="' + esc(S.catIcon(d)) + '" data-icon-size="' + (size || 22) + '"></span>';
  }

  function identHtml(d, opciones) {
    var o = opciones || {};
    var abierto = ui.form.abierto || null;
    var colores = [];
    for (var i = 1; i <= S.CAT_COLORS; i++) colores.push(i);
    var iconos = S.ICONOS_CAT || [];

    if (o.heredadoDe) {
      return '' +
        '<div class="ident ident--heredada">' +
          caraSvg(d, 26) +
          '<input type="text" class="ident__nombre" id="fName" data-f="Name" ' +
                 'maxlength="' + (o.max || 24) + '" ' +
                 'placeholder="' + esc(o.placeholder || "Sin nombre") + '" ' +
                 'aria-label="Nombre" value="' + esc(d.name) + '">' +
        '</div>' +
        '<p class="field__hint">Lleva el icono y el color de <strong>' +
          esc(o.heredadoDe) + '</strong>.</p>';
    }

    return '' +
      '<div class="ident">' +
        '<button type="button" class="ident__cara cat-face cat-face--svg" id="fPreview" ' +
                'data-ident="icon" aria-expanded="' + (abierto === "icon") + '" ' +
                'style="--cat-color:var(--cat-' + d.color + ')" ' +
                'aria-label="Cambiar el icono" data-icon="' + esc(S.catIcon(d)) + '" ' +
                'data-icon-size="22"></button>' +

        '<input type="text" class="ident__nombre" id="fName" data-f="Name" ' +
               'maxlength="' + (o.max || 24) + '" ' +
               'placeholder="' + esc(o.placeholder || "Sin nombre") + '" ' +
               'aria-label="Nombre" value="' + esc(d.name) + '">' +

        '<button type="button" class="ident__color" data-ident="color" ' +
                'aria-expanded="' + (abierto === "color") + '" ' +
                'aria-label="Cambiar el color">' +
          '<span class="ident__punto" id="fPreviewColor" ' +
                'style="background:var(--cat-' + d.color + ')"></span>' +
        '</button>' +
      '</div>' +

      (abierto === "icon"
        ? '<div class="ident__cajon">' +
            '<div class="icon-grid">' +
              iconos.map(function (ic) {
                return '<button type="button" class="icon-pick" data-picon="' + esc(ic) + '" ' +
                         'aria-pressed="' + (ic === S.catIcon(d)) + '" aria-label="' + esc(ic) + '">' +
                    '<span data-icon="' + esc(ic) + '" data-icon-size="20"></span>' +
                  '</button>';
              }).join("") +
            '</div>' +
          '</div>'
        : "") +

      (abierto === "color"
        ? '<div class="ident__cajon">' +
            '<div class="swatch-grid">' +
              colores.map(function (n) {
                return '<button type="button" class="swatch" data-pcolor="' + n + '" ' +
                         'style="background:var(--cat-' + n + ')" ' +
                         'aria-pressed="' + (n === d.color) + '" ' +
                         'aria-label="Color ' + n + '"></button>';
              }).join("") +
            '</div>' +
          '</div>'
        : "") +

      (o.hint ? '<p class="field__hint">' + o.hint + '</p>' : "");
  }

  function refreshIdent() {
    var d = ui.form && ui.form.d;
    if (!d) return;
    var cara = $("#fPreview");
    if (cara) {
      cara.setAttribute("data-icon", S.catIcon(d));
      cara.removeAttribute("data-icon-done");
      cara.innerHTML = icon(S.catIcon(d), 22);
      cara.setAttribute("data-icon-done", "1");
      cara.style.setProperty("--cat-color", "var(--cat-" + d.color + ")");
    }
    var punto = $("#fPreviewColor");
    if (punto) punto.style.background = "var(--cat-" + d.color + ")";
  }

  A.identHtml = identHtml;
  A.refreshIdent = refreshIdent;
})();
