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
  function nombreCiclo() { return A.nombreCiclo.apply(null, arguments); }
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
  function refreshLimites() { return A.refreshLimites.apply(null, arguments); }
  function bindAjustes() { return A.bindAjustes.apply(null, arguments); }

  /* Una fila por límite: el nombre con lo que supone al mes, la barra de
     lo gastado y el importe editable. Tocar el nombre abre su hoja, que
     es donde se elige a qué categorías mira. */
  function filaDeLimite(e) {
    var lim = S.limitePorId(e.id);
    var fill = e.nivel === "pasado" ? "var(--status-critical)"
             : e.nivel === "cerca" ? "var(--status-warning)"
             : "var(--cat-" + e.color + ")";
    /* La cara y el texto van dentro del MISMO botón: son la misma acción
       —abrir el límite— y dos botones pegados haciendo lo mismo dan un
       objetivo pequeño cada uno en vez de uno grande. */
    return '<div class="pres-fila">' +
        '<button type="button" class="pres-fila__main" data-lim-abrir="' +
                esc(e.id) + '" aria-label="Editar ' + esc(e.name) + '">' +
          '<span class="pres-fila__cara cat-face" ' +
                'style="--cat-color:var(--cat-' + e.color + ')" aria-hidden="true">' +
            esc(e.emoji) + '</span>' +
          '<span class="pres-fila__texto">' +
          /* La cifra va arriba con el nombre y no abajo con el ámbito:
             en un móvil estrecho las dos cosas juntas en una línea no
             caben, y lo que se perdía era siempre el final. Arriba el
             porcentaje consumido, que es lo que se lee de un vistazo;
             los euros exactos, en el Resumen y en la tabla. */
          '<span class="pres-fila__nombre">' +
            '<span class="pres-fila__label">' + esc(e.name) + '</span>' +
            '<span class="pres-fila__num"' +
              (e.nivel === "pasado" ? ' style="color:' + fill + '"' : "") + '>' +
              esc(S.pct(e.pct)) + '</span>' +
          '</span>' +
          '<span class="pres-fila__pct">' +
            esc(S.textoAmbitoCortoLimite(lim)) +
          '</span>' +
          '<span class="pres-fila__track">' +
            '<span class="pres-fila__fill" style="width:' + e.pct + '%;background:' +
              fill + '"></span>' +
            '</span>' +
          '</span>' +
        '</button>' +
        '<span class="input-affix pres-fila__campo">' +
          '<input type="number" class="field__input" data-lim-eur="' +
                 esc(e.id) + '" min="0" step="10" inputmode="decimal" ' +
                 'value="' + e.limite + '" ' +
                 'aria-label="Tope de ' + esc(e.name) + '">' +
          '<span class="input-affix__suffix">€</span>' +
        '</span>' +
      '</div>';
  }

  function renderAjustes() {
    var root = $("#view-ajustes");
    var inc = S.state.income;
    var planned = S.plannedIncome();
    var theme = S.getTheme();
    var lims = S.estadoDeLimites();
    var res = S.resumenDeLimites();

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

      /* ---- los límites del mes ----
         Un límite es un tope con nombre: cuánto y sobre qué categorías.
         Puedes tener los que hagan falta y cada uno va a lo suyo, así
         que la lista es lo que manda; el detalle de cada uno se edita en
         su hoja, que es donde caben el ámbito y las categorías.

         No viene ninguno de fábrica: se crean los que a cada uno le
         interesen, y lo que no tenga tope se sigue contando igual. */
      '<section class="card">' +
        '<div class="card__head">' +
          '<div>' +
            '<h2 class="card__title">Límites de ' + esc(nombreCiclo(S.cicloActual())) + '</h2>' +
            '<p class="card__sub">Cuánto quieres gastar como mucho, y en qué. ' +
              'Se vacían al empezar el ' + esc(periodo()) + ' siguiente.</p>' +
          '</div>' +
          (lims.length
            ? '<button type="button" class="card__link" id="allocReset">Vaciar</button>'
            : "") +
        '</div>' +

        (lims.length
          ? '<div id="allocRows">' +
              lims.map(filaDeLimite).join("") +
            '</div>' +

            /* Lo gastado que cae fuera de todos los límites. Sumar los
               topes no valdría —dos límites pueden solaparse y la suma
               daría de más—, pero esto es cierto siempre. */
            (res.sinTope > 0
              ? '<p class="card__sub" style="margin-top:var(--sp-4)">' +
                  esc(S.moneyShort(res.sinTope)) + ' de este ' + esc(periodo()) +
                  ' no entran en ningún límite.</p>'
              : "")

          : emptyHtml("chart", "Sin límites, de momento",
              "Crea el primero abajo. Lo que no tenga tope se sigue contando " +
              "igual, simplemente no avisa.")) +

        '<div class="field" style="margin-top:var(--sp-5)">' +
          '<button type="button" class="btn btn--ghost" id="limNuevo" style="width:100%">' +
            icon("plus", 17) + (lims.length ? "Nuevo límite" : "Crear el primero") +
          '</button>' +
        '</div>' +

        (lims.length
          ? U.tableView("tblAllocSet", ["Límite", "Al " + periodo(), "Gastado", "A qué afecta"],
              lims.map(function (e) {
                var l = S.limitePorId(e.id);
                return [e.name, money(e.limite), money(e.gastado),
                        S.textoAmbitoLimite(l)];
              }))
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
        '<p style="font-size:var(--t-hint);color:var(--text-muted);line-height:1.6">' +
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
    refreshLimites();
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
