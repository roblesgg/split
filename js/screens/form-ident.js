/* ============================================================
   split — la identidad de una ficha: cara, nombre y color

   Lo comparten la categoría, el apartado y el límite, que son las tres
   cosas de la app que tienen emoji, nombre y color.

   Antes esto eran cuatro campos apilados: una vista previa que no se
   podía tocar, y debajo «Nombre», «Emoji» y «Color», cada uno con su
   etiqueta y su rejilla siempre abierta. Media hoja de formulario para
   decidir tres cosas, y había que bajar hasta el final para ver el
   botón de guardar.

   Ahora la vista previa ES el editor: tocas la cara y salen todos los
   emojis, tocas el color y salen todos los colores, y el nombre se
   escribe donde se ve. Solo se abre una cosa a la vez, así que la hoja
   no crece por los dos lados.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, $ = A.$, esc = A.esc, ui = A.ui;
  var EMOJI_SUGERIDOS = A.EMOJI_SUGERIDOS;

  /* Cuál de los dos cajones está abierto vive en ui.form.abierto:
     null, "emoji" o "color". */

  function identHtml(d, opciones) {
    var o = opciones || {};
    var abierto = ui.form.abierto || null;
    var colores = [];
    for (var i = 1; i <= S.CAT_COLORS; i++) colores.push(i);

    return '' +
      '<div class="ident">' +
        '<button type="button" class="ident__cara cat-face" id="fPreview" ' +
                'data-ident="emoji" aria-expanded="' + (abierto === "emoji") + '" ' +
                'style="--cat-color:var(--cat-' + d.color + ')" ' +
                'aria-label="Cambiar el emoji">' + esc(d.emoji) + '</button>' +

        /* El nombre es el campo, no una etiqueta encima de otro campo:
           se toca donde se lee. */
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

      (abierto === "emoji"
        ? '<div class="ident__cajon">' +
            '<input type="text" class="field__input ident__libre" id="fEmoji" ' +
                   'data-f="Emoji" maxlength="8" autocomplete="off" ' +
                   'aria-label="Otro emoji" placeholder="O escribe el que quieras" ' +
                   'value="' + esc(d.emoji) + '">' +
            '<div class="emoji-grid">' +
              EMOJI_SUGERIDOS.map(function (e) {
                return '<button type="button" class="emoji-pick" data-pemoji="' + esc(e) + '" ' +
                         'aria-pressed="' + (e === d.emoji) + '">' + esc(e) + '</button>';
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

  /* Al teclear o tocar un color se repinta solo lo que cambia: repintar
     la hoja entera dejaría el campo sin foco a media palabra. */
  function refreshIdent() {
    var d = ui.form && ui.form.d;
    if (!d) return;
    var cara = $("#fPreview");
    if (cara) {
      cara.textContent = d.emoji || "📦";
      cara.style.setProperty("--cat-color", "var(--cat-" + d.color + ")");
    }
    var punto = $("#fPreviewColor");
    if (punto) punto.style.background = "var(--cat-" + d.color + ")";
  }

  /* --- lo que usan otros archivos --- */
  A.identHtml = identHtml;
  A.refreshIdent = refreshIdent;
})();
