/* ============================================================
   split — columnas divergentes sobre el cero
   ============================================================ */

(function () {
  "use strict";

  var G = window.Graficos;
  var capPath = G.capPath, ensureTooltip = G.ensureTooltip, fmtTick = G.fmtTick, niceTicks = G.niceTicks, placeTooltip = G.placeTooltip, svgEl = G.svgEl, tipRows = G.tipRows, widthOf = G.widthOf;

  /* ============================================================
     2) Columnas divergentes — saldo neto por mes sobre el cero
        polos frío/cálido + línea base neutra
     ============================================================ */

  function divergingColumns(container, opts) {
    var data = opts.data;                    /* [{label, labelFull, value}] */
    var fmt = opts.format || function (v) { return String(v); };
    if (!data.length) return;

    container.classList.add("chart");
    container.innerHTML = "";

    var W = widthOf(container);
    var padL = 40, padR = 12, padT = 14, padB = 26;
    var plotH = opts.height || 140;
    var H = plotH + padT + padB;
    var innerW = W - padL - padR;

    var vals = data.map(function (d) { return d.value; });
    var lo = Math.min(0, Math.min.apply(null, vals));
    var hi = Math.max(0, Math.max.apply(null, vals));
    var ticks = niceTicks(lo, hi, 3);
    var tMin = ticks[0], tMax = ticks[ticks.length - 1];
    var span = (tMax - tMin) || 1;

    function py(v) { return padT + plotH - ((v - tMin) / span) * plotH; }

    var band = innerW / data.length;
    var barW = Math.min(24, band - 2);       /* tope de 24px; el resto queda como aire */

    var svg = svgEl("svg", {
      class: "chart__svg", viewBox: "0 0 " + W + " " + H, width: W, height: H,
      role: "img", "aria-label": opts.ariaLabel || "Saldo neto por mes"
    });

    ticks.forEach(function (t) {
      var y = py(t);
      svg.appendChild(svgEl("line", {
        class: t === 0 ? "axis-line" : "grid-line",
        x1: padL, y1: y, x2: padL + innerW, y2: y
      }));
      var lbl = svgEl("text", { class: "tick-label", x: padL - 8, y: y + 3.5, "text-anchor": "end" });
      lbl.textContent = fmtTick(t);
      svg.appendChild(lbl);
    });

    var zeroY = py(0);
    var tip = null;

    /* Cuántas etiquetas caben. Una etiqueta de mes ocupa unos 26 px con
       la tipografía gorda de la app, así que si la banda es más estrecha
       se pintan de dos en dos, o de tres en tres: doce meses apretados
       en un móvil se solapan y no se lee ninguno. La última siempre se
       pinta —es «dónde estamos»— y por eso se cuenta desde el final. */
    var cadaCuantas = Math.max(1, Math.ceil(26 / band));

    data.forEach(function (d, i) {
      var cx = padL + band * i + band / 2;
      var x = cx - barW / 2;
      var y = py(d.value);
      var up = d.value >= 0;
      var h = Math.abs(y - zeroY);

      var path = svgEl("path", {
        class: "col-mark grow-up",
        d: capPath(x, up ? y : zeroY, barW, h, 4, up ? "up" : "down"),
        style: "fill:" + (up ? "var(--div-pos)" : "var(--div-neg)") +
               ";--delay:" + (i * 34) + "ms" +
               ";transform-origin:" + cx + "px " + zeroY + "px",
        "data-i": i
      });
      svg.appendChild(path);

      if ((data.length - 1 - i) % cadaCuantas === 0) {
        var lbl = svgEl("text", {
          class: "axis-label", x: cx, y: padT + plotH + 17, "text-anchor": "middle"
        });
        lbl.textContent = d.label;
        svg.appendChild(lbl);
      }

      /* zona de impacto ≥24px, cubre toda la banda */
      var hitRect = svgEl("rect", {
        class: "hit", x: padL + band * i, y: 0,
        width: band, height: H, "data-i": i
      });
      svg.appendChild(hitRect);
    });

    container.appendChild(svg);
    tip = ensureTooltip(container);

    var marks = Array.prototype.slice.call(svg.querySelectorAll(".col-mark"));

    function show(i) {
      var d = data[i];
      container.setAttribute("data-hovering", "true");
      marks.forEach(function (m, mi) { m.setAttribute("data-hot", String(mi === i)); });
      tip.innerHTML = '<div class="tooltip__title">' + (d.labelFull || d.label) + '</div>' +
        tipRows([{
          color: d.value >= 0 ? "var(--div-pos)" : "var(--div-neg)",
          name: d.value >= 0 ? "Ahorrado" : "Descubierto",
          value: fmt(d.value)
        }]);
      tip.setAttribute("data-open", "true");
      placeTooltip(container, tip, padL + band * i + band / 2, Math.min(py(d.value), zeroY));
    }

    function hide() {
      container.setAttribute("data-hovering", "false");
      marks.forEach(function (m) { m.removeAttribute("data-hot"); });
      tip.setAttribute("data-open", "false");
    }

    svg.querySelectorAll(".hit").forEach(function (r) {
      r.addEventListener("pointerenter", function () { show(+r.getAttribute("data-i")); });
      r.addEventListener("pointerdown", function () { show(+r.getAttribute("data-i")); });
    });
    svg.addEventListener("pointerleave", hide);

    var focusIdx = data.length - 1;
    svg.setAttribute("tabindex", "0");
    svg.addEventListener("focus", function () { show(focusIdx); });
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { focusIdx = Math.max(0, focusIdx - 1); show(focusIdx); e.preventDefault(); }
      if (e.key === "ArrowRight") { focusIdx = Math.min(data.length - 1, focusIdx + 1); show(focusIdx); e.preventDefault(); }
      if (e.key === "Escape") hide();
    });
  }

  /* --- lo que se lleva el espacio común --- */
  G.divergingColumns = divergingColumns;
})();
