/* ============================================================
   split — hoja: el formulario de un apartado

   Los dos formularios que van con los apartados: el del apartado en sí y
   el de mover dinero entre él y su cuenta. Salen del archivo de al lado
   porque allí ya no cabían, no porque sean otra cosa.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, $ = A.$, esc = A.esc, ui = A.ui;
  var EMOJI_SUGERIDOS = A.EMOJI_SUGERIDOS;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function bigAmount() { return A.bigAmount.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function numField() { return A.numField.apply(null, arguments); }
  function periodo() { return A.periodo.apply(null, arguments); }

  /* Devuelve el formulario de un apartado o el de apartar y devolver.
     Cadena vacía si no es ninguno de los dos. */
  function htmlApartado(t, d) {
    var html = "";

      if (t === "aportar") {
        var estAp = S.estadoDeApartado(d.apartadoId);
        var sacar = d.dir === "sacar";
        html =
          '<div class="hero-center">' +
            '<p class="hero-center__label">Ahora hay en ' + esc(d.name) + '</p>' +
            '<p class="hero-center__value">' + bigAmount(estAp ? estAp.saldo : 0) + '</p>' +
          '</div>' +

          '<div class="segmented" id="fSeg" role="tablist">' +
            '<span class="segmented__thumb" id="fThumb" aria-hidden="true"></span>' +
            '<button type="button" class="segmented__btn" role="tab" data-fdir="meter" ' +
                    'aria-selected="' + (!sacar) + '">Apartar más</button>' +
            '<button type="button" class="segmented__btn" role="tab" data-fdir="sacar" ' +
                    'aria-selected="' + sacar + '">Devolver</button>' +
          '</div>' +

          '<div class="field" style="margin-top:var(--sp-5)">' +
            numField("fImporte", sacar ? "Cuánto devuelves" : "Cuánto apartas",
                     d.importe, 10) +
            '<p class="field__hint">' +
              (sacar
                ? 'Vuelve a estar disponible en la cuenta. El saldo total no cambia: ' +
                  'nunca salió de ahí.'
                : 'Se reserva dentro de la cuenta. El saldo total no cambia: el dinero ' +
                  'no se mueve de sitio.') +
            '</p>' +
          '</div>';
      }

      if (t === "apartado") {
        var coloresAp = [];
        for (var ai = 1; ai <= S.CAT_COLORS; ai++) coloresAp.push(ai);
        var cuentaAp = S.state.accounts.find(function (x) { return x.id === d.accountId; });
        var elegidas = d.categoryIds || [];

        html =
          '<div class="field">' +
            '<span class="field__label">Así se verá</span>' +
            '<div class="cat-preview">' +
              '<span class="cat-preview__face cat-face" id="fPreview" ' +
                    'style="--cat-color:var(--cat-' + d.color + ')" aria-hidden="true">' +
                esc(d.emoji) + '</span>' +
              '<span class="cat-preview__name" id="fPreviewName">' +
                esc(d.name || "Sin nombre") + '</span>' +
            '</div>' +
            '<p class="field__hint">Dentro de <strong>' +
              esc(cuentaAp ? cuentaAp.name : "tu cuenta") + '</strong>. ' +
              'Apartar no mueve el dinero de sitio: lo reserva, y el saldo de ' +
              'la cuenta sigue siendo el mismo.</p>' +
          '</div>' +

          '<div class="field">' +
            '<label class="field__label" for="fName">Nombre</label>' +
            '<input type="text" class="field__input" id="fName" data-f="Name" maxlength="24" ' +
                   'placeholder="Gasolina" value="' + esc(d.name) + '">' +
          '</div>' +

          '<div class="field__row">' +
            numField("fPorCiclo", "Apartas cada " + periodo(), d.porCiclo, 10) +
            (ui.form.id
              ? '<div></div>'
              : numField("fInicial", "Metes ahora", d.inicial, 10)) +
          '</div>' +
          '<p class="field__hint">' +
            (parseFloat(d.porCiclo) > 0
              ? 'Cada ' + esc(periodo()) + ' entran ' + esc(money(parseFloat(d.porCiclo))) +
                ' más, y lo que sobre se queda dentro: si apartas 200 y gastas 160, ' +
                'el siguiente empiezas con 240.'
              : 'Déjalo vacío si prefieres ir metiendo tú a mano cuando quieras.') +
          '</p>' +

          '<div class="field">' +
            '<span class="field__label">Se descuenta solo al gastar en</span>' +
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
            '<p class="field__hint">' +
              (elegidas.length
                ? 'Un gasto de ' + (elegidas.length === 1 ? 'esa categoría' : 'esas categorías') +
                  ' pagado con esta cuenta sale de aquí sin que tengas que decir nada, ' +
                  'y deja de contar en el límite de la cuenta.'
                : 'Sin ninguna elegida tendrás que ir marcando a mano qué gastos ' +
                  'salen de este apartado.') +
            '</p>' +
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
              coloresAp.map(function (n) {
                return '<button type="button" class="swatch" data-pcolor="' + n + '" ' +
                         'style="background:var(--cat-' + n + ')" ' +
                         'aria-pressed="' + (n === d.color) + '" ' +
                         'aria-label="Color ' + n + '"></button>';
              }).join("") +
            '</div>' +
          '</div>';
      }

    return html;
  }

  /* --- lo que usan otros archivos --- */
  A.htmlApartado = htmlApartado;
})();
