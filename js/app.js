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
    movsAccount: null,       /* si se llega desde una cuenta, solo la suya */
    movsMonthOffset: 0,
    draft: null,
    editingId: null,
    cuentaReturn: null,      /* a qué cuenta volver al salir de su edición */
    opcionesRec: false,      /* «Más opciones» del formulario de programado */
    catAbierta: null,        /* madre desplegada en el selector de categoría */
    detallesAbiertos: false, /* «Más detalles» de la hoja de apuntar */
    update: null            /* { version, name, url } si hay una release nueva */
  };

  var sheets = {};

  /* ---------- tutorial de bienvenida ---------- */

  var ob = null;   /* { step, accountId, name } */

  /* La bienvenida no es un folleto de cinco pantallas que nadie lee: son
     tres preguntas. Primero se dice dónde acaban los datos, que es lo que
     de verdad importa saber antes de escribir cuánto ganas. Luego dónde
     tienes el dinero, y luego de dónde te entra.

     Lo que no se pregunta aquí —categorías, presupuesto, reparto— se pone
     sobre la marcha. Preguntarlo todo el primer día es la forma más rápida
     de que alguien cierre la app y no vuelva. */
  var ONBOARD_STEPS = ["privacidad", "cuentas", "trabajos", "listo"];

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

  /* «cuentas» limita la serie a unas cuantas; null son todas. Lo usa el
     Resumen para que la rayita de debajo de cada cifra hable de lo mismo
     que la cifra: una línea de todas las cuentas bajo un número de una
     sola sería una mentira pequeña pero mentira. */
  function seriesEnding(endKey, n, cuentas) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var key = S.addMonths(endKey, -i);
      var mes = S.txOfMonth(key);
      if (cuentas) {
        mes = mes.filter(function (t) {
          return cuentas.indexOf(t.accountId) >= 0 ||
                 (t.toAccountId && cuentas.indexOf(t.toAccountId) >= 0);
        });
      }
      var t = S.totals(mes);
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

  /* Se llama después de cada repintado, así que es el sitio natural para
     dejar también listos los campos recién creados: el teclado del móvil
     tiene que enseñar «Listo» en todos, no solo en los del HTML fijo. */
  function mountIcons(root) {
    $$("[data-icon]", root || document).forEach(function (n) {
      if (n.getAttribute("data-icon-done")) return;
      n.innerHTML = icon(n.getAttribute("data-icon"), +(n.getAttribute("data-icon-size") || 20));
      n.setAttribute("data-icon-done", "1");
    });
    U.tecladoComodo(root || document);
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
    var cur = S.totals(S.txOfMonth(curKey));
    var bal = S.balance();
    var cfgRes = S.resumenCfg();
    var series = seriesEnding(curKey, 12, cfgRes.cuentas);
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
            return '<button type="button" class="paycard" data-card="' + i + '" ' +
                   'data-cuenta="' + esc(a.id) + '" ' +
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
              '</button>';
          }).join("") +

          /* La última del carrusel es la de crear otra. Antes había que
             saber que las cuentas se administran en otra pantalla, y no
             había forma de adivinarlo: aquí se ve deslizando, que es lo
             que uno hace con unas tarjetas. */
          '<button type="button" class="paycard paycard--nueva" data-form="account">' +
            '<span class="paycard__plus" data-icon="plus" data-icon-size="22"></span>' +
            '<span class="paycard__nueva-txt">Añadir cuenta</span>' +
            '<span class="paycard__nueva-sub">Otro banco, una hucha, efectivo…</span>' +
          '</button>' +
        '</div>' +
        '<div class="cards__dots" id="cardsDots" aria-hidden="true">' +
          accounts.concat([null]).map(function (a, i) {
            return '<span class="cards__dot" data-on="' + (i === 0) + '"></span>';
          }).join("") +
        '</div>' +
      '</div>';

    /* Las tres cifras respetan lo que se haya elegido al mantenerlas
       pulsadas: qué cuentas cuentan y de qué periodo.

       El «tanto por ciento respecto al anterior» solo se enseña cuando se
       mira el mes, que es el único periodo con un anterior evidente; en
       «este año» o «desde el principio» un porcentaje ahí no significaría
       nada. Los dos meses salen de la serie, que ya viene filtrada por las
       mismas cuentas, así que la comparación cuadra con la cifra. */
    var res = S.totalesResumen();
    var comparable = cfgRes.periodo === "mes";
    var mesAnt = series[series.length - 2] || { income: 0, expense: 0, net: 0 };
    var delta = function (ahora, antes) {
      return comparable ? deltaPct(ahora, antes) : null;
    };

    var cardKpis =
      '<div class="kpi-row" id="kpiRow">' +
        statTile("Ingresos", res.income, delta(res.income, mesAnt.income), "up-good",
                 series.map(function (m) { return m.income; })) +
        statTile("Gastos", res.expense, delta(res.expense, mesAnt.expense), "up-bad",
                 series.map(function (m) { return m.expense; })) +
        statTile("Ahorro", res.net, delta(res.net, mesAnt.net), "up-good",
                 series.map(function (m) { return m.net; })) +
      '</div>' +
      '<button type="button" class="kpi-filtro" id="kpiFiltro">' +
        esc(S.etiquetaResumen()) +
        '<span data-icon="chevDown" data-icon-size="13"></span>' +
      '</button>';

    /* Sin presupuesto puesto no se enseña ninguna de las dos tarjetas: un
       «0 € de 0 €» y unas barras vacías no dicen nada, y encima dan la
       impresión de que la app te está midiendo por un plan que no has
       hecho. Quien lo quiera, lo pone en Ajustes. */
    var budgetTotal = S.budgetTotal();
    var hayPresupuesto = rows.length > 0 && budgetTotal > 0;

    var cardBudgets = hayPresupuesto
      ? foldCard("presupuesto",
          "Presupuesto de " + esc(monthName(curKey)),
          esc(money(cur.expense)) + " de " + esc(money(budgetTotal)) + " asignados",
          '<button type="button" class="card__link" data-goto="ajustes">Editar</button>',
          rows.map(meterHtml).join(""))
      : "";

    /* --- tarjeta de límite: el presupuesto del mes de un vistazo --- */
    var usedRatio = budgetTotal > 0 ? Math.min(1, cur.expense / budgetTotal) : 0;
    var cardLimit = hayPresupuesto
      ? '<button type="button" class="limit" data-goto="ajustes">' +
          '<span class="limit__ring" data-limit-ring="' + usedRatio + '"></span>' +
          '<span class="limit__body">' +
            '<span class="limit__label">Presupuesto de ' + esc(monthName(curKey)) + '</span>' +
            '<span class="limit__value">' + esc(S.moneyShort(cur.expense)) + ' de ' +
              esc(S.moneyShort(budgetTotal)) + '</span>' +
          '</span>' +
          '<span class="limit__chev" data-icon="chevron" data-icon-size="18"></span>' +
        '</button>'
      : "";

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
                  catFace(c, 24, "tile__icon") +
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
                  : catFace(catOf(r.categoryId), 21, "account__badge")) +
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

    /* --- cobros esperando el visto bueno ---
       Si se cerró la hoja sin contestar, la cola no se pierde: queda a la
       vista en Inicio hasta que se conteste. */
    var cola = S.pendientes();
    var cardCola = cola.length
      ? '<section class="update-card">' +
          '<span class="update-card__icon" data-icon="calendar" data-icon-size="19"></span>' +
          '<div class="update-card__body">' +
            '<p class="update-card__title">' +
              (cola.length === 1 ? "Tienes 1 movimiento por confirmar"
                                 : "Tienes " + cola.length + " movimientos por confirmar") + '</p>' +
            '<p class="update-card__text">' + esc(cola[0].note) +
              (cola.length > 1
                ? " y " + (cola.length - 1) + " más. Dinos el importe y se apuntan."
                : ". Dinos el importe y se apunta.") + '</p>' +
            '<div class="update-card__actions">' +
              '<button type="button" class="btn btn--primary" id="colaAbrir">' +
                icon("check", 16) + 'Confirmar</button>' +
            '</div>' +
          '</div>' +
        '</section>'
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
            '<div class="update-bar" id="updateBar" hidden>' +
              '<span class="update-bar__fill" id="updateBarFill"></span>' +
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
          (cardCola ? '<div style="--i:0">' + cardCola + '</div>' : "") +
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
          (cardLimit ? '<div style="--i:1">' + cardLimit + '</div>' : "") +
          '<div style="--i:2">' + cardUpcoming + '</div>' +
          (cardBudgets ? '<div style="--i:3">' + cardBudgets + '</div>' : "") +
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
        catFace(cat, 22, "avatar-letter") +
        '<span class="row__body">' +
          '<span class="row__title">' + esc(t.note) + '</span>' +
          '<span class="row__meta">' + esc(S.nombreLargo(t.categoryId) || cat.name) +
            ' · ' + esc(S.relDayLabel(t.date)) + '</span>' +
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

            (cuentaFiltro
              ? '<div class="chips">' +
                  '<button type="button" class="chip" id="movsAccClear" ' +
                          'aria-pressed="true">' +
                    esc(cuentaFiltro.name) +
                    '<span data-icon="close" data-icon-size="11"></span>' +
                  '</button>' +
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
        /* El rosco dice el total y las proporciones a la vez; la lista de
           debajo, la cifra exacta de cada una. Cada cosa hace lo suyo. */
        '<div class="donut" id="donutCats"></div>' +
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
      /* sin rejilla ni números al margen: la forma se lee sola y la
         cifra exacta sale al tocar */
      limpio: true,
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

    C.donut($("#donutCats", root), cats, {
      format: S.moneyShort,
      label: "Gastado",
      size: isDesktop() ? 210 : 180,
      ariaLabel: "Reparto del gasto por categoría"
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
          return '<button type="button" class="account" data-cuenta="' + esc(a.id) + '" ' +
                  'style="width:100%;text-align:left">' +
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

    if (type === "resumen") {
      var cfg = S.resumenCfg();
      d = {
        periodo: cfg.periodo,
        dias: cfg.dias,
        /* null en el estado significa «todas»; aquí se materializa la
           lista para poder ir marcando y desmarcando */
        cuentas: cfg.cuentas ? cfg.cuentas.slice()
                             : S.state.accounts.map(function (a) { return a.id; })
      };
    } else if (type === "saldo") {
      /* No se edita nada de la cuenta: solo se dice cuánto hay de verdad
         y la app apunta la diferencia. */
      var cuenta = S.state.accounts.find(function (x) { return x.id === id; });
      d = { accountId: id, real: cuenta ? S.accountBalance(id) : 0 };
    } else if (type === "category") {
      d = it
        ? { name: it.name, emoji: it.emoji, color: it.color, kind: it.kind,
            parentId: it.parentId || "" }
        : { name: "", emoji: "🏷️", color: 1,
            kind: (opts && opts.kind === "in") ? "in" : "out",
            /* al crear desde dentro de una madre, ya viene puesta */
            parentId: (opts && opts.parentId) || "" };
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
            freq: it.freq === "semanal" ? "semanal" : "mensual",
            weekdays: S.diasDe(it),
            pagas: +it.pagas === 14 ? 14 : 12,
            confirmar: !!it.confirmar,
            importeAbierto: !!it.importeAbierto,
            /* El modo se guarda tal cual y no se deduce de la tarifa: al
               elegir «Por horas» la tarifa todavía está vacía, y deducirlo
               dejaba el formulario en el modo anterior. */
            modo: it.tarifa > 0 ? "hora" : it.importeAbierto ? "varia" : "fijo",
            tarifa: it.tarifa == null ? "" : it.tarifa,
            hora: it.hora || "09:00",
            avisar: !!it.avisar,
            cuotas: it.cuotas == null ? "" : it.cuotas,
            categoryId: it.categoryId, accountId: it.accountId,
            toAccountId: it.toAccountId || (accs[1] || accs[0]).id }
        : { kind: "out", note: "", amount: "", day: 1,
            freq: "mensual", weekdays: [0], pagas: 12, confirmar: false,
            importeAbierto: false, modo: "fijo", tarifa: "",
            hora: "09:00", avisar: false, cuotas: "",
            categoryId: "hogar",
            accountId: accs[0].id, toAccountId: (accs[1] || accs[0]).id };
    }

    form = { type: type, id: id || null, d: d };
    ui.opcionesRec = false;

    $("#sheetFormTitle").textContent = {
      account: id ? "Editar cuenta" : "Nueva cuenta",
      goal: id ? "Editar meta" : "Nueva meta",
      recurring: id ? "Editar programado" : "Nuevo programado",
      saldo: "Corregir el saldo",
      resumen: "Qué cuentan estas cifras",
      category: id ? "Editar categoría" : "Nueva categoría"
    }[type] || "Editar";

    renderForm();
    sheets.form.show();
  }

  function findFor(type, id) {
    if (type === "saldo" || type === "resumen") return null;   /* no editan una ficha */
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

  var DIAS_LARGO = ["Lunes", "Martes", "Miércoles", "Jueves",
                    "Viernes", "Sábado", "Domingo"];

  /* «Cada lunes», «Lunes y jueves», «Lunes, miércoles y viernes». Con los
     siete puestos no se enumeran: se dice que es todos los días. */
  function listaDias(dias) {
    if (dias.length === 7) return "Todos los días";
    var nombres = dias.map(function (i) { return DIAS_LARGO[i].toLowerCase(); });
    if (nombres.length === 1) {
      return "Cada " + nombres[0];
    }
    var ultimo = nombres.pop();
    var txt = nombres.join(", ") + " y " + ultimo;
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }

  /* Cómo se lee el ritmo de un programado en una línea. */
  function ritmoDe(r) {
    if (r.freq === "semanal") return listaDias(S.diasDe(r));
    if (r.kind === "in" && +r.pagas === 14) return "14 pagas, día " + r.day;
    var quedan = S.cuotasQueQuedan(r);
    if (quedan != null) {
      return "Día " + r.day + " · " +
             (quedan === 0 ? "pagado del todo"
                           : "quedan " + quedan + (quedan === 1 ? " cuota" : " cuotas"));
    }
    return "Cada día " + r.day;
  }

  /* Un interruptor de sí/no con su explicación debajo. Es un botón, no un
     checkbox: así se puede tocar en cualquier parte de la fila, que en el
     móvil es la diferencia entre acertar y no. */
  function switchRow(id, label, hint, on) {
    return '<div class="field" style="margin-top:var(--sp-5)">' +
        '<button type="button" class="switch-row" id="' + id + '" ' +
                'role="switch" aria-checked="' + (!!on) + '">' +
          '<span class="switch-row__text">' +
            '<span class="switch-row__label">' + esc(label) + '</span>' +
            (hint ? '<span class="switch-row__hint">' + esc(hint) + '</span>' : "") +
          '</span>' +
          '<span class="switch" aria-hidden="true"><span class="switch__dot"></span></span>' +
        '</button>' +
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

      /* Una que ya tiene hijas no puede meterse dentro de nadie. */
      var tieneHijas = form.id && S.hijasDe(form.id).length > 0;
      var madresPosibles = tieneHijas ? [] : S.categoriasMadre(d.kind)
        .filter(function (c) { return c.id !== form.id && !c.sistema; });

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

        /* Meterla dentro de otra. Solo se ofrecen las de primer nivel del
           mismo tipo, y solo si esta no tiene ya hijas: un nivel y no más,
           que dos ya obligan a pensar dónde va cada cosa. */
        (madresPosibles.length
          ? '<div class="field">' +
              '<span class="field__label">Dentro de</span>' +
              pickField("fMadre", d.parentId || "",
                        d.parentId ? catOf(d.parentId).name : "Nada, va suelta") +
              '<p class="field__hint">' +
                (d.parentId
                  ? "En los gráficos sumará dentro de «" +
                    esc(catOf(d.parentId).name) + "», pero en la lista de " +
                    "movimientos se distingue."
                  : "Puedes meterla dentro de otra, por ejemplo «Deuda coche» " +
                    "dentro de «Deudas».") +
              '</p>' +
            '</div>'
          : "") +

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
            '<span class="field__label">Tipo</span>' +
            pickField("fType", d.type, d.type) +
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

    if (t === "resumen") {
      var todas = d.cuentas.length === S.state.accounts.length;

      html =
        '<div class="field">' +
          '<span class="field__label">De cuándo</span>' +
          '<div class="chips">' +
            [["mes", "Este mes"], ["ano", "Este año"],
             ["dias", "Últimos días"], ["todo", "Desde el principio"]].map(function (o) {
              return '<button type="button" class="chip" data-fperiodo="' + o[0] + '" ' +
                       'aria-pressed="' + (d.periodo === o[0]) + '">' + o[1] + '</button>';
            }).join("") +
          '</div>' +
        '</div>' +

        (d.periodo === "dias"
          ? '<div class="field">' +
              numField("fDias", "Cuántos días", d.dias, 1, "días") +
              '<p class="field__hint">Por ejemplo 7 para la semana, o 90 para el ' +
                'trimestre.</p>' +
            '</div>'
          : "") +

        '<div class="field" style="margin-top:var(--sp-6)">' +
          '<div class="card__head" style="margin-bottom:var(--sp-3)">' +
            '<span class="field__label" style="margin:0">De qué cuentas</span>' +
            '<button type="button" class="card__link" id="fTodasCuentas">' +
              (todas ? "Ninguna" : "Todas") + '</button>' +
          '</div>' +
          S.state.accounts.map(function (a) {
            var puesta = d.cuentas.indexOf(a.id) >= 0;
            return '<button type="button" class="pick" data-fcuenta="' + esc(a.id) + '" ' +
                     'aria-pressed="' + puesta + '">' +
                '<span class="pick__punto" style="background:' +
                  S.catColorVar(a) + '"></span>' +
                '<span class="pick__texto">' +
                  '<span class="pick__nombre">' + esc(a.name) + '</span>' +
                  '<span class="pick__sub">' + esc(a.type) + '</span>' +
                '</span>' +
                (puesta
                  ? '<span class="pick__tick" data-icon="check" data-icon-size="16"></span>'
                  : '') +
              '</button>';
          }).join("") +
          (d.cuentas.length
            ? ""
            : '<p class="field__hint">' + icon("warning", 12) +
              ' Marca al menos una, o no habrá nada que contar.</p>') +
        '</div>';
    }

    if (t === "saldo") {
      var cuentaS = S.state.accounts.find(function (x) { return x.id === d.accountId; });
      var actual = cuentaS ? S.accountBalance(d.accountId) : 0;
      var puesto = parseFloat(d.real);
      var dif = isFinite(puesto) ? Math.round((puesto - actual) * 100) / 100 : 0;

      html =
        '<div style="text-align:center;padding:var(--sp-2) 0 var(--sp-5)">' +
          '<p class="card__title">' + esc(cuentaS ? cuentaS.name : "") + '</p>' +
          '<p class="card__sub" style="margin-top:2px">La app dice que tienes ' +
            esc(money(actual)) + '</p>' +
        '</div>' +

        '<div class="field">' +
          '<label class="field__label" for="fReal">¿Cuánto tienes de verdad?</label>' +
          '<div class="input-affix">' +
            '<input type="number" class="field__input field__input--big" id="fReal" ' +
                   'data-f="Real" step="0.01" inputmode="decimal" value="' +
                   esc(d.real) + '">' +
            '<span class="input-affix__suffix">€</span>' +
          '</div>' +
        '</div>' +

        /* Lo que se va a apuntar, dicho antes de tocar nada. Que nadie se
           encuentre un movimiento que no esperaba. */
        '<div class="ajuste" id="fAjuste" data-dif="' +
              (dif > 0 ? "in" : dif < 0 ? "out" : "cero") + '">' +
          (Math.abs(dif) < 0.005
            ? '<span class="ajuste__txt">Ya cuadra: no hay nada que apuntar.</span>'
            : '<span class="ajuste__txt">Se apuntará ' +
                (dif > 0 ? "un ingreso" : "un gasto") + ' de</span>' +
              '<span class="ajuste__eur">' + esc(money(Math.abs(dif))) + '</span>') +
        '</div>' +

        '<p class="field__hint">Queda como un movimiento normal, con la fecha de ' +
          'hoy y la categoría «Ajuste de saldo». Se puede borrar o editar después ' +
          'como cualquier otro.</p>';
    }

    if (t === "recurring") {
      var cats = S.CATEGORIES.filter(function (c) {
        return c.kind === (d.kind === "in" ? "in" : "out");
      });
      var mismaCuenta = d.kind === "transfer" && d.accountId === d.toAccountId;
      var esSem = d.freq === "semanal";
      var modoImporte = d.kind === "in" ? (d.modo || "fijo") : "fijo";
      /* Un traspaso necesita sus dos cuentas sí o sí, así que ahí las
         opciones se abren de entrada. */
      var opcionesAbiertas = ui.opcionesRec || d.kind === "transfer";
      var cuotasHechas = form.id
        ? ((S.state.recurring.find(function (x) { return x.id === form.id; }) || {}).pagadas || 0)
        : 0;

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

        /* Un trabajo por horas no tiene un importe: tiene una tarifa. Y
           hay quien ni eso sabe hasta que cobra. Tres formas de decirlo,
           y solo se enseña el campo de la que se elija. */
        (d.kind === "in"
          ? '<div class="field" style="margin-top:var(--sp-5)">' +
              '<span class="field__label">Cuánto cobras</span>' +
              '<div class="segmented" id="fModoSeg" role="tablist">' +
                '<span class="segmented__thumb" id="fModoThumb" aria-hidden="true"></span>' +
                '<button type="button" class="segmented__btn" role="tab" data-fmodo="fijo" ' +
                        'aria-selected="' + (modoImporte === "fijo") + '">Siempre igual</button>' +
                '<button type="button" class="segmented__btn" role="tab" data-fmodo="hora" ' +
                        'aria-selected="' + (modoImporte === "hora") + '">Por horas</button>' +
                '<button type="button" class="segmented__btn" role="tab" data-fmodo="varia" ' +
                        'aria-selected="' + (modoImporte === "varia") + '">Varía</button>' +
              '</div>' +
            '</div>'
          : "") +

        (modoImporte === "hora"
          ? '<div class="field" style="margin-top:var(--sp-5)">' +
              numField("fTarifa", "Lo que cobras por hora", d.tarifa, 0.5) +
              '<p class="field__hint">Cada vez que toque, la app te pregunta ' +
                'cuántas horas has echado y hace la cuenta.</p>' +
            '</div>'

          : modoImporte === "varia"
            ? '<div class="field" style="margin-top:var(--sp-5)">' +
                numField("fAmount", "Más o menos (opcional)", d.amount, 5) +
                '<p class="field__hint">Solo para hacerse una idea del mes. ' +
                  'Cada vez que toque se te preguntará la cifra de verdad, y ' +
                  'puedes dejar esto vacío.</p>' +
              '</div>'

            : '<div class="field" style="margin-top:var(--sp-5)">' +
                numField("fAmount", "Importe", d.amount, 5) +
              '</div>') +

        /* Con qué ritmo se repite. Dos opciones y ya: nadie quiere una
           pantalla de reglas de calendario para apuntar el alquiler. */
        '<div class="field" style="margin-top:var(--sp-5)">' +
          '<span class="field__label">Cada cuánto</span>' +
          '<div class="segmented" id="fFreqSeg" role="tablist">' +
            '<span class="segmented__thumb" id="fFreqThumb" aria-hidden="true"></span>' +
            '<button type="button" class="segmented__btn" role="tab" data-ffreq="mensual" ' +
                    'aria-selected="' + !esSem + '">Al mes</button>' +
            '<button type="button" class="segmented__btn" role="tab" data-ffreq="semanal" ' +
                    'aria-selected="' + esSem + '">A la semana</button>' +
          '</div>' +
        '</div>' +

        /* Y qué día. Los siete días caben en una fila a lo ancho de la
           hoja; metidos en media columna se partían en dos. */
        (esSem
          ? '<div class="field" style="margin-top:var(--sp-5)">' +
              '<span class="field__label">Qué día</span>' +
              '<div class="chips chips--dias" role="group" aria-label="Días de la semana">' +
                DIAS_LARGO.map(function (nombre, i) {
                  return '<button type="button" class="chip chip--dia" data-fweekday="' + i + '" ' +
                         'aria-pressed="' + (d.weekdays.indexOf(i) >= 0) + '" ' +
                         'aria-label="' + esc(nombre) + '">' +
                         esc(S.DOW_SHORT[i]) + '</button>';
                }).join("") +
              '</div>' +
              '<p class="field__hint">Puedes marcar varios.</p>' +
            '</div>'
          : '<div class="field" style="margin-top:var(--sp-5)">' +
              '<label class="field__label" for="fDay">Día del mes</label>' +
              '<input type="number" class="field__input" id="fDay" data-f="Day" min="1" max="28" ' +
                     'step="1" inputmode="numeric" value="' + esc(d.day) + '">' +
            '</div>') +

        /* Las catorce pagas son cosa de las nóminas de aquí: dos extras,
           en junio y en diciembre. Solo tiene sentido en cobros mensuales. */
        (d.kind === "in" && !esSem
          ? '<div class="field" style="margin-top:var(--sp-5)">' +
              '<span class="field__label">Pagas al año</span>' +
              '<div class="segmented" id="fPagasSeg" role="tablist">' +
                '<span class="segmented__thumb" id="fPagasThumb" aria-hidden="true"></span>' +
                '<button type="button" class="segmented__btn" role="tab" data-fpagas="12" ' +
                        'aria-selected="' + (+d.pagas !== 14) + '">12</button>' +
                '<button type="button" class="segmented__btn" role="tab" data-fpagas="14" ' +
                        'aria-selected="' + (+d.pagas === 14) + '">14</button>' +
              '</div>' +
            '</div>'
          : "") +

        /* El sueldo casi nunca cae clavado: horas de más, un mes con
           menos días trabajados... Con esto la app pregunta en vez de
           apuntar una cifra que luego hay que corregir a mano. */
        /* Con «Por horas» o «Varía» ya se pregunta siempre: ofrecer el
           interruptor sería ofrecer algo que no se puede apagar. */
        (modoImporte === "fijo"
          ? switchRow("fConfirmar", "Preguntarme el importe",
              d.kind === "in"
                ? "Antes de apuntarlo te enseña la cifra por si cobras algo más o menos"
                : "Antes de apuntarlo te deja ajustar la cifra",
              d.confirmar)
          : '<p class="field__hint" style="margin-top:var(--sp-4)">' +
              icon("check", 12) + ' Se te preguntará cada vez, que para eso ' +
              'no hay una cifra fija.</p>') +

        /* Hora, aviso, cuenta y categoría van recogidos. Con nueve
           controles delante, crear una nómina normal daba pereza; lo de
           arriba —concepto, importe, cada cuánto y qué día— es lo que casi
           siempre basta. */
        '<div class="field" style="margin-top:var(--sp-4)">' +
          '<button type="button" class="fold-head fold-head--suelto" id="fOpciones" ' +
                  'aria-expanded="' + opcionesAbiertas + '">' +
            '<span class="card__title">Más opciones</span>' +
            '<span class="fold-head__chev" data-icon="chevDown" data-icon-size="15"></span>' +
          '</button>' +
          '<div class="fold" data-open="' + opcionesAbiertas + '">' +
            '<div class="fold__inner">' +

              /* A qué hora. Un aviso a las nueve de la mañana de algo que
                 se cobra al salir del turno no sirve de nada. */
              '<div class="field__row">' +
                '<div>' +
                  '<label class="field__label" for="fHora">A qué hora</label>' +
                  '<input type="time" class="field__input" id="fHora" data-f="Hora" ' +
                         'value="' + esc(d.hora || "09:00") + '">' +
                '</div>' +
                '<div></div>' +
              '</div>' +

              switchRow("fAvisar", "Avisarme en el móvil",
                "Una notificación el día que toque, a esa hora",
                d.avisar) +

              /* Un préstamo tiene final. Sin esto había que acordarse de
                 apagarlo a mano el mes que se termina de pagar. */
              (d.kind === "out"
                ? '<div class="field" style="margin-top:var(--sp-5)">' +
                    numField("fCuotas", "Cuántas veces en total", d.cuotas, 1, "veces") +
                    '<p class="field__hint">' +
                      (parseFloat(d.cuotas) > 0
                        ? (form.id && cuotasHechas
                            ? "Llevas " + cuotasHechas + " de " + parseInt(d.cuotas, 10) +
                              ". Cuando se paguen todas se apagará solo."
                            : "Se apagará solo cuando se hayan pagado las " +
                              parseInt(d.cuotas, 10) + ".")
                        : "Déjalo vacío si no se acaba nunca, como el alquiler. " +
                          "Ponlo si es un préstamo: 12, 24, las que sean.") +
                    '</p>' +
                  '</div>'
                : "") +

              (d.kind === "transfer"
                ? '<div class="field__row" style="margin-top:var(--sp-5)">' +
                    '<div>' +
                      '<span class="field__label">Desde</span>' +
                      accountSelect("fAccount", d.accountId) +
                    '</div>' +
                    '<div>' +
                      '<span class="field__label">Hacia</span>' +
                      accountSelect("fToAccount", d.toAccountId) +
                    '</div>' +
                  '</div>'
                : '<div class="field__row" style="margin-top:var(--sp-5)">' +
                    '<div>' +
                      '<span class="field__label">Categoría</span>' +
                      pickField("fCat", d.categoryId, catOf(d.categoryId).name) +
                    '</div>' +
                    '<div>' +
                      '<span class="field__label">Cuenta</span>' +
                      accountSelect("fAccount", d.accountId) +
                    '</div>' +
                  '</div>') +
            '</div>' +
          '</div>' +
        '</div>' +

        '<p class="field__hint">' +
          (mismaCuenta
            ? icon("warning", 12) + " Elige dos cuentas distintas."
            : esSem
              ? listaDias(d.weekdays) + "."
              : (d.kind === "in" && +d.pagas === 14
                  ? "Cada mes, con paga extra en junio y en diciembre. Máximo día 28."
                  : "Cada mes. Máximo día 28.")) +
        '</p>';
    }

    var bloqueado = t === "recurring" && d.kind === "transfer" &&
                    d.accountId === d.toAccountId;

    body.innerHTML = html +
      '<div class="field" style="margin-top:var(--sp-6)">' +
        '<button type="button" class="btn btn--primary" id="fSave"' +
          (bloqueado ? " disabled" : "") + '>' +
          icon("check", 17) +
          (t === "saldo" ? "Corregir"
           : t === "resumen" ? "Aplicar"
           : form.id ? "Guardar cambios" : "Crear") + '</button>' +
      '</div>' +
      (form.id && t !== "saldo" && t !== "resumen"
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

      var segF = $("#fFreqSeg", body);
      if (segF) U.slideIndicator(segF, $("#fFreqThumb", body),
        $('[data-ffreq="' + (d.freq === "semanal" ? "semanal" : "mensual") + '"]', segF));

      var segM = $("#fModoSeg", body);
      if (segM) U.slideIndicator(segM, $("#fModoThumb", body),
        $('[data-fmodo="' + modoImporte + '"]', segM));

      var segP = $("#fPagasSeg", body);
      if (segP) U.slideIndicator(segP, $("#fPagasThumb", body),
        $('[data-fpagas="' + (+d.pagas === 14 ? 14 : 12) + '"]', segP));
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

  function refreshAjuste() {
    var caja = $("#fAjuste");
    if (!caja) return;
    var actual = S.accountBalance(form.d.accountId);
    var puesto = parseFloat(form.d.real);
    var dif = isFinite(puesto) ? Math.round((puesto - actual) * 100) / 100 : 0;

    caja.setAttribute("data-dif", dif > 0 ? "in" : dif < 0 ? "out" : "cero");
    caja.innerHTML = Math.abs(dif) < 0.005
      ? '<span class="ajuste__txt">Ya cuadra: no hay nada que apuntar.</span>'
      : '<span class="ajuste__txt">Se apuntará ' +
          (dif > 0 ? "un ingreso" : "un gasto") + ' de</span>' +
        '<span class="ajuste__eur">' + esc(money(Math.abs(dif))) + '</span>';
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

      /* si se vino desde el selector del movimiento, se vuelve allí con el
         importe que se llevaba tecleado; si además era nueva, ya elegida */
      if (ui.catReturnToAdd) {
        ui.catReturnToAdd = false;
        if (!id) ui.draft.categoryId = cat.id;
        sheets.form.close();
        renderAddSheet();
        sheets.add.show();
        return;
      }
    }

    if (t === "resumen") {
      if (!d.cuentas.length) {
        U.toast("Marca al menos una cuenta", { icon: "warning" }); return;
      }
      S.setResumen({
        periodo: d.periodo,
        dias: parseInt(d.dias, 10) || 30,
        /* todas marcadas se guarda como «todas», no como la lista: así
           una cuenta nueva entra sola en vez de quedarse fuera */
        cuentas: d.cuentas.length === S.state.accounts.length ? null : d.cuentas
      });
      U.toast("Hecho", { icon: "check" });
    }

    if (t === "saldo") {
      var puestoS = parseFloat(d.real);
      if (!isFinite(puestoS)) {
        U.toast("Pon cuánto tienes de verdad", { icon: "warning" }); return;
      }
      var res = S.corregirSaldo(d.accountId, puestoS);
      if (!res) { U.toast("Esa cuenta ya no existe", { icon: "warning" }); return; }
      U.toast(res.dif === 0
        ? "Ya cuadraba: no se ha apuntado nada"
        : "Saldo corregido, " + (res.dif > 0 ? "+" : "−") + money(Math.abs(res.dif)),
        { icon: "check" });
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
      var modoG = d.kind === "in" ? (d.modo || "fijo") : "fijo";
      if (modoG === "hora") {
        if (!(parseFloat(d.tarifa) > 0)) {
          U.toast("Pon lo que cobras por hora", { icon: "warning" }); return;
        }
      } else if (modoG === "varia") {
        /* el importe es opcional: se preguntará cada vez */
      } else if (!(parseFloat(d.amount) > 0)) {
        U.toast("El importe tiene que ser mayor que cero", { icon: "warning" }); return;
      }
      var data = {
        kind: d.kind, note: d.note, amount: d.amount, day: d.day,
        freq: d.freq === "semanal" ? "semanal" : "mensual",
        weekdays: d.weekdays,
        /* Un gasto no tiene modos: siempre lleva su importe. */
        importeAbierto: d.kind === "in" && d.modo !== "fijo",
        tarifa: (d.kind === "in" && d.modo === "hora" && parseFloat(d.tarifa) > 0)
          ? parseFloat(d.tarifa) : null,
        hora: d.hora,
        avisar: !!d.avisar,
        cuotas: (d.kind === "out" && parseFloat(d.cuotas) > 0)
          ? parseInt(d.cuotas, 10) : null,
        /* las catorce pagas solo existen en un cobro mensual */
        pagas: (d.kind === "in" && d.freq !== "semanal" && +d.pagas === 14) ? 14 : 12,
        confirmar: !!d.confirmar,
        accountId: d.accountId,
        toAccountId: d.kind === "transfer" ? d.toAccountId : null,
        categoryId: d.kind === "transfer" ? "otros" : d.categoryId
      };
      if (id) S.updateRecurring(id, data); else S.addRecurring(data);
      U.toast(id ? "Programado actualizado" : "Programado creado", { icon: "check" });
    }

    sheets.form.close();
    S.runRecurring();
    sincronizarAvisos();
    renderAll();

    /* Si el programado que se acaba de guardar ya tocaba y pide que le
       pregunten el importe, se pregunta ahora y no en la próxima apertura. */
    if (t === "recurring" && hayPendientes()) setTimeout(abrirCobros, 380);
  }

  function deleteForm() {
    var t = form.type, id = form.id;

    if (t === "category") {
      var resCat = S.deleteCategory(id);
      if (!resCat.ok) { U.toast(resCat.reason, { icon: "warning", duration: 5500 }); return; }
      U.toast("Categoría eliminada", { icon: "check" });

      if (ui.catReturnToAdd) {
        ui.catReturnToAdd = false;
        /* el borrador apuntaba a la que acaba de desaparecer */
        if (ui.draft && ui.draft.categoryId === id) {
          var quedan = S.categoriesOf(ui.draft.kind === "in" ? "in" : "out");
          ui.draft.categoryId = quedan.length ? quedan[0].id : "otros";
        }
        sheets.form.close();
        renderAddSheet();
        sheets.add.show();
        return;
      }
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
      sincronizarAvisos();
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

    var main =
      '<section class="card">' +
        '<div class="card__head">' +
          '<h2 class="card__title">Cuánto cuentas al mes</h2>' +
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
                    ? "Media de tus últimos " + inc.months + " meses"
                    : "Aún sin historial: se usa la cifra manual")) + '</p>' +
        '</div>' +

        (modo === "auto"
          ? '<div class="field">' +
              '<span class="field__label">Meses que promedia</span>' +
              pickField("incMonths", inc.months, inc.months + " meses") +
              '<p class="field__hint">Cuenta lo que te ha entrado de verdad. ' +
                'Un mes con paga extra sube la media solo.</p>' +
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
            '<h2 class="card__title">Presupuesto del mes</h2>' +
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

  function themeLabel(t) {
    return t === "dark" ? "Oscuro" : t === "light" ? "Claro" : "Automático, como el sistema";
  }
  function themeShort(t) {
    return t === "dark" ? "Oscuro" : t === "light" ? "Claro" : "Automático";
  }

  /* Los emojis de Apple, Samsung y Xiaomi son fuentes propietarias: no se
     pueden meter dentro de la app. Quien los quiera los tiene ya con
     «Sistema», que es justo lo que le pinta su móvil. Lo que se puede
     traer son los dos de licencia abierta. */
  var EMOJI_NOMBRE = {
    sistema: "Los de tu móvil",
    noto: "Noto, los de Google",
    twemoji: "Twemoji, planos"
  };
  var EMOJI_CORTO = { sistema: "Tu móvil", noto: "Noto", twemoji: "Twemoji" };

  function emojiHint(v) { return EMOJI_NOMBRE[v] || EMOJI_NOMBRE.sistema; }
  function emojiCorto(v) { return EMOJI_CORTO[v] || EMOJI_CORTO.sistema; }

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

    var segs = S.budgetedCategories()
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

    /* El campo en euros NO se reescribe mientras se teclea: hacerlo
       movería el cursor a media cifra. Solo se refresca el porcentaje. */
    $$("[data-alloc-pct]").forEach(function (n) {
      n.textContent = (S.state.allocation[n.getAttribute("data-alloc-pct")] || 0) +
                      " % de lo que entra";
    });
  }

  function bindAjustes() {
    var root = $("#view-ajustes");

    root.addEventListener("input", function (e) {
      if (e.target.id === "incManual") {
        S.setIncome({ manual: e.target.value });
        refreshAllocation();
      } else if (e.target.matches("[data-alloc-eur]")) {
        S.setAllocationEuros(e.target.getAttribute("data-alloc-eur"), e.target.value);
        refreshAllocation();
      }
    });

    root.addEventListener("click", function (e) {
      var node;

      if ((node = e.target.closest("[data-incmode]"))) {
        S.setIncome({ mode: node.getAttribute("data-incmode") });
        renderAjustes();
        U.haptic("light");
        return;
      }

      /* Añadir una categoría al presupuesto: entra con un décimo de lo
         que cobras, una cifra redonda de la que partir en vez de un cero
         que no dice nada. */
      if ((node = e.target.closest("[data-alloc-add]"))) {
        S.setAllocation(node.getAttribute("data-alloc-add"), 10);
        renderAjustes();
        U.haptic("light");
        return;
      }

      if ((node = e.target.closest("[data-alloc-quitar]"))) {
        S.removeAllocation(node.getAttribute("data-alloc-quitar"));
        renderAjustes();
        U.haptic("light");
        return;
      }

      if (e.target.closest("#allocReset")) {
        if (!confirm("¿Quitar todo el presupuesto? Los movimientos no se tocan.")) return;
        S.resetAllocation();
        renderAjustes();
        U.toast("Presupuesto vaciado", { icon: "check" });
      }
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

    /* La guía se puede repetir cuando se quiera: no borra nada, arranca
       con las cuentas que ya hay y solo añade lo que se escriba. */
    if (action === "guia") { startOnboarding(); return; }

    if (action === "emojis") {
      pick("Juego de emojis", [
        { value: "sistema", label: EMOJI_NOMBRE.sistema,
          sub: "Los que te pinta tu teléfono", muestra: "sistema" },
        { value: "noto", label: EMOJI_NOMBRE.noto,
          sub: "Los de un Android sin capa encima", muestra: "noto" },
        { value: "twemoji", label: EMOJI_NOMBRE.twemoji,
          sub: "Sin sombras ni brillos, como el resto de la app",
          muestra: "twemoji" }
      ], S.getEmojiSet()).then(function (v) {
        if (v == null) return;
        S.setEmojiSet(v);
        renderAll();
        U.toast("Emojis: " + emojiCorto(v).toLowerCase(), { icon: "sparkle" });
      });
      return;
    }

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
          /* Se dice QUÉ ha fallado y qué hacer. «¿Tienes conexión?» cuando
             la tienes es de las cosas que dejan a uno sin saber por dónde
             seguir. */
          var m = {
            limite: "GitHub ha cortado por muchas consultas seguidas. " +
                    "Prueba dentro de un rato.",
            tardanza: "GitHub ha tardado demasiado. Prueba otra vez.",
            red: "No se ha podido llegar a GitHub. ¿Tienes conexión?",
            http: res.motivo + ".",
            respuesta: "GitHub ha contestado algo raro. Prueba otra vez.",
            navegador: "Aquí no se puede comprobar."
          }[res.clase] || "No se ha podido comprobar.";

          U.toast(m + " Puedes bajarla a mano desde el enlace de abajo.",
                  { icon: "warning", duration: 7000 });
        } else {
          U.toast("Ya tienes la última versión", { icon: "check" });
        }
      });
    }
  }

  /* ============================================================
     Sheet · añadir / editar movimiento
     ============================================================ */

  /* `opts.accountId` deja la cuenta ya elegida: se usa al apuntar desde
     dentro de una cuenta, donde dar por hecho la primera sería absurdo. */
  function openAdd(kind, txId, opts) {
    var t = txId ? S.state.transactions.find(function (x) { return x.id === txId; }) : null;
    ui.editingId = txId || null;
    /* Cada vez que se abre, los detalles vuelven a estar recogidos: el
       plegable se abre solo si el movimiento ya trae algo dentro. */
    ui.detallesAbiertos = false;
    ui.catAbierta = null;
    var accs = S.state.accounts;
    ui.draft = t
      ? { kind: t.kind, amount: String(Math.round(t.amount * 100)), categoryId: t.categoryId,
          accountId: t.accountId, toAccountId: t.toAccountId || null,
          note: t.note, memo: t.memo || "", date: t.date, time: t.time || "",
          tags: Array.isArray(t.tags) ? t.tags.slice() : [],
          attachments: Array.isArray(t.attachments) ? t.attachments.slice() : [] }
      : { kind: kind || "out", amount: "", categoryId: kind === "in" ? "nomina" : "comida",
          accountId: (opts && opts.accountId) || accs[0].id,
          toAccountId: null,
          note: "", memo: "", date: S.ymd(new Date()), time: nowHHMM(),
          tags: [], attachments: [],
          /* reparto de un ingreso entre varias cuentas: apagado por
             defecto, y `trozos` guarda cuánto va a cada una */
          reparto: false, trozos: {},
          /* que el movimiento se repita a partir de ahora */
          repetir: false, repFreq: "mensual" };

    /* en un traspaso el destino tiene que ser otra cuenta */
    if (!t) {
      ui.draft.toAccountId = (accs.find(function (x) {
        return x.id !== ui.draft.accountId;
      }) || accs[0]).id;
    }

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

  /* «Que se repita»: apagado no ocupa casi nada, y encendido enseña solo
     cada cuánto y qué día. Todo lo demás —categoría, cuenta, importe— ya
     lo tiene el movimiento que se está apuntando. */
  function repetirHtml(d) {
    var fecha = S.parseYmd(d.date);
    var diaMes = Math.min(28, fecha.getDate());
    var diaSem = (fecha.getDay() + 6) % 7;

    if (!d.repetir) {
      return switchRow("addRepetir", "Que se repita",
        "Y lo apunto yo solo cada vez que toque", false);
    }

    return switchRow("addRepetir", "Que se repita",
        "Y lo apunto yo solo cada vez que toque", true) +

      '<div class="field" style="margin-top:var(--sp-3)">' +
        '<div class="segmented" id="addRepSeg" role="tablist">' +
          '<span class="segmented__thumb" id="addRepThumb" aria-hidden="true"></span>' +
          '<button type="button" class="segmented__btn" role="tab" data-repfreq="mensual" ' +
                  'aria-selected="' + (d.repFreq !== "semanal") + '">Cada mes</button>' +
          '<button type="button" class="segmented__btn" role="tab" data-repfreq="semanal" ' +
                  'aria-selected="' + (d.repFreq === "semanal") + '">Cada semana</button>' +
        '</div>' +
        '<p class="field__hint">' +
          (d.repFreq === "semanal"
            ? "Todos los " + DIAS_LARGO[diaSem].toLowerCase() + ", como hoy."
            : "El día " + diaMes + " de cada mes, como hoy.") +
          ' Luego se puede afinar en Mi dinero.</p>' +
      '</div>';
  }

  /* Lo que no hace falta ver para apuntar un gasto normal. Se abre solo
     cuando el movimiento ya trae algo dentro: si estás editando una cena
     con foto y notas y no las vieras, pensarías que se han perdido. */
  function detallesHtml(d) {
    var traeAlgo = !!(String(d.note).trim() || String(d.memo).trim() ||
                      (d.tags && d.tags.length) ||
                      (ui.draftAttachments && ui.draftAttachments.length) ||
                      /* en un traspaso las dos cuentas están aquí dentro y
                         son imprescindibles: no se puede empezar cerrado */
                      d.kind === "transfer");
    var abierto = ui.detallesAbiertos || traeAlgo;

    return '<div class="field" style="margin-top:var(--sp-4)">' +
        '<button type="button" class="fold-head fold-head--suelto" id="addDetalles" ' +
                'aria-expanded="' + abierto + '">' +
          '<span class="card__title">Más detalles</span>' +
          '<span class="fold-head__chev" data-icon="chevDown" data-icon-size="15"></span>' +
        '</button>' +

        '<div class="fold" data-open="' + abierto + '">' +
          '<div class="fold__inner">' +

            '<div class="field">' +
              '<label class="field__label" for="addNote">Título</label>' +
              '<input type="text" class="field__input" id="addNote" maxlength="40" ' +
                     'placeholder="' + esc(catOf(d.categoryId).name) + '" ' +
                     'value="' + esc(d.note) + '">' +
            '</div>' +

            (d.kind === "transfer"
              ? '<div class="field__row">' +
                  '<div>' +
                    '<span class="field__label">Desde</span>' +
                    accountSelect("addAccount", d.accountId) +
                  '</div>' +
                  '<div>' +
                    '<span class="field__label">Hacia</span>' +
                    accountSelect("addToAccount", d.toAccountId) +
                  '</div>' +
                '</div>'
              : "") +

            '<div class="field__row">' +
              '<div>' +
                '<label class="field__label" for="addDate">Fecha</label>' +
                '<input type="date" class="field__input" id="addDate" value="' +
                       esc(d.date) + '" max="' + esc(S.ymd(new Date())) + '">' +
              '</div>' +
              '<div>' +
                '<label class="field__label" for="addTime">Hora</label>' +
                '<input type="time" class="field__input" id="addTime" value="' +
                       esc(d.time) + '">' +
              '</div>' +
            '</div>' +

            tagsFieldHtml(d) +

            '<div class="field">' +
              '<label class="field__label" for="addMemo">Notas</label>' +
              '<textarea class="field__input field__input--area" id="addMemo" rows="3" ' +
                        'maxlength="500" placeholder="Lo que quieras recordar de este ' +
                        'movimiento">' + esc(d.memo) + '</textarea>' +
            '</div>' +

            attachFieldHtml() +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function nowHHMM() {
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function accountSelect(id, selected) {
    var a = S.state.accounts.find(function (x) { return x.id === selected; })
            || S.state.accounts[0];
    return pickField(id, a ? a.id : "", a ? a.name : "—");
  }

  /* Las opciones de cada desplegable, en un sitio: así el campo y la hoja
     que abre no se pueden desincronizar. */
  function opcionesDe(id) {
    if (id === "addAccount" || id === "addToAccount" ||
        id === "fAccount" || id === "fToAccount") {
      return {
        titulo: (id === "addToAccount" || id === "fToAccount") ? "¿Hacia dónde?" : "¿Qué cuenta?",
        lista: S.state.accounts.map(function (a) {
          return { value: a.id, label: a.name, sub: a.type, color: a.color || 1 };
        })
      };
    }
    if (id === "fCat") {
      var kind = form.d.kind === "in" ? "in" : "out";
      return {
        titulo: "¿Qué categoría?",
        lista: S.CATEGORIES.filter(function (c) { return c.kind === kind; })
          .map(function (c) {
            return { value: c.id, label: c.name, emoji: c.emoji, color: c.color };
          })
      };
    }
    if (id === "fMadre") {
      var lista = [{ value: "", label: "Nada, va suelta" }];
      S.categoriasMadre(form.d.kind).forEach(function (c) {
        if (c.id === form.id || c.sistema) return;
        lista.push({ value: c.id, label: c.name, emoji: c.emoji, color: c.color });
      });
      return { titulo: "¿Dentro de cuál?", lista: lista };
    }
    if (id === "fType") {
      return {
        titulo: "¿Qué tipo de cuenta?",
        lista: ["Banco", "Ahorro", "Efectivo", "Tarjeta"].map(function (x) {
          return { value: x, label: x };
        })
      };
    }
    if (id === "incMonths") {
      return {
        titulo: "¿Cuántos meses promedia?",
        lista: [3, 6, 12].map(function (n) {
          return { value: n, label: n + " meses" };
        })
      };
    }
    return null;
  }

  /* Qué hacer con lo elegido. Cada campo sabe lo suyo. */
  function aplicarPick(id, valor) {
    if (id === "addAccount") {
      ui.draft.accountId = valor;
      renderAddSheet();
    } else if (id === "addToAccount") {
      ui.draft.toAccountId = valor;
      renderAddSheet();
    } else if (id === "fAccount") {
      form.d.accountId = valor; renderForm();
    } else if (id === "fToAccount") {
      form.d.toAccountId = valor; renderForm();
    } else if (id === "fCat") {
      form.d.categoryId = valor; renderForm();
    } else if (id === "fMadre") {
      form.d.parentId = valor;
      /* hereda el color de la madre, como hace el store al guardar */
      if (valor) form.d.color = catOf(valor).color;
      renderForm();
    } else if (id === "fType") {
      form.d.type = valor; renderForm();
    } else if (id === "incMonths") {
      S.setIncome({ months: +valor }); renderAjustes();
    }
  }

  function draftValue() {
    return ui.draft.amount ? parseInt(ui.draft.amount, 10) / 100 : 0;
  }

  function renderAddSheet() {
    var d = ui.draft;
    var body = $("#sheetAddBody");
    /* En la cuadrícula solo van las de primer nivel. Las que estén dentro
       de otra salen en una fila aparte al tocar su madre, y así no se
       mezclan doce categorías con sus veinte hijas. */
    var cats = S.categoriasMadre(d.kind);
    var elegida = catOf(d.categoryId);
    /* si lo elegido es una hija, su madre aparece abierta */
    var abierta = elegida && elegida.parentId ? elegida.parentId : ui.catAbierta;
    var hijas = abierta ? S.hijasDe(abierta) : [];
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
                var conHijas = S.hijasDe(c.id).length > 0;
                return '<button type="button" class="cat-pick" data-cat="' + c.id + '" ' +
                         'aria-pressed="' + (c.id === d.categoryId) + '"' +
                         (conHijas ? ' data-con-hijas="1"' : '') + '>' +
                    catFace(c, 26, "cat-pick__icon") +
                    '<span class="cat-pick__name">' + esc(c.name) + '</span>' +
                  '</button>';
              }).join("") +
              '<button type="button" class="cat-pick cat-pick--add" ' +
                      'data-cat-new="' + d.kind + '">' +
                '<span class="cat-pick__icon">' + icon("plus", 18) + '</span>' +
                '<span class="cat-pick__name">Nueva</span>' +
              '</button>' +
            '</div>' +

            /* Las de dentro, cuando hay una madre abierta. Se puede quedar
               en la madre sin más: elegir «Deudas» a secas es válido. */
            (abierta
              ? '<div class="chips" style="margin-top:var(--sp-3)">' +
                  hijas.map(function (h) {
                    return '<button type="button" class="chip" data-cat="' + h.id + '" ' +
                             'aria-pressed="' + (h.id === d.categoryId) + '">' +
                           esc(h.emoji || "") + ' ' + esc(h.name) + '</button>';
                  }).join("") +
                  '<button type="button" class="chip chip--add" ' +
                          'data-cat-new-hija="' + esc(abierta) + '">' +
                    icon("plus", 12) + 'Nueva dentro' +
                  '</button>' +
                '</div>'
              : "") +

            '<p class="field__hint">Mantén pulsada una categoría para editarla.</p>' +
          '</div>') +

      /* Solo en un traspaso hacen falta las dos cuentas delante. */
      (d.kind === "transfer"
        ? ""
        : d.reparto
          ? repartoHtml(d, v)
          : '<div class="field" style="margin-top:var(--sp-4)">' +
              '<span class="field__label">Cuenta</span>' +
              accountSelect("addAccount", d.accountId) +
            '</div>') +

      /* Solo tiene sentido en un ingreso nuevo y con más de una cuenta:
         editar uno ya guardado es editar ese, no repartir de nuevo. */
      (d.kind === "in" && !ui.editingId && S.state.accounts.length > 1
        ? '<button type="button" class="btn btn--ghost" id="addReparto" ' +
                  'style="width:100%;margin-top:var(--sp-3)">' +
            icon(d.reparto ? "close" : "swap", 15) +
            (d.reparto ? "Ingresar todo en una cuenta" : "Repartir entre varias cuentas") +
          '</button>'
        : "") +

      /* Programar desde aquí. Antes había que apuntar el traspaso y luego
         irse a otra pantalla a crear el programado con los mismos datos.
         Repetir un pago, un cobro o un traspaso es lo mismo, así que se
         ofrece igual en los tres. */
      (ui.editingId ? "" : repetirHtml(d)) +

      /* Y el resto, cerrado. Apuntar un café son dos toques: importe y
         categoría. Tener delante título, fecha, hora, etiquetas, notas y
         adjuntos convertía eso en un formulario que hay que atravesar con
         la vista cada vez.

         No se pierde nada: lo que no se rellena tiene un valor sensato
         —el título es el nombre de la categoría, la fecha hoy, la hora
         ahora—. Y si el movimiento que se edita ya trae detalles, se abre
         solo, que si no parecería que se han borrado. */
      detallesHtml(d) +

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

      var segR = $("#addRepSeg", body);
      if (segR) U.slideIndicator(segR, $("#addRepThumb", body),
        $('[data-repfreq="' + (d.repFreq === "semanal" ? "semanal" : "mensual") + '"]', segR));
    });
  }

  /* ---------- repartir un ingreso entre cuentas ----------
     Se cobra una cantidad y no toda va al mismo sitio: una parte a la
     cuenta del día a día y otra a la hucha. Antes había que apuntar el
     ingreso entero y luego un traspaso a mano.

     No se inventa nada nuevo en los datos: se guarda un ingreso por
     cuenta. Cada uno es un movimiento normal, se edita y se borra por
     separado, y los saldos salen solos. */

  function sumaTrozos(d) {
    return S.state.accounts.reduce(function (t, a) {
      var v = parseFloat(d.trozos[a.id]);
      return t + (isFinite(v) && v > 0 ? v : 0);
    }, 0);
  }

  function restoPorRepartir(d, total) {
    return Math.round((total - sumaTrozos(d)) * 100) / 100;
  }

  function repartoHtml(d, total) {
    var resto = restoPorRepartir(d, total);

    return '<div class="field" style="margin-top:var(--sp-4)">' +
        '<div class="card__head" style="margin-bottom:var(--sp-3)">' +
          '<span class="field__label" style="margin:0">Cuánto va a cada cuenta</span>' +
          '<button type="button" class="card__link" id="addRepartoIgual">A partes iguales</button>' +
        '</div>' +

        S.state.accounts.map(function (a) {
          var val = d.trozos[a.id];
          return '<div class="reparto-fila">' +
              '<span class="reparto-fila__punto" ' +
                    'style="background:' + S.catColorVar(a) + '"></span>' +
              '<span class="reparto-fila__nombre">' + esc(a.name) + '</span>' +
              '<span class="input-affix reparto-fila__campo">' +
                '<input type="number" class="field__input" data-trozo="' + esc(a.id) + '" ' +
                       'min="0" step="0.01" inputmode="decimal" placeholder="0" ' +
                       'value="' + esc(val == null ? "" : val) + '">' +
                '<span class="input-affix__suffix">€</span>' +
              '</span>' +
            '</div>';
        }).join("") +

        '<div class="ajuste" id="addResto" data-dif="' +
              (Math.abs(resto) < 0.005 ? "cero" : resto > 0 ? "out" : "in") + '">' +
          textoResto(resto) +
        '</div>' +
      '</div>';
  }

  function textoResto(resto) {
    if (Math.abs(resto) < 0.005) {
      return '<span class="ajuste__txt">Repartido del todo.</span>';
    }
    if (resto > 0) {
      return '<span class="ajuste__txt">Queda por repartir</span>' +
             '<span class="ajuste__eur">' + esc(money(resto)) + '</span>';
    }
    return '<span class="ajuste__txt">Te has pasado</span>' +
           '<span class="ajuste__eur">' + esc(money(-resto)) + '</span>';
  }

  /* Se recalcula sin repintar: repintar dejaría el campo sin foco. */
  function refreshResto() {
    var caja = $("#addResto");
    if (!caja) return;
    var resto = restoPorRepartir(ui.draft, draftValue());
    caja.setAttribute("data-dif",
      Math.abs(resto) < 0.005 ? "cero" : resto > 0 ? "out" : "in");
    caja.innerHTML = textoResto(resto);
    refreshAmount();
  }

  function repartirIgual() {
    var cuentas = S.state.accounts;
    var total = draftValue();
    var trozo = Math.floor((total / cuentas.length) * 100) / 100;
    var acumulado = 0;

    cuentas.forEach(function (a, i) {
      /* el último se lleva lo que sobre del redondeo, para que la suma
         cuadre al céntimo */
      var v = i === cuentas.length - 1
        ? Math.round((total - acumulado) * 100) / 100
        : trozo;
      acumulado += v;
      ui.draft.trozos[a.id] = v;
    });

    renderAddSheet();
  }

  function refreshAmount() {
    var v = draftValue();
    var disp = $("#amountDisplay"), txt = $("#amountText"), save = $("#addSave");
    if (!disp || !txt) return;
    txt.textContent = S.num2.format(v);
    disp.classList.toggle("is-zero", v === 0);
    if (save) {
      var d = ui.draft;
      var repartoMal = d.reparto &&
        Math.abs(restoPorRepartir(d, v)) >= 0.005;
      save.disabled = v <= 0 ||
        (d.kind === "transfer" && d.accountId === d.toAccountId) ||
        repartoMal;
    }
  }

  function saveDraft() {
    var d = ui.draft, v = draftValue();
    if (v <= 0) return;

    /* Repartido: un ingreso por cuenta, todos con el mismo título, fecha
       y categoría. Los adjuntos van solo en el primero: duplicar la foto
       de una nómina en cada trozo ocuparía sitio para nada. */
    if (d.reparto && !ui.editingId) {
      var resto = restoPorRepartir(d, v);
      if (Math.abs(resto) >= 0.005) {
        U.toast(resto > 0
          ? "Todavía quedan " + money(resto) + " por repartir"
          : "Te has pasado en " + money(-resto), { icon: "warning" });
        return;
      }

      var adjuntos = (ui.draftAttachments || []).map(function (a) { return a.id; });
      var puestos = 0;
      S.state.accounts.forEach(function (a) {
        var trozo = parseFloat(d.trozos[a.id]);
        if (!(trozo > 0)) return;
        S.addTx({
          kind: "in", amount: trozo, categoryId: d.categoryId,
          accountId: a.id, toAccountId: null,
          note: d.note, memo: d.memo, date: d.date, time: d.time,
          tags: d.tags,
          attachments: puestos === 0 ? adjuntos : []
        });
        puestos++;
      });

      U.toast("Ingreso de " + money(v) + " repartido en " + puestos +
              (puestos === 1 ? " cuenta" : " cuentas"), { icon: "check" });
      U.haptic("success");
      sheets.add.close();
      renderAll();
      return;
    }

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

      var queEs = d.kind === "in" ? "Ingreso" : d.kind === "transfer" ? "Traspaso" : "Gasto";

      if (d.repetir) {
        programarDesde(d, v);
        U.toast(queEs + " de " + money(v) + " guardado, y se repetirá",
                { icon: "repeat", duration: 4500 });
      } else {
        U.toast(queEs + " de " + money(v) + " guardado", { icon: "check" });
      }
    }
    U.haptic("success");
    sheets.add.close();
    renderAll();
  }

  /* Crea el programado a partir del movimiento que se acaba de apuntar.
     Se marca como ya hecho en este periodo: si no, al recargar la app
     volvería a apuntar el de hoy y saldría dos veces. */
  function programarDesde(d, importe) {
    var fecha = S.parseYmd(d.date);
    var semanal = d.repFreq === "semanal";

    S.addRecurring({
      kind: d.kind,
      note: String(d.note).trim() || catOf(d.categoryId).name,
      amount: importe,
      categoryId: d.kind === "transfer" ? "otros" : d.categoryId,
      accountId: d.accountId,
      toAccountId: d.kind === "transfer" ? d.toAccountId : null,
      freq: semanal ? "semanal" : "mensual",
      weekdays: [(fecha.getDay() + 6) % 7],
      day: Math.min(28, fecha.getDate()),
      hora: d.time || "09:00",
      yaHecho: !semanal,
      desde: d.date
    });

    sincronizarAvisos();
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
    /* «Planes» no decía qué había dentro y las cuentas estaban escondidas
       ahí. Se llama por lo que la gente viene a buscar. */
    ahorro:   { eyebrow: "Cuentas y metas", title: "Mi dinero" },
    ajustes:  { eyebrow: "Configuración", title: "Ajustes" }
  };

  /* Dónde se quedó cada pantalla. Bajar media lista de movimientos, mirar
     una cosa en Análisis y volver para encontrarte otra vez arriba del todo
     es de las cosas que más cansan de una app. Tocar la pestaña de la
     pantalla en la que ya estás sigue llevando arriba, que es el atajo que
     todo el mundo conoce. */
  var desplazamiento = {};

  function goTo(view, skipHash) {
    if (!TITLES[view]) view = "inicio";

    var area = $("#scrollArea");

    if (ui.view === view) {
      desplazamiento[view] = 0;
      area.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    desplazamiento[ui.view] = area.scrollTop;

    ui.view = view;
    if (!skipHash && location.hash.slice(1) !== view) location.hash = view;

    $$(".view").forEach(function (v) {
      v.setAttribute("data-active", String(v.id === "view-" + view));
    });
    $$("[data-view]").forEach(function (b) {
      b.setAttribute("aria-selected", String(b.getAttribute("data-view") === view));
    });

    setTopbar(view);

    U.haptic("light");
    renderView(view);

    /* después de pintar, que si no la altura todavía es la de antes y el
       navegador recorta la posición */
    var y = desplazamiento[view] || 0;
    requestAnimationFrame(function () { area.scrollTop = y; });
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

      if ((node = e.target.closest("[data-cuenta]"))) {
        openCuenta(node.getAttribute("data-cuenta"));
        return;
      }
      if ((node = e.target.closest("[data-form]"))) {
        openForm(node.getAttribute("data-form"), node.getAttribute("data-form-id"));
        return;
      }
      if (e.target.closest("#kpiFiltro")) { openForm("resumen"); return; }
      if (e.target.closest("#colaAbrir")) { abrirCobros(); return; }
      if ((node = e.target.closest("[data-rec-toggle]"))) {
        var r = S.toggleRecurring(node.getAttribute("data-rec-toggle"));
        S.runRecurring();
        sincronizarAvisos();
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
      if (e.target.closest("#movsAccClear")) {
        ui.movsAccount = null; renderMovs(); U.haptic("light"); return;
      }

      if (e.target.closest("#updateNow")) { descargarActualizacion(); return; }
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

    /* --- una cuenta por dentro --- */
    var cuentaBody = $("#sheetCuentaBody");

    cuentaBody.addEventListener("click", function (e) {
      var id = cuentaAbierta;
      var node;

      /* un movimiento de la lista abre su detalle, como en cualquier
         otra parte de la app */
      if ((node = e.target.closest("[data-tx]"))) {
        sheets.cuenta.close();
        var txId = node.getAttribute("data-tx");
        setTimeout(function () { openDetail(txId); }, 220);
        return;
      }

      if (e.target.closest("#cuentaGasto")) {
        sheets.cuenta.close();
        setTimeout(function () { openAdd("out", null, { accountId: id }); }, 220);
        return;
      }
      if (e.target.closest("#cuentaTraspaso")) {
        sheets.cuenta.close();
        setTimeout(function () { openAdd("transfer", null, { accountId: id }); }, 220);
        return;
      }
      if (e.target.closest("#cuentaCorregir")) {
        ui.cuentaReturn = id;
        sheets.cuenta.close();
        setTimeout(function () { openForm("saldo", id); }, 220);
        return;
      }
      if (e.target.closest("#cuentaEditar")) {
        ui.cuentaReturn = id;
        sheets.cuenta.close();
        setTimeout(function () { openForm("account", id); }, 220);
        return;
      }
      if (e.target.closest("#cuentaVerTodos")) {
        sheets.cuenta.close();
        ui.movsAccount = id;
        goTo("movs");
      }
    });

    /* Los desplegables propios salen en las vistas y también dentro de
       varias hojas, así que se escuchan una sola vez en el documento en
       vez de repetir el mismo enganche en cada sitio. */
    document.addEventListener("click", function (e) {
      var node = e.target.closest("[data-pick-open]");
      if (!node) return;
      abrirPick(node.getAttribute("data-pick-open"), node.getAttribute("data-value"));
    });

    /* --- confirmar un programado --- */
    var cobroBody = $("#sheetCobroBody");

    cobroBody.addEventListener("click", function (e) {
      var cola = S.pendientes();
      var p = cola[0];
      if (!p) { sheets.cobro.close(); return; }

      if (e.target.closest("#cobroOk")) {
        var importe;
        var horas = $("#cobroHoras", cobroBody);

        if (horas) {
          var h = parseFloat(horas.value);
          if (!(h > 0)) {
            U.toast("Pon cuántas horas has echado", { icon: "warning" });
            return;
          }
          importe = Math.round(h * (+p.tarifa) * 100) / 100;
        } else {
          var campo = $("#cobroAmount", cobroBody);
          importe = campo ? parseFloat(campo.value) : NaN;
        }

        if (!(importe > 0)) {
          U.toast("El importe tiene que ser mayor que cero", { icon: "warning" });
          return;
        }
        S.confirmarPendiente(p.id, importe);
        U.haptic("success");
        U.toast("Apuntado " + money(importe), { icon: "check" });
        seguirCobros();
        return;
      }

      if (e.target.closest("#cobroNo")) {
        S.descartarPendiente(p.id);
        U.haptic("light");
        seguirCobros();
      }
    });

    /* El total se recalcula mientras se teclean las horas, para que se
       vea lo que va a entrar antes de aceptarlo. */
    cobroBody.addEventListener("input", function (e) {
      if (e.target.id !== "cobroHoras") return;
      var p = S.pendientes()[0];
      var total = $("#cobroTotal", cobroBody);
      if (!p || !total) return;
      var h = parseFloat(e.target.value);
      var eur = h > 0 ? Math.round(h * (+p.tarifa) * 100) / 100 : 0;
      total.textContent = money(eur);
      var caja = $("#cobroCalculo", cobroBody);
      if (caja) caja.setAttribute("data-dif", eur > 0 ? "in" : "cero");
    });

    /* Cerrar la hoja no descarta nada: lo que quede sigue en la cola y
       vuelve a preguntarse la próxima vez que se abra la app. */

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
      Real: function (v) { form.d.real = v; },
      Tarifa: function (v) { form.d.tarifa = v; },
      Hora: function (v) { form.d.hora = v; },
      Cuotas: function (v) { form.d.cuotas = v; },
      Dias: function (v) { form.d.dias = v; },
      Day: function (v) { form.d.day = v; },
      Cat: function (v) { form.d.categoryId = v; }
    };

    function readField(el) {
      var key = el.getAttribute("data-f");
      if (key && FIELD_MAP[key]) { FIELD_MAP[key](el.value); return true; }
      return false;
    }

    formBody.addEventListener("input", function (e) {
      if (!readField(e.target)) return;
      if (form.type === "category") refreshCatPreview();
      if (form.type === "account") refreshCardPreview();
      /* el aviso de «se apuntará X» se recalcula mientras se teclea, sin
         repintar: repintar dejaría el campo sin foco a media cifra */
      if (form.type === "saldo") refreshAjuste();
    });

    formBody.addEventListener("change", function (e) { readField(e.target); });

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
      if ((node = e.target.closest("[data-fperiodo]"))) {
        form.d.periodo = node.getAttribute("data-fperiodo");
        renderForm(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-fcuenta]"))) {
        var idC = node.getAttribute("data-fcuenta");
        var iC = form.d.cuentas.indexOf(idC);
        if (iC >= 0) form.d.cuentas.splice(iC, 1); else form.d.cuentas.push(idC);
        renderForm(); U.haptic("light"); return;
      }
      if (e.target.closest("#fTodasCuentas")) {
        form.d.cuentas = form.d.cuentas.length === S.state.accounts.length
          ? []
          : S.state.accounts.map(function (a) { return a.id; });
        renderForm(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-fmodo]"))) {
        form.d.modo = node.getAttribute("data-fmodo");
        if (form.d.modo !== "hora") form.d.tarifa = "";
        form.d.importeAbierto = form.d.modo !== "fijo";
        if (form.d.importeAbierto) form.d.confirmar = true;
        renderForm();
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("[data-ffreq]"))) {
        form.d.freq = node.getAttribute("data-ffreq");
        renderForm();
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("[data-fpagas]"))) {
        form.d.pagas = +node.getAttribute("data-fpagas");
        renderForm();
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("[data-fweekday]"))) {
        var dia = +node.getAttribute("data-fweekday");
        var i = form.d.weekdays.indexOf(dia);
        if (i >= 0) {
          /* tiene que quedar al menos uno: un semanal sin días no toca nunca */
          if (form.d.weekdays.length > 1) form.d.weekdays.splice(i, 1);
        } else {
          form.d.weekdays.push(dia);
        }
        form.d.weekdays.sort(function (a, b) { return a - b; });
        renderForm();
        U.haptic("light");
        return;
      }
      if (e.target.closest("#fOpciones")) {
        ui.opcionesRec = !ui.opcionesRec;
        renderForm(); U.haptic("light"); return;
      }
      if (e.target.closest("#fAvisar")) {
        var sw = e.target.closest("#fAvisar");
        form.d.avisar = sw.getAttribute("aria-checked") !== "true";
        sw.setAttribute("aria-checked", String(form.d.avisar));
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("#fConfirmar"))) {
        form.d.confirmar = node.getAttribute("aria-checked") !== "true";
        node.setAttribute("aria-checked", String(form.d.confirmar));
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

    /* Mantener pulsada cualquiera de las tres cifras del Resumen abre sus
       ajustes. El botón de debajo hace lo mismo y es lo que la gente va a
       encontrar; la pulsación larga es para quien ya lo sabe. */
    U.longPress($("#scrollArea"), "#kpiRow .stat", function () {
      openForm("resumen");
    });

    /* Mantener pulsada una categoría la abre para editar, en vez de
       seleccionarla. El clic que viene detrás se traga solo. */
    U.longPress(addBody, "[data-cat]", function (node) {
      ui.catReturnToAdd = true;
      sheets.add.close();
      openForm("category", node.getAttribute("data-cat"));
    });

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
      if (e.target.closest("#addRepetir")) {
        ui.draft.repetir = !ui.draft.repetir;
        renderAddSheet(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-repfreq]"))) {
        ui.draft.repFreq = node.getAttribute("data-repfreq");
        renderAddSheet(); U.haptic("light"); return;
      }
      if (e.target.closest("#addDetalles")) {
        ui.detallesAbiertos = !ui.detallesAbiertos;
        renderAddSheet(); U.haptic("light"); return;
      }
      if (e.target.closest("#addReparto")) {
        ui.draft.reparto = !ui.draft.reparto;
        /* al encender, el importe entero va a la cuenta que estaba
           elegida: repartir desde cero obligaría a teclear dos veces */
        if (ui.draft.reparto) {
          ui.draft.trozos = {};
          ui.draft.trozos[ui.draft.accountId] = draftValue();
        }
        renderAddSheet(); U.haptic("light"); return;
      }
      if (e.target.closest("#addRepartoIgual")) {
        repartirIgual(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-cat-new]"))) {
        /* el borrador (importe incluido) sobrevive en ui.draft, así que al
           volver del formulario se sigue donde se estaba */
        ui.catReturnToAdd = true;
        sheets.add.close();
        openForm("category", null, { kind: node.getAttribute("data-cat-new") });
        return;
      }
      if ((node = e.target.closest("[data-cat-new-hija]"))) {
        ui.catReturnToAdd = true;
        var madre = node.getAttribute("data-cat-new-hija");
        sheets.add.close();
        openForm("category", null, { kind: ui.draft.kind, parentId: madre });
        return;
      }
      if ((node = e.target.closest("[data-cat]"))) {
        var elegido = node.getAttribute("data-cat");
        ui.draft.categoryId = elegido;

        /* Tocar una que tiene otras dentro la elige Y las enseña: quedarse
           en la madre es una respuesta válida, y afinar es un toque más. */
        if (node.hasAttribute("data-con-hijas")) {
          ui.catAbierta = ui.catAbierta === elegido ? null : elegido;
          renderAddSheet(); U.haptic("light");
          return;
        }

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
      if (e.target.hasAttribute("data-trozo")) {
        ui.draft.trozos[e.target.getAttribute("data-trozo")] = e.target.value;
        refreshResto();
      }
    });

    addBody.addEventListener("change", function (e) {
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

    /* --- cuestionario de bienvenida --- */
    var onboard = $("#onboard");
    $("#onboardNext").addEventListener("click", onboardNext);
    $("#onboardBack").addEventListener("click", onboardBack);
    $("#onboardSkip").addEventListener("click", skipOnboarding);

    /* Lo que se escribe solo actualiza el modelo: repintar en cada tecla
       le quitaría el foco al campo a media palabra. Repinta lo que cambia
       de forma —las chapas y los botones—, que va abajo. */
    onboard.addEventListener("input", function (e) {
      var n = e.target, i;
      if ((i = n.getAttribute("data-obc-nombre")) != null) {
        ob.cuentas[+i].name = n.value; return;
      }
      if ((i = n.getAttribute("data-obc-saldo")) != null) {
        ob.cuentas[+i].opening = n.value; return;
      }
      if (!ob.nuevo) return;
      if (n.hasAttribute("data-obt-nombre")) { ob.nuevo.nombre = n.value; return; }
      if (n.id === "obtImporte") { ob.nuevo.importe = n.value; return; }
      if (n.id === "obtTarifa") { ob.nuevo.tarifa = n.value; return; }
      if (n.id === "obtDay") { ob.nuevo.day = n.value; }
    });

    onboard.addEventListener("click", function (e) {
      var n;

      if ((n = e.target.closest("[data-obc-quitar]"))) {
        ob.cuentas.splice(+n.getAttribute("data-obc-quitar"), 1);
        if (!ob.cuentas.length) ob.cuentas.push({ id: null, name: "", opening: "" });
        renderOnboardStep(); U.haptic("light"); return;
      }
      if (e.target.closest("[data-obc-add]")) {
        ob.cuentas.push({ id: null, name: "", opening: "" });
        renderOnboardStep();
        var ultimo = $$("[data-obc-nombre]", onboard).pop();
        if (ultimo) ultimo.focus();
        U.haptic("light"); return;
      }

      if (e.target.closest("[data-obt-add]")) {
        ob.nuevo = Object.assign({}, TRABAJO_NUEVO);
        renderOnboardStep();
        var campo = $("#obtNombre", onboard);
        if (campo) campo.focus();
        U.haptic("light"); return;
      }
      if ((n = e.target.closest("[data-obt-quitar]"))) {
        ob.trabajos.splice(+n.getAttribute("data-obt-quitar"), 1);
        renderOnboardStep(); U.haptic("light"); return;
      }
      if (e.target.closest("[data-obt-guardar]")) {
        if (guardarTrabajo(false)) { renderOnboardStep(); U.haptic("light"); }
        return;
      }

      if (!ob.nuevo) return;
      if ((n = e.target.closest("[data-obt-modo]"))) {
        ob.nuevo.modo = n.getAttribute("data-obt-modo");
      } else if ((n = e.target.closest("[data-obt-freq]"))) {
        ob.nuevo.freq = n.getAttribute("data-obt-freq");
      } else if ((n = e.target.closest("[data-obt-dow]"))) {
        ob.nuevo.weekday = +n.getAttribute("data-obt-dow");
      } else if ((n = e.target.closest("[data-obt-pagas]"))) {
        ob.nuevo.pagas = +n.getAttribute("data-obt-pagas");
      } else if ((n = e.target.closest("[data-obt-cuenta]"))) {
        ob.nuevo.cuenta = +n.getAttribute("data-obt-cuenta");
      } else { return; }
      renderOnboardStep(); U.haptic("light");
    });

    onboard.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { skipOnboarding(); return; }
      if (e.key === "Enter" && e.target.tagName === "INPUT") {
        e.preventDefault();
        e.target.blur();
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
     Cuestionario de bienvenida

     Nada se guarda hasta el último botón. Mientras tanto todo vive en
     `ob`, así que se puede ir y volver entre pasos sin dejar cuentas a
     medias en el estado, y «Saltar» de verdad no toca nada.
     ============================================================ */

  var TRABAJO_NUEVO = {
    nombre: "", modo: "fijo", importe: "", tarifa: "",
    freq: "mensual", pagas: 12, day: 1, weekday: 0, cuenta: 0
  };

  function startOnboarding() {
    ob = {
      step: 0,
      /* las cuentas que ya existan se pueden renombrar y ajustar, no
         borrar: una cuenta con movimientos detrás no se quita desde una
         pantalla de bienvenida */
      cuentas: S.state.accounts.map(function (a) {
        return { id: a.id, name: a.name, opening: a.opening };
      }),
      trabajos: [],
      nuevo: null
    };
    if (!ob.cuentas.length) ob.cuentas.push({ id: null, name: "", opening: "" });
    renderOnboardStep();
    $("#onboard").setAttribute("data-open", "true");
    $("#onboard").setAttribute("aria-hidden", "false");
    U.haptic("light");
  }

  /* Cómo se lee un trabajo ya añadido, en una línea. */
  function resumenTrabajo(t) {
    var cada = t.freq === "semanal"
      ? "cada " + DIAS_LARGO[t.weekday].toLowerCase()
      : "el " + t.day + " de cada mes" + (t.pagas === 14 ? ", con dos pagas extra" : "");
    if (t.modo === "hora") return money(+t.tarifa || 0) + " la hora · " + cada;
    if (t.modo === "varia") return "importe variable · " + cada;
    return money(+t.importe || 0) + " · " + cada;
  }

  function pasoPrivacidad() {
    return [
      ["lock", "No sale de este móvil",
       "Todo lo que escribas se guarda aquí dentro. No hay cuenta que crear, " +
       "no hay nube y no se manda nada a ningún sitio."],
      '<ul class="ob-lista">' +
        [["user", "Sin registro", "Ni correo ni contraseña. Abres y ya está."],
         ["lock", "Sin internet", "La app funciona entera en avión."],
         ["download", "La copia la tienes tú",
          "En Ajustes puedes exportar un archivo y guardarlo donde quieras."]]
          .map(function (l) {
            return '<li class="ob-lista__item">' +
                '<span class="ob-lista__icono" data-icon="' + l[0] + '" ' +
                  'data-icon-size="15"></span>' +
                '<span><b>' + esc(l[1]) + '</b><br>' + esc(l[2]) + '</span>' +
              '</li>';
          }).join("") +
      '</ul>'
    ];
  }

  function pasoCuentas() {
    var filas = ob.cuentas.map(function (c, i) {
      return '<div class="ob-fila">' +
          '<input type="text" class="field__input" data-obc-nombre="' + i + '" ' +
                 'maxlength="28" placeholder="Banco" value="' + esc(c.name) + '">' +
          '<div class="input-affix ob-fila__dinero">' +
            '<input type="number" class="field__input" data-obc-saldo="' + i + '" ' +
                   'inputmode="decimal" step="0.01" placeholder="0" value="' +
                   esc(c.opening === "" || c.opening == null ? "" : c.opening) + '">' +
            '<span class="input-affix__suffix">€</span>' +
          '</div>' +
          (c.id
            ? '<span class="ob-fila__hueco"></span>'
            : '<button type="button" class="ob-fila__x" data-obc-quitar="' + i + '" ' +
                'aria-label="Quitar esta cuenta">' + icon("close", 14) + '</button>') +
        '</div>';
    }).join("");

    return [
      ["wallet", "¿Dónde tienes el dinero?",
       "Una por cada sitio: el banco, la cartera, la hucha. Pon lo que hay " +
       "ahora mismo en cada una; si no lo sabes, déjalo en blanco y lo " +
       "corriges cuando quieras."],
      '<div class="ob-filas">' + filas + '</div>' +
      '<button type="button" class="ob-add" data-obc-add>' +
        icon("plus", 15) + 'Añadir otra cuenta</button>'
    ];
  }

  function pasoTrabajos() {
    var puestos = ob.trabajos.map(function (t, i) {
      return '<div class="ob-item">' +
          '<span class="ob-item__icono" data-icon="briefcase" data-icon-size="15"></span>' +
          '<span class="ob-item__texto">' +
            '<span class="ob-item__nombre">' + esc(t.nombre) + '</span>' +
            '<span class="ob-item__sub">' + esc(resumenTrabajo(t)) + '</span>' +
          '</span>' +
          '<button type="button" class="ob-fila__x" data-obt-quitar="' + i + '" ' +
            'aria-label="Quitar este trabajo">' + icon("close", 14) + '</button>' +
        '</div>';
    }).join("");

    return [
      ["briefcase", "¿De dónde te entra?",
       "Añade tus trabajos, los que sean. Da igual si cobras siempre lo " +
       "mismo, si te pagan por horas o si cambia cada mes: hay un hueco " +
       "para cada caso. Y si prefieres no poner nada ahora, sigue adelante."],
      puestos +
      (ob.nuevo ? formTrabajo(ob.nuevo)
                : '<button type="button" class="ob-add" data-obt-add>' +
                    icon("plus", 15) + 'Añadir un trabajo</button>')
    ];
  }

  /* El mini-formulario de un trabajo. Solo enseña lo que hace falta según
     cómo se cobre: quien cobra por horas no tiene por qué ver una casilla
     de importe fijo que va a dejar vacía. */
  function formTrabajo(t) {
    var chips = function (attr, opciones, valor) {
      return '<div class="chips">' + opciones.map(function (o) {
        return '<button type="button" class="chip" data-' + attr + '="' + o[0] + '" ' +
                 'aria-pressed="' + (String(valor) === String(o[0])) + '">' +
                 esc(o[1]) + '</button>';
      }).join("") + '</div>';
    };

    return '<div class="ob-form">' +
        '<div class="field">' +
          '<label class="field__label" for="obtNombre">Cómo se llama</label>' +
          '<input type="text" class="field__input" id="obtNombre" data-obt-nombre ' +
                 'maxlength="28" placeholder="Mi trabajo" value="' + esc(t.nombre) + '">' +
        '</div>' +

        '<div class="field">' +
          '<span class="field__label">Cómo cobras</span>' +
          chips("obt-modo", [["fijo", "Siempre igual"], ["hora", "Por horas"],
                             ["varia", "Cambia"]], t.modo) +
        '</div>' +

        (t.modo === "fijo"
          ? '<div class="field">' +
              numField("obtImporte", "Cuánto cobras", t.importe, 0.01) +
            '</div>'
          : t.modo === "hora"
          ? '<div class="field">' +
              numField("obtTarifa", "Cuánto te pagan la hora", t.tarifa, 0.01) +
              '<p class="field__hint">El día que toque te preguntará cuántas horas ' +
                'has echado y hará la cuenta.</p>' +
            '</div>'
          : '<p class="field__hint">' + icon("bell", 12) +
            ' El día que toque te avisará y te preguntará cuánto ha sido.</p>') +

        '<div class="field">' +
          '<span class="field__label">Cada cuánto</span>' +
          chips("obt-freq", [["mensual", "Al mes"], ["semanal", "Cada semana"]], t.freq) +
        '</div>' +

        (t.freq === "semanal"
          ? '<div class="field">' +
              '<span class="field__label">Qué día</span>' +
              chips("obt-dow", DIAS_LARGO.map(function (d, i) {
                return [i, d.slice(0, 3)];
              }), t.weekday) +
            '</div>'
          : '<div class="field">' +
              '<label class="field__label" for="obtDay">Qué día del mes</label>' +
              '<input type="number" class="field__input" id="obtDay" min="1" max="28" ' +
                     'step="1" inputmode="numeric" value="' + esc(t.day) + '">' +
              '<div style="margin-top:var(--sp-4)">' +
                chips("obt-pagas", [[12, "12 pagas"], [14, "14 pagas"]], t.pagas) +
              '</div>' +
            '</div>') +

        (ob.cuentas.length > 1
          ? '<div class="field">' +
              '<span class="field__label">A qué cuenta llega</span>' +
              chips("obt-cuenta", ob.cuentas.map(function (c, i) {
                return [i, c.name || "Cuenta " + (i + 1)];
              }), t.cuenta) +
            '</div>'
          : "") +

        '<button type="button" class="btn btn--primary" data-obt-guardar ' +
          'style="width:100%;margin-top:var(--sp-4)">' +
          icon("check", 16) + 'Añadir este trabajo</button>' +
      '</div>';
  }

  function pasoListo() {
    var nCuentas = ob.cuentas.filter(function (c) {
      return (c.name || "").trim() || c.id;
    }).length;
    var nTrabajos = ob.trabajos.length;
    var cuenta = nCuentas === 1 ? "una cuenta" : nCuentas + " cuentas";
    var trab = nTrabajos === 0 ? "ningún trabajo todavía"
             : nTrabajos === 1 ? "un trabajo" : nTrabajos + " trabajos";

    return [
      ["check", "Ya está",
       "Vas a empezar con " + cuenta + " y " + trab + ". Lo demás se pone " +
       "sobre la marcha, y todo se puede cambiar luego."],
      '<ul class="ob-lista">' +
        [["plus", "Apuntar un gasto",
          "El botón grande de abajo. Es lo que más vas a usar."],
         ["sliders", "Categorías y presupuesto",
          "En Ajustes, cuando te apetezca. Nada viene puesto de fábrica."],
         ["repeat", "Recibos y préstamos",
          "En Mi dinero → Programados se apuntan solos cada mes."]]
          .map(function (l) {
            return '<li class="ob-lista__item">' +
                '<span class="ob-lista__icono" data-icon="' + l[0] + '" ' +
                  'data-icon-size="15"></span>' +
                '<span><b>' + esc(l[1]) + '</b><br>' + esc(l[2]) + '</span>' +
              '</li>';
          }).join("") +
      '</ul>'
    ];
  }

  function renderOnboardStep() {
    var paso = ONBOARD_STEPS[ob.step];
    var partes = paso === "privacidad" ? pasoPrivacidad()
               : paso === "cuentas" ? pasoCuentas()
               : paso === "trabajos" ? pasoTrabajos()
               : pasoListo();

    $("#onboardIcon").innerHTML = icon(partes[0][0], 28);
    $("#onboardTitle").textContent = partes[0][1];
    $("#onboardText").textContent = partes[0][2];
    $("#onboardExtra").innerHTML = partes[1] || "";

    $("#onboardDots").innerHTML = ONBOARD_STEPS.map(function (_, i) {
      return '<span class="onboard__dot" data-active="' + (i === ob.step) + '"></span>';
    }).join("");

    $("#onboardBack").setAttribute("data-hidden", String(ob.step === 0));
    $("#onboardNext").textContent = ob.step === 0 ? "Empezar"
      : ob.step === ONBOARD_STEPS.length - 1 ? "Listo" : "Siguiente";

    mountIcons($("#onboard"));
  }

  function onboardNext() {
    if (ob.step === ONBOARD_STEPS.length - 1) { finishOnboarding(); return; }
    /* un trabajo a medio escribir al pasar de paso se guarda solo: haber
       rellenado el formulario y que se pierda por no tocar «Añadir» es de
       las cosas que más rabia dan */
    if (ONBOARD_STEPS[ob.step] === "trabajos" && ob.nuevo) guardarTrabajo(true);
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

  function guardarTrabajo(callado) {
    var t = ob.nuevo;
    if (!t) return false;
    var nombre = (t.nombre || "").trim();
    var tieneImporte = t.modo === "fijo" ? +t.importe > 0
                     : t.modo === "hora" ? +t.tarifa > 0
                     : true;

    /* al pasar de paso, un formulario que ni se ha empezado se tira sin
       decir nada; si se ha tocado el botón, se explica qué falta */
    if (!nombre && !t.importe && !t.tarifa) { ob.nuevo = null; return true; }
    if (!nombre) {
      if (!callado) U.toast("Ponle un nombre al trabajo", { icon: "warning" });
      return false;
    }
    if (!tieneImporte) {
      if (!callado) {
        U.toast(t.modo === "hora" ? "Falta cuánto te pagan la hora"
                                  : "Falta cuánto cobras", { icon: "warning" });
      }
      return false;
    }

    ob.trabajos.push(Object.assign({}, t, { nombre: nombre }));
    ob.nuevo = null;
    return true;
  }

  /* Aquí es donde por fin se escribe algo. Hasta este botón, nada. */
  function finishOnboarding() {
    /* 1. cuentas: las que ya existían se actualizan, las nuevas se crean */
    var ids = ob.cuentas.map(function (c) {
      var name = (c.name || "").trim();
      var opening = +c.opening || 0;
      if (c.id) {
        S.updateAccount(c.id, name ? { name: name, opening: opening }
                                   : { opening: opening });
        return c.id;
      }
      if (!name) return null;
      return S.addAccount({ name: name, opening: opening }).id;
    });
    var porDefecto = ids.find(function (x) { return x; }) || S.state.accounts[0].id;

    /* 2. trabajos: un ingreso programado por cada uno */
    ob.trabajos.forEach(function (t) {
      var abierto = t.modo !== "fijo";
      S.addRecurring({
        kind: "in",
        note: t.nombre,
        amount: t.modo === "fijo" ? +t.importe || 0 : 0,
        categoryId: "nomina",
        accountId: ids[t.cuenta] || porDefecto,
        freq: t.freq,
        day: t.day,
        weekdays: [t.weekday],
        pagas: t.freq === "mensual" ? t.pagas : 12,
        importeAbierto: abierto,
        tarifa: t.modo === "hora" ? +t.tarifa || 0 : null,
        /* sin importe cerrado no se puede apuntar solo: hay que preguntar,
           y para preguntar hay que avisar */
        confirmar: abierto,
        avisar: abierto,
        hora: "09:00",
        yaHecho: true
      });
    });

    var creados = ob.trabajos.length;
    closeOnboarding();
    renderAll();
    if (creados) sincronizarAvisos();
    goTo("inicio");
    U.toast(creados ? "Todo listo. Apunta tu primer gasto con el +"
                    : "Todo listo. Empieza cuando quieras",
            { icon: "check", duration: 4500 });
  }

  function skipOnboarding() {
    closeOnboarding();
  }

  /* ============================================================
     Elegir de una lista

     Los <select> abren el menú del sistema: una lista gris, con su propia
     tipografía y sus propias esquinas, que no se parece a nada de lo que
     hay alrededor. En una pantalla cuidada canta más que cualquier otra
     cosa.

     Esto es lo mismo pero en una hoja de la app: cada opción una fila
     tocable, con su emoji o su color si lo tiene, y la elegida marcada.
     De paso se toca mejor con el pulgar que una lista de sistema.
     ============================================================ */

  var pickPendiente = null;   /* { resolver } */

  /* opciones: [{ value, label, sub, emoji, color }] */
  function pick(titulo, opciones, valor) {
    return new Promise(function (resolver) {
      pickPendiente = { resolver: resolver };

      $("#sheetPickTitle").textContent = titulo;
      $("#sheetPickBody").innerHTML = opciones.map(function (o) {
        var elegida = String(o.value) === String(valor);
        return '<button type="button" class="pick" data-pick="' + esc(o.value) + '" ' +
                 'aria-pressed="' + elegida + '">' +
            (o.emoji
              ? '<span class="pick__cara cat-face"' +
                  (o.color ? ' style="--cat-color:var(--cat-' + o.color + ')"' : '') +
                  '>' + esc(o.emoji) + '</span>'
              : o.color
                ? '<span class="pick__punto" style="background:var(--cat-' +
                    o.color + ')"></span>'
                : '') +
            '<span class="pick__texto">' +
              '<span class="pick__nombre">' + esc(o.label) + '</span>' +
              (o.sub ? '<span class="pick__sub">' + esc(o.sub) + '</span>' : "") +
              /* algunas opciones se ven mejor que se explican */
              (o.muestra
                ? '<span class="emoji-muestra" data-set="' + esc(o.muestra) + '">' +
                    "🍽️🏠☕🚗💰" + '</span>'
                : "") +
            '</span>' +
            (elegida
              ? '<span class="pick__tick" data-icon="check" data-icon-size="16"></span>'
              : '') +
          '</button>';
      }).join("");

      mountIcons($("#sheetPickBody"));
      sheets.pick.show();
    });
  }

  function abrirPick(id, valorActual) {
    var cfg = opcionesDe(id);
    if (!cfg) return;
    pick(cfg.titulo, cfg.lista, valorActual).then(function (v) {
      if (v == null) return;
      aplicarPick(id, v);
    });
  }

  /* Un campo que parece un desplegable pero abre la hoja de arriba. */
  function pickField(id, valor, texto) {
    return '<button type="button" class="field__input field__select" ' +
             'id="' + id + '" data-pick-open="' + esc(id) + '" ' +
             'data-value="' + esc(valor) + '">' +
        '<span class="field__select-txt">' + esc(texto) + '</span>' +
        '<span class="field__select-chev" data-icon="chevDown" data-icon-size="15"></span>' +
      '</button>';
  }

  /* ============================================================
     Una cuenta por dentro

     Tocar una tarjeta abría directamente el formulario de editar, y eso
     no es lo que uno espera: al tocar tu cuenta quieres VERLA —cuánto
     tienes, qué ha entrado y salido este mes, los últimos movimientos— y
     desde ahí decidir si hay algo que cambiar.
     ============================================================ */

  var cuentaAbierta = null;

  /* Todo lo que ha pasado por esta cuenta, entradas y salidas, con el
     signo visto desde ella: un traspaso que sale resta y el mismo
     traspaso visto desde la cuenta de destino suma. */
  function movimientosDe(accId) {
    return S.state.transactions.filter(function (t) {
      return t.accountId === accId || t.toAccountId === accId;
    });
  }

  function efectoEnCuenta(t, accId) {
    if (t.kind === "transfer") return t.toAccountId === accId ? t.amount : -t.amount;
    return t.kind === "in" ? t.amount : -t.amount;
  }

  function renderCuenta() {
    var a = S.state.accounts.find(function (x) { return x.id === cuentaAbierta; });
    if (!a) { sheets.cuenta.close(); return; }

    var body = $("#sheetCuentaBody");
    var curKey = S.currentMonthKey();
    var propios = movimientosDe(a.id);

    /* del mes en curso, y separando lo que entra de lo que sale */
    var entra = 0, sale = 0;
    propios.forEach(function (t) {
      if (S.monthKey(t.date) !== curKey) return;
      var e = efectoEnCuenta(t, a.id);
      if (e >= 0) entra += e; else sale += -e;
    });

    var ultimos = propios.slice(0, 5);
    var uso = S.accountUsage(a.id);

    $("#sheetCuentaTitle").textContent = a.name;

    body.innerHTML =
      /* la misma tarjeta que en el Resumen, para que se vea que es ella */
      '<div class="paycard paycard--suelta" style="--acc-color:' + S.catColorVar(a) + '">' +
        '<div class="paycard__top">' +
          '<span class="paycard__dots"><i></i><i></i><i></i><i></i>' + esc(a.name) + '</span>' +
          '<span class="paycard__type">' + esc(a.type) + '</span>' +
        '</div>' +
        '<div>' +
          '<p class="paycard__label">Saldo</p>' +
          '<p class="paycard__value">' + bigAmount(S.accountBalance(a.id)) + '</p>' +
        '</div>' +
      '</div>' +

      '<p class="field__label" style="margin-top:var(--sp-5)">En ' +
        esc(monthName(curKey)) + '</p>' +
      '<div class="kpi-row">' +
        '<div class="stat stat--compact stat--quiet">' +
          '<p class="stat__label">Ha entrado</p>' +
          '<p class="stat__value" style="color:var(--money-in)">+ ' +
            esc(S.moneyShort(entra)) + '</p>' +
        '</div>' +
        '<div class="stat stat--compact stat--quiet">' +
          '<p class="stat__label">Ha salido</p>' +
          '<p class="stat__value">− ' + esc(S.moneyShort(sale)) + '</p>' +
        '</div>' +
      '</div>' +

      '<div class="field" style="margin-top:var(--sp-6)">' +
        '<div class="card__head" style="margin-bottom:var(--sp-3)">' +
          '<h3 class="card__title">Últimos movimientos</h3>' +
          (propios.length > 5
            ? '<button type="button" class="card__link" id="cuentaVerTodos">Ver todos</button>'
            : "") +
        '</div>' +
        (ultimos.length
          ? ultimos.map(txRowHtml).join("")
          : emptyHtml("list", "Todavía nada",
              "Los movimientos que apuntes en esta cuenta saldrán aquí.")) +
      '</div>' +

      '<div class="field" style="margin-top:var(--sp-6)">' +
        '<button type="button" class="btn btn--primary" id="cuentaGasto" style="width:100%">' +
          icon("plus", 17) + 'Apuntar aquí un movimiento</button>' +
      '</div>' +
      '<div class="field">' +
        '<button type="button" class="btn btn--ghost" id="cuentaTraspaso" style="width:100%">' +
          icon("swap", 17) + 'Hacer un traspaso</button>' +
      '</div>' +
      '<div class="field" style="display:flex;gap:var(--sp-3)">' +
        /* sin icono: con él «Corregir saldo» se parte en dos líneas y la
           pareja de botones queda descuadrada */
        '<button type="button" class="btn btn--ghost" id="cuentaCorregir" style="flex:1">' +
          'Corregir saldo</button>' +
        '<button type="button" class="btn btn--ghost" id="cuentaEditar" style="flex:1">' +
          icon("edit", 16) + 'Editar</button>' +
      '</div>' +
      '<p class="field__hint" style="text-align:center">' +
        (uso.transactions === 1 ? "1 movimiento" : uso.transactions + " movimientos") +
        (uso.recurring
          ? " · " + (uso.recurring === 1 ? "1 programado" : uso.recurring + " programados")
          : "") + '</p>';

    mountIcons(body);
  }

  function openCuenta(id) {
    cuentaAbierta = id;
    renderCuenta();
    sheets.cuenta.show();
  }

  /* ============================================================
     Confirmar un programado antes de apuntarlo

     Un sueldo casi nunca cae clavado. Quien marque «preguntarme el
     importe» no verá el movimiento apuntado solo: al abrir la app se le
     enseña la cifra prevista con el cursor puesto, y con tocar «Apuntar»
     entra tal cual. Se van pasando de uno en uno, que es más fácil de
     entender que una lista con varias casillas.
     ============================================================ */

  function hayPendientes() { return S.pendientes().length > 0; }

  function renderCobro() {
    var cola = S.pendientes();
    var p = cola[0];
    if (!p) { sheets.cobro.close(); return; }

    var esIn = p.kind === "in";
    var body = $("#sheetCobroBody");
    var tarifa = +p.tarifa > 0 ? +p.tarifa : 0;

    $("#sheetCobroTitle").textContent = tarifa
      ? "¿Cuántas horas has echado?"
      : esIn ? "¿Cuánto has cobrado?" : "¿Cuánto ha sido?";

    body.innerHTML =
      (cola.length > 1
        ? '<p class="card__sub" style="text-align:center">Te quedan ' +
            cola.length + ' por confirmar</p>'
        : "") +

      '<div style="text-align:center;padding:var(--sp-3) 0 var(--sp-5)">' +
        '<p class="card__title">' + esc(p.note) + '</p>' +
        '<p class="card__sub" style="margin-top:2px">' +
          esc(S.relDayLabel(p.date)) + ' · ' + esc(accName(p.accountId)) + '</p>' +
      '</div>' +

      (tarifa
        /* Por horas: se piden horas, no euros. Pedir euros obligaría a
           hacer la multiplicación de cabeza cada vez. */
        ? '<div class="field">' +
            '<label class="field__label" for="cobroHoras">Horas</label>' +
            '<div class="input-affix">' +
              '<input type="number" class="field__input field__input--big" id="cobroHoras" ' +
                     'min="0" step="0.25" inputmode="decimal" value="">' +
              '<span class="input-affix__suffix">h</span>' +
            '</div>' +
          '</div>' +
          '<div class="ajuste" id="cobroCalculo" data-dif="cero">' +
            '<span class="ajuste__txt">A ' + esc(money(tarifa)) + ' la hora</span>' +
            '<span class="ajuste__eur" id="cobroTotal">' + esc(money(0)) + '</span>' +
          '</div>'

        : '<div class="field">' +
            '<label class="field__label" for="cobroAmount">Importe</label>' +
            '<div class="input-affix">' +
              '<input type="number" class="field__input field__input--big" id="cobroAmount" ' +
                     'min="0" step="0.01" inputmode="decimal" value="' +
                     (p.amount > 0 ? esc(p.amount) : "") + '">' +
              '<span class="input-affix__suffix">€</span>' +
            '</div>' +
            '<p class="field__hint">' +
              (p.amount > 0
                ? "Lo previsto eran " + esc(money(p.amount)) +
                  ". Cámbialo si esta vez ha sido otra cifra."
                : "No hay una cifra prevista: pon la que te haya quedado.") +
            '</p>' +
          '</div>') +

      '<div class="field" style="margin-top:var(--sp-6)">' +
        '<button type="button" class="btn btn--primary" id="cobroOk">' +
          icon("check", 17) + 'Apuntar</button>' +
      '</div>' +
      '<div class="field">' +
        '<button type="button" class="btn btn--ghost" id="cobroNo" style="width:100%">' +
          (esIn ? "Este mes no lo he cobrado" : "Este mes no lo he pagado") + '</button>' +
      '</div>';

    mountIcons(body);
  }

  /* Siguiente de la cola, o cerrar y repintar si ya no queda ninguno. */
  function seguirCobros() {
    if (hayPendientes()) { renderCobro(); return; }
    sheets.cobro.close();
    renderAll();
  }

  function abrirCobros() {
    if (!hayPendientes()) return;
    renderCobro();
    sheets.cobro.show();
    /* el teclado tapa media pantalla: mejor que no salte solo */
  }

  /* Vuelve a poner las alarmas con lo que haya ahora. Si es el primer
     programado que pide aviso, se pide el permiso: hacerlo antes, sin que
     nadie lo haya pedido, es de las cosas que hacen desinstalar una app. */
  function sincronizarAvisos() {
    if (!window.Avisos || !window.Avisos.hay()) return;

    var quiereAvisos = (S.state.recurring || []).some(function (r) {
      return r.active && r.avisar;
    });

    if (!quiereAvisos) { window.Avisos.sincronizar(S); return; }

    window.Avisos.permitido().then(function (ok) {
      if (ok) return window.Avisos.sincronizar(S);
      return window.Avisos.pedirPermiso().then(function (dado) {
        if (dado) return window.Avisos.sincronizar(S);
        U.toast("Sin permiso de notificaciones no puedo avisarte. " +
                "Se puede dar en los ajustes del móvil.",
                { icon: "warning", duration: 6000 });
      });
    });
  }

  /* ============================================================
     Botón atrás

     En Android el botón de atrás es el gesto de «déjame salir de aquí».
     Sin esto, el WebView lo interpretaba como el atrás de un navegador:
     con una hoja abierta te sacaba de la pantalla en la que estabas y la
     hoja se quedaba puesta.

     El orden es el que espera cualquiera: primero se cierra lo que está
     encima, después se vuelve al Resumen, y solo cuando no queda nada que
     cerrar se sale de la app. Devuelve true si ha hecho algo; si devuelve
     false, la capa Android cierra la aplicación.
     ============================================================ */

  function atras() {
    /* La guía está por encima de todo. Dentro de ella, atrás es el paso
       anterior —que es lo que espera cualquiera en un cuestionario— y
       solo cierra cuando ya no queda paso al que volver. */
    if ($("#onboard").getAttribute("data-open") === "true") {
      if (ob && ob.step > 0) onboardBack(); else skipOnboarding();
      return true;
    }

    /* La hoja de encima, no todas: del detalle se salta a editar, y
       atrás tiene que devolverte al detalle. */
    if (U.cerrarHojaDeArriba()) return true;

    /* Desde cualquier pantalla, atrás lleva al Resumen. Desde el Resumen
       ya no hay a dónde volver. */
    if (ui.view !== "inicio") { goTo("inicio"); return true; }

    return false;
  }

  /* ============================================================
     Arranque
     ============================================================ */

  function init() {
    var firstRun = !S.hasSavedState();
    S.load();
    S.applyTheme(S.getTheme());
    S.applyEmojiSet(S.getEmojiSet());

    /* apunta lo programado que haya vencido desde la última visita */
    var posted = S.runRecurring();

    /* Las alarmas del sistema no sobreviven a un reinicio del teléfono,
       así que se vuelven a poner en cada arranque. */
    if (window.Avisos && window.Avisos.hay()) window.Avisos.sincronizar(S);

    sheets.add = new U.Sheet($("#sheetAdd"), $("#scrim"));
    sheets.detail = new U.Sheet($("#sheetDetail"), $("#scrim"));
    sheets.form = new U.Sheet($("#sheetForm"), $("#scrim"));
    sheets.cobro = new U.Sheet($("#sheetCobro"), $("#scrim"));
    sheets.cuenta = new U.Sheet($("#sheetCuenta"), $("#scrim"));
    sheets.pick = new U.Sheet($("#sheetPick"), $("#scrim"));

    /* Cerrar sin elegir resuelve a null: quien la abrió deja las cosas
       como estaban en vez de quedarse esperando para siempre. */
    sheets.pick.onClose = function () {
      if (!pickPendiente) return;
      var r = pickPendiente.resolver;
      pickPendiente = null;
      r(null);
    };

    $("#sheetPickBody").addEventListener("click", function (e) {
      var node = e.target.closest("[data-pick]");
      if (!node || !pickPendiente) return;
      var r = pickPendiente.resolver;
      pickPendiente = null;
      sheets.pick.close();
      U.haptic("light");
      r(node.getAttribute("data-pick"));
    });

    /* Al formulario de categoría se llega a veces desde un movimiento a
       medio escribir. Salir de ahí de cualquier manera —la X, el botón
       atrás, arrastrando la hoja hacia abajo, tocando fuera— tiene que
       devolverte al movimiento con lo que llevabas tecleado, no dejarte
       en blanco. Guardar y borrar bajan la bandera antes de cerrar, así
       que esto solo salta cuando de verdad se ha abandonado. */
    sheets.form.onClose = function () {
      if (ui.catReturnToAdd) {
        ui.catReturnToAdd = false;
        renderAddSheet();
        sheets.add.show();
        return;
      }

      /* Lo mismo al editar una cuenta desde dentro de la cuenta: se
         vuelve a ella con los cambios ya puestos. Si se acaba de
         borrar, no hay a dónde volver. */
      if (ui.cuentaReturn) {
        var id = ui.cuentaReturn;
        ui.cuentaReturn = null;
        if (!S.state.accounts.some(function (a) { return a.id === id; })) return;
        cuentaAbierta = id;
        renderCuenta();
        sheets.cuenta.show();
      }
    };

    mountIcons(document);
    U.vigilarTeclado();
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
    else { checkForUpdate(); setTimeout(abrirCobros, 700); }
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

  /* Baja la actualización sin salir de la app cuando se puede, y si no,
     tira del navegador como se hacía antes. */
  function descargarActualizacion() {
    var boton = $("#updateNow");
    var barra = $("#updateBar");

    if (!Up.hayDescargaNativa()) {
      Up.open(ui.update.url);
      U.toast("Descargando la actualización…", { icon: "download", duration: 4500 });
      return;
    }

    if (boton) { boton.disabled = true; boton.innerHTML = icon("download", 16) + "Descargando…"; }
    if (barra) barra.hidden = false;

    Up.descargarEInstalar(ui.update.url, function (ev) {
      var pct = (ev && ev.pct) || 0;
      var relleno = $("#updateBarFill");
      if (relleno) relleno.style.width = Math.max(2, pct) + "%";
      if (boton && ev && ev.fase === "descargando") {
        boton.innerHTML = icon("download", 16) + "Descargando… " + pct + " %";
      }
    }).then(function (res) {
      if (res === "instalando") {
        if (boton) boton.innerHTML = icon("check", 16) + "Abriendo el instalador…";
        return;
      }

      /* cualquier otro final deja el botón como estaba */
      if (boton) { boton.disabled = false; boton.innerHTML = icon("download", 16) + "Actualizar"; }
      if (barra) barra.hidden = true;

      if (res === "sin-permiso") {
        U.toast("Android necesita tu permiso para instalar. Te llevo a los ajustes.",
                { icon: "warning", duration: 5500 });
        Up.pedirPermisoInstalar();
      } else if (res === "sin-plugin") {
        Up.open(ui.update.url);
      } else {
        U.toast("No se ha podido descargar. Prueba con el enlace de abajo.",
                { icon: "warning", duration: 5000 });
      }
    });
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

  /* Lo único que la app enseña al exterior: el botón atrás de Android
     entra por aquí. */
  window.App = { atras: atras };

  /* En el escritorio no hay botón físico, pero Escape es lo mismo y así se
     puede probar el recorrido sin un móvil delante. Las hojas ya se cierran
     ellas con Escape cuando tienen el foco; esto cubre el resto. */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (U.hayHojaAbierta()) return;   /* de eso se encarga la propia hoja */
    if (atras()) e.preventDefault();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
