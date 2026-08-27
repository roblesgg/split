/* ============================================================
   split — hoja: el formulario de un límite

   Un límite es un tope con nombre. Lo que hay que contestar aquí son
   tres cosas y en este orden, que es el orden en que se piensan:
   cuánto, sobre qué, y cada cuánto se vacía.
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

  var DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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
           : "…pero no has elegido ninguna categoría, así que no contará nada")
      : d.ambito === "salvo"
      ? (n ? "en todo menos en " + (n === 1 ? "esa categoría" : "esas " + n + " categorías")
           : "en todo")
      : "en todo";

    var cuando = d.reinicio === "semana" ? "Se vacía cada " + DIAS_CORTOS[d.reinicioDia].toLowerCase()
               : d.reinicio === "mes" ? "Se vacía el día " + d.reinicioDia + " de cada mes"
               : "Se vacía con el mes de la app";

    var importe = parseFloat(d.importe);
    if (!(importe > 0)) return cuando + ".";
    return "Vas a poder gastar " + money(importe) + " " + sobre + ". " + cuando + ".";
  }

  /* Devuelve el formulario de un límite, o cadena vacía si no es uno. */
  function htmlLimite(t, d) {
    if (t !== "limite") return "";

    var colores = [];
    for (var i = 1; i <= S.CAT_COLORS; i++) colores.push(i);
    var cuenta = S.state.accounts.find(function (x) { return x.id === d.accountId; });
    var elegidas = d.categoryIds || [];
    var dias = [];
    for (var j = 1; j <= S.CICLO_DIA_MAX; j++) dias.push([j, String(j)]);

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
        '<p class="field__hint">En <strong>' +
          esc(cuenta ? cuenta.name : "tu cuenta") + '</strong>. Un límite no ' +
          'bloquea nada: avisa. Si te pasas, el gasto se apunta igual — ' +
          'apuntarlo en otro sitio para que cuadre sería mentirte a ti mismo.</p>' +
      '</div>' +

      '<div class="field">' +
        '<label class="field__label" for="fName">Nombre</label>' +
        '<input type="text" class="field__input" id="fName" data-f="Name" maxlength="24" ' +
               'placeholder="Gasto del mes" value="' + esc(d.name) + '">' +
      '</div>' +

      '<div class="field">' +
        numField("fImporte", "Cuánto puedes gastar", d.importe, 10) +
      '</div>' +

      '<div class="field">' +
        '<span class="field__label">A qué gastos afecta</span>' +
        chips("flamb", [["todas", "A todos"], ["solo", "Solo a estas"],
                        ["salvo", "A todos menos estas"]], d.ambito) +
      '</div>' +

      (d.ambito === "todas"
        ? ""
        : '<div class="field">' +
            '<span class="field__label">' +
              (d.ambito === "solo" ? "Las que cuentan" : "Las que NO cuentan") + '</span>' +
            '<div class="cat-grid">' +
              S.categoriesOf("out").filter(function (c) { return !c.sistema; })
                .map(function (c) {
                  return '<button type="button" class="cat-pick" data-pcat="' + esc(c.id) + '" ' +
                           'aria-pressed="' + (elegidas.indexOf(c.id) >= 0) + '" ' +
                           'aria-label="' + esc(c.name) + '">' +
                      '<span class="cat-pick__icon cat-face" ' +
                            'style="--cat-color:var(--cat-' + c.color + ')">' +
                        esc(c.emoji) + '</span>' +
                      '<span class="cat-pick__name">' + esc(c.name) + '</span>' +
                    '</button>';
                }).join("") +
            '</div>' +
          '</div>') +

      '<div class="field">' +
        '<span class="field__label">Cuándo se vacía</span>' +
        chips("flrei", [["ciclo", "Con el mes de la app"], ["mes", "Un día del mes"],
                        ["semana", "Cada semana"]], d.reinicio) +
        (d.reinicio === "mes"
          ? '<div style="margin-top:var(--sp-4)">' + chips("flreidia", dias, d.reinicioDia) +
            '<p class="field__hint">Hasta el ' + S.CICLO_DIA_MAX + ', para que se vacíe ' +
              'el mismo día también en febrero.</p></div>'
          : d.reinicio === "semana"
          ? '<div style="margin-top:var(--sp-4)">' +
              chips("flreidia", DIAS_CORTOS.map(function (n, k) { return [k, n]; }),
                    d.reinicioDia) + '</div>'
          : '<p class="field__hint">Se vacía el mismo día que todo lo demás que ' +
            'cuenta la app. Es lo normal: así todas las cifras hablan del mismo ' +
            'periodo.</p>') +
      '</div>' +

      /* Se repinta solo esta línea al marcar categorías o cambiar el día:
         repintar la hoja entera movería la rejilla bajo el dedo. */
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
