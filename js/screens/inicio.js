/* ============================================================
   split — pantalla: Resumen
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, C = A.C, Up = A.Up, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, ui = A.ui;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function bigAmount() { return A.bigAmount.apply(null, arguments); }
  function catFace() { return A.catFace.apply(null, arguments); }
  function catOf() { return A.catOf.apply(null, arguments); }
  function deltaPct() { return A.deltaPct.apply(null, arguments); }
  function emptyHtml() { return A.emptyHtml.apply(null, arguments); }
  function foldCard() { return A.foldCard.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function nombreCiclo() { return A.nombreCiclo.apply(null, arguments); }
  function limiteEnTarjeta() { return A.limiteEnTarjeta.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function seriesEnding() { return A.seriesEnding.apply(null, arguments); }
  function txRowHtml() { return A.txRowHtml.apply(null, arguments); }

  /* ============================================================
     Pantalla · Resumen
     ============================================================ */

  function renderInicio() {
    var root = $("#view-inicio");
    var curKey = S.cicloActual();
    var cur = S.totals(S.txDeCiclo(curKey));
    var bal = S.balance();
    var cfgRes = S.resumenCfg();
    var series = seriesEnding(curKey, 12, cfgRes.cuentas);
    var planned = S.plannedIncome();
    var rows = S.estadoDeLimites(curKey).sort(function (a, b) { return b.ratio - a.ratio; });
    var recent = S.state.transactions.slice(0, 6);

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
                /* si la cuenta tiene objetivo de gasto, la barra sustituye
                   al pie de texto: es lo que se quiere mirar de un vistazo */
                (function () {
                  var lim = S.estadoDeObjetivo(a.id, curKey);
                  return lim ? limiteEnTarjeta(lim) : "";
                })() +
                '<div class="paycard__foot">' +
                  '<span class="paycard__label">' +
                    (i === 0
                      ? esc(S.signed(cur.net)) + " en " + esc(nombreCiclo(curKey))
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

    /* Sin ningún límite puesto no se enseña ninguna de las dos tarjetas:
       unas barras vacías no dicen nada, y encima dan la impresión de que
       la app te está midiendo por un plan que no has hecho. Quien lo
       quiera, lo pone en Ajustes. */
    var res = S.resumenDeLimites(curKey);
    var hayLimites = rows.length > 0;

    var cardBudgets = hayLimites
      ? foldCard("presupuesto",
          "Límites de " + esc(nombreCiclo(curKey)),
          esc(res.cuantos === 1 ? "1 límite" : res.cuantos + " límites") +
            (res.sinTope > 0
              ? " · " + esc(S.moneyShort(res.sinTope)) + " fuera de todos"
              : ""),
          '<button type="button" class="card__link" data-goto="ajustes">Editar</button>',
          rows.map(meterHtml).join(""))
      : "";

    /* --- tarjeta de límite: el que va más apurado ---
       Solo cabe uno, y el que interesa de un vistazo es el que está a
       punto de reventar, no el primero que se creó. Sumar todos los
       topes no valdría: dos límites pueden solaparse y la suma daría de
       más. */
    var peor = S.limiteMasApurado(curKey);
    var cardLimit = peor
      ? '<button type="button" class="limit" data-goto="ajustes">' +
          '<span class="limit__ring" data-limit-ring="' +
            Math.min(1, peor.ratio) + '"></span>' +
          '<span class="limit__body">' +
            '<span class="limit__label">' + esc(peor.emoji) + ' ' + esc(peor.name) + '</span>' +
            '<span class="limit__value">' + esc(S.moneyShort(peor.gastado)) + ' de ' +
              esc(S.moneyShort(peor.limite)) + '</span>' +
          '</span>' +
          '<span class="limit__chev" data-icon="chevron" data-icon-size="18"></span>' +
        '</button>'
      : "";

    /* --- en qué se está yendo el mes ---
       Esto NO es la lista de categorías: es en qué se ha gastado este mes,
       de más a menos. Llamarlo «Categorías» hacía que la gente entrara a
       buscar dónde se crean y se encontrara una sola chapa, porque aquí
       solo sale lo que tiene gasto. Se gestionan en Ajustes.

       Y tocar una abre esa categoría, no la pantalla de estadísticas: si
       toco «Hogar» quiero ver mis gastos de hogar. */
    var todasCats = S.byCategory(curKey, "out");
    var topCats = todasCats.slice(0, 4);
    var cardTiles = topCats.length
      ? '<section>' +
          '<div class="card__head" style="margin-bottom:var(--sp-3)">' +
            '<div>' +
              '<h2 class="card__title">En qué se te va</h2>' +
              '<p class="card__sub">' + esc(nombreCiclo(curKey)) +
                (todasCats.length > topCats.length
                  ? " · " + todasCats.length + " categorías"
                  : "") + '</p>' +
            '</div>' +
            '<button type="button" class="card__link" data-goto="analisis">' +
              'Ver el detalle</button>' +
          '</div>' +
          '<div class="tiles">' +
            topCats.map(function (c) {
              return '<button type="button" class="tile" data-cat-movs="' +
                       esc(c.id) + '">' +
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

  /* Una barra por límite. Le llega el estado ya calculado, así que aquí
     solo se decide cómo se pinta. */
  function meterHtml(b, i) {
    var over = b.nivel === "pasado";
    var near = b.nivel === "cerca";
    /* el relleno lleva la severidad; el color del límite cuando va bien */
    var fill = over ? "var(--status-critical)"
             : near ? "var(--status-warning)"
             : "var(--cat-" + b.color + ")";
    return '' +
      '<div class="meter">' +
        '<div class="meter__head">' +
          '<span class="meter__dot" style="background:' + fill + '"></span>' +
          '<span class="meter__label">' + esc(b.emoji || "") + ' ' + esc(b.name) + '</span>' +
          '<span class="meter__value">' + esc(S.moneyShort(b.gastado)) + ' / ' +
            esc(S.moneyShort(b.limite)) + '</span>' +
        '</div>' +
        '<div class="meter__track">' +
          '<div class="meter__fill" style="width:' + Math.min(100, b.ratio * 100).toFixed(1) + '%;' +
            'background:' + fill + ';--delay:' + (i * 55 + 90) + 'ms"></div>' +
        '</div>' +
        /* El porcentaje manda y los euros van detrás: lo que se quiere
           saber de un vistazo es cuánto margen queda, no la resta. Y el
           color de estado nunca va solo: siempre con icono y texto. */
        (over
          ? '<p class="meter__foot">' + icon("warning", 11) + ' Te has pasado un ' +
            esc(S.pct(Math.round((b.ratio - 1) * 100))) + ' · ' +
            esc(S.moneyShort(b.gastado - b.limite)) + ' de más</p>'
          : '<p class="meter__foot">' +
            (near ? icon("warning", 11) + ' Al límite: te queda ' : 'Te queda ') +
            'el ' + esc(S.pct(Math.max(0, Math.round((1 - b.ratio) * 100)))) + ' · ' +
            esc(S.moneyShort(b.queda)) + '</p>') +
      '</div>';
  }


  /* --- lo que usan otros archivos --- */
  A.renderInicio = renderInicio;

  A.screens["inicio"] = renderInicio;
})();
