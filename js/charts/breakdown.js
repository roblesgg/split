/* ============================================================
   split — barra apilada y ranking
   ============================================================ */

(function () {
  "use strict";

  var G = window.Graficos;
  var catColor = G.catColor;

  /* ============================================================
     6) Barra apilada horizontal + ranking (parte-todo)
     ============================================================ */

  function stackedBreakdown(container, items, opts) {
    opts = opts || {};
    var fmt = opts.format || function (v) { return String(v); };
    var total = items.reduce(function (s, it) { return s + it.value; }, 0);
    container.innerHTML = "";

    if (!total) {
      container.innerHTML = '<p class="chart-note">Todavía no hay gastos en este mes.</p>';
      return;
    }

    /* barra apilada: máximo 6 segmentos, el resto se pliega en "Otras" */
    var CAP = 6;
    var shown = items.slice(0, CAP);
    var rest = items.slice(CAP);
    if (rest.length) {
      shown = shown.concat([{
        id: "resto",
        name: "Otras",
        slot: 8,
        value: rest.reduce(function (s, it) { return s + it.value; }, 0)
      }]);
    }

    var bar = document.createElement("div");
    bar.className = "stackbar";
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", "Reparto del gasto por categoría");

    shown.forEach(function (it, i) {
      var seg = document.createElement("div");
      seg.className = "stackbar__seg";
      seg.style.flex = it.value;
      seg.style.background = catColor(it);
      seg.style.setProperty("--delay", (i * 60) + "ms");
      seg.title = it.name + " · " + fmt(it.value);
      bar.appendChild(seg);
    });
    container.appendChild(bar);

    /* ranking con etiqueta directa: el relieve que exige la paleta clara */
    var rank = document.createElement("div");
    rank.className = "rank";

    items.forEach(function (it, i) {
      var share = (it.value / total) * 100;
      var row = document.createElement("div");
      row.className = "rank__item";
      row.innerHTML =
        '<div class="rank__head">' +
          '<span class="rank__dot" style="background:' + catColor(it) + '"></span>' +
          '<span class="rank__name">' + (it.emoji ? it.emoji + " " : "") + it.name + '</span>' +
          '<span class="rank__val">' + fmt(it.value) + '</span>' +
          '<span class="rank__pct">' + Math.round(share) + '%</span>' +
        '</div>' +
        '<div class="rank__track">' +
          '<div class="rank__fill" style="width:' + share.toFixed(1) + '%;' +
            'background:' + catColor(it) + ';--delay:' + (i * 55 + 80) + 'ms"></div>' +
        '</div>';
      rank.appendChild(row);
    });

    container.appendChild(rank);
  }

  /* --- lo que se lleva el espacio común --- */
  G.stackedBreakdown = stackedBreakdown;
})();
