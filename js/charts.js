/* ============================================================
   split — motor de gráficos en SVG, sin dependencias
   Marcas finas · rejilla hairline · huecos de 2px en superficie
   Cada gráfico se acompaña de leyenda y vista tabla.
   Expone window.Charts
   ============================================================ */

(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  /* ---------- utilidades ---------- */

  function svgEl(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      n.setAttribute(k, attrs[k]);
    });
    return n;
  }

  function seriesColor(slot) { return "var(--series-" + slot + ")"; }

  /* Una serie puede traer color propio. Sirve para los gráficos de
     énfasis: la serie protagonista en tinta y el resto en gris, que
     es una forma distinta de la paleta categórica. */
  function colorOf(s) { return s.color || seriesColor(s.slot); }

  /* ticks redondeados a números limpios */
  function niceTicks(min, max, count) {
    if (min === max) { max = min + 1; }
    var span = max - min;
    var raw = span / Math.max(1, count);
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    var start = Math.floor(min / step) * step;
    var end = Math.ceil(max / step) * step;
    var ticks = [];
    for (var v = start; v <= end + step * 0.001; v += step) {
      ticks.push(Math.round(v * 1e6) / 1e6);
    }
    return ticks;
  }

  function fmtTick(v) {
    var a = Math.abs(v);
    if (a >= 1000) {
      var k = v / 1000;
      return (Math.round(k * 10) / 10).toLocaleString("es-ES") + "k";
    }
    return Math.round(v).toLocaleString("es-ES");
  }

  /* rectángulo con extremo de dato redondeado y base cuadrada */
  function capPath(x, y, w, h, r, dir) {
    if (h <= 0.5) return "M" + x + "," + y + "h" + w;
    var rr = Math.min(r, w / 2, h);
    if (dir === "up") {
      /* crece hacia arriba: cantos superiores redondeados */
      return "M" + x + "," + (y + h) +
             "V" + (y + rr) +
             "a" + rr + "," + rr + " 0 0 1 " + rr + "," + (-rr) +
             "h" + (w - rr * 2) +
             "a" + rr + "," + rr + " 0 0 1 " + rr + "," + rr +
             "V" + (y + h) + "Z";
    }
    /* crece hacia abajo: cantos inferiores redondeados */
    return "M" + x + "," + y +
           "V" + (y + h - rr) +
           "a" + rr + "," + rr + " 0 0 0 " + rr + "," + rr +
           "h" + (w - rr * 2) +
           "a" + rr + "," + rr + " 0 0 0 " + rr + "," + (-rr) +
           "V" + y + "Z";
  }

  /* Curva suave tipo Catmull-Rom convertida a béziers cúbicas.
     Es lo que da el trazo ondulado de las apps de banca en vez de la
     polilínea a trozos. No inventa datos: la curva pasa por todos los
     puntos, solo suaviza el camino entre ellos. */
  function splinePath(pts, tension) {
    if (pts.length < 2) return "";
    var t = tension == null ? 0.85 : tension;
    var d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);

    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[i + 2] || p2;

      var c1x = p1[0] + ((p2[0] - p0[0]) / 6) * t;
      var c1y = p1[1] + ((p2[1] - p0[1]) / 6) * t;
      var c2x = p2[0] - ((p3[0] - p1[0]) / 6) * t;
      var c2y = p2[1] - ((p3[1] - p1[1]) / 6) * t;

      d += "C" + c1x.toFixed(1) + "," + c1y.toFixed(1) +
           " " + c2x.toFixed(1) + "," + c2y.toFixed(1) +
           " " + p2[0].toFixed(1) + "," + p2[1].toFixed(1);
    }
    return d;
  }

  var gradSeq = 0;

  /* degradado vertical del color de la serie a transparente */
  function areaGradient(svg, color) {
    var id = "split-grad-" + (++gradSeq);
    var defs = svgEl("defs");
    var lg = svgEl("linearGradient", {
      id: id, x1: "0", y1: "0", x2: "0", y2: "1"
    });
    lg.appendChild(svgEl("stop", {
      offset: "0%", style: "stop-color:" + color + ";stop-opacity:0.24"
    }));
    lg.appendChild(svgEl("stop", {
      offset: "100%", style: "stop-color:" + color + ";stop-opacity:0"
    }));
    defs.appendChild(lg);
    svg.appendChild(defs);
    return "url(#" + id + ")";
  }

  /* ancho disponible del contenedor */
  function widthOf(container, fallback) {
    var w = container.clientWidth;
    return w > 40 ? w : (fallback || 320);
  }

  /* ---------- tooltip compartido ---------- */

  function ensureTooltip(container) {
    var tip = container.querySelector(".tooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "tooltip";
      tip.setAttribute("role", "status");
      container.appendChild(tip);
    }
    return tip;
  }

  function placeTooltip(container, tip, x, y) {
    var cw = container.clientWidth;
    var tw = tip.offsetWidth || 140;
    var th = tip.offsetHeight || 60;
    var left = Math.max(4, Math.min(cw - tw - 4, x - tw / 2));
    var top = Math.max(4, y - th - 14);
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }

  function tipRows(rows) {
    return rows.map(function (r) {
      return '<div class="tooltip__row">' +
        (r.color ? '<span class="tooltip__key" style="background:' + r.color + '"></span>' : '') +
        '<span class="tooltip__name">' + r.name + '</span>' +
        '<span class="tooltip__val">' + r.value + '</span>' +
      '</div>';
    }).join("");
  }

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
    var padL = 40, padR = 46, padT = 16, padB = 26;
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

    /* rejilla + ticks del eje y; la línea del cero se marca como eje */
    ticks.forEach(function (t) {
      var y = py(t);
      svg.appendChild(svgEl("line", {
        class: (t === 0 && lo < 0) ? "axis-line" : "grid-line",
        x1: padL, y1: y, x2: padL + innerW, y2: y
      }));
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
          ? areaGradient(svg, colorOf(s))
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

      var lbl = svgEl("text", {
        class: "axis-label", x: cx, y: padT + plotH + 17, "text-anchor": "middle"
      });
      lbl.textContent = d.label;
      svg.appendChild(lbl);

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

  /* ============================================================
     3) Sparkline — 12 puntos, contexto atenuado + tramo actual
     ============================================================ */

  function sparkline(container, values, opts) {
    opts = opts || {};
    if (!values.length) return;

    container.innerHTML = "";
    var W = widthOf(container, 90);
    var H = opts.height || 26;
    var pad = 3;
    var lo = Math.min.apply(null, values);
    var hi = Math.max.apply(null, values);
    var span = (hi - lo) || 1;

    function px(i) { return pad + (i / (values.length - 1)) * (W - pad * 2); }
    function py(v) { return H - pad - ((v - lo) / span) * (H - pad * 2); }

    var svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H, width: W, height: H,
      "aria-hidden": "true", focusable: "false",
      style: "display:block;overflow:visible"
    });

    /* mismo trazo ondulado que el gráfico grande */
    var pts = values.map(function (v, i) { return [px(i), py(v)]; });
    svg.appendChild(svgEl("path", {
      d: splinePath(pts), fill: "none",
      style: "stroke:var(--deemphasis);stroke-width:2;stroke-linejoin:round;stroke-linecap:round"
    }));

    /* el tramo final va en el color de acento, curvado igual */
    var last = values.length >= 2
      ? svgEl("path", {
          d: splinePath(pts), fill: "none",
          style: "stroke:" + (opts.color || "var(--accent)") +
                 ";stroke-width:2;stroke-linejoin:round;stroke-linecap:round"
        })
      : null;
    if (last) svg.appendChild(last);

    svg.appendChild(svgEl("circle", {
      cx: px(values.length - 1), cy: py(values[values.length - 1]), r: 2.6,
      style: "fill:" + (opts.color || "var(--accent)") +
             ";stroke:var(--surface-1);stroke-width:2"
    }));

    container.appendChild(svg);

    /* Recorta la curva de acento al último tramo. getTotalLength solo es
       fiable con el nodo ya en el documento, por eso va después de montar.
       El reparto es aproximado: los tramos de una curva no miden igual,
       pero para un sparkline de 12 puntos la diferencia no se ve. */
    if (last) {
      try {
        var total = last.getTotalLength();
        var visible = total / (values.length - 1);
        last.setAttribute("stroke-dasharray", visible + " " + total);
        last.setAttribute("stroke-dashoffset", -(total - visible));
      } catch (e) {
        last.parentNode.removeChild(last);   /* mejor sin resalte que mal */
      }
    }
  }

  /* ============================================================
     4) Anillo de progreso
     ============================================================ */

  function progressRing(container, ratio, opts) {
    opts = opts || {};
    var size = opts.size || 58;
    var stroke = opts.stroke || 6;
    var r = (size - stroke) / 2;
    var c = 2 * Math.PI * r;
    var clamped = Math.max(0, Math.min(1, ratio));

    container.innerHTML = "";
    container.classList.add("ring");
    container.style.width = size + "px";
    container.style.height = size + "px";

    var svg = svgEl("svg", {
      width: size, height: size, viewBox: "0 0 " + size + " " + size,
      "aria-hidden": "true", focusable: "false"
    });

    /* pista: paso más claro de la misma rampa */
    svg.appendChild(svgEl("circle", {
      cx: size / 2, cy: size / 2, r: r, fill: "none",
      style: "stroke:" + (opts.track || "var(--surface-3)") + ";stroke-width:" + stroke
    }));

    var arc = svgEl("circle", {
      class: "ring__arc",
      cx: size / 2, cy: size / 2, r: r, fill: "none",
      "stroke-linecap": "round",
      transform: "rotate(-90 " + (size / 2) + " " + (size / 2) + ")",
      style: "stroke:" + (opts.color || "var(--accent)") +
             ";stroke-width:" + stroke +
             ";stroke-dasharray:" + c +
             ";stroke-dashoffset:" + c
    });
    svg.appendChild(arc);
    container.appendChild(svg);

    /* el anillo grande pinta su propia etiqueta con el pie de texto */
    if (opts.label !== false) {
      var pctNode = document.createElement("span");
      pctNode.className = "ring__pct";
      pctNode.textContent = Math.round(clamped * 100) + "%";
      container.appendChild(pctNode);
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        arc.style.strokeDashoffset = String(c * (1 - clamped));
      });
    });
  }

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
      seg.style.background = seriesColor(it.slot);
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
          '<span class="rank__dot" style="background:' + seriesColor(it.slot) + '"></span>' +
          '<span class="rank__name">' + it.name + '</span>' +
          '<span class="rank__val">' + fmt(it.value) + '</span>' +
          '<span class="rank__pct">' + Math.round(share) + '%</span>' +
        '</div>' +
        '<div class="rank__track">' +
          '<div class="rank__fill" style="width:' + share.toFixed(1) + '%;' +
            'background:' + seriesColor(it.slot) + ';--delay:' + (i * 55 + 80) + 'ms"></div>' +
        '</div>';
      rank.appendChild(row);
    });

    container.appendChild(rank);
  }

  /* ============================================================
     Re-render en cambio de tamaño — los SVG se miden en píxeles
     ============================================================ */

  var resizeHandlers = [];

  function onResize(fn) { resizeHandlers.push(fn); }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeHandlers.forEach(function (fn) { try { fn(); } catch (e) {} });
    }, 160);
  });

  window.Charts = {
    lineChart: lineChart,
    divergingColumns: divergingColumns,
    sparkline: sparkline,
    progressRing: progressRing,
    heatmap: heatmap,
    stackedBreakdown: stackedBreakdown,
    seriesColor: seriesColor,
    colorOf: colorOf,
    onResize: onResize,
    niceTicks: niceTicks
  };
})();
