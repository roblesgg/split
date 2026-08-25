/* ============================================================
   split — heatmap de gasto diario
   ============================================================ */

(function () {
  "use strict";

  var G = window.Graficos;
  var ensureTooltip = G.ensureTooltip, placeTooltip = G.placeTooltip, tipRows = G.tipRows;

  /* ============================================================
     5) Heatmap de gasto diario — secuencial de una sola tinta
     ============================================================ */

  var HEAT_STEPS = ["var(--seq-100)", "var(--seq-300)", "var(--seq-500)", "var(--seq-700)"];

  function heatmap(container, days, opts) {
    opts = opts || {};
    var fmt = opts.format || function (v) { return String(v); };
    container.innerHTML = "";

    var values = days.map(function (d) { return d.value; }).filter(function (v) { return v > 0; });
    var max = values.length ? Math.max.apply(null, values) : 0;

    function bucket(v) {
      if (v <= 0) return -1;
      if (max <= 0) return 0;
      var b = Math.ceil((v / max) * HEAT_STEPS.length) - 1;
      return Math.max(0, Math.min(HEAT_STEPS.length - 1, b));
    }

    var grid = document.createElement("div");
    grid.className = "heat";

    /* cabecera de días, lunes primero */
    ["L", "M", "X", "J", "V", "S", "D"].forEach(function (n, i) {
      var h = document.createElement("div");
      h.className = "heat__dow";
      h.textContent = n;
      h.setAttribute("aria-hidden", "true");
      grid.appendChild(h);
    });

    /* huecos hasta alinear el día 1 con su columna */
    for (var p = 0; p < days[0].dow; p++) {
      var pad = document.createElement("div");
      pad.className = "heat__cell heat__cell--pad";
      grid.appendChild(pad);
    }

    var tip = null;

    days.forEach(function (d, i) {
      var b = bucket(d.value);
      var cell = document.createElement("div");
      cell.className = "heat__cell";
      cell.style.setProperty("--delay", (i * 9) + "ms");
      if (b >= 0) {
        cell.style.background = HEAT_STEPS[b];
        cell.setAttribute("data-has", "true");
      }
      cell.setAttribute("tabindex", "0");
      cell.setAttribute("role", "img");
      cell.setAttribute("aria-label", "Día " + d.day + ": " + fmt(d.value));

      function show() {
        if (!tip) tip = ensureTooltip(container);
        tip.innerHTML = '<div class="tooltip__title">Día ' + d.day + '</div>' +
          tipRows([{ color: b >= 0 ? HEAT_STEPS[b] : "var(--surface-3)", name: "Gastado", value: fmt(d.value) }]);
        tip.setAttribute("data-open", "true");
        var r = cell.getBoundingClientRect();
        var cr = container.getBoundingClientRect();
        placeTooltip(container, tip, r.left - cr.left + r.width / 2, r.top - cr.top);
      }
      function hide() { if (tip) tip.setAttribute("data-open", "false"); }

      cell.addEventListener("pointerenter", show);
      cell.addEventListener("pointerleave", hide);
      cell.addEventListener("focus", show);
      cell.addEventListener("blur", hide);

      grid.appendChild(cell);
    });

    container.style.position = "relative";
    container.appendChild(grid);

    /* leyenda de escala */
    var scale = document.createElement("div");
    scale.className = "heat-scale";
    scale.innerHTML = '<span>Menos</span><span class="heat-scale__steps">' +
      '<span class="heat-scale__step" style="background:var(--surface-3)"></span>' +
      HEAT_STEPS.map(function (s) {
        return '<span class="heat-scale__step" style="background:' + s + '"></span>';
      }).join("") +
      '</span><span>Más</span>';
    container.appendChild(scale);
  }

  /* --- lo que se lleva el espacio común --- */
  G.heatmap = heatmap;
})();
