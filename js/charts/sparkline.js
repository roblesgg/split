/* ============================================================
   split — sparkline
   ============================================================ */

(function () {
  "use strict";

  var G = window.Graficos;
  var splinePath = G.splinePath, svgEl = G.svgEl, widthOf = G.widthOf;

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
      style: "stroke:var(--deemphasis);stroke-width:3;stroke-linejoin:round;stroke-linecap:round"
    }));

    /* el tramo final va en el color de acento, curvado igual */
    var last = values.length >= 2
      ? svgEl("path", {
          d: splinePath(pts), fill: "none",
          style: "stroke:" + (opts.color || "var(--accent)") +
                 ";stroke-width:3;stroke-linejoin:round;stroke-linecap:round"
        })
      : null;
    if (last) svg.appendChild(last);

    svg.appendChild(svgEl("circle", {
      cx: px(values.length - 1), cy: py(values[values.length - 1]), r: 3.4,
      style: "fill:" + (opts.color || "var(--accent)") +
             ";stroke:var(--surface-1);stroke-width:2.5"
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

  /* --- lo que se lleva el espacio común --- */
  G.sparkline = sparkline;
})();
