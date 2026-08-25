/* ============================================================
   split — pantalla: Movimientos
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, $ = A.$, $$ = A.$$, esc = A.esc, ui = A.ui;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function catOf() { return A.catOf.apply(null, arguments); }
  function emptyHtml() { return A.emptyHtml.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function cicloMovs() { return A.cicloMovs.apply(null, arguments); }
  function txRowHtml() { return A.txRowHtml.apply(null, arguments); }
  function Periodo() { return A.Periodo.apply(null, arguments); }

  /* ============================================================
     Pantalla · Movimientos
     ============================================================ */

  function renderMovs() {
    var root = $("#view-movs");
    var key = cicloMovs();
    var list = S.txDeCiclo(key);

    /* Al venir de «Ver todos» desde una cuenta, la lista se queda en ella
       hasta que se quite la chapa. Es un filtro visible, no una trampa. */
    var cuentaFiltro = ui.movsAccount
      ? S.state.accounts.find(function (a) { return a.id === ui.movsAccount; })
      : null;
    if (!cuentaFiltro) ui.movsAccount = null;
    if (cuentaFiltro) {
      list = list.filter(function (t) {
        return t.accountId === ui.movsAccount || t.toAccountId === ui.movsAccount;
      });
    }

    /* Igual que la cuenta: si se ha entrado desde una categoría, se ve
       solo la suya con su chapa para quitarla. Una madre arrastra a sus
       hijas, que es como se suman en el resto de la app. */
    var catFiltro = ui.movsCat ? S.catExacta(ui.movsCat) : null;
    if (!catFiltro) ui.movsCat = null;
    if (catFiltro) {
      list = list.filter(function (t) {
        var r = S.raizDe(t.categoryId);
        return t.categoryId === ui.movsCat || (r && r.id === ui.movsCat);
      });
    }

    if (ui.movsKind !== "all") {
      list = list.filter(function (t) { return t.kind === ui.movsKind; });
    }
    if (ui.movsQuery) {
      var q = ui.movsQuery.toLowerCase();
      list = list.filter(function (t) {
        return t.note.toLowerCase().indexOf(q) >= 0 ||
               catOf(t.categoryId).name.toLowerCase().indexOf(q) >= 0;
      });
    }

    var t = S.totals(list);
    var groups = [], byDay = {};
    list.forEach(function (tx) {
      if (!byDay[tx.date]) { byDay[tx.date] = []; groups.push(tx.date); }
      byDay[tx.date].push(tx);
    });

    root.innerHTML =
      '<div class="single">' +
        '<div class="filter-row">' +
          '<button type="button" class="icon-btn" data-ciclo="-1" aria-label="' + esc(Periodo()) + ' anterior" ' +
                  'data-icon="chevLeft" data-icon-size="17"></button>' +
          '<div class="month-nav">' +
            '<p class="month-nav__label">' + esc(S.etiquetaCiclo(key)) + '</p>' +
            '<p class="month-nav__sub">' + list.length + ' movimiento' +
              (list.length === 1 ? "" : "s") + '</p>' +
          '</div>' +
          '<button type="button" class="icon-btn" data-ciclo="1" aria-label="' + esc(Periodo()) + ' siguiente" ' +
                  'data-icon="chevron" data-icon-size="17"' +
                  (ui.movsCicloOffset === 0 ? " disabled" : "") + '></button>' +
        '</div>' +

        '<div class="stagger">' +
          '<div class="section-gap" style="--i:0;display:grid;gap:var(--sp-3)">' +
            '<div class="search">' +
              '<span class="search__icon" data-icon="search" data-icon-size="16"></span>' +
              '<input type="search" class="search__input" id="movsSearch" ' +
                     'placeholder="Buscar concepto o categoría" value="' + esc(ui.movsQuery) + '" ' +
                     'aria-label="Buscar movimientos">' +
              '<button type="button" class="search__clear" id="movsClear" aria-label="Limpiar" ' +
                      'data-show="' + (ui.movsQuery ? "true" : "false") + '" ' +
                      'data-icon="close" data-icon-size="11"></button>' +
            '</div>' +
            '<div class="segmented" id="movsSeg" role="tablist">' +
              '<span class="segmented__thumb" id="movsThumb" aria-hidden="true"></span>' +
              '<button type="button" class="segmented__btn" role="tab" data-kind="all" ' +
                      'aria-selected="' + (ui.movsKind === "all") + '">Todo</button>' +
              '<button type="button" class="segmented__btn" role="tab" data-kind="in" ' +
                      'aria-selected="' + (ui.movsKind === "in") + '">Ingresos</button>' +
              '<button type="button" class="segmented__btn" role="tab" data-kind="out" ' +
                      'aria-selected="' + (ui.movsKind === "out") + '">Gastos</button>' +
            '</div>' +

            (cuentaFiltro || catFiltro
              ? '<div class="chips">' +
                  (cuentaFiltro
                    ? '<button type="button" class="chip" id="movsAccClear" ' +
                              'aria-pressed="true">' +
                        esc(cuentaFiltro.name) +
                        '<span data-icon="close" data-icon-size="11"></span>' +
                      '</button>'
                    : "") +
                  (catFiltro
                    ? '<button type="button" class="chip" id="movsCatClear" ' +
                              'aria-pressed="true">' +
                        esc(catFiltro.emoji ? catFiltro.emoji + " " : "") +
                        esc(catFiltro.name) +
                        '<span data-icon="close" data-icon-size="11"></span>' +
                      '</button>'
                    : "") +
                '</div>'
              : "") +
          '</div>' +

          '<div class="kpi-row section-gap" style="--i:1">' +
            '<div class="stat stat--compact stat--quiet">' +
              '<p class="stat__label">Entró</p>' +
              '<p class="stat__value" style="color:var(--money-in)">+ ' +
                esc(S.moneyShort(t.income)) + '</p>' +
            '</div>' +
            '<div class="stat stat--compact stat--quiet">' +
              '<p class="stat__label">Salió</p>' +
              '<p class="stat__value">− ' + esc(S.moneyShort(t.expense)) + '</p>' +
            '</div>' +
            '<div class="stat stat--compact stat--quiet">' +
              '<p class="stat__label">Balance</p>' +
              '<p class="stat__value">' + esc(S.signed(t.net)) + '</p>' +
            '</div>' +
          '</div>' +

          '<section class="card card--flush section-gap" style="--i:2">' +
            (groups.length
              ? groups.map(function (day) {
                  return '<div class="day-head">' +
                      '<span>' + esc(S.relDayLabel(day)) + '</span>' +
                      '<span class="day-head__sum">' + esc(S.signed(S.totals(byDay[day]).net)) + '</span>' +
                    '</div>' +
                    '<div class="rows">' + byDay[day].map(txRowHtml).join("") + '</div>';
                }).join("")
              : emptyHtml("search", "Nada por aquí",
                  ui.movsQuery ? "Prueba con otra búsqueda." : "No hay movimientos con este filtro.")) +
          '</section>' +
        '</div>' +
      '</div>';

    mountIcons(root);
    requestAnimationFrame(function () {
      var seg = $("#movsSeg", root);
      if (seg) U.slideIndicator(seg, $("#movsThumb", root), $('[data-kind="' + ui.movsKind + '"]', seg));
    });
  }


  /* --- lo que usan otros archivos --- */
  A.renderMovs = renderMovs;

  A.screens["movs"] = renderMovs;
})();
