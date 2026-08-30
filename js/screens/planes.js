/* ============================================================
   split — pantalla: Mi dinero
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, C = A.C, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function catFace() { return A.catFace.apply(null, arguments); }
  function catOf() { return A.catOf.apply(null, arguments); }
  function emptyHtml() { return A.emptyHtml.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function ritmoDe() { return A.ritmoDe.apply(null, arguments); }
  function wrapStagger() { return A.wrapStagger.apply(null, arguments); }

  /* ============================================================
     Pantalla · Ahorro
     ============================================================ */

  function renderPlanes() {
    var root = $("#view-ahorro");
    var goals = S.state.goals;
    var accounts = S.state.accounts;
    var rec = S.state.recurring || [];
    var totalSaved = goals.reduce(function (s, g) { return s + g.saved; }, 0);
    var totalTarget = goals.reduce(function (s, g) { return s + g.target; }, 0);
    var recSum = S.recurringMonthly();

    /* --- cuentas --- */
    var cardAccounts =
      '<section class="card card--flush">' +
        '<div class="card__head card__pad--tight" style="margin-bottom:0">' +
          '<div>' +
            '<h2 class="card__title">Cuentas</h2>' +
            '<p class="card__sub">' + esc(money(S.balance())) + ' en total</p>' +
          '</div>' +
          '<button type="button" class="card__link" data-form="account">+ Nueva</button>' +
        '</div>' +
        accounts.map(function (a) {
          /* Si la cuenta tiene objetivo de gasto se dice aquí: si no, hay
             que entrar en ella para enterarse de que existe. */
          var lim = S.estadoDeObjetivo(a.id);
          return '<button type="button" class="account" data-cuenta="' + esc(a.id) + '" ' +
                  'style="width:100%;text-align:left">' +
              '<span class="account__badge" data-icon="' + esc(a.icon || "wallet") +
                    '" data-icon-size="17"></span>' +
              '<span class="account__body">' +
                '<span class="account__name">' + esc(a.name) + '</span>' +
                '<span class="account__type">' + esc(a.type) +
                  (lim
                    ? ' · ' + esc(lim.nivel === "pasado"
                        ? "te has pasado del objetivo"
                        : "te queda el " + lim.pctQueda + " % del objetivo")
                    : "") + '</span>' +
              '</span>' +
              '<span class="account__amount">' + esc(money(S.accountBalance(a.id))) + '</span>' +
              '<span class="setting__chev" data-icon="chevron" data-icon-size="14"></span>' +
            '</button>';
        }).join("") +
        '<div class="card__pad" style="padding-top:var(--sp-3)">' +
          '<button type="button" class="btn btn--ghost" style="width:100%" data-quick="traspaso">' +
            icon("swap", 17) + 'Hacer un traspaso</button>' +
        '</div>' +
      '</section>';

    /* --- programados --- */
    var cardRecurring =
      '<section class="card card--flush">' +
        '<div class="card__head card__pad--tight" style="margin-bottom:0">' +
          '<div>' +
            '<h2 class="card__title">Programados</h2>' +
            '<p class="card__sub">' +
              (rec.length
                ? "− " + esc(S.moneyShort(recSum.expense)) + " · + " +
                  esc(S.moneyShort(recSum.income)) + " al mes"
                : "") + '</p>' +
          '</div>' +
          '<button type="button" class="card__link" data-form="recurring">+ Nuevo</button>' +
        '</div>' +
        (rec.length
          ? rec.slice().sort(function (a, b) { return a.day - b.day; }).map(function (r) {
              var due = S.nextDue(r);
              var sign = r.kind === "in" ? "+" : r.kind === "transfer" ? "" : "−";
              return '<div class="account"' + (r.active ? "" : ' style="opacity:.5"') + '>' +
                  (r.kind === "transfer"
                    ? '<span class="account__badge" data-icon="swap" data-icon-size="17"></span>'
                    : catFace(catOf(r.categoryId), 21, "account__badge")) +
                  '<button type="button" class="account__body" data-form="recurring" ' +
                          'data-form-id="' + esc(r.id) + '" style="text-align:left">' +
                    '<span class="account__name">' + esc(r.note) + '</span>' +
                    '<span class="account__type">' +
                      (r.active ? ritmoDe(r) + " · próximo " +
                        esc(due.toLocaleDateString("es-ES", { day: "numeric", month: "short" }))
                        : "En pausa") +
                    '</span>' +
                  '</button>' +
                  '<span class="account__amount">' + sign + esc(S.moneyShort(r.amount)) + '</span>' +
                  '<button type="button" class="icon-btn" data-rec-toggle="' + esc(r.id) + '" ' +
                          'aria-label="' + (r.active ? "Pausar" : "Reanudar") + ' ' + esc(r.note) +
                          '" data-icon="' + (r.active ? "pause" : "play") +
                          '" data-icon-size="15"></button>' +
                '</div>';
            }).join("")
          : emptyHtml("calendar", "Nada programado",
              "Lo que se repite cada mes se apunta solo.")) +
      '</section>';

    /* --- metas --- */
    var cardGoals =
      '<section class="card card--flush">' +
        '<div class="card__head card__pad--tight" style="margin-bottom:0">' +
          '<div>' +
            '<h2 class="card__title">Metas</h2>' +
            '<p class="card__sub">' + esc(money(totalSaved)) + ' de ' +
              esc(money(totalTarget)) + '</p>' +
          '</div>' +
          '<button type="button" class="card__link" data-form="goal">+ Nueva</button>' +
        '</div>' +
        (goals.length
          ? goals.map(function (g, i) {
              var ratio = g.target > 0 ? g.saved / g.target : 0;
              var left = Math.max(0, g.target - g.saved);
              var months = g.monthly > 0 ? Math.ceil(left / g.monthly) : null;
              return '<div class="goal">' +
                  '<div class="ring" data-ring="' + ratio + '" data-slot="' + ((i % 8) + 1) + '"></div>' +
                  '<button type="button" class="goal__body" data-form="goal" ' +
                          'data-form-id="' + esc(g.id) + '" style="text-align:left">' +
                    '<p class="goal__name">' + esc(g.name) + '</p>' +
                    '<p class="goal__amounts">' + esc(money(g.saved)) + ' de ' +
                      esc(money(g.target)) + '</p>' +
                    '<p class="goal__eta">' +
                      (left <= 0 ? "Meta cumplida"
                       : months ? "Faltan " + esc(money(left)) + " · " + months + " mes" +
                         (months === 1 ? "" : "es") + " a " + esc(S.moneyShort(g.monthly)) + "/mes"
                       : "Faltan " + esc(money(left))) +
                    '</p>' +
                  '</button>' +
                  '<button type="button" class="icon-btn" data-goal-add="' + esc(g.id) + '" ' +
                          'aria-label="Aportar a ' + esc(g.name) + '" ' +
                          'data-icon="plus" data-icon-size="16"></button>' +
                '</div>';
            }).join("")
          : emptyHtml("target", "Sin metas todavía", "Crea una meta para ahorrar con rumbo.")) +
      '</section>';

    root.innerHTML =
      '<div class="dash">' +
        '<div class="dash__col stagger">' + wrapStagger(cardAccounts + cardRecurring) + '</div>' +
        '<div class="dash__col stagger">' + wrapStagger(cardGoals) + '</div>' +
      '</div>';

    mountIcons(root);
    $$("[data-ring]", root).forEach(function (node) {
      C.progressRing(node, parseFloat(node.getAttribute("data-ring")), {
        size: 50, stroke: 8, color: C.seriesColor(+node.getAttribute("data-slot"))
      });
    });
  }


  A.screens["ahorro"] = renderPlanes;
})();
