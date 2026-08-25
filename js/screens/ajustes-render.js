/* ============================================================
   split — pantalla: pintar Ajustes

   Solo dibuja. Lo que hace cada fila y el cableado están al lado, en
   ajustes.js.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, Up = A.Up, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, ui = A.ui;
  var DIAS_LARGO = A.DIAS_LARGO;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function bigAmount() { return A.bigAmount.apply(null, arguments); }
  function catFace() { return A.catFace.apply(null, arguments); }
  function emptyHtml() { return A.emptyHtml.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function pickField() { return A.pickField.apply(null, arguments); }
  function wrapStagger() { return A.wrapStagger.apply(null, arguments); }
  function periodo() { return A.periodo.apply(null, arguments); }
  function periodos() { return A.periodos.apply(null, arguments); }
  function themeLabel() { return A.themeLabel.apply(null, arguments); }
  function themeShort() { return A.themeShort.apply(null, arguments); }
  function emojiHint() { return A.emojiHint.apply(null, arguments); }
  function emojiCorto() { return A.emojiCorto.apply(null, arguments); }
  function settingRow() { return A.settingRow.apply(null, arguments); }
  function refreshAllocation() { return A.refreshAllocation.apply(null, arguments); }
  function bindAjustes() { return A.bindAjustes.apply(null, arguments); }

  function renderAjustes() {
    var root = $("#view-ajustes");
    var inc = S.state.income;
    var planned = S.plannedIncome();
    var sum = S.allocationSum();
    var savings = S.savingsPct();
    var theme = S.getTheme();
    /* Las del sistema («Ajuste de saldo») quedan fuera del presupuesto: no
       se presupuesta lo que por definición no habías previsto. */
    var presupuestadas = S.budgetedCategories().filter(function (c) {
      return !c.sistema;
    });
    var sinPresupuesto = S.unbudgetedCategories();

    var media = S.averageIncome(inc.months);
    var modo = inc.mode === "manual" ? "manual"
             : inc.mode === "trabajos" ? "trabajos" : "auto";

    /* Los cobros programados: cada uno es "un trabajo" en la práctica, y
       lo que se enseña es lo que supone al mes ya repartido (una nómina de
       catorce pagas rinde más al mes de lo que pone en el recibo). */
    var trabajos = (S.state.recurring || []).filter(function (r) {
      return r.active && r.kind === "in";
    });
    var declarado = S.declaredIncome();

    /* El ciclo va el primero porque es la regla que manda sobre todo lo
       que se ve debajo: si tu mes empieza el 25, el presupuesto, los
       totales y el histórico van del 25 al 24. */
    var dia = S.diaDeCorte();
    var cicloKey = S.cicloActual();
    var rango = S.rangoDeCiclo(cicloKey);

    var main =
      '<section class="card">' +
        '<div class="card__head">' +
          '<h2 class="card__title">Cuándo empieza tu mes</h2>' +
        '</div>' +

        '<div class="field">' +
          '<span class="field__label">Se reinicia el día</span>' +
          pickField("cicloDia", dia, dia === 1 ? "1, como el calendario" : String(dia)) +
        '</div>' +

        '<p class="card__sub" style="margin-top:var(--sp-3)">' +
          (dia === 1
            ? 'Tu mes es el del calendario: del 1 al último día.'
            : 'Este mes va del <strong>' + esc(S.fechaLarga(rango.desde)) +
              '</strong> al <strong>' + esc(S.fechaLarga(rango.hasta)) + '</strong>. ' +
              'Todo lo que cuenta la app —totales, presupuesto e histórico— va con él.') +
        '</p>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card__head">' +
          '<h2 class="card__title">Cuánto cuentas por ' + esc(periodo()) + '</h2>' +
        '</div>' +

        '<div class="segmented" id="incSeg" role="tablist">' +
          '<span class="segmented__thumb" id="incThumb" aria-hidden="true"></span>' +
          '<button type="button" class="segmented__btn" role="tab" data-incmode="auto" ' +
                  'aria-selected="' + (modo === "auto") + '">Automático</button>' +
          '<button type="button" class="segmented__btn" role="tab" data-incmode="trabajos" ' +
                  'aria-selected="' + (modo === "trabajos") + '">Trabajos</button>' +
          '<button type="button" class="segmented__btn" role="tab" data-incmode="manual" ' +
                  'aria-selected="' + (modo === "manual") + '">Manual</button>' +
        '</div>' +

        '<div class="hero-center" style="padding:var(--sp-5) 0 var(--sp-3)">' +
          '<p class="hero-center__value">' + bigAmount(planned) + '</p>' +
          '<p class="card__sub" style="margin-top:var(--sp-2)">' +
            (modo === "manual" ? "La cifra que has puesto tú"
             : modo === "trabajos"
               ? (declarado > 0
                    ? (trabajos.length === 1
                         ? "Lo que cobras de tu único trabajo"
                         : "Suma de tus " + trabajos.length + " trabajos")
                    : "Aún no has programado ningún cobro")
               : (media > 0
                    ? "Media de tus últimos " + inc.months + " " + periodos()
                    : "Aún sin historial: se usa la cifra manual")) + '</p>' +
        '</div>' +

        (modo === "auto"
          ? '<div class="field">' +
              '<span class="field__label">Cuántos ' + esc(periodos()) + ' promedia</span>' +
              pickField("incMonths", inc.months, inc.months + " " + periodos()) +
              '<p class="field__hint">Cuenta lo que te ha entrado de verdad. ' +
                'Un ' + esc(periodo()) + ' con paga extra sube la media solo.</p>' +
            '</div>'

        : modo === "trabajos"
          ? (trabajos.length
              ? '<div class="mini-list">' +
                  trabajos.map(function (r) {
                    var alMes = S.mensualizar(r);
                    /* Solo se repite el importe suelto cuando no coincide
                       con lo que sale al mes; si coincide, sobra. */
                    var detalle = r.freq === "semanal"
                      ? "Cada " + DIAS_LARGO[r.weekday || 0].toLowerCase() +
                        ", " + S.moneyShort(r.amount)
                      : (+r.pagas === 14
                           ? "14 pagas de " + S.moneyShort(r.amount)
                           : "Cada día " + r.day);
                    return '<button type="button" class="mini-list__row" ' +
                             'data-form="recurring" data-form-id="' + esc(r.id) + '">' +
                        '<span class="mini-list__text">' +
                          '<span class="mini-list__name">' + esc(r.note) + '</span>' +
                          '<span class="mini-list__meta">' + esc(detalle) + '</span>' +
                        '</span>' +
                        '<span class="mini-list__value">' + esc(S.moneyShort(alMes)) + '</span>' +
                      '</button>';
                  }).join("") +
                '</div>' +
                '<p class="field__hint" style="margin-top:var(--sp-3)">' +
                  'Al mes, repartiendo las pagas extra y las semanas del año. ' +
                  'Toca uno para cambiarlo.</p>' +
                '<button type="button" class="btn btn--ghost" data-form="recurring" ' +
                        'style="width:100%;margin-top:var(--sp-4)">' +
                  icon("plus", 16) + 'Añadir otro trabajo</button>'

              : emptyHtml("calendar", "Ningún cobro programado",
                  "Programa aquí lo que cobras de cada trabajo y la app suma sola.") +
                '<button type="button" class="btn btn--primary" data-form="recurring" ' +
                        'style="width:100%;margin-top:var(--sp-4)">' +
                  icon("plus", 16) + 'Añadir mi primer trabajo</button>')

          : '<div class="field">' +
              '<label class="field__label" for="incManual">Tu cifra</label>' +
              '<div class="input-affix">' +
                '<input type="number" class="field__input" id="incManual" min="0" step="50" ' +
                       'inputmode="decimal" value="' + inc.manual + '">' +
                '<span class="input-affix__suffix">€</span>' +
              '</div>' +
            '</div>') +
      '</section>' +

      /* ---- presupuesto por categoría ----
         Esto NO son las cuentas: son los tipos de gasto. La confusión es
         fácil de tener, así que lo dice el subtítulo. Y no viene nada
         puesto de fábrica: se añade lo que a cada uno le interese
         vigilar, y lo demás ni aparece. */
      '<section class="card">' +
        '<div class="card__head">' +
          '<div>' +
            '<h2 class="card__title">Presupuesto del ' +
            esc(periodo()) + '</h2>' +
            '<p class="card__sub">Cuánto quieres gastar como mucho en cada tipo de ' +
              'gasto. No son tus cuentas.</p>' +
          '</div>' +
          (presupuestadas.length
            ? '<button type="button" class="card__link" id="allocReset">Vaciar</button>'
            : "") +
        '</div>' +

        (planned <= 0
          ? emptyHtml("wallet", "Primero, cuánto cobras",
              "Pon ahí arriba lo que entra al mes. Sin eso no hay de dónde repartir.")

          : presupuestadas.length
            ? '<div class="alloc-bar" id="allocBar" role="img" ' +
                    'aria-label="Reparto del sueldo"></div>' +

              '<div class="alloc-head">' +
                '<p class="card__sub" id="allocSummary"></p>' +
                '<p class="alloc-total" id="allocTotal"></p>' +
              '</div>' +

              '<div id="allocRows">' +
                presupuestadas.map(function (c) {
                  return '<div class="pres-fila">' +
                      catFace(c, 22, "pres-fila__cara") +
                      '<span class="pres-fila__texto">' +
                        '<span class="pres-fila__nombre">' + esc(c.name) + '</span>' +
                        '<span class="pres-fila__pct" data-alloc-pct="' + c.id + '">' +
                          (S.state.allocation[c.id] || 0) + ' % de lo que entra</span>' +
                      '</span>' +
                      '<span class="input-affix pres-fila__campo">' +
                        '<input type="number" class="field__input" data-alloc-eur="' +
                               esc(c.id) + '" min="0" step="10" inputmode="decimal" ' +
                               'value="' + S.budgetFor(c.id) + '" ' +
                               'aria-label="Presupuesto de ' + esc(c.name) + '">' +
                        '<span class="input-affix__suffix">€</span>' +
                      '</span>' +
                      '<button type="button" class="icon-btn pres-fila__quitar" ' +
                              'data-alloc-quitar="' + esc(c.id) + '" ' +
                              'aria-label="Quitar ' + esc(c.name) + ' del presupuesto" ' +
                              'data-icon="close" data-icon-size="13"></button>' +
                    '</div>';
                }).join("") +
              '</div>'

            : emptyHtml("chart", "Sin presupuesto, de momento",
                "Añade abajo los gastos que quieras vigilar. Lo que no pongas " +
                "sigue contándose, simplemente no tiene tope.")) +

        (planned > 0 && sinPresupuesto.length
          ? '<div class="field" style="margin-top:var(--sp-5)">' +
              '<span class="field__label">' +
                (presupuestadas.length ? "Añadir otro" : "Empieza por uno") + '</span>' +
              '<div class="chips">' +
                sinPresupuesto.map(function (c) {
                  return '<button type="button" class="chip" data-alloc-add="' +
                           esc(c.id) + '">' + esc(c.emoji || "") + ' ' +
                           esc(c.name) + '</button>';
                }).join("") +
              '</div>' +
            '</div>'
          : "") +

        (presupuestadas.length
          ? U.tableView("tblAllocSet", ["Partida", "Al mes", "Porcentaje"],
              presupuestadas.map(function (c) {
                return [c.name, money(S.budgetFor(c.id)),
                        (S.state.allocation[c.id] || 0) + " %"];
              }).concat([["Ahorro", money(Math.round(planned * savings / 100)),
                          savings + " %"]]))
          : "") +
      '</section>';

    var side =
      '<section class="card card--flush">' +
        '<div class="card__head card__pad--tight" style="margin-bottom:0">' +
          '<h2 class="card__title">Apariencia</h2>' +
        '</div>' +
        settingRow("sun", "Tema", themeLabel(theme), "theme", themeShort(theme)) +
        settingRow("sparkle", "Emojis", emojiHint(S.getEmojiSet()), "emojis",
                   emojiCorto(S.getEmojiSet())) +
        /* Twemoji es CC-BY: dejar el crédito a la vista mientras se usa no
           es un detalle bonito, es la condición de la licencia. */
        (S.getEmojiSet() === "twemoji"
          ? '<p class="card__sub card__pad--tight" style="padding-bottom:var(--sp-4)">' +
              'Emojis de <a href="https://github.com/twitter/twemoji" ' +
                'target="_blank" rel="noopener">Twemoji</a>, con licencia ' +
              'CC-BY 4.0.</p>'
          : S.getEmojiSet() === "noto"
          ? '<p class="card__sub card__pad--tight" style="padding-bottom:var(--sp-4)">' +
              'Emojis de <a href="https://github.com/googlefonts/noto-emoji" ' +
                'target="_blank" rel="noopener">Noto Emoji</a>, con licencia ' +
              'SIL OFL 1.1.</p>'
          : "") +
      '</section>' +

      '<section class="card card--flush">' +
        '<div class="card__head card__pad--tight" style="margin-bottom:0">' +
          '<h2 class="card__title">Tus datos</h2>' +
        '</div>' +
        settingRow("download", "Exportar", "", "export") +
        settingRow("upload", "Importar", "", "import") +
        settingRow("repeat", "Datos de ejemplo", "", "reset") +
        settingRow("trash", "Vaciar todo", "", "clear") +
      '</section>' +

      '<section class="card card--flush">' +
        '<div class="card__head card__pad--tight" style="margin-bottom:0">' +
          '<h2 class="card__title">Empezar</h2>' +
        '</div>' +
        settingRow("lock", "Volver a la guía",
                   "Añade cuentas y trabajos sin borrar nada de lo que ya tienes",
                   "guia") +
      '</section>' +

      '<section class="card card--flush">' +
        '<div class="card__head card__pad--tight" style="margin-bottom:0">' +
          '<div>' +
            '<h2 class="card__title">Categorías</h2>' +
            '<p class="card__sub">' + S.CATEGORIES.length + ' en total</p>' +
          '</div>' +
          '<button type="button" class="card__link" data-form="category">+ Nueva</button>' +
        '</div>' +
        ["out", "in"].map(function (kind) {
          var list = S.categoriesOf(kind);
          if (!list.length) return "";
          return '<p class="cat-list__head">' +
                   (kind === "out" ? "Gastos" : "Ingresos") + '</p>' +
            '<div class="cat-list">' +
              list.map(function (c) {
                var use = S.categoryUsage(c.id);
                return '<button type="button" class="cat-list__item" ' +
                        'data-form="category" data-form-id="' + esc(c.id) + '">' +
                    catFace(c, 21, "cat-list__face") +
                    '<span class="cat-list__body">' +
                      '<span class="cat-list__name">' + esc(c.name) + '</span>' +
                      '<span class="cat-list__meta">' +
                        (use.transactions
                          ? use.transactions + " movimiento" + (use.transactions === 1 ? "" : "s")
                          : "Sin movimientos") +
                      '</span>' +
                    '</span>' +
                    '<span class="setting__chev" data-icon="chevron" data-icon-size="14"></span>' +
                  '</button>';
              }).join("") +
            '</div>';
        }).join("") +
      '</section>' +

      '<section class="card card--flush">' +
        '<div class="card__head card__pad--tight" style="margin-bottom:0">' +
          '<h2 class="card__title">Acerca de</h2>' +
        '</div>' +
        settingRow("download", "Versión",
                   ui.update ? "Hay una actualización disponible" : "Toca para buscar actualizaciones",
                   "update", Up.VERSION) +

        /* Salida de emergencia: si la comprobación falla —GitHub caído, la
           red de un momento, el límite de consultas— siempre queda bajarla
           a mano. Es un enlace de verdad, no un botón, para que lo abra el
           navegador del sistema pase lo que pase dentro de la app. */
        '<div class="card__pad" style="padding-top:0">' +
          '<a class="update-card__link" href="' + esc(Up.RELEASES_URL) + '" ' +
             'target="_blank" rel="noopener">¿No la encuentra? Descargarla a mano</a>' +
        '</div>' +
      '</section>' +

      '<section class="card">' +
        '<p style="font-size:12px;color:var(--text-muted);line-height:1.6">' +
          'split guarda todo en el almacenamiento de este navegador, en este ' +
          'dispositivo. No hay servidor detrás y nada sale de aquí. Solo se ' +
          'conecta a GitHub cuando comprueba si hay una versión nueva.' +
        '</p>' +
      '</section>' +

      '<input type="file" id="importFile" accept="application/json,.json" class="visually-hidden">';

    root.innerHTML =
      '<div class="dash">' +
        '<div class="dash__col stagger">' + wrapStagger(main) + '</div>' +
        '<div class="dash__col stagger">' + wrapStagger(side) + '</div>' +
      '</div>';

    mountIcons(root);
    refreshAllocation();
    bindAjustes();
    requestAnimationFrame(function () {
      var seg = $("#incSeg", root);
      if (seg) U.slideIndicator(seg, $("#incThumb", root),
        $('[data-incmode="' + modo + '"]', seg));
    });
  }

  /* --- lo que usan otros archivos --- */
  A.renderAjustes = renderAjustes;

  A.screens["ajustes"] = renderAjustes;
})();
