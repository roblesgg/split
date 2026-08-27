/* ============================================================
   split — hoja: el formulario de un límite

   Un límite es un tope con nombre. Aquí se contestan dos cosas, en el
   orden en que se piensan: cuánto, y sobre qué.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, esc = A.esc, ui = A.ui;
  var EMOJI_SUGERIDOS = A.EMOJI_SUGERIDOS;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function money() { return A.money.apply(null, arguments); }
  function numField() { return A.numField.apply(null, arguments); }
  function periodo() { return A.periodo.apply(null, arguments); }

  function chips(attr, opciones, valor) {
    return '<div class="chips">' + opciones.map(function (o) {
      return '<button type="button" class="chip" data-' + attr + '="' + esc(o[0]) + '" ' +
               'aria-pressed="' + (String(valor) === String(o[0])) + '">' +
               esc(o[1]) + '</button>';
    }).join("") + '</div>';
  }

  /* Cómo va a quedar, dicho con las palabras del usuario y no con las
     del modelo de datos. Es lo que evita tener que probarlo para
     entenderlo. */
  function resumen(d) {
    var n = (d.categoryIds || []).length;
    var sobre = d.ambito === "solo"
      ? (n ? (n === 1 ? "de esa categoría" : "de esas " + n + " categorías")
           : "…pero no has marcado ninguna categoría, así que no contará nada")
      : d.ambito === "salvo"
      ? (n ? "en todo menos en " + (n === 1 ? "esa categoría" : "esas " + n + " categorías")
           : "en todo")
      : "en todo";

    var importe = parseFloat(d.importe);
    if (!(importe > 0)) return "Pon cuánto puedes gastar.";
    return "Vas a poder gastar " + money(importe) + " " + sobre +
           " cada " + periodo() + ".";
  }

  /* La rejilla de categorías, con las madres y sus hijas dentro. Marcar
     una madre trae a todas sus hijas, así que las hijas se pintan como
     ya marcadas cuando lo está la madre: si no, parecería que se te ha
     colado una por detrás. */
  function rejillaCategorias(d) {
    var elegidas = d.categoryIds || [];
    var puesta = function (c) {
      if (elegidas.indexOf(c.id) >= 0) return true;
      return !!(c.parentId && elegidas.indexOf(c.parentId) >= 0);
    };
    return '<div class="cat-grid">' +
      S.categoriesOf("out").filter(function (c) { return !c.sistema; })
        .map(function (c) {
          var porLaMadre = c.parentId && elegidas.indexOf(c.parentId) >= 0 &&
                           elegidas.indexOf(c.id) < 0;
          return '<button type="button" class="cat-pick" data-pcat="' + esc(c.id) + '" ' +
                   'aria-pressed="' + puesta(c) + '" ' +
                   (porLaMadre ? 'disabled ' : "") +
                   'aria-label="' + esc(S.nombreLargo(c.id) || c.name) + '">' +
              '<span class="cat-pick__icon cat-face" ' +
                    'style="--cat-color:var(--cat-' + c.color + ')">' +
                esc(c.emoji) + '</span>' +
              '<span class="cat-pick__name">' + esc(c.name) + '</span>' +
            '</button>';
        }).join("") +
    '</div>';
  }

  /* Devuelve el formulario de un límite, o cadena vacía si no es uno. */
  function htmlLimite(t, d) {
    if (t !== "limite") return "";

    var colores = [];
    for (var i = 1; i <= S.CAT_COLORS; i++) colores.push(i);

    return '' +
      '<div class="field">' +
        '<span class="field__label">Así se verá</span>' +
        '<div class="cat-preview">' +
          '<span class="cat-preview__face cat-face" id="fPreview" ' +
                'style="--cat-color:var(--cat-' + d.color + ')" aria-hidden="true">' +
            esc(d.emoji) + '</span>' +
          '<span class="cat-preview__name" id="fPreviewName">' +
            esc(d.name || "Sin nombre") + '</span>' +
        '</div>' +
        '<p class="field__hint">Un límite no bloquea nada: avisa. Si te pasas, ' +
          'el gasto se apunta igual — apuntarlo en otro sitio para que cuadre ' +
          'sería mentirte a ti mismo.</p>' +
      '</div>' +

      '<div class="field">' +
        '<label class="field__label" for="fName">Nombre</label>' +
        '<input type="text" class="field__input" id="fName" data-f="Name" maxlength="24" ' +
               'placeholder="Gasolina" value="' + esc(d.name) + '">' +
      '</div>' +

      '<div class="field">' +
        numField("fImporte", "Cuánto puedes gastar al " + periodo(), d.importe, 10) +
      '</div>' +

      '<div class="field">' +
        '<span class="field__label">A qué gastos afecta</span>' +
        chips("flamb", [["todas", "A todos"], ["solo", "Solo a estos"],
                        ["salvo", "A todos menos estos"]], d.ambito) +
      '</div>' +

      (d.ambito === "todas"
        ? ""
        : '<div class="field">' +
            '<span class="field__label">' +
              (d.ambito === "solo" ? "Los que cuentan" : "Los que NO cuentan") + '</span>' +
            rejillaCategorias(d) +
            '<p class="field__hint">Marcar una categoría marca también sus ' +
              'subcategorías: excluir Suscripciones excluye a todas las de dentro.</p>' +
          '</div>') +

      '<div class="field">' +
        '<p class="field__hint" id="fLimResumen">' + esc(resumen(d)) + '</p>' +
      '</div>' +

      '<div class="field">' +
        '<label class="field__label" for="fEmoji">Emoji</label>' +
        '<input type="text" class="field__input" id="fEmoji" data-f="Emoji" ' +
               'maxlength="8" autocomplete="off" value="' + esc(d.emoji) + '">' +
        '<div class="emoji-grid">' +
          EMOJI_SUGERIDOS.map(function (e) {
            return '<button type="button" class="emoji-pick" data-pemoji="' + esc(e) + '" ' +
                     'aria-pressed="' + (e === d.emoji) + '">' + esc(e) + '</button>';
          }).join("") +
        '</div>' +
      '</div>' +

      '<div class="field">' +
        '<span class="field__label">Color</span>' +
        '<div class="swatch-grid">' +
          colores.map(function (n) {
            return '<button type="button" class="swatch" data-pcolor="' + n + '" ' +
                     'style="background:var(--cat-' + n + ')" ' +
                     'aria-pressed="' + (n === d.color) + '" ' +
                     'aria-label="Color ' + n + '"></button>';
          }).join("") +
        '</div>' +
      '</div>';
  }

  /* --- lo que usan otros archivos --- */
  A.htmlLimite = htmlLimite;
  A.resumenLimite = resumen;
})();
