/* ============================================================
   split — gráfico de líneas
   ============================================================ */

(function () {
  "use strict";

  var G = window.Graficos;
  var areaGradient = G.areaGradient, colorOf = G.colorOf, ensureTooltip = G.ensureTooltip, fmtTick = G.fmtTick, niceTicks = G.niceTicks, placeTooltip = G.placeTooltip, splinePath = G.splinePath, svgEl = G.svgEl, tipRows = G.tipRows, widthOf = G.widthOf;

  /* ============================================================
     1) Gráfico de líneas — tendencia con 2 series categóricas
        crosshair + tooltip + etiquetas directas en el extremo
     ============================================================ */

  function lineChart(container, opts) {
    var data = opts.data;                    /* [{label, labelFull, ...}] */
    var series = opts.series;                /* [{key, name, slot}] */
    var fmt = opts.format || function (v) { return String(v); };
    if (!data.length) return;

    container.classList.add("chart");
    container.innerHTML = "";

    var W = widthOf(container);

    /* Modo limpio: la curva y poco más. Sin rejilla, sin eje vertical y
       sin números a la izquierda. Lo que se quiere saber de un vistazo es
       la forma —si sube o baja—, no cuánto vale la tercera raya. La cifra
       exacta se lee tocando, y la del último punto va siempre escrita. */
    var limpio = opts.limpio === true;

    var padL = limpio ? 10 : 40;
    var padR = 46, padT = 16, padB = 26;
    var plotH = opts.height || 150;
    var H = plotH + padT + padB;              /* la banda del eje va dentro */
    var innerW = W - padL - padR;

    /* El dominio sale de los datos, no de cero: una serie con meses en
       negativo (el ahorro, por ejemplo) se salía del área por abajo y
       pisaba las etiquetas del eje x. */
    var minV = 0, maxV = 0;
    data.forEach(function (d) {
      series.forEach(function (s) {
        var v = d[s.key] || 0;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      });
    });
    var ticks = niceTicks(minV, maxV, 3);
    var lo = ticks[0];
    var hi = ticks[ticks.length - 1];
    var span = (hi - lo) || 1;

    function px(i) {
      return padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    }
    function py(v) { return padT + plotH - ((v - lo) / span) * plotH; }

    /* el área se apoya en el cero cuando el cero está dentro del rango */
    var baseY = Math.max(padT, Math.min(padT + plotH, py(0)));

    var svg = svgEl("svg", {
      class: "chart__svg",
      viewBox: "0 0 " + W + " " + H,
      width: W, height: H,
      role: "img",
      "aria-label": opts.ariaLabel || "Gráfico de líneas"
    });

    /* Rejilla y números del eje. En modo limpio solo se deja la línea del
       cero cuando hay valores negativos, porque ahí sí importa saber por
       dónde se cruza. */
    ticks.forEach(function (t) {
      var y = py(t);
      var esCero = t === 0 && lo < 0;
      if (limpio && !esCero) return;

      svg.appendChild(svgEl("line", {
        class: esCero ? "axis-line" : "grid-line",
        x1: padL, y1: y, x2: padL + innerW, y2: y
      }));

      if (limpio) return;
      var lbl = svgEl("text", { class: "tick-label", x: padL - 8, y: y + 3.5, "text-anchor": "end" });
      lbl.textContent = fmtTick(t);
      svg.appendChild(lbl);
    });

    /* etiquetas del eje x, aligeradas si no caben */
    var everyN = innerW / data.length < 26 ? 2 : 1;
    data.forEach(function (d, i) {
      if (i % everyN !== 0 && i !== data.length - 1) return;
      var lbl = svgEl("text", {
        class: "axis-label", x: px(i), y: padT + plotH + 17, "text-anchor": "middle"
      });
      lbl.textContent = d.label;
      svg.appendChild(lbl);
    });

    /* series */
    var drawn = [];
    series.forEach(function (s, si) {
      var pts = data.map(function (d, i) { return [px(i), py(d[s.key] || 0)]; });
      var dLine = opts.smooth === false
        ? pts.map(function (p, i) {
            return (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1);
          }).join(" ")
        : splinePath(pts);

      /* lavado de área bajo la primera serie */
      if (si === 0 && opts.area !== false) {
        var dArea = dLine + " L" + pts[pts.length - 1][0].toFixed(1) + "," + baseY.toFixed(1) +
                    " L" + pts[0][0].toFixed(1) + "," + baseY.toFixed(1) + " Z";
        var fill = opts.gradient
          ? areaGradient(svg, colorOf(s), limpio)
          : colorOf(s);
        svg.appendChild(svgEl("path", {
          class: "series-area fade-in" + (opts.gradient ? " series-area--grad" : ""),
          d: dArea,
          style: "fill:" + fill + ";--delay:" + (si * 90 + 120) + "ms"
        }));
      }

      var path = svgEl("path", {
        class: "series-line draw-in", d: dLine,
        style: "stroke:" + colorOf(s) +
               (opts.thick ? ";stroke-width:" + opts.thick : "")
      });
      svg.appendChild(path);
      drawn.push(path);

      /* punto final ≥8px con anillo de superficie */
      var last = pts[pts.length - 1];
      svg.appendChild(svgEl("circle", {
        class: "end-dot fade-in", cx: last[0], cy: last[1], r: 4.5,
        style: "fill:" + colorOf(s) + ";--delay:" + (380 + si * 80) + "ms"
      }));
    });

    /* etiqueta directa solo en el extremo, y separadas si colisionan */
    var endLabels = series.map(function (s) {
      return { s: s, y: py(data[data.length - 1][s.key] || 0), v: data[data.length - 1][s.key] || 0 };
    }).sort(function (a, b) { return a.y - b.y; });

    for (var i = 1; i < endLabels.length; i++) {
      if (endLabels[i].y - endLabels[i - 1].y < 13) endLabels[i].y = endLabels[i - 1].y + 13;
    }

    endLabels.forEach(function (e, i) {
      var t = svgEl("text", {
        class: "direct-label fade-in",
        x: padL + innerW + 8,
        y: Math.min(padT + plotH, Math.max(padT + 6, e.y + 3.5)),
        "text-anchor": "start",
        style: "--delay:" + (460 + i * 70) + "ms"
      });
      t.textContent = fmtTick(e.v);
      svg.appendChild(t);
    });

    /* Etiqueta flotante en el punto más alto de la primera serie.
       Es una etiqueta directa del extremo, no un adorno: marca el dato
       que el ojo busca primero. El texto va dentro de un relleno, así
       que se pinta en blanco, que es el caso permitido. */
    if (opts.peak !== false) {
      var peakI = 0, peakV = -Infinity;
      data.forEach(function (d, i) {
        var v = d[series[0].key] || 0;
        if (v > peakV) { peakV = v; peakI = i; }
      });

      var text = fmtTick(peakV);
      var bw = Math.max(38, text.length * 7.5 + 18);
      var bh = 22;
      var bx = Math.max(padL, Math.min(padL + innerW - bw, px(peakI) - bw / 2));
      var by = Math.max(2, py(peakV) - bh - 12);
      var g = svgEl("g", { class: "peak fade-in", style: "--delay:520ms" });

      g.appendChild(svgEl("rect", {
        class: "peak__box", x: bx, y: by, width: bw, height: bh, rx: 8
      }));
      /* pico del bocadillo */
      g.appendChild(svgEl("path", {
        class: "peak__tail",
        d: "M" + (px(peakI) - 4) + "," + (by + bh) +
           "L" + px(peakI) + "," + (by + bh + 5) +
           "L" + (px(peakI) + 4) + "," + (by + bh) + "Z"
      }));
      var tx = svgEl("text", {
        class: "peak__text", x: bx + bw / 2, y: by + bh / 2 + 4, "text-anchor": "middle"
      });
      tx.textContent = text;
      g.appendChild(tx);
      svg.appendChild(g);
    }

    /* capa de interacción */
    var cross = svgEl("line", {
      class: "crosshair", x1: 0, y1: padT, x2: 0, y2: padT + plotH
    });
    svg.appendChild(cross);

    var focusDots = series.map(function (s) {
      var c = svgEl("circle", {
        class: "focus-dot", r: 4.5, cx: 0, cy: 0,
        style: "fill:" + colorOf(s)
      });
      svg.appendChild(c);
      return c;
    });

    var hit = svgEl("rect", {
      class: "hit", x: padL - innerW / (data.length * 2), y: 0,
      width: innerW + innerW / data.length, height: H
    });
    svg.appendChild(hit);

    container.appendChild(svg);

    /* la longitud del trazo solo es fiable con el nodo ya en el documento */
    drawn.forEach(function (path) {
      try { path.style.setProperty("--len", path.getTotalLength() + "px"); }
      catch (e) { path.classList.remove("draw-in"); }
    });

    var tip = ensureTooltip(container);

    function showAt(idx) {
      idx = Math.max(0, Math.min(data.length - 1, idx));
      var d = data[idx];
      var x = px(idx);
      container.setAttribute("data-hovering", "true");
      cross.setAttribute("x1", x); cross.setAttribute("x2", x);
      var minY = padT + plotH;
      series.forEach(function (s, si) {
        var y = py(d[s.key] || 0);
        focusDots[si].setAttribute("cx", x);
        focusDots[si].setAttribute("cy", y);
        minY = Math.min(minY, y);
      });
      tip.innerHTML = '<div class="tooltip__title">' + (d.labelFull || d.label) + '</div>' +
        tipRows(series.map(function (s) {
          return { color: colorOf(s), name: s.name, value: fmt(d[s.key] || 0) };
        }));
      tip.setAttribute("data-open", "true");
      placeTooltip(container, tip, x, minY);
    }

    function hide() {
      container.setAttribute("data-hovering", "false");
      tip.setAttribute("data-open", "false");
    }

    function idxFromEvent(e) {
      var r = svg.getBoundingClientRect();
      var rel = (e.clientX - r.left) * (W / r.width);
      return Math.round(((rel - padL) / innerW) * (data.length - 1));
    }

    hit.addEventListener("pointermove", function (e) { showAt(idxFromEvent(e)); });
    hit.addEventListener("pointerdown", function (e) { showAt(idxFromEvent(e)); });
    hit.addEventListener("pointerleave", hide);

    /* teclado: mismo contenido que el hover */
    var focusIdx = data.length - 1;
    svg.setAttribute("tabindex", "0");
    svg.addEventListener("focus", function () { showAt(focusIdx); });
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { focusIdx = Math.max(0, focusIdx - 1); showAt(focusIdx); e.preventDefault(); }
      if (e.key === "ArrowRight") { focusIdx = Math.min(data.length - 1, focusIdx + 1); showAt(focusIdx); e.preventDefault(); }
      if (e.key === "Escape") hide();
    });
  }

  /* --- lo que se lleva el espacio común --- */
  G.lineChart = lineChart;
})();
