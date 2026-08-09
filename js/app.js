/* ============================================================
   split — render de pantallas y cableado
   ============================================================ */

(function () {
  "use strict";

  var S = window.Store, U = window.UI, C = window.Charts, Up = window.Updater;
  var $ = U.$, $$ = U.$$, esc = U.esc, icon = U.icon;

  /* ---------- estado de la interfaz ---------- */

  var ui = {
    view: "inicio",
    monthOffset: 0,          /* scope único de Análisis */
    anView: "ahorro",        /* qué muestra el gráfico de Historial */
    range: 12,               /* meses de histórico que se dibujan */
    movsKind: "all",
    movsQuery: "",
    movsMonthOffset: 0,
    draft: null,
    editingId: null,
    update: null            /* { version, name, url } si hay una release nueva */
  };

  var sheets = {};

  /* ---------- tutorial de bienvenida ---------- */

  var ob = null;   /* { step, accountId, name } */

  var ONBOARD_STEPS = [
    { icon: "wallet", title: "Bienvenido a split",
      text: "Controla tus gastos, tus ingresos y tu ahorro desde el móvil. " +
            "Todo se queda en este dispositivo: no hay cuentas ni nube." },
    { icon: "home", title: "Resumen, de un vistazo",
      text: "Tus cuentas, lo que llevas gastado este mes, lo que viene programado " +
            "y el reparto de tu sueldo, todo en la primera pantalla." },
    { icon: "list", title: "Movimientos y traspasos",
      text: "Registra cada gasto o ingreso con el botón +. Mover dinero entre tus " +
            "propias cuentas es un traspaso: no cuenta como gasto." },
    { icon: "sliders", title: "El reparto por porcentajes",
      text: "En Ajustes decides cuánto entra al mes y qué parte va a cada categoría. " +
            "Lo que no repartas es tu ahorro." },
    { icon: "chart", title: "Análisis y planes",
      text: "Gráficos de ahorro y de gasto por categoría, y en Planes tus cuentas, " +
            "pagos programados y metas de ahorro." }
  ];

  /* ---------- helpers ---------- */

  function money(v) { return S.money(v); }
  function selectedMonth() { return S.addMonths(S.currentMonthKey(), -ui.monthOffset); }
  function movsMonth() { return S.addMonths(S.currentMonthKey(), -ui.movsMonthOffset); }
  function catOf(id) { return S.catById(id); }

  /* Emoji de la categoría sobre un fondo teñido con su color. Sustituye al
     icono SVG: el emoji lo elige el usuario y el color separa de un vistazo.
     El nombre siempre viaja al lado, así que el color nunca es el único
     canal que lleva el dato. */
  function catFace(cat, size, cls) {
    return '<span class="' + (cls ? cls + " " : "") + 'cat-face" ' +
           'style="--cat-color:' + S.catColorVar(cat) + ';font-size:' + (size || 18) + 'px" ' +
           'aria-hidden="true">' + esc(cat.emoji || "\uD83D\uDCE6") + '</span>';
  }
  function isDesktop() { return window.matchMedia("(min-width: 900px)").matches; }

  function seriesEnding(endKey, n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var key = S.addMonths(endKey, -i);
      var t = S.totals(S.txOfMonth(key));
      out.push({
        key: key,
        label: S.monthLabel(key, "short"),
        labelFull: S.monthLabel(key),
        income: t.income, expense: t.expense, net: t.net
      });
    }
    return out;
  }

  function deltaPct(now, before) {
    if (!before) return null;
    return ((now - before) / Math.abs(before)) * 100;
  }

  function mountIcons(root) {
    $$("[data-icon]", root || document).forEach(function (n) {
      if (n.getAttribute("data-icon-done")) return;
      n.innerHTML = icon(n.getAttribute("data-icon"), +(n.getAttribute("data-icon-size") || 20));
      n.setAttribute("data-icon-done", "1");
    });
  }

  /* importe con céntimos en menor tamaño */
  function bigAmount(v) {
    var s = money(v);
    var i = s.lastIndexOf(",");
    if (i < 0) return esc(s);
    return esc(s.slice(0, i)) + '<span class="cents">' + esc(s.slice(i)) + "</span>";
  }

  function monthName(key) { return S.monthLabel(key).split(" ")[0]; }

  /* ---------- tarjetas plegables ----------
     Qué está plegado se guarda aparte del estado de datos: es una
     preferencia de la pantalla, no algo que exportar ni migrar. */

  var FOLD_KEY = "split.folds";
  var folds = null;

  function foldState() {
    if (!folds) {
      try { folds = JSON.parse(localStorage.getItem(FOLD_KEY)) || {}; }
      catch (e) { folds = {}; }
    }
    return folds;
  }

  /* abiertas por defecto: plegar es una decisión del usuario */
  function isFolded(id) { return foldState()[id] === true; }

  function setFolded(id, plegada) {
    foldState()[id] = plegada;
    try { localStorage.setItem(FOLD_KEY, JSON.stringify(folds)); } catch (e) {}
  }

  /* `extra` es lo que va a la derecha del título (un enlace, por ejemplo);
     va fuera del botón, porque un botón dentro de otro no es válido. */
  function foldCard(id, titulo, sub, extra, cuerpo, flush) {
    var abierta = !isFolded(id);
    return '<section class="card' + (flush ? " card--flush" : "") + '">' +
        '<div class="card__head' + (flush ? " card__pad--tight" : "") + '" ' +
             'style="margin-bottom:' + (abierta && !flush ? "var(--sp-4)" : "0") + '">' +
          '<button type="button" class="fold-head" data-fold="' + esc(id) + '" ' +
                  'aria-expanded="' + abierta + '">' +
            '<span>' +
              '<span class="card__title">' + titulo + '</span>' +
              (sub ? '<span class="card__sub" style="display:block">' + sub + '</span>' : "") +
            '</span>' +
            '<span class="fold-head__chev" data-icon="chevDown" data-icon-size="15"></span>' +
          '</button>' +
          (extra || "") +
        '</div>' +
        '<div class="fold" data-open="' + abierta + '">' +
          '<div class="fold__inner">' + cuerpo + '</div>' +
        '</div>' +
      '</section>';
  }

  /* presupuestos vigentes, derivados del reparto */
  function budgetRows(monthKey) {
    var spent = {};
    S.byCategory(monthKey, "out").forEach(function (c) { spent[c.id] = c.value; });
    return Object.keys(S.state.allocation).map(function (id) {
      var limit = S.budgetFor(id);
      return {
        id: id,
        name: catOf(id).name,
        emoji: catOf(id).emoji,
        color: catOf(id).color,
        pct: S.state.allocation[id],
        limit: limit,
        spent: spent[id] || 0,
        ratio: limit > 0 ? (spent[id] || 0) / limit : 0
      };
    });
  }

  /* ============================================================
     Pantalla · Resumen
     ============================================================ */

  function renderInicio() {
    var root = $("#view-inicio");
    var curKey = S.currentMonthKey();
    var prevKey = S.addMonths(curKey, -1);
    var cur = S.totals(S.txOfMonth(curKey));
    var prev = S.totals(S.txOfMonth(prevKey));
    var bal = S.balance();
    var series = seriesEnding(curKey, 12);
    var planned = S.plannedIncome();
    var rows = budgetRows(curKey).sort(function (a, b) { return b.ratio - a.ratio; });
    var recent = S.state.transactions.slice(0, 6);
    var savings = S.savingsPct();

    /* --- carrusel: una tarjeta por cuenta, deslizable --- */
    var accounts = S.state.accounts;
    var cardBalance =
      '<div class="cards">' +
        '<div class="cards__track" id="cardsTrack">' +
          accounts.map(function (a, i) {
            /* cada tarjeta con el color de su cuenta; ya no hay una
               "principal" distinta, todas se ven como tarjetas */
            return '<article class="paycard" data-card="' + i + '" ' +
                   'style="--acc-color:' + S.catColorVar(a) + '">' +
                '<div class="paycard__top">' +
                  '<span class="paycard__dots">' +
                    '<i></i><i></i><i></i><i></i>' + esc(a.name) +
                  '</span>' +
                  '<span class="paycard__type">' + esc(a.type) + '</span>' +
                '</div>' +
                '<div>' +
                  '<p class="paycard__label">Saldo</p>' +
                  '<p class="paycard__value">' + bigAmount(S.accountBalance(a.id)) + '</p>' +
                '</div>' +
                '<div class="paycard__foot">' +
                  '<span class="paycard__label">' +
                    (i === 0
                      ? esc(S.signed(cur.net)) + " en " + esc(monthName(curKey))
                      : esc(a.type)) +
                  '</span>' +
                  '<span class="paycard__mark" aria-hidden="true"><span></span><span></span></span>' +
                '</div>' +
              '</article>';
          }).join("") +
        '</div>' +
        '<div class="cards__dots" id="cardsDots" aria-hidden="true">' +
          accounts.map(function (a, i) {
            return '<span class="cards__dot" data-on="' + (i === 0) + '"></span>';
          }).join("") +
        '</div>' +
      '</div>';

    var cardKpis =
      '<div class="kpi-row">' +
        statTile("Ingresos", cur.income, deltaPct(cur.income, prev.income), "up-good",
                 series.map(function (m) { return m.income; })) +
        statTile("Gastos", cur.expense, deltaPct(cur.expense, prev.expense), "up-bad",
                 series.map(function (m) { return m.expense; })) +
        statTile("Ahorro", cur.net, deltaPct(cur.net, prev.net), "up-good",
                 series.map(function (m) { return m.net; })) +
      '</div>';

    var cardBudgets = foldCard("presupuesto",
      "Presupuesto de " + esc(monthName(curKey)),
      esc(money(cur.expense)) + " de " + esc(money(S.budgetTotal())) + " asignados",
      '<button type="button" class="card__link" data-goto="ajustes">Editar</button>',
      rows.map(meterHtml).join(""));

    /* --- tarjeta de límite: el presupuesto del mes de un vistazo --- */
    var budgetTotal = S.budgetTotal();
    var usedRatio = budgetTotal > 0 ? Math.min(1, cur.expense / budgetTotal) : 0;
    var cardLimit =
      '<button type="button" class="limit" data-goto="ajustes">' +
        '<span class="limit__ring" data-limit-ring="' + usedRatio + '"></span>' +
        '<span class="limit__body">' +
          '<span class="limit__label">Presupuesto de ' + esc(monthName(curKey)) + '</span>' +
          '<span class="limit__value">' + esc(S.moneyShort(cur.expense)) + ' de ' +
            esc(S.moneyShort(budgetTotal)) + '</span>' +
        '</span>' +
        '<span class="limit__chev" data-icon="chevron" data-icon-size="18"></span>' +
      '</button>';

    /* --- tiles: en qué se está yendo el mes --- */
    var topCats = S.byCategory(curKey, "out").slice(0, 4);
    var cardTiles = topCats.length
      ? '<section>' +
          '<div class="card__head" style="margin-bottom:var(--sp-3)">' +
            '<h2 class="card__title">Categorías</h2>' +
            '<button type="button" class="card__link" data-goto="analisis">Ver todas</button>' +
          '</div>' +
          '<div class="tiles">' +
            topCats.map(function (c) {
              return '<button type="button" class="tile" data-goto="analisis">' +
                  catFace(c, 19, "tile__icon") +
                  '<span>' +
                    '<span class="tile__name">' + esc(c.name) + '</span>' +
                    '<span class="tile__value">' + esc(S.moneyShort(c.value)) + '</span>' +
                  '</span>' +
                '</button>';
            }).join("") +
          '</div>' +
        '</section>'
      : "";

    /* --- lo que viene: pagos y cobros programados --- */
    var upcoming = S.upcomingRecurring(4);
    var cardUpcoming = upcoming.length
      ? foldCard("proximos", "Lo que viene", "",
          '<button type="button" class="card__link" data-goto="ahorro">Gestionar</button>',
          upcoming.map(function (u) {
            var r = u.r;
            var sign = r.kind === "in" ? "+" : r.kind === "transfer" ? "" : "−";
            return '<button type="button" class="account" data-form="recurring" ' +
                    'data-form-id="' + esc(r.id) + '" style="width:100%;text-align:left">' +
                (r.kind === "transfer"
                  ? '<span class="account__badge" data-icon="swap" data-icon-size="17"></span>'
                  : catFace(catOf(r.categoryId), 17, "account__badge")) +
                '<span class="account__body">' +
                  '<span class="account__name">' + esc(r.note) + '</span>' +
                  '<span class="account__type">' +
                    esc(u.due.toLocaleDateString("es-ES",
                        { weekday: "short", day: "numeric", month: "short" })) +
                  '</span>' +
                '</span>' +
                '<span class="account__amount"' +
                  (r.kind === "in" ? ' style="color:var(--money-in)"' : '') + '>' +
                  sign + esc(S.moneyShort(r.amount)) + '</span>' +
              '</button>';
          }).join(""), true)
      : "";

    /* --- aviso de actualización, cuando hay release nueva --- */
    var cardUpdate = ui.update
      ? '<section class="update-card">' +
          '<span class="update-card__icon" data-icon="download" data-icon-size="19"></span>' +
          '<div class="update-card__body">' +
            '<p class="update-card__title">Hay una actualización</p>' +
            '<p class="update-card__text">' +
              'split ' + esc(ui.update.version) + ' ya está disponible. ' +
              'Tú tienes la ' + esc(Up.VERSION) + '.' +
            '</p>' +
            '<div class="update-card__actions">' +
              '<button type="button" class="btn btn--primary" id="updateNow">' +
                icon("download", 16) + 'Actualizar</button>' +
              '<button type="button" class="update-card__later" id="updateLater">Ahora no</button>' +
            '</div>' +
            /* Enlace de verdad, no un botón: si el WebView se atragantara
               con la descarga del botón, tocar un <a> siempre acaba en el
               navegador del sistema. */
            '<a class="update-card__link" href="' + esc(ui.update.page || ui.update.url) +
               '" target="_blank" rel="noopener">¿No se descarga? Ábrela en el navegador</a>' +
          '</div>' +
        '</section>'
      : "";

    var cardQuick =
      '<div class="actions">' +
        '<button type="button" class="btn btn--primary" data-quick="gasto">' +
          icon("minus", 18) + 'Nuevo gasto</button>' +
        '<button type="button" class="action-circle" data-quick="ingreso" ' +
                'aria-label="Registrar un ingreso" data-icon="plus" data-icon-size="19"></button>' +
        '<button type="button" class="action-circle" data-goto="analisis" ' +
                'aria-label="Ir a Análisis" data-icon="chart" data-icon-size="18"></button>' +
      '</div>';

    var cardRecent = foldCard("recientes", "Últimos movimientos", "",
      '<button type="button" class="card__link" data-goto="movs">Ver todo</button>',
      (recent.length
        ? '<div class="rows">' + recent.map(txRowHtml).join("") + '</div>'
        : emptyHtml("list", "Sin movimientos", "Pulsa «Nuevo movimiento» para registrar el primero.")),
      true);

    root.innerHTML =
      /* La columna ancha lleva el hilo (saldo → cifras → reparto → qué
         ha pasado); la estrecha, las acciones y el control del mes. */
      '<div class="dash">' +
        '<div class="dash__col stagger">' +
          (cardUpdate ? '<div style="--i:0">' + cardUpdate + '</div>' : "") +
          '<div style="--i:0">' + cardBalance + '</div>' +
          /* las acciones van pegadas a las tarjetas: en móvil todo se
             apila en una columna y deben quedar a mano, no al final */
          '<div style="--i:1">' + cardQuick + '</div>' +
          '<div style="--i:2">' + cardKpis + '</div>' +
          '<div style="--i:3">' + cardTiles + '</div>' +
          '<div style="--i:4">' + cardRecent + '</div>' +
        '</div>' +
        '<div class="dash__col stagger">' +
          '<div style="--i:1">' + cardLimit + '</div>' +
          '<div style="--i:2">' + cardUpcoming + '</div>' +
          '<div style="--i:3">' + cardBudgets + '</div>' +
        '</div>' +
      '</div>';

    mountIcons(root);

    $$("[data-spark]", root).forEach(function (node) {
      C.sparkline(node, JSON.parse(node.getAttribute("data-spark")), { height: 24 });
    });

    /* los puntos del carrusel siguen a la tarjeta centrada */
    var track = $("#cardsTrack", root);
    if (track) {
      var dots = $$("#cardsDots .cards__dot", root);
      track.addEventListener("scroll", function () {
        var i = Math.round(track.scrollLeft / (track.scrollWidth / dots.length));
        dots.forEach(function (d, di) { d.setAttribute("data-on", String(di === i)); });
      }, { passive: true });
    }

    var limitRing = $("[data-limit-ring]", root);
    if (limitRing) {
      C.progressRing(limitRing, parseFloat(limitRing.getAttribute("data-limit-ring")), {
        size: 46, stroke: 4, color: "#fff", track: "rgba(255,255,255,0.28)"
      });
    }

    var hero = $("#heroBalance", root);
    if (hero) U.countTo(hero, bal, bigAmount, 560);
  }

  function statTile(label, value, delta, polarity, sparkVals) {
    var dir = "flat", arrow = "", txt = "—";
    if (delta != null && isFinite(delta)) {
      var up = delta > 0.5, down = delta < -0.5;
      if (up || down) {
        arrow = up ? "trendUp" : "trendDown";
        dir = (polarity === "up-good" ? up : down) ? "good" : "bad";
        txt = (up ? "+" : "−") + Math.abs(Math.round(delta)) + " %";
      } else { txt = "sin cambios"; }
    }
    return '' +
      '<div class="stat">' +
        '<p class="stat__label">' + esc(label) + '</p>' +
        '<p class="stat__value">' + esc(S.moneyShort(value)) + '</p>' +
        '<p class="stat__delta" data-dir="' + dir + '">' +
          (arrow ? icon(arrow, 12) : "") + '<span>' + esc(txt) + '</span>' +
        '</p>' +
        '<div class="stat__spark" data-spark="' + esc(JSON.stringify(sparkVals)) + '"></div>' +
      '</div>';
  }

  function meterHtml(b, i) {
    var over = b.ratio > 1;
    var near = b.ratio > 0.85 && !over;
    /* el relleno lleva la severidad; el color de la partida cuando va bien */
    var fill = over ? "var(--status-critical)"
             : near ? "var(--status-warning)"
             : S.catColorVar(b);
    return '' +
      '<div class="meter">' +
        '<div class="meter__head">' +
          '<span class="meter__dot" style="background:' + fill + '"></span>' +
          '<span class="meter__label">' + esc(b.emoji || "") + ' ' + esc(b.name) + '</span>' +
          '<span class="meter__value">' + esc(S.moneyShort(b.spent)) + ' / ' +
            esc(S.moneyShort(b.limit)) + '</span>' +
        '</div>' +
        '<div class="meter__track">' +
          '<div class="meter__fill" style="width:' + Math.min(100, b.ratio * 100).toFixed(1) + '%;' +
            'background:' + fill + ';--delay:' + (i * 55 + 90) + 'ms"></div>' +
        '</div>' +
        /* el color de estado nunca va solo: siempre con icono y texto */
        (over
          ? '<p class="meter__foot">' + icon("warning", 11) + ' Te has pasado ' +
            esc(S.moneyShort(b.spent - b.limit)) + '</p>'
          : near
            ? '<p class="meter__foot">' + icon("warning", 11) + ' Al límite: quedan ' +
              esc(S.moneyShort(b.limit - b.spent)) + '</p>'
            : '<p class="meter__foot">Quedan ' + esc(S.moneyShort(b.limit - b.spent)) + '</p>') +
      '</div>';
  }

  function accName(id) {
    var a = S.state.accounts.find(function (x) { return x.id === id; });
    return a ? a.name : "—";
  }

  function txRowHtml(t) {
    var cat = catOf(t.categoryId);
    var isIn = t.kind === "in";

    /* un traspaso no es ingreso ni gasto: se marca aparte y su importe
       va en tinta neutra, sin signo de más ni de menos */
    if (t.kind === "transfer") {
      return '' +
        '<button type="button" class="row" data-tx="' + esc(t.id) + '">' +
          '<span class="avatar-letter" data-icon="swap" data-icon-size="18"></span>' +
          '<span class="row__body">' +
            '<span class="row__title">' + esc(t.note) + '</span>' +
            '<span class="row__meta">' + esc(accName(t.accountId)) + ' → ' +
              esc(accName(t.toAccountId)) + ' · ' + esc(S.relDayLabel(t.date)) + '</span>' +
          '</span>' +
          '<span class="row__amount" style="color:var(--text-secondary)">' +
            esc(money(t.amount)) + '</span>' +
        '</button>';
    }
    /* el emoji de la categoría hundido en el material, teñido con su
       color; el nombre de la categoría sigue leyéndose en la línea de abajo */
    return '' +
      '<button type="button" class="row" data-tx="' + esc(t.id) + '">' +
        catFace(cat, 18, "avatar-letter") +
        '<span class="row__body">' +
          '<span class="row__title">' + esc(t.note) + '</span>' +
          '<span class="row__meta">' + esc(cat.name) + ' · ' + esc(S.relDayLabel(t.date)) + '</span>' +
        '</span>' +
        '<span class="row__amount" data-kind="' + (isIn ? "in" : "out") + '">' +
          (isIn ? "+" : "−") + esc(money(t.amount)) +
        '</span>' +
      '</button>';
  }

  function emptyHtml(ic, title, text) {
    return '<div class="empty">' +
        '<span class="empty__icon" data-icon="' + ic + '" data-icon-size="20"></span>' +
        '<p class="empty__title">' + esc(title) + '</p>' +
        '<p class="empty__text">' + esc(text) + '</p>' +
      '</div>';
  }

  /* ============================================================
     Pantalla · Movimientos
     ============================================================ */

  function renderMovs() {
    var root = $("#view-movs");
    var key = movsMonth();
    var list = S.txOfMonth(key);

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
          '<button type="button" class="icon-btn" data-month="-1" aria-label="Mes anterior" ' +
                  'data-icon="chevLeft" data-icon-size="17"></button>' +
          '<div class="month-nav">' +
            '<p class="month-nav__label">' + esc(S.monthLabel(key)) + '</p>' +
            '<p class="month-nav__sub">' + list.length + ' movimiento' +
              (list.length === 1 ? "" : "s") + '</p>' +
          '</div>' +
          '<button type="button" class="icon-btn" data-month="1" aria-label="Mes siguiente" ' +
                  'data-icon="chevron" data-icon-size="17"' +
                  (ui.movsMonthOffset === 0 ? " disabled" : "") + '></button>' +
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

  /* ============================================================
     Pantalla · Análisis
     ============================================================ */

  function renderAnalisis() {
    var root = $("#view-analisis");
    var key = selectedMonth();
    var series = seriesEnding(key, ui.range);
    var cats = S.byCategory(key, "out");
    var t = S.totals(S.txOfMonth(key));
    var rate = S.savingsRate(key);
    var days = S.dailySpend(key);
    var merchants = S.topMerchants(key, 5);
    var avg = S.averageExpense(6);
    var projected = S.projectedExpense(key);

    var main =
      '<section class="card">' +
        '<div class="card__head">' +
          '<div>' +
            '<h2 class="card__title">Historial</h2>' +
            '<p class="card__sub">' +
              (ui.anView === "gastos" ? "Ingresos y gastos" : "Lo que ahorras cada mes") +
              ", " + ui.range + " meses en euros" + '</p>' +
          '</div>' +
          '<span class="mini-select" style="pointer-events:none">hasta ' +
            esc(S.monthLabel(key, "shortYear")) + '</span>' +
        '</div>' +
        '<div id="chartFlow"></div>' +
        /* con una sola serie no hace falta leyenda: el título ya la nombra */
        (ui.anView === "gastos"
          ? '<div class="legend">' +
              '<span class="legend__item"><span class="legend__key" style="background:var(--chart-ink)"></span>Gastos</span>' +
              '<span class="legend__item"><span class="legend__key" style="background:var(--deemphasis)"></span>Ingresos</span>' +
            '</div>'
          : "") +
        U.tableView("tblFlow", ["Mes", "Ingresos", "Gastos", "Ahorro"],
          series.map(function (m) {
            return [m.labelFull, money(m.income), money(m.expense), S.signed(m.net)];
          })) +
      '</section>' +

      '<section class="card">' +
        '<div class="card__head">' +
          '<div>' +
            '<h2 class="card__title">Ahorro por mes</h2>' +
            ''+
          '</div>' +
        '</div>' +
        '<div id="chartNet"></div>' +
        '<div class="legend">' +
          '<span class="legend__item"><span class="legend__key legend__key--swatch" style="background:var(--div-pos)"></span>Mes en positivo</span>' +
          '<span class="legend__item"><span class="legend__key legend__key--swatch" style="background:var(--div-neg)"></span>Mes en negativo</span>' +
        '</div>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card__head">' +
          '<div>' +
            '<h2 class="card__title">Ritmo del mes</h2>' +
            ''+
          '</div>' +
        '</div>' +
        '<div id="chartHeat"></div>' +
        U.tableView("tblHeat", ["Día", "Gastado"],
          days.filter(function (d) { return d.value > 0; })
              .map(function (d) { return [String(d.day), money(d.value)]; })) +
      '</section>';

    var side =
      '<section class="card">' +
        '<div class="card__head" style="margin-bottom:0">' +
          '<h2 class="card__title">Tasa de ahorro</h2>' +
          '<p class="card__sub">Objetivo 20 %</p>' +
        '</div>' +
        bigRing(rate) +
      '</section>' +

      '<section class="card">' +
        '<div class="card__head">' +
          '<div>' +
            '<h2 class="card__title">En qué se va</h2>' +
            '<p class="card__sub">' + esc(S.monthLabel(key)) + '</p>' +
          '</div>' +
        '</div>' +
        '<div id="chartCats"></div>' +
        U.tableView("tblCats", ["Categoría", "Importe", "Peso"],
          cats.map(function (c) {
            return [c.name, money(c.value),
                    t.expense ? Math.round((c.value / t.expense) * 100) + " %" : "0 %"];
          })) +
      '</section>' +

      '<section class="card">' +
        '<div class="card__head" style="margin-bottom:var(--sp-3)">' +
          '<h2 class="card__title">Dónde más gastas</h2>' +
          '<p class="card__sub">Top 5</p>' +
        '</div>' +
        (merchants.length
          ? '<div class="rank">' + merchants.map(function (m, i) {
              return '<div class="rank__item">' +
                '<div class="rank__head">' +
                  '<span class="rank__dot" style="background:' +
                    S.catColorVar(catOf(m.categoryId)) + '"></span>' +
                  '<span class="rank__name">' + esc(m.name) + '</span>' +
                  '<span class="rank__val">' + esc(money(m.value)) + '</span>' +
                  '<span class="rank__pct">' + m.count + '×</span>' +
                '</div>' +
                '<div class="rank__track">' +
                  '<div class="rank__fill" style="width:' +
                    ((m.value / merchants[0].value) * 100).toFixed(1) + '%;background:' +
                    S.catColorVar(catOf(m.categoryId)) + ';--delay:' + (i * 45 + 60) + 'ms"></div>' +
                '</div>' +
              '</div>';
            }).join("") + '</div>'
          : '<p class="chart-note">Aún no hay gastos este mes.</p>') +
      '</section>' +

      '<section class="card">' +
        '<div class="card__head" style="margin-bottom:0">' +
          '<h2 class="card__title">Lo que dicen tus números</h2>' +
        '</div>' +
        insights({ key: key, t: t, cats: cats, rate: rate, avg: avg, projected: projected }) +
      '</section>';

    /* Cifra centrada y, debajo, UNA sola zona de filtros que ordena todo
       lo que viene después: el mes, qué serie se mira y cuánto histórico. */
    var RANGES = [{ n: 3, l: "3M" }, { n: 6, l: "6M" }, { n: 12, l: "12M" }, { n: 24, l: "Todo" }];

    root.innerHTML =
      '<div class="hero-center">' +
        '<p class="hero-center__label">Saldo total</p>' +
        '<p class="hero-center__value">' + bigAmount(S.balance()) + '</p>' +
      '</div>' +

      '<div class="filter-row" style="flex-direction:column;align-items:stretch;gap:var(--sp-3)">' +
        '<div style="display:flex;align-items:center;gap:var(--sp-2)">' +
          '<button type="button" class="icon-btn" data-amonth="-1" aria-label="Mes anterior" ' +
                  'data-icon="chevLeft" data-icon-size="17"></button>' +
          '<div class="month-nav">' +
            '<p class="month-nav__label">' + esc(S.monthLabel(key)) + '</p>' +
            '<p class="month-nav__sub">' + esc(money(t.expense)) + ' gastados</p>' +
          '</div>' +
          '<button type="button" class="icon-btn" data-amonth="1" aria-label="Mes siguiente" ' +
                  'data-icon="chevron" data-icon-size="17"' +
                  (ui.monthOffset === 0 ? " disabled" : "") + '></button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)">' +
          '<div class="segmented" id="anSeg" role="tablist">' +
            '<span class="segmented__thumb" id="anThumb" aria-hidden="true"></span>' +
            '<button type="button" class="segmented__btn" role="tab" data-anview="ahorro" ' +
                    'aria-selected="' + (ui.anView === "ahorro") + '">Ahorro</button>' +
            '<button type="button" class="segmented__btn" role="tab" data-anview="gastos" ' +
                    'aria-selected="' + (ui.anView === "gastos") + '">Gastos</button>' +
          '</div>' +
          '<div class="range-pills" role="group" aria-label="Periodo del histórico">' +
            RANGES.map(function (r) {
              return '<button type="button" class="range-pill" data-range="' + r.n + '" ' +
                     'aria-pressed="' + (ui.range === r.n) + '">' + r.l + '</button>';
            }).join("") +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="dash section-gap">' +
        '<div class="dash__col stagger">' + wrapStagger(main) + '</div>' +
        '<div class="dash__col stagger">' + wrapStagger(side) + '</div>' +
      '</div>';

    mountIcons(root);

    C.lineChart($("#chartFlow", root), {
      data: series,
      /* Forma de énfasis en vez de paleta categórica: la serie que
         cuenta va en tinta y el contexto en gris. Es lo que mantiene
         el gráfico dentro de la escala de grises sin perder identidad
         (van con leyenda, etiqueta directa y vista de tabla). */
      series: ui.anView === "gastos"
        ? [{ key: "expense", name: "Gastos", color: "var(--chart-ink)" },
           { key: "income", name: "Ingresos", color: "var(--deemphasis)" }]
        : [{ key: "net", name: "Ahorro", color: "var(--chart-ink)" }],
      format: money,
      smooth: true,
      gradient: true,
      thick: 3,
      height: isDesktop() ? 190 : 155,
      ariaLabel: ui.anView === "gastos"
        ? "Ingresos y gastos de los últimos 12 meses"
        : "Ahorro de los últimos 12 meses"
    });

    C.divergingColumns($("#chartNet", root), {
      data: series.map(function (m) {
        return { label: m.label, labelFull: m.labelFull, value: m.net };
      }),
      format: S.signed,
      height: isDesktop() ? 170 : 130,
      ariaLabel: "Ahorro neto por mes"
    });

    C.stackedBreakdown($("#chartCats", root), cats, { format: money });
    C.heatmap($("#chartHeat", root), days, { format: money });

    var big = $("[data-big-ring]", root);
    if (big) {
      C.progressRing(big, parseFloat(big.getAttribute("data-big-ring")), {
        size: isDesktop() ? 190 : 168,
        stroke: 14,
        label: false,
        track: "var(--surface-2)",
        color: big.getAttribute("data-big-color")
      });
    }

    requestAnimationFrame(function () {
      var seg = $("#anSeg", root);
      if (seg) U.slideIndicator(seg, $("#anThumb", root),
        $('[data-anview="' + ui.anView + '"]', seg));
    });
  }

  /* envuelve cada <section> de primer nivel para escalonar su entrada */
  function wrapStagger(html) {
    var parts = html.split("</section>").filter(function (p) { return p.trim(); });
    return parts.map(function (p, i) {
      return '<div style="--i:' + i + '">' + p + '</section></div>';
    }).join("");
  }

  /* Anillo grande hundido en el material, como el 76 % de la referencia.
     El relleno lleva la severidad y el pie de texto la explica: el color
     nunca va solo. */
  function bigRing(rate) {
    var target = 20;
    var ratio = Math.max(0, Math.min(1, rate / (target * 2)));
    var color = rate < 0 ? "var(--status-critical)"
              : rate < 10 ? "var(--status-warning)"
              : "var(--accent)";
    return '' +
      '<div class="big-ring">' +
        '<div class="big-ring__well">' +
          '<div class="ring" data-big-ring="' + ratio + '" ' +
               'data-big-color="' + color + '"></div>' +
          '<div class="big-ring__inner">' +
            '<div>' +
              /* el número va sin recortar: si el mes es negativo, el
                 anillo vacío y el signo dicen lo mismo y es la verdad */
              '<p class="big-ring__pct">' + (rate < 0 ? "−" : "") +
                Math.abs(Math.round(rate)) + ' %</p>' +
              '<p class="big-ring__cap">' +
                (rate < 0 ? "no ahorraste nada" : "de lo que ingresas") + '</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<p class="meter__foot" style="justify-content:center">' +
        (rate < 0
          ? icon("warning", 12) + " Este mes gastaste más de lo que entró."
          : rate >= target
            ? icon("check", 12) + " Por encima del objetivo del 20 %."
            : icon("info", 12) + " Faltan " + esc(S.num2.format(target - rate)) +
              " puntos para el objetivo.") +
      '</p>';
  }

  function rateMeter(rate) {
    var target = 20;
    var ratio = Math.max(0, Math.min(1, rate / (target * 2)));
    var fill = rate < 0 ? "var(--status-critical)"
             : rate < 10 ? "var(--status-warning)"
             : "var(--accent)";
    return '' +
      '<div class="meter">' +
        '<div class="meter__head">' +
          '<span class="meter__dot" style="background:' + fill + '"></span>' +
          '<span class="meter__label">De cada 100 € que entran, ahorras ' +
            esc(S.num2.format(Math.max(0, rate))) + ' €</span>' +
        '</div>' +
        '<div class="meter__track">' +
          '<div class="meter__fill" style="width:' + (ratio * 100).toFixed(1) +
            '%;background:' + fill + '"></div>' +
        '</div>' +
        '<p class="meter__foot">' +
          (rate < 0 ? "Este mes has gastado más de lo que ingresaste."
           : rate >= target ? "Por encima del objetivo del 20 %."
           : "Faltan " + S.num2.format(target - rate) + " puntos para el objetivo.") +
        '</p>' +
      '</div>';
  }

  function insights(d) {
    var out = [];
    var elapsedDays = d.key === S.currentMonthKey() ? new Date().getDate() : 0;

    if (elapsedDays >= 5 && d.avg > 0) {
      var pctDiff = Math.round(((d.projected - d.avg) / d.avg) * 100);
      out.push({
        status: Math.abs(pctDiff) < 8 ? "neutral" : (pctDiff > 0 ? "warning" : "good"),
        ic: Math.abs(pctDiff) < 8 ? "info" : (pctDiff > 0 ? "warning" : "check"),
        title: "Vas camino de cerrar el mes en " + S.moneyShort(d.projected),
        text: (Math.abs(pctDiff) < 8
          ? "En línea con tu media de los últimos 6 meses (" + S.moneyShort(d.avg) + ")."
          : pctDiff > 0
            ? "Un " + pctDiff + " % por encima de tu media de 6 meses (" + S.moneyShort(d.avg) + ")."
            : "Un " + Math.abs(pctDiff) + " % por debajo de tu media de 6 meses (" + S.moneyShort(d.avg) + ").") +
          " Calculado sobre cuánto sueles llevar gastado a estas alturas del mes."
      });
    }

    if (d.cats.length && d.t.expense > 0) {
      var top = d.cats[0];
      var share = Math.round((top.value / d.t.expense) * 100);
      out.push({
        status: share > 45 ? "warning" : "neutral",
        ic: share > 45 ? "warning" : "trendUp",
        title: top.name + " se lleva el " + share + " % de tus gastos",
        text: S.moneyShort(top.value) + " de " + S.moneyShort(d.t.expense) + " este mes." +
              (share > 45 ? " Es la partida donde más margen tienes para recortar." : "")
      });
    }

    out.push({
      status: d.rate < 0 ? "critical" : d.rate >= 20 ? "good" : "warning",
      ic: d.rate < 0 ? "warning" : d.rate >= 20 ? "check" : "info",
      title: d.rate < 0 ? "Mes en números rojos"
                        : "Ahorras el " + Math.round(d.rate) + " % de lo que ingresas",
      text: d.rate < 0
        ? "Gastaste " + S.moneyShort(Math.abs(d.t.net)) + " más de lo que entró."
        : d.rate >= 20
          ? "Estás por encima del 20 % que se suele recomendar."
          : "Subirlo al 20 % serían " + S.moneyShort(d.t.income * 0.2) + " al mes."
    });

    var over = [];
    d.cats.forEach(function (c) {
      var lim = S.budgetFor(c.id);
      if (lim && c.value > lim) over.push(c.name);
    });
    if (over.length) {
      out.push({
        status: "critical", ic: "warning",
        title: over.length === 1 ? "Te has pasado en " + over[0]
                                 : "Te has pasado en " + over.length + " partidas",
        text: over.join(", ") + ". Puedes reajustar los porcentajes en Ajustes."
      });
    }

    return out.map(function (o) {
      return '<div class="insight" data-status="' + o.status + '">' +
          '<span class="insight__icon" data-icon="' + o.ic + '" data-icon-size="15"></span>' +
          '<span class="insight__body">' +
            '<span class="insight__title">' + esc(o.title) + '</span>' +
            '<span class="insight__text">' + esc(o.text) + '</span>' +
          '</span>' +
        '</div>';
    }).join("");
  }

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
          return '<button type="button" class="account" data-form="account" ' +
                  'data-form-id="' + esc(a.id) + '" style="width:100%;text-align:left">' +
              '<span class="account__badge" data-icon="' + esc(a.icon || "wallet") +
                    '" data-icon-size="17"></span>' +
              '<span class="account__body">' +
                '<span class="account__name">' + esc(a.name) + '</span>' +
                '<span class="account__type">' + esc(a.type) + '</span>' +
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
                    : catFace(catOf(r.categoryId), 17, "account__badge")) +
                  '<button type="button" class="account__body" data-form="recurring" ' +
                          'data-form-id="' + esc(r.id) + '" style="text-align:left">' +
                    '<span class="account__name">' + esc(r.note) + '</span>' +
                    '<span class="account__type">' +
                      (r.active ? "Cada día " + r.day + " · próximo " +
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
        size: 50, stroke: 5, color: C.seriesColor(+node.getAttribute("data-slot"))
      });
    });
  }

  /* ============================================================
     Sheet de formulario: cuentas, metas y programados
     ============================================================ */

  /* El formulario trabaja siempre sobre un borrador en memoria. Leer los
     valores del DOM al guardar fallaba al repintar (por ejemplo al
     cambiar el tipo de un programado, que cambia qué campos existen). */
  var form = null;   /* { type, id, d } */

  function openForm(type, id, opts) {
    var it = id ? findFor(type, id) : null;
    var accs = S.state.accounts;
    var d;

    if (type === "category") {
      d = it ? { name: it.name, emoji: it.emoji, color: it.color, kind: it.kind }
             : { name: "", emoji: "🏷️", color: 1,
                 kind: (opts && opts.kind === "in") ? "in" : "out" };
    } else if (type === "account") {
      d = it
        ? { name: it.name, type: it.type, opening: it.opening,
            icon: it.icon || "wallet", color: it.color || 1 }
        : { name: "", type: "Banco", opening: 0, icon: "wallet",
            color: ((S.state.accounts.length * 5) % S.CAT_COLORS) + 1 };
    } else if (type === "goal") {
      d = it ? { name: it.name, target: it.target, saved: it.saved, monthly: it.monthly }
             : { name: "", target: "", saved: 0, monthly: "" };
    } else {
      d = it
        ? { kind: it.kind, note: it.note, amount: it.amount, day: it.day,
            categoryId: it.categoryId, accountId: it.accountId,
            toAccountId: it.toAccountId || (accs[1] || accs[0]).id }
        : { kind: "out", note: "", amount: "", day: 1, categoryId: "hogar",
            accountId: accs[0].id, toAccountId: (accs[1] || accs[0]).id };
    }

    form = { type: type, id: id || null, d: d };

    $("#sheetFormTitle").textContent = {
      account: id ? "Editar cuenta" : "Nueva cuenta",
      goal: id ? "Editar meta" : "Nueva meta",
      recurring: id ? "Editar programado" : "Nuevo programado",
      category: id ? "Editar categoría" : "Nueva categoría"
    }[type] || "Editar";

    renderForm();
    sheets.form.show();
  }

  function findFor(type, id) {
    if (type === "category") return S.state.categories.find(function (x) { return x.id === id; });
    if (type === "account") return S.state.accounts.find(function (x) { return x.id === id; });
    if (type === "goal") return S.state.goals.find(function (x) { return x.id === id; });
    return (S.state.recurring || []).find(function (x) { return x.id === id; });
  }

  function numField(id, label, value, step, suffix) {
    return '<div>' +
        '<label class="field__label" for="' + id + '">' + esc(label) + '</label>' +
        '<div class="input-affix">' +
          '<input type="number" class="field__input" id="' + id + '" data-f="' +
            id.slice(1) + '" min="0" step="' + step + '" inputmode="decimal" value="' +
            esc(value === "" || value == null ? "" : value) + '">' +
          '<span class="input-affix__suffix">' + (suffix || "€") + '</span>' +
        '</div>' +
      '</div>';
  }

  /* Un puñado de emojis a mano para escritorio, donde no hay teclado de
     emoji. En el móvil el campo de texto abre el del sistema y hay todos. */
  var EMOJI_SUGERIDOS = [
    "🍽️", "🛒", "☕", "🍺", "⛽", "🚗", "🚌", "✈️",
    "🏠", "💡", "📶", "🛍️", "👕", "🎬", "🎮", "🎁",
    "💊", "🏥", "🏋️", "📚", "🐶", "🧾", "🔧", "💼",
    "💰", "🏦", "📈", "🎓", "✂️", "🧼", "🍼", "🏷️"
  ];

  function renderForm() {
    var body = $("#sheetFormBody");
    var t = form.type, d = form.d;
    var html = "";

    if (t === "category") {
      var colores = [];
      for (var ci = 1; ci <= S.CAT_COLORS; ci++) colores.push(ci);

      html =
        (form.id
          ? ""
          : '<div class="segmented" id="fSeg" role="tablist">' +
              '<span class="segmented__thumb" id="fThumb" aria-hidden="true"></span>' +
              '<button type="button" class="segmented__btn" role="tab" data-fkind="out" ' +
                      'aria-selected="' + (d.kind === "out") + '">Gasto</button>' +
              '<button type="button" class="segmented__btn" role="tab" data-fkind="in" ' +
                      'aria-selected="' + (d.kind === "in") + '">Ingreso</button>' +
            '</div>') +

        '<div class="field">' +
          '<span class="field__label">Así se verá</span>' +
          '<div class="cat-preview">' +
            '<span class="cat-preview__face cat-face" id="fPreview" ' +
                  'style="--cat-color:var(--cat-' + d.color + ')" aria-hidden="true">' +
              esc(d.emoji) + '</span>' +
            '<span class="cat-preview__name" id="fPreviewName">' +
              esc(d.name || "Sin nombre") + '</span>' +
          '</div>' +
        '</div>' +

        '<div class="field">' +
          '<label class="field__label" for="fName">Nombre</label>' +
          '<input type="text" class="field__input" id="fName" data-f="Name" maxlength="24" ' +
                 'placeholder="Gasolina" value="' + esc(d.name) + '">' +
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
          '<p class="field__hint">Escribe el que quieras o elige uno de arriba.</p>' +
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

    if (t === "account") {
      html =
        '<div class="field">' +
          '<label class="field__label" for="fName">Nombre</label>' +
          '<input type="text" class="field__input" id="fName" data-f="Name" maxlength="28" ' +
                 'placeholder="Cuenta corriente" value="' + esc(d.name) + '">' +
        '</div>' +
        '<div class="field__row" style="margin-top:var(--sp-5)">' +
          '<div>' +
            '<label class="field__label" for="fType">Tipo</label>' +
            '<select class="field__input" id="fType" data-f="Type">' +
              ["Banco", "Ahorro", "Efectivo", "Tarjeta"].map(function (x) {
                return '<option' + (d.type === x ? " selected" : "") + '>' + x + '</option>';
              }).join("") +
            '</select>' +
          '</div>' +
          numField("fOpening", "Saldo inicial", d.opening, 10) +
        '</div>' +
        '<div class="field">' +
          '<span class="field__label">Icono</span>' +
          '<div class="cat-grid">' +
            ["wallet", "piggy", "cash", "target"].map(function (ic) {
              return '<button type="button" class="cat-pick" data-picon="' + ic + '" ' +
                       'aria-pressed="' + (d.icon === ic) + '">' +
                  '<span class="cat-pick__icon" data-icon="' + ic + '" data-icon-size="18"></span>' +
                '</button>';
            }).join("") +
          '</div>' +
        '</div>' +

        '<div class="field">' +
          '<span class="field__label">Color de la tarjeta</span>' +
          '<div class="card-preview" id="fCardPreview" ' +
               'style="--acc-color:var(--cat-' + d.color + ')">' +
            '<span class="card-preview__name" id="fCardName">' +
              esc(d.name || "Tu cuenta") + '</span>' +
            '<span class="card-preview__mark" aria-hidden="true">' +
              '<span></span><span></span></span>' +
          '</div>' +
          '<div class="swatch-grid" style="margin-top:var(--sp-3)">' +
            (function () {
              var out = [];
              for (var n = 1; n <= S.CAT_COLORS; n++) {
                out.push('<button type="button" class="swatch" data-pcolor="' + n + '" ' +
                           'style="background:var(--cat-' + n + ')" ' +
                           'aria-pressed="' + (n === d.color) + '" ' +
                           'aria-label="Color ' + n + '"></button>');
              }
              return out.join("");
            })() +
          '</div>' +
        '</div>';
    }

    if (t === "goal") {
      html =
        '<div class="field">' +
          '<label class="field__label" for="fName">Nombre</label>' +
          '<input type="text" class="field__input" id="fName" data-f="Name" maxlength="32" ' +
                 'placeholder="Colchón de emergencia" value="' + esc(d.name) + '">' +
        '</div>' +
        '<div class="field__row" style="margin-top:var(--sp-5)">' +
          numField("fTarget", "Objetivo", d.target, 50) +
          numField("fSaved", "Ya ahorrado", d.saved, 10) +
        '</div>' +
        '<div class="field">' +
          numField("fMonthly", "Aportación mensual", d.monthly, 10) +
          ''+
        '</div>';
    }

    if (t === "recurring") {
      var cats = S.CATEGORIES.filter(function (c) {
        return c.kind === (d.kind === "in" ? "in" : "out");
      });
      var mismaCuenta = d.kind === "transfer" && d.accountId === d.toAccountId;

      html =
        '<div class="segmented" id="fSeg" role="tablist">' +
          '<span class="segmented__thumb" id="fThumb" aria-hidden="true"></span>' +
          '<button type="button" class="segmented__btn" role="tab" data-fkind="out" ' +
                  'aria-selected="' + (d.kind === "out") + '">Pago</button>' +
          '<button type="button" class="segmented__btn" role="tab" data-fkind="in" ' +
                  'aria-selected="' + (d.kind === "in") + '">Cobro</button>' +
          '<button type="button" class="segmented__btn" role="tab" data-fkind="transfer" ' +
                  'aria-selected="' + (d.kind === "transfer") + '">Ahorro</button>' +
        '</div>' +

        '<div class="field">' +
          '<label class="field__label" for="fName">Concepto</label>' +
          '<input type="text" class="field__input" id="fName" data-f="Name" maxlength="32" ' +
                 'placeholder="' + (d.kind === "in" ? "Nómina" :
                   d.kind === "transfer" ? "Ahorro del mes" : "Alquiler") + '" ' +
                 'value="' + esc(d.note) + '">' +
        '</div>' +

        '<div class="field__row" style="margin-top:var(--sp-5)">' +
          numField("fAmount", "Importe", d.amount, 5) +
          '<div>' +
            '<label class="field__label" for="fDay">Día del mes</label>' +
            '<input type="number" class="field__input" id="fDay" data-f="Day" min="1" max="28" ' +
                   'step="1" inputmode="numeric" value="' + esc(d.day) + '">' +
          '</div>' +
        '</div>' +

        (d.kind === "transfer"
          ? '<div class="field__row" style="margin-top:var(--sp-5)">' +
              '<div>' +
                '<label class="field__label" for="fAccount">Desde</label>' +
                accountSelect("fAccount", d.accountId) +
              '</div>' +
              '<div>' +
                '<label class="field__label" for="fToAccount">Hacia</label>' +
                accountSelect("fToAccount", d.toAccountId) +
              '</div>' +
            '</div>'
          : '<div class="field__row" style="margin-top:var(--sp-5)">' +
              '<div>' +
                '<label class="field__label" for="fCat">Categoría</label>' +
                '<select class="field__input" id="fCat" data-f="Cat">' +
                  cats.map(function (c) {
                    return '<option value="' + esc(c.id) + '"' +
                           (d.categoryId === c.id ? " selected" : "") + '>' +
                           esc(c.name) + '</option>';
                  }).join("") +
                '</select>' +
              '</div>' +
              '<div>' +
                '<label class="field__label" for="fAccount">Cuenta</label>' +
                accountSelect("fAccount", d.accountId) +
              '</div>' +
            '</div>') +

        '<p class="field__hint">' +
          (mismaCuenta
            ? icon("warning", 12) + " Elige dos cuentas distintas."
            : "Se apunta solo cada mes. Máximo día 28." +
              "") +
        '</p>';
    }

    var bloqueado = t === "recurring" && d.kind === "transfer" &&
                    d.accountId === d.toAccountId;

    body.innerHTML = html +
      '<div class="field" style="margin-top:var(--sp-6)">' +
        '<button type="button" class="btn btn--primary" id="fSave"' +
          (bloqueado ? " disabled" : "") + '>' +
          icon("check", 17) + (form.id ? "Guardar cambios" : "Crear") + '</button>' +
      '</div>' +
      (form.id
        ? '<div class="field">' +
            '<button type="button" class="btn btn--danger" id="fDelete" style="width:100%">' +
              icon("trash", 16) + 'Eliminar</button>' +
          '</div>'
        : "");

    mountIcons(body);
    requestAnimationFrame(function () {
      var seg = $("#fSeg", body);
      if (seg) U.slideIndicator(seg, $("#fThumb", body),
        $('[data-fkind="' + d.kind + '"]', seg));
    });
  }

  /* La vista previa se actualiza sola al teclear o al tocar un color, sin
     repintar el formulario: hacerlo dejaría el campo de texto sin foco. */
  function refreshCatPreview() {
    var face = $("#fPreview");
    if (!face) return;
    face.textContent = form.d.emoji || "📦";
    face.style.setProperty("--cat-color", "var(--cat-" + form.d.color + ")");
    var nameEl = $("#fPreviewName");
    if (nameEl) nameEl.textContent = String(form.d.name || "").trim() || "Sin nombre";
  }

  /* vista previa de la tarjeta en el formulario de cuenta */
  function refreshCardPreview() {
    var box = $("#fCardPreview");
    if (!box) return;
    box.style.setProperty("--acc-color", "var(--cat-" + form.d.color + ")");
    var nombre = $("#fCardName");
    if (nombre) nombre.textContent = String(form.d.name || "").trim() || "Tu cuenta";
  }

  function saveForm() {
    var t = form.type, id = form.id, d = form.d;

    if (t === "category") {
      if (!String(d.name).trim()) {
        U.toast("Ponle un nombre a la categoría", { icon: "warning" }); return;
      }
      var cat = id ? S.updateCategory(id, d) : S.addCategory(d);
      U.toast(id ? "Categoría actualizada" : "Categoría creada", { icon: "check" });

      /* si se creó desde el selector del movimiento, se vuelve allí con
         la nueva ya elegida y el importe que se llevaba tecleado */
      if (!id && ui.catReturnToAdd) {
        ui.catReturnToAdd = false;
        ui.draft.categoryId = cat.id;
        sheets.form.close();
        renderAddSheet();
        sheets.add.show();
        return;
      }
    }

    if (t === "account") {
      if (!String(d.name).trim()) {
        U.toast("Ponle un nombre a la cuenta", { icon: "warning" }); return;
      }
      if (id) S.updateAccount(id, d); else S.addAccount(d);
      U.toast(id ? "Cuenta actualizada" : "Cuenta creada", { icon: "check" });
    }

    if (t === "goal") {
      if (!String(d.name).trim()) {
        U.toast("Ponle un nombre a la meta", { icon: "warning" }); return;
      }
      if (!(parseFloat(d.target) > 0)) {
        U.toast("El objetivo tiene que ser mayor que cero", { icon: "warning" }); return;
      }
      if (id) S.updateGoal(id, d); else S.addGoal(d);
      U.toast(id ? "Meta actualizada" : "Meta creada", { icon: "check" });
    }

    if (t === "recurring") {
      if (!String(d.note).trim()) {
        U.toast("Ponle un concepto", { icon: "warning" }); return;
      }
      if (!(parseFloat(d.amount) > 0)) {
        U.toast("El importe tiene que ser mayor que cero", { icon: "warning" }); return;
      }
      var data = {
        kind: d.kind, note: d.note, amount: d.amount, day: d.day,
        accountId: d.accountId,
        toAccountId: d.kind === "transfer" ? d.toAccountId : null,
        categoryId: d.kind === "transfer" ? "otros" : d.categoryId
      };
      if (id) S.updateRecurring(id, data); else S.addRecurring(data);
      U.toast(id ? "Programado actualizado" : "Programado creado", { icon: "check" });
    }

    sheets.form.close();
    S.runRecurring();
    renderAll();
  }

  function deleteForm() {
    var t = form.type, id = form.id;

    if (t === "category") {
      var resCat = S.deleteCategory(id);
      if (!resCat.ok) { U.toast(resCat.reason, { icon: "warning", duration: 5500 }); return; }
      U.toast("Categoría eliminada", { icon: "check" });
    }

    if (t === "account") {
      var res = S.deleteAccount(id);
      if (!res.ok) { U.toast(res.reason, { icon: "warning", duration: 5500 }); return; }
      U.toast("Cuenta eliminada", { icon: "check" });
    }
    if (t === "goal") {
      if (!confirm("¿Eliminar esta meta?")) return;
      S.deleteGoal(id);
      U.toast("Meta eliminada", { icon: "check" });
    }
    if (t === "recurring") {
      if (!confirm("¿Eliminar este programado? Los movimientos ya apuntados se quedan.")) return;
      S.deleteRecurring(id);
      U.toast("Programado eliminado", { icon: "check" });
    }

    sheets.form.close();
    renderAll();
  }

  /* ============================================================
     Pantalla · Ajustes — ingresos y reparto del sueldo
     ============================================================ */

  function renderAjustes() {
    var root = $("#view-ajustes");
    var inc = S.state.income;
    var planned = S.plannedIncome();
    var sum = S.allocationSum();
    var savings = S.savingsPct();
    var theme = S.getTheme();
    var cats = S.CATEGORIES.filter(function (c) { return c.kind === "out"; });

    var media = S.averageIncome(inc.months);
    var esAuto = inc.mode !== "manual";

    var main =
      '<section class="card">' +
        '<div class="card__head">' +
          '<h2 class="card__title">Cuánto cuentas al mes</h2>' +
        '</div>' +

        '<div class="segmented" id="incSeg" role="tablist">' +
          '<span class="segmented__thumb" id="incThumb" aria-hidden="true"></span>' +
          '<button type="button" class="segmented__btn" role="tab" data-incmode="auto" ' +
                  'aria-selected="' + esAuto + '">Automático</button>' +
          '<button type="button" class="segmented__btn" role="tab" data-incmode="manual" ' +
                  'aria-selected="' + !esAuto + '">Manual</button>' +
        '</div>' +

        (esAuto
          ? '<div class="hero-center" style="padding:var(--sp-5) 0 var(--sp-3)">' +
              '<p class="hero-center__value">' + bigAmount(planned) + '</p>' +
              '<p class="card__sub" style="margin-top:var(--sp-2)">' +
                (media > 0
                  ? "Media de tus últimos " + inc.months + " meses"
                  : "Aún sin historial: se usa la cifra manual") + '</p>' +
            '</div>' +
            '<div class="field">' +
              '<label class="field__label" for="incMonths">Meses que promedia</label>' +
              '<select class="field__input" id="incMonths">' +
                [3, 6, 12].map(function (n) {
                  return '<option value="' + n + '"' +
                         (inc.months === n ? " selected" : "") + '>' + n + ' meses</option>';
                }).join("") +
              '</select>' +
            '</div>'
          : '<div class="field">' +
              '<label class="field__label" for="incManual">Tu cifra</label>' +
              '<div class="input-affix">' +
                '<input type="number" class="field__input" id="incManual" min="0" step="50" ' +
                       'inputmode="decimal" value="' + inc.manual + '">' +
                '<span class="input-affix__suffix">€</span>' +
              '</div>' +
            '</div>') +
      '</section>' +

      '<section class="card">' +
        '<div class="card__head">' +
          '<div>' +
            '<h2 class="card__title">Reparto</h2>' +
            '<p class="card__sub">Lo que sobra va a ahorro</p>' +
          '</div>' +
          '<button type="button" class="card__link" id="allocReset">Restablecer</button>' +
        '</div>' +

        '<div class="alloc-bar" id="allocBar" role="img" aria-label="Reparto del sueldo"></div>' +

        '<div class="alloc-head">' +
          '<p class="card__sub" id="allocSummary"></p>' +
          '<p class="alloc-total" id="allocTotal"></p>' +
        '</div>' +

        '<div id="allocRows">' +
          cats.map(function (c) {
            var pct = S.state.allocation[c.id] || 0;
            return '<div class="alloc-row">' +
                '<div class="alloc-row__head">' +
                  '<span class="alloc-row__dot" style="background:' + S.catColorVar(c) + '"></span>' +
                  '<span class="alloc-row__name">' + esc(c.emoji || "") + ' ' + esc(c.name) + '</span>' +
                  '<span class="alloc-row__eur" data-alloc-eur="' + c.id + '">' +
                    esc(S.moneyShort(S.budgetFor(c.id))) + '</span>' +
                  '<span class="alloc-row__pct" data-alloc-pct="' + c.id + '">' + pct + ' %</span>' +
                '</div>' +
                '<input type="range" class="range" data-alloc="' + c.id + '" ' +
                       'min="0" max="60" step="1" value="' + pct + '" ' +
                       'style="--range-color:' + S.catColorVar(c) +
                         ';--fill:' + ((pct / 60) * 100).toFixed(1) + '" ' +
                       'aria-label="Porcentaje para ' + esc(c.name) + '">' +
              '</div>';
          }).join("") +
        '</div>' +

        U.tableView("tblAllocSet", ["Partida", "Porcentaje", "Al mes"],
          cats.map(function (c) {
            return [c.name, (S.state.allocation[c.id] || 0) + " %", money(S.budgetFor(c.id))];
          }).concat([["Ahorro", savings + " %", money(Math.round(planned * savings / 100))]])) +
      '</section>';

    var side =
      '<section class="card card--flush">' +
        '<div class="card__head card__pad--tight" style="margin-bottom:0">' +
          '<h2 class="card__title">Apariencia</h2>' +
        '</div>' +
        settingRow("sun", "Tema", themeLabel(theme), "theme", themeShort(theme)) +
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
                    catFace(c, 17, "cat-list__face") +
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
        $('[data-incmode="' + (esAuto ? "auto" : "manual") + '"]', seg));
    });
  }

  function themeLabel(t) {
    return t === "dark" ? "Oscuro" : t === "light" ? "Claro" : "Automático, como el sistema";
  }
  function themeShort(t) {
    return t === "dark" ? "Oscuro" : t === "light" ? "Claro" : "Automático";
  }

  function settingRow(ic, label, hint, action, value) {
    return '<button type="button" class="setting" data-setting="' + action + '">' +
        '<span class="setting__icon" data-icon="' + ic + '" data-icon-size="15"></span>' +
        '<span class="setting__body">' +
          '<span class="setting__label">' + esc(label) + '</span>' +
          '<span class="setting__hint">' + esc(hint) + '</span>' +
        '</span>' +
        (value ? '<span class="setting__value">' + esc(value) + '</span>' : "") +
        '<span class="setting__chev" data-icon="chevron" data-icon-size="14"></span>' +
      '</button>';
  }

  /* repinta solo las partes vivas del reparto, sin perder el foco del slider */
  function refreshAllocation() {
    var planned = S.plannedIncome();
    var sum = S.allocationSum();
    var savings = S.savingsPct();
    var bar = $("#allocBar");
    var total = $("#allocTotal");
    var summary = $("#allocSummary");
    if (!bar) return;

    var segs = S.CATEGORIES.filter(function (c) { return c.kind === "out"; })
      .map(function (c) {
        return { pct: S.state.allocation[c.id] || 0, color: c.color, name: c.name };
      })
      .filter(function (r) { return r.pct > 0; })
      .sort(function (a, b) { return b.pct - a.pct; });

    bar.innerHTML = segs.map(function (r) {
      return '<span class="alloc-bar__seg" style="flex:' + r.pct + ';background:' +
             S.catColorVar(r) + '" title="' + esc(r.name) + ' · ' + r.pct + ' %"></span>';
    }).join("") + (savings > 0
      ? '<span class="alloc-bar__seg alloc-bar__seg--rest" style="flex:' + savings +
        '" title="Ahorro · ' + savings + ' %"></span>'
      : "");

    var state = sum > 100 ? "over" : sum === 100 ? "ok" : "under";
    total.setAttribute("data-state", state);
    total.textContent = sum + " % repartido";

    summary.innerHTML = sum > 100
      ? "Te has pasado " + (sum - 100) + " puntos. Baja alguna partida."
      : "Quedan <strong>" + savings + " %</strong> para ahorro, " +
        esc(S.moneyShort(Math.round(planned * savings / 100))) + " al mes.";

    $$("[data-alloc-eur]").forEach(function (n) {
      n.textContent = S.moneyShort(S.budgetFor(n.getAttribute("data-alloc-eur")));
    });
    $$("[data-alloc-pct]").forEach(function (n) {
      n.textContent = (S.state.allocation[n.getAttribute("data-alloc-pct")] || 0) + " %";
    });
    $$("[data-alloc]").forEach(function (n) {
      n.style.setProperty("--fill", ((n.value / (+n.max || 60)) * 100).toFixed(1));
    });
  }

  function bindAjustes() {
    var root = $("#view-ajustes");

    root.addEventListener("input", function (e) {
      if (e.target.id === "incManual") {
        S.setIncome({ manual: e.target.value });
        refreshAllocation();
      } else if (e.target.matches("[data-alloc]")) {
        S.setAllocation(e.target.getAttribute("data-alloc"), +e.target.value);
        refreshAllocation();
      }
    });

    root.addEventListener("change", function (e) {
      if (e.target.id !== "incMonths") return;
      S.setIncome({ months: +e.target.value });
      renderAjustes();
    });

    root.addEventListener("click", function (e) {
      var node = e.target.closest("[data-incmode]");
      if (!node) return;
      S.setIncome({ mode: node.getAttribute("data-incmode") });
      renderAjustes();
      U.haptic("light");
    });

    $("#allocReset").addEventListener("click", function () {
      S.resetAllocation();
      renderAjustes();
      U.toast("Reparto restablecido", { icon: "check" });
    });

    $$("[data-setting]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { handleSetting(btn.getAttribute("data-setting")); });
    });

    $("#importFile").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          S.importJson(String(reader.result));
          renderAll();
          U.toast("Datos importados", { icon: "check" });
        } catch (err) {
          U.toast("No he podido leer ese archivo", { icon: "warning" });
        }
      };
      reader.readAsText(file);
    });
  }

  function handleSetting(action) {
    if (action === "theme") { cycleTheme(); return; }

    if (action === "export") {
      var blob = new Blob([S.exportJson()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "split-" + S.ymd(new Date()) + ".json";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      U.toast("Archivo descargado", { icon: "check" });
      return;
    }

    if (action === "import") { $("#importFile").click(); return; }

    if (action === "reset") {
      if (!confirm("¿Recargar los datos de ejemplo? Se perderá lo que hayas registrado.")) return;
      S.reset(); renderAll(); U.toast("Datos de ejemplo recargados", { icon: "check" });
      return;
    }

    if (action === "clear") {
      if (!confirm("¿Borrar todos tus movimientos y metas? No se puede deshacer.")) return;
      S.clearAll(); renderAll(); U.toast("Todo vaciado", { icon: "check" });
      return;
    }

    if (action === "update") {
      U.toast("Buscando actualizaciones…", { icon: "repeat" });
      /* manual: se salta el límite de una comprobación cada 6 h, y aquí sí
         se avisa aunque esa versión se hubiera descartado con «Ahora no» */
      Up.check(true).then(function (res) {
        if (res.status === "update") {
          ui.update = res;
          renderAll();
          U.toast("split " + res.version + " disponible", { icon: "download", duration: 4500 });
        } else if (res.status === "offline") {
          U.toast("No se ha podido comprobar. ¿Tienes conexión?", { icon: "warning", duration: 4500 });
        } else {
          U.toast("Ya tienes la última versión", { icon: "check" });
        }
      });
    }
  }

  /* ============================================================
     Sheet · añadir / editar movimiento
     ============================================================ */

  function openAdd(kind, txId) {
    var t = txId ? S.state.transactions.find(function (x) { return x.id === txId; }) : null;
    ui.editingId = txId || null;
    var accs = S.state.accounts;
    ui.draft = t
      ? { kind: t.kind, amount: String(Math.round(t.amount * 100)), categoryId: t.categoryId,
          accountId: t.accountId, toAccountId: t.toAccountId || null,
          note: t.note, memo: t.memo || "", date: t.date, time: t.time || "",
          tags: Array.isArray(t.tags) ? t.tags.slice() : [],
          attachments: Array.isArray(t.attachments) ? t.attachments.slice() : [] }
      : { kind: kind || "out", amount: "", categoryId: kind === "in" ? "nomina" : "comida",
          accountId: accs[0].id,
          toAccountId: accs.length > 1 ? accs[1].id : accs[0].id,
          note: "", memo: "", date: S.ymd(new Date()), time: nowHHMM(),
          tags: [], attachments: [] };

    /* los adjuntos viven en IndexedDB: se piden aparte y se pintan cuando
       llegan, sin bloquear la apertura del sheet */
    ui.draftAttachments = [];
    if (window.Attach && ui.draft.attachments.length) {
      window.Attach.getMany(ui.draft.attachments).then(function (list) {
        if (!sheets.add.open) return;
        ui.draftAttachments = list;
        refreshAttachments();
      });
    }

    $("#sheetAddTitle").textContent = txId ? "Editar movimiento" : "Nuevo movimiento";
    renderAddSheet();
    sheets.add.show();
  }

  /* Chips de etiqueta: las que ya existen se marcan, y el + abre un campo
     para escribir una nueva. Son transversales a la categoría, así que un
     movimiento puede llevar varias o ninguna. */
  function tagsFieldHtml(d) {
    var todas = S.state.tags || [];
    return '<div class="field">' +
        '<span class="field__label">Etiquetas</span>' +
        '<div class="chips" id="addTags">' +
          todas.map(function (tg) {
            var on = d.tags.indexOf(tg.id) >= 0;
            return '<button type="button" class="chip" data-tag="' + esc(tg.id) + '" ' +
                     'aria-pressed="' + on + '">' + esc(tg.name) + '</button>';
          }).join("") +
          '<button type="button" class="chip chip--add" id="addTagNew">' +
            icon("plus", 13) + 'Nueva' +
          '</button>' +
        '</div>' +
        (todas.length ? "" :
          '<p class="field__hint">Por ejemplo «Vacaciones» o «Coche»: valen para ' +
          'agrupar gastos de categorías distintas.</p>') +
      '</div>';
  }

  /* Los adjuntos no caben en localStorage, así que van en IndexedDB. Si el
     navegador no la deja usar (modo privado, políticas), no se ofrece el
     campo en vez de fallar al guardar. */
  function attachFieldHtml() {
    if (!window.Attach || !window.Attach.supported()) return "";
    return '<div class="field">' +
        '<span class="field__label">Adjuntos</span>' +
        '<div class="attach" id="addAttach"></div>' +
        '<input type="file" id="attachFile" accept="image/*" class="visually-hidden">' +
      '</div>';
  }

  function refreshAttachments() {
    var box = $("#addAttach");
    if (!box) return;
    var list = ui.draftAttachments || [];
    box.innerHTML =
      list.map(function (a) {
        return '<div class="attach__item">' +
            '<img class="attach__img" src="' + esc(a.dataUrl) + '" alt="' + esc(a.name) + '">' +
            '<button type="button" class="attach__del" data-attach-del="' + esc(a.id) + '" ' +
                    'aria-label="Quitar adjunto">' + icon("close", 12) + '</button>' +
          '</div>';
      }).join("") +
      '<button type="button" class="attach__add" id="attachAdd" aria-label="Añadir adjunto">' +
        icon("plus", 18) +
      '</button>';
    mountIcons(box);
  }

  function nowHHMM() {
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function accountSelect(id, selected) {
    return '<select class="field__input" id="' + id + '">' +
      S.state.accounts.map(function (a) {
        return '<option value="' + esc(a.id) + '"' +
               (a.id === selected ? " selected" : "") + '>' + esc(a.name) + '</option>';
      }).join("") +
    '</select>';
  }

  function draftValue() {
    return ui.draft.amount ? parseInt(ui.draft.amount, 10) / 100 : 0;
  }

  function renderAddSheet() {
    var d = ui.draft;
    var body = $("#sheetAddBody");
    var cats = S.CATEGORIES.filter(function (c) { return c.kind === d.kind; });
    var v = draftValue();

    body.innerHTML =
      '<div class="segmented" id="addSeg" role="tablist">' +
        '<span class="segmented__thumb" id="addThumb" aria-hidden="true"></span>' +
        '<button type="button" class="segmented__btn" role="tab" data-dkind="out" ' +
                'aria-selected="' + (d.kind === "out") + '">Gasto</button>' +
        '<button type="button" class="segmented__btn" role="tab" data-dkind="in" ' +
                'aria-selected="' + (d.kind === "in") + '">Ingreso</button>' +
        '<button type="button" class="segmented__btn" role="tab" data-dkind="transfer" ' +
                'aria-selected="' + (d.kind === "transfer") + '">Traspaso</button>' +
      '</div>' +

      '<div class="amount-display' + (v === 0 ? " is-zero" : "") + '" id="amountDisplay" ' +
           'data-kind="' + d.kind + '" aria-live="polite">' +
        '<span class="amount-display__sign">' +
          (d.kind === "in" ? "+" : d.kind === "transfer" ? "" : "−") + '</span>' +
        '<span id="amountText">' + esc(S.num2.format(v)) + '</span>' +
        '<span class="amount-display__cur">€</span>' +
      '</div>' +

      '<div class="keypad" id="keypad">' +
        [1,2,3,4,5,6,7,8,9].map(function (n) {
          return '<button type="button" class="key" data-key="' + n + '">' + n + '</button>';
        }).join("") +
        '<button type="button" class="key" data-key="00">00</button>' +
        '<button type="button" class="key" data-key="0">0</button>' +
        '<button type="button" class="key" data-key="del" aria-label="Borrar">' +
          icon("backspace", 18) + '</button>' +
      '</div>' +

      (d.kind === "transfer"
        ? '<div class="field__row">' +
            '<div>' +
              '<label class="field__label" for="addAccount">Desde</label>' +
              accountSelect("addAccount", d.accountId) +
            '</div>' +
            '<div>' +
              '<label class="field__label" for="addToAccount">Hacia</label>' +
              accountSelect("addToAccount", d.toAccountId) +
            '</div>' +
          '</div>' +
          (d.accountId === d.toAccountId
            ? '<p class="field__hint">' + icon("warning", 12) +
              ' Elige dos cuentas distintas.</p>'
            : '' +
              '')
        : '<div class="field">' +
            '<span class="field__label">Categoría</span>' +
            '<div class="cat-grid">' +
              cats.map(function (c) {
                return '<button type="button" class="cat-pick" data-cat="' + c.id + '" ' +
                         'aria-pressed="' + (c.id === d.categoryId) + '">' +
                    catFace(c, 20, "cat-pick__icon") +
                    '<span class="cat-pick__name">' + esc(c.name) + '</span>' +
                  '</button>';
              }).join("") +
              '<button type="button" class="cat-pick cat-pick--add" ' +
                      'data-cat-new="' + d.kind + '">' +
                '<span class="cat-pick__icon">' + icon("plus", 18) + '</span>' +
                '<span class="cat-pick__name">Nueva</span>' +
              '</button>' +
            '</div>' +
          '</div>') +

      '<div class="field">' +
        '<label class="field__label" for="addNote">Título</label>' +
        '<input type="text" class="field__input" id="addNote" maxlength="40" ' +
               'placeholder="' + esc(catOf(d.categoryId).name) + '" value="' + esc(d.note) + '">' +
      '</div>' +

      (d.kind === "transfer"
        ? '<div class="field__row">' +
            '<div>' +
              '<label class="field__label" for="addDate">Fecha</label>' +
              '<input type="date" class="field__input" id="addDate" value="' + esc(d.date) + '" ' +
                     'max="' + esc(S.ymd(new Date())) + '">' +
            '</div>' +
            '<div>' +
              '<label class="field__label" for="addTime">Hora</label>' +
              '<input type="time" class="field__input" id="addTime" value="' + esc(d.time) + '">' +
            '</div>' +
          '</div>'
        : '<div class="field__row" style="margin-top:var(--sp-4)">' +
            '<div>' +
              '<label class="field__label" for="addAccount">Cuenta</label>' +
              accountSelect("addAccount", d.accountId) +
            '</div>' +
            '<div>' +
              '<label class="field__label" for="addDate">Fecha</label>' +
              '<input type="date" class="field__input" id="addDate" value="' + esc(d.date) + '" ' +
                     'max="' + esc(S.ymd(new Date())) + '">' +
            '</div>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field__label" for="addTime">Hora</label>' +
            '<input type="time" class="field__input" id="addTime" value="' + esc(d.time) + '">' +
          '</div>') +

      tagsFieldHtml(d) +

      '<div class="field">' +
        '<label class="field__label" for="addMemo">Notas</label>' +
        '<textarea class="field__input field__input--area" id="addMemo" rows="3" ' +
                  'maxlength="500" placeholder="Lo que quieras recordar de este ' +
                  'movimiento">' + esc(d.memo) + '</textarea>' +
      '</div>' +

      attachFieldHtml() +

      '<div class="field" style="margin-top:var(--sp-5)">' +
        '<button type="button" class="btn btn--primary" id="addSave"' +
          ((v <= 0 || (d.kind === "transfer" && d.accountId === d.toAccountId))
            ? " disabled" : "") + '>' +
          icon("check", 17) + (ui.editingId ? "Guardar cambios" : "Guardar movimiento") +
        '</button>' +
      '</div>' +

      (ui.editingId
        ? '<div class="field">' +
            '<button type="button" class="btn btn--danger" id="addDelete" style="width:100%">' +
              icon("trash", 16) + 'Eliminar movimiento</button>' +
          '</div>'
        : "");

    mountIcons(body);
    refreshAttachments();
    requestAnimationFrame(function () {
      var seg = $("#addSeg", body);
      if (seg) U.slideIndicator(seg, $("#addThumb", body), $('[data-dkind="' + d.kind + '"]', seg));
    });
  }

  function refreshAmount() {
    var v = draftValue();
    var disp = $("#amountDisplay"), txt = $("#amountText"), save = $("#addSave");
    if (!disp || !txt) return;
    txt.textContent = S.num2.format(v);
    disp.classList.toggle("is-zero", v === 0);
    if (save) {
      save.disabled = v <= 0 ||
        (ui.draft.kind === "transfer" && ui.draft.accountId === ui.draft.toAccountId);
    }
  }

  function saveDraft() {
    var d = ui.draft, v = draftValue();
    if (v <= 0) return;
    var payload = {
      kind: d.kind, amount: v, categoryId: d.categoryId,
      accountId: d.accountId, toAccountId: d.toAccountId,
      note: d.note, memo: d.memo, date: d.date, time: d.time,
      tags: d.tags,
      attachments: (ui.draftAttachments || []).map(function (a) { return a.id; })
    };
    if (ui.editingId) {
      S.updateTx(ui.editingId, payload);
      U.toast("Movimiento actualizado", { icon: "check" });
    } else {
      S.addTx(payload);
      U.toast((d.kind === "in" ? "Ingreso" : d.kind === "transfer" ? "Traspaso" : "Gasto") +
              " de " + money(v) + " guardado", { icon: "check" });
    }
    U.haptic("success");
    sheets.add.close();
    renderAll();
  }

  /* ============================================================
     Sheet · detalle
     ============================================================ */

  function openDetail(txId) {
    var t = S.state.transactions.find(function (x) { return x.id === txId; });
    if (!t) return;
    var cat = catOf(t.categoryId);
    var acc = S.state.accounts.find(function (a) { return a.id === t.accountId; });
    var isIn = t.kind === "in";
    var etiquetas = (t.tags || []).map(function (id) { return S.tagById(id); })
                                  .filter(Boolean);

    $("#sheetDetailBody").innerHTML =
      '<div style="text-align:center;padding:var(--sp-3) 0 var(--sp-5)">' +
        '<span style="display:inline-grid;place-items:center;width:48px;height:48px;' +
              'border-radius:var(--r-full);font-size:24px;line-height:1;' +
              'background:var(--surface-2);box-shadow:var(--nm-in)" ' +
              'aria-hidden="true">' + esc(cat.emoji || "\uD83D\uDCE6") + '</span>' +
        '<p style="margin-top:var(--sp-3);font-size:30px;font-weight:640;letter-spacing:-.035em;' +
           (isIn ? "color:var(--money-in)" : "") + '">' +
          (isIn ? "+" : "−") + esc(money(t.amount)) + '</p>' +
        '<p style="margin-top:2px;font-size:14px;color:var(--text-secondary)">' + esc(t.note) + '</p>' +
      '</div>' +

      '<div class="card card--quiet" style="padding:0;overflow:hidden">' +
        detailRow("Categoría", cat.emoji + " " + cat.name) +
        detailRow("Cuenta", acc ? acc.name : "—") +
        detailRow("Fecha", S.parseYmd(t.date).toLocaleDateString("es-ES", {
          weekday: "long", day: "numeric", month: "long", year: "numeric"
        })) +
        (t.time ? detailRow("Hora", t.time) : "") +
        detailRow("Tipo", isIn ? "Ingreso" : "Gasto") +
      '</div>' +

      (etiquetas.length
        ? '<div class="field">' +
            '<span class="field__label">Etiquetas</span>' +
            '<div class="chips">' +
              etiquetas.map(function (tg) {
                return '<span class="chip" aria-pressed="true">' + esc(tg.name) + '</span>';
              }).join("") +
            '</div>' +
          '</div>'
        : "") +

      (t.memo
        ? '<div class="field">' +
            '<span class="field__label">Notas</span>' +
            '<p class="detail-memo">' + esc(t.memo) + '</p>' +
          '</div>'
        : "") +

      ((t.attachments && t.attachments.length)
        ? '<div class="field">' +
            '<span class="field__label">Adjuntos</span>' +
            '<div class="attach" id="detailAttach">' +
              '<p class="field__hint">Cargando…</p>' +
            '</div>' +
          '</div>'
        : "") +

      '<div class="field" style="display:flex;gap:var(--sp-3)">' +
        '<button type="button" class="btn btn--ghost" id="detailEdit" style="flex:1">' +
          icon("edit", 16) + 'Editar</button>' +
        '<button type="button" class="btn btn--danger" id="detailDelete" style="flex:1">' +
          icon("trash", 16) + 'Eliminar</button>' +
      '</div>';

    mountIcons($("#sheetDetailBody"));

    if (t.attachments && t.attachments.length && window.Attach) {
      window.Attach.getMany(t.attachments).then(function (list) {
        var box = $("#detailAttach");
        if (!box) return;
        box.innerHTML = list.length
          ? list.map(function (a) {
              return '<a class="attach__item" href="' + esc(a.dataUrl) + '" ' +
                       'target="_blank" rel="noopener">' +
                  '<img class="attach__img" src="' + esc(a.dataUrl) + '" ' +
                       'alt="' + esc(a.name) + '">' +
                '</a>';
            }).join("")
          : '<p class="field__hint">Los adjuntos ya no están disponibles.</p>';
      });
    }

    $("#detailEdit").onclick = function () {
      sheets.detail.close();
      setTimeout(function () { openAdd(t.kind, t.id); }, 220);
    };

    $("#detailDelete").onclick = function () {
      var removed = S.deleteTx(t.id);
      sheets.detail.close();
      renderAll();
      U.toast("Movimiento eliminado", {
        icon: "trash", actionLabel: "Deshacer", duration: 5000,
        onAction: function () {
          S.restoreTx(removed); renderAll(); U.toast("Restaurado", { icon: "check" });
        }
      });
    };

    sheets.detail.show();
  }

  function detailRow(label, value) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;' +
             'gap:var(--sp-4);padding:var(--sp-3) var(--sp-4);' +
             'box-shadow:inset 0 1px 0 var(--hairline)">' +
        '<span style="font-size:12.5px;color:var(--text-secondary)">' + esc(label) + '</span>' +
        '<span style="font-size:13px;font-weight:570;text-align:right">' + esc(value) + '</span>' +
      '</div>';
  }

  /* ============================================================
     Navegación
     ============================================================ */

  var TITLES = {
    /* en Resumen la línea superior lleva la fecha: repetir "Resumen"
       encima del título no aporta nada */
    inicio:   { eyebrow: null, title: "Resumen" },
    movs:     { eyebrow: "Histórico", title: "Movimientos" },
    analisis: { eyebrow: "Datos", title: "Análisis" },
    ahorro:   { eyebrow: "Tu plan", title: "Planes" },
    ajustes:  { eyebrow: "Configuración", title: "Ajustes" }
  };

  function goTo(view, skipHash) {
    if (!TITLES[view]) view = "inicio";

    if (ui.view === view) {
      $("#scrollArea").scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    ui.view = view;
    if (!skipHash && location.hash.slice(1) !== view) location.hash = view;

    $$(".view").forEach(function (v) {
      v.setAttribute("data-active", String(v.id === "view-" + view));
    });
    $$("[data-view]").forEach(function (b) {
      b.setAttribute("aria-selected", String(b.getAttribute("data-view") === view));
    });

    setTopbar(view);
    $("#scrollArea").scrollTop = 0;

    U.haptic("light");
    renderView(view);
  }

  function setTopbar(view) {
    var t = TITLES[view] || TITLES.inicio;
    $("#topbarEyebrow").textContent = t.eyebrow || todayLabel();
    $("#topbarTitle").textContent = t.title;
  }

  function todayLabel() {
    var s = new Date().toLocaleDateString("es-ES", {
      weekday: "long", day: "numeric", month: "long"
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function renderView(view) {
    if (view === "inicio") renderInicio();
    else if (view === "movs") renderMovs();
    else if (view === "analisis") renderAnalisis();
    else if (view === "ahorro") renderPlanes();
    else if (view === "ajustes") renderAjustes();
  }

  function renderAll() { renderView(ui.view); }

  /* ============================================================
     Eventos
     ============================================================ */

  function bind() {
    $$("[data-view]").forEach(function (b) {
      b.addEventListener("click", function () { goTo(b.getAttribute("data-view")); });
    });

    $$("[data-add]").forEach(function (b) {
      b.addEventListener("click", function () { openAdd("out"); });
    });

    $("#settingsBtn").addEventListener("click", function () { goTo("ajustes"); });
    $("#themeBtn").addEventListener("click", cycleTheme);

    var scroll = $("#scrollArea");
    scroll.addEventListener("scroll", function () {
      $("#topbar").setAttribute("data-stuck", String(scroll.scrollTop > 4));
    }, { passive: true });

    scroll.addEventListener("click", function (e) {
      var node;
      if ((node = e.target.closest("[data-tx]"))) { openDetail(node.getAttribute("data-tx")); return; }
      if ((node = e.target.closest("[data-goto]"))) { goTo(node.getAttribute("data-goto")); return; }

      if ((node = e.target.closest("[data-form]"))) {
        openForm(node.getAttribute("data-form"), node.getAttribute("data-form-id"));
        return;
      }
      if ((node = e.target.closest("[data-rec-toggle]"))) {
        var r = S.toggleRecurring(node.getAttribute("data-rec-toggle"));
        S.runRecurring();
        renderAll(); U.haptic("light");
        U.toast(r && r.active ? "Programado reanudado" : "Programado en pausa",
                { icon: r && r.active ? "play" : "pause" });
        return;
      }
      if ((node = e.target.closest("[data-quick]"))) {
        var q = node.getAttribute("data-quick");
        openAdd(q === "ingreso" ? "in" : q === "traspaso" ? "transfer" : "out");
        return;
      }
      if ((node = e.target.closest("[data-kind]"))) {
        ui.movsKind = node.getAttribute("data-kind");
        renderMovs(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-range]"))) {
        ui.range = +node.getAttribute("data-range");
        renderAnalisis(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-anview]"))) {
        ui.anView = node.getAttribute("data-anview");
        renderAnalisis(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-month]"))) {
        ui.movsMonthOffset = Math.max(0, ui.movsMonthOffset - (+node.getAttribute("data-month")));
        renderMovs(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-amonth]"))) {
        ui.monthOffset = Math.max(0, ui.monthOffset - (+node.getAttribute("data-amonth")));
        renderAnalisis(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-fold]"))) {
        var fid = node.getAttribute("data-fold");
        var abierta = node.getAttribute("aria-expanded") === "true";
        var caja = node.closest(".card__head").parentNode.querySelector(".fold");
        node.setAttribute("aria-expanded", String(!abierta));
        if (caja) caja.setAttribute("data-open", String(!abierta));
        /* la cabecera se pega al cuerpo al plegarse */
        var cab = node.closest(".card__head");
        if (cab && !cab.classList.contains("card__pad--tight")) {
          cab.style.marginBottom = abierta ? "0" : "var(--sp-4)";
        }
        setFolded(fid, abierta);
        U.haptic("light");
        return;
      }
      if (e.target.closest("#movsClear")) { ui.movsQuery = ""; renderMovs(); return; }

      if (e.target.closest("#updateNow")) {
        Up.open(ui.update.url);
        U.toast("Descargando la actualización…", { icon: "download", duration: 4500 });
        return;
      }
      if (e.target.closest("#updateLater")) {
        Up.dismiss(ui.update.version);
        ui.update = null;
        renderAll(); U.haptic("light");
        return;
      }

      if ((node = e.target.closest("[data-goal-add]"))) {
        var gid = node.getAttribute("data-goal-add");
        var raw = prompt("¿Cuánto quieres aportar a esta meta? (€)", "50");
        if (raw == null) return;
        var amount = parseFloat(String(raw).replace(",", "."));
        if (!isFinite(amount) || amount <= 0) {
          U.toast("Introduce un importe válido", { icon: "warning" }); return;
        }
        S.addGoalSaving(gid, amount);
        renderAhorro(); U.haptic("success");
        U.toast("Has aportado " + money(amount), { icon: "check" });
      }
    });

    var searchTimer = null;
    scroll.addEventListener("input", function (e) {
      if (e.target.id !== "movsSearch") return;
      var value = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        ui.movsQuery = value;
        renderMovs();
        var input = $("#movsSearch");
        if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      }, 240);
    });

    /* --- sheet de formulario (cuentas, metas, programados) --- */
    var formBody = $("#sheetFormBody");

    var FIELD_MAP = {
      Name: function (v) { form.d[form.type === "recurring" ? "note" : "name"] = v; },
      Emoji: function (v) { form.d.emoji = v; },
      Type: function (v) { form.d.type = v; },
      Opening: function (v) { form.d.opening = v; },
      Target: function (v) { form.d.target = v; },
      Saved: function (v) { form.d.saved = v; },
      Monthly: function (v) { form.d.monthly = v; },
      Amount: function (v) { form.d.amount = v; },
      Day: function (v) { form.d.day = v; },
      Cat: function (v) { form.d.categoryId = v; }
    };

    function readField(el) {
      var key = el.getAttribute("data-f");
      if (key && FIELD_MAP[key]) { FIELD_MAP[key](el.value); return true; }
      if (el.id === "fAccount") { form.d.accountId = el.value; return true; }
      if (el.id === "fToAccount") { form.d.toAccountId = el.value; return true; }
      return false;
    }

    formBody.addEventListener("input", function (e) {
      if (!readField(e.target)) return;
      if (form.type === "category") refreshCatPreview();
      if (form.type === "account") refreshCardPreview();
    });

    formBody.addEventListener("change", function (e) {
      if (!readField(e.target)) return;
      /* elegir cuenta en un traspaso puede dejar origen y destino iguales:
         hay que repintar para mostrar el aviso y bloquear el guardado */
      if (form.type === "recurring" && form.d.kind === "transfer" &&
          (e.target.id === "fAccount" || e.target.id === "fToAccount")) {
        renderForm();
      }
    });

    formBody.addEventListener("click", function (e) {
      var node;
      if ((node = e.target.closest("[data-fkind]"))) {
        form.d.kind = node.getAttribute("data-fkind");
        if (form.type !== "category") {
          /* la categoría por defecto cambia con el tipo */
          if (form.d.kind === "in") form.d.categoryId = "nomina";
          else if (form.d.kind === "out") form.d.categoryId = "hogar";
        }
        renderForm();
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("[data-pemoji]"))) {
        form.d.emoji = node.getAttribute("data-pemoji");
        var inp = $("#fEmoji", formBody);
        if (inp) inp.value = form.d.emoji;
        $$("[data-pemoji]", formBody).forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === node));
        });
        refreshCatPreview();
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("[data-pcolor]"))) {
        form.d.color = +node.getAttribute("data-pcolor");
        $$("[data-pcolor]", formBody).forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === node));
        });
        refreshCatPreview();
        refreshCardPreview();
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("[data-picon]"))) {
        form.d.icon = node.getAttribute("data-picon");
        $$("[data-picon]", formBody).forEach(function (b) {
          b.setAttribute("aria-selected", String(b === node));
          b.setAttribute("aria-pressed", String(b === node));
        });
        U.haptic("light");
        return;
      }
      if (e.target.closest("#fSave")) { saveForm(); return; }
      if (e.target.closest("#fDelete")) { deleteForm(); return; }
    });

    /* --- sheet de añadir --- */
    var addBody = $("#sheetAddBody");

    addBody.addEventListener("click", function (e) {
      var node;
      if ((node = e.target.closest("[data-key]"))) {
        var k = node.getAttribute("data-key");
        if (k === "del") ui.draft.amount = ui.draft.amount.slice(0, -1);
        else if (ui.draft.amount.length < 9)
          ui.draft.amount = (ui.draft.amount + k).replace(/^0+(?=\d)/, "");
        refreshAmount(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-dkind]"))) {
        ui.draft.kind = node.getAttribute("data-dkind");
        if (ui.draft.kind === "in") ui.draft.categoryId = "nomina";
        else if (ui.draft.kind === "out") ui.draft.categoryId = "comida";
        else ui.draft.categoryId = "otros";
        renderAddSheet(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-cat-new]"))) {
        /* el borrador (importe incluido) sobrevive en ui.draft, así que al
           volver del formulario se sigue donde se estaba */
        ui.catReturnToAdd = true;
        sheets.add.close();
        openForm("category", null, { kind: node.getAttribute("data-cat-new") });
        return;
      }
      if ((node = e.target.closest("[data-cat]"))) {
        ui.draft.categoryId = node.getAttribute("data-cat");
        $$("[data-cat]", addBody).forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === node));
        });
        var note = $("#addNote");
        if (note) note.placeholder = catOf(ui.draft.categoryId).name;
        U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-tag]"))) {
        var tid = node.getAttribute("data-tag");
        var pos = ui.draft.tags.indexOf(tid);
        if (pos >= 0) ui.draft.tags.splice(pos, 1); else ui.draft.tags.push(tid);
        node.setAttribute("aria-pressed", String(pos < 0));
        U.haptic("light");
        return;
      }
      if (e.target.closest("#addTagNew")) {
        var nombre = prompt("Nombre de la etiqueta");
        if (nombre == null) return;
        var tag = S.addTag(nombre);
        if (!tag) { U.toast("Ponle un nombre", { icon: "warning" }); return; }
        if (ui.draft.tags.indexOf(tag.id) < 0) ui.draft.tags.push(tag.id);
        renderAddSheet();
        refreshAttachments();
        U.haptic("light");
        return;
      }
      if (e.target.closest("#attachAdd")) { $("#attachFile").click(); return; }
      if ((node = e.target.closest("[data-attach-del]"))) {
        var aid = node.getAttribute("data-attach-del");
        ui.draftAttachments = (ui.draftAttachments || [])
          .filter(function (a) { return a.id !== aid; });
        /* del disco se va al guardar (o en la limpieza del arranque): si
           el usuario cierra sin guardar, el adjunto original sigue ahí */
        refreshAttachments();
        U.haptic("light");
        return;
      }
      if (e.target.closest("#addSave")) { saveDraft(); return; }
      if (e.target.closest("#addDelete")) {
        if (!confirm("¿Eliminar este movimiento?")) return;
        var removed = S.deleteTx(ui.editingId);
        sheets.add.close(); renderAll();
        U.toast("Movimiento eliminado", {
          icon: "trash", actionLabel: "Deshacer", duration: 5000,
          onAction: function () { S.restoreTx(removed); renderAll(); }
        });
      }
    });

    addBody.addEventListener("input", function (e) {
      if (e.target.id === "addNote") ui.draft.note = e.target.value;
      if (e.target.id === "addMemo") ui.draft.memo = e.target.value;
    });

    addBody.addEventListener("change", function (e) {
      if (e.target.id === "addAccount") {
        ui.draft.accountId = e.target.value;
        if (ui.draft.kind === "transfer") renderAddSheet();
      }
      if (e.target.id === "addToAccount") {
        ui.draft.toAccountId = e.target.value;
        renderAddSheet();
      }
      if (e.target.id === "addDate") ui.draft.date = e.target.value;
      if (e.target.id === "addTime") ui.draft.time = e.target.value;
    });

    /* elegir imagen: se reduce y se guarda en IndexedDB antes de pintarla */
    addBody.addEventListener("change", function (e) {
      if (e.target.id !== "attachFile") return;
      var file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      U.toast("Procesando la imagen…", { icon: "upload" });
      window.Attach.put(file).then(function (rec) {
        ui.draftAttachments = (ui.draftAttachments || []).concat([rec]);
        refreshAttachments();
        U.haptic("success");
      }, function (err) {
        U.toast(err && err.message ? err.message : "No se ha podido adjuntar",
                { icon: "warning", duration: 4500 });
      });
    });

    document.addEventListener("keydown", function (e) {
      if (!sheets.add || !sheets.add.open) return;
      if (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (/^[0-9]$/.test(e.key)) {
        if (ui.draft.amount.length < 9)
          ui.draft.amount = (ui.draft.amount + e.key).replace(/^0+(?=\d)/, "");
        refreshAmount();
      } else if (e.key === "Backspace") {
        ui.draft.amount = ui.draft.amount.slice(0, -1); refreshAmount();
      } else if (e.key === "Enter") { saveDraft(); }
    });

    /* los SVG se miden en píxeles: repintar la vista al cambiar el tamaño */
    var lastW = window.innerWidth;
    C.onResize(function () {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      renderAll();
    });

    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () {
        if (S.getTheme() !== "auto") return;
        updateThemeIcon(); renderAll();
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }

    /* --- tutorial de bienvenida --- */
    var onboard = $("#onboard");
    $("#onboardNext").addEventListener("click", onboardNext);
    $("#onboardBack").addEventListener("click", onboardBack);
    $("#onboardSkip").addEventListener("click", skipOnboarding);

    onboard.addEventListener("input", function (e) {
      if (e.target.id === "onboardAccName") ob.name = e.target.value;
    });

    onboard.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { skipOnboarding(); return; }
      if (e.key === "Enter" && e.target.id === "onboardAccName") {
        e.preventDefault();
        onboardNext();
      }
    });
  }

  function cycleTheme() {
    var order = ["auto", "light", "dark"];
    var next = order[(order.indexOf(S.getTheme()) + 1) % order.length];
    S.setTheme(next);
    updateThemeIcon();
    renderAll();
    U.toast("Tema: " + themeShort(next).toLowerCase(), { icon: next === "dark" ? "moon" : "sun" });
  }

  function updateThemeIcon() {
    var t = S.getTheme();
    var effectiveDark = t === "dark" || (t === "auto" && window.matchMedia &&
                        window.matchMedia("(prefers-color-scheme: dark)").matches);
    var btn = $("#themeBtn");
    btn.innerHTML = icon(effectiveDark ? "moon" : "sun", 18);
    btn.setAttribute("aria-label", "Tema: " + themeLabel(t) + ". Pulsa para cambiar");
  }

  /* ============================================================
     Tutorial de bienvenida
     ============================================================ */

  function startOnboarding() {
    var acc = S.state.accounts[0];
    ob = { step: 0, accountId: acc ? acc.id : null, name: acc ? acc.name : "" };
    renderOnboardStep();
    $("#onboard").setAttribute("data-open", "true");
    $("#onboard").setAttribute("aria-hidden", "false");
    U.haptic("light");
  }

  function renderOnboardStep() {
    var last = ob.step === ONBOARD_STEPS.length;
    var s = last
      ? { icon: "edit", title: "Ya tienes una cuenta creada",
          text: "Arranca sin dinero cargado. Puedes cambiarle el nombre ahora si " +
                "quieres, y luego, cuando quieras, metes tus ingresos y el reparto en Ajustes." }
      : ONBOARD_STEPS[ob.step];

    $("#onboardIcon").innerHTML = icon(s.icon, 28);
    $("#onboardTitle").textContent = s.title;
    $("#onboardText").textContent = s.text;

    $("#onboardExtra").innerHTML = last
      ? '<div class="field" style="margin-top:0">' +
          '<label class="field__label" for="onboardAccName">Nombre de tu cuenta</label>' +
          '<input type="text" class="field__input" id="onboardAccName" maxlength="28" ' +
                 'placeholder="Banco" value="' + esc(ob.name) + '">' +
        '</div>'
      : "";

    $("#onboardDots").innerHTML = ONBOARD_STEPS.concat([null]).map(function (_, i) {
      return '<span class="onboard__dot" data-active="' + (i === ob.step) + '"></span>';
    }).join("");

    $("#onboardBack").setAttribute("data-hidden", String(ob.step === 0));
    $("#onboardNext").textContent = last ? "Empezar" : "Siguiente";

    var input = $("#onboardAccName");
    if (input) setTimeout(function () { input.focus(); }, 60);
  }

  function onboardNext() {
    if (ob.step === ONBOARD_STEPS.length) { finishOnboarding(); return; }
    ob.step++;
    renderOnboardStep();
    U.haptic("light");
  }

  function onboardBack() {
    if (ob.step === 0) return;
    ob.step--;
    renderOnboardStep();
    U.haptic("light");
  }

  function closeOnboarding() {
    $("#onboard").setAttribute("data-open", "false");
    $("#onboard").setAttribute("aria-hidden", "true");
  }

  /* El botón final guarda el nombre si lo han cambiado y lleva a Ajustes,
     que es donde toca meter los ingresos y el reparto. */
  function finishOnboarding() {
    var input = $("#onboardAccName");
    var name = input ? input.value.trim() : "";
    if (name && ob.accountId) S.updateAccount(ob.accountId, { name: name });
    closeOnboarding();
    goTo("ajustes");
    U.toast("Cuando quieras, mete tus ingresos y el reparto aquí", {
      icon: "sliders", duration: 5000
    });
  }

  function skipOnboarding() {
    closeOnboarding();
  }

  /* ============================================================
     Arranque
     ============================================================ */

  function init() {
    var firstRun = !S.hasSavedState();
    S.load();
    S.applyTheme(S.getTheme());

    /* apunta lo programado que haya vencido desde la última visita */
    var posted = S.runRecurring();

    sheets.add = new U.Sheet($("#sheetAdd"), $("#scrim"));
    sheets.detail = new U.Sheet($("#sheetDetail"), $("#scrim"));
    sheets.form = new U.Sheet($("#sheetForm"), $("#scrim"));

    mountIcons(document);
    updateThemeIcon();
    bind();

    var start = location.hash.slice(1);
    if (TITLES[start] && start !== "inicio") {
      goTo(start, true);
    } else {
      setTopbar("inicio");
      renderInicio();
    }

    window.addEventListener("hashchange", function () {
      goTo(location.hash.slice(1) || "inicio", true);
    });

    if (posted) {
      setTimeout(function () {
        U.toast("Se han apuntado " + posted + " movimiento" + (posted === 1 ? "" : "s") +
                " programado" + (posted === 1 ? "" : "s"), { icon: "calendar", duration: 4500 });
      }, 600);
    }

    /* Adjuntos que ya no cuelgan de ningún movimiento (se borró el
       movimiento, o se quitó la imagen y se guardó): ocuparían sitio para
       siempre, así que se barren al arrancar. */
    if (window.Attach && window.Attach.supported()) {
      var vivos = [];
      S.state.transactions.forEach(function (t) {
        if (Array.isArray(t.attachments)) vivos = vivos.concat(t.attachments);
      });
      window.Attach.sweep(vivos);
    }

    /* El tutorial manda: la primera vez el aviso de actualización espera a
       la siguiente apertura en vez de pisarlo. */
    asegurarHuecoInferior();

    if (firstRun) setTimeout(startOnboarding, 500);
    else checkForUpdate();
  }

  /* Dentro de la app, el hueco de la barra de navegación lo manda la capa
     Android en --safe-b-native, con la medida real de ESE móvil. Si por lo
     que sea no llegara, se reserva un mínimo prudente para que la barra de
     pestañas no acabe debajo del gesto. El valor nativo manda siempre: esto
     solo rellena el hueco si sigue vacío. */
  function asegurarHuecoInferior() {
    if (!window.Capacitor) return;
    setTimeout(function () {
      var raiz = document.documentElement;
      if (!raiz.style.getPropertyValue("--safe-b-native")) {
        raiz.style.setProperty("--safe-b-native", "24px");
      }
    }, 1500);
  }

  /* Comprobación de fondo: no bloquea el arranque y, si no hay conexión,
     no se nota. */
  function checkForUpdate() {
    if (!Up) return;
    Up.check(false).then(function (res) {
      if (res.status !== "update" || Up.isDismissed(res.version)) return;
      ui.update = res;
      renderAll();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
