/* ============================================================
   split — pantalla: Análisis
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, C = A.C, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, ui = A.ui;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function bigAmount() { return A.bigAmount.apply(null, arguments); }
  function catOf() { return A.catOf.apply(null, arguments); }
  function isDesktop() { return A.isDesktop.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function selectedMonth() { return A.selectedMonth.apply(null, arguments); }
  function seriesEnding() { return A.seriesEnding.apply(null, arguments); }
  function wrapStagger() { return A.wrapStagger.apply(null, arguments); }

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


  /* --- lo que usan otros archivos --- */
  A.renderAnalisis = renderAnalisis;

  A.screens["analisis"] = renderAnalisis;
})();
