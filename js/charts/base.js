/* ============================================================
   split — cimientos del motor de gráficos

   Crear nodos SVG, elegir color, repartir los ticks de un eje, dibujar
   una curva y el tooltip que comparten todos.
   ============================================================ */

(function () {
  "use strict";

  var G = window.Graficos;

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

  /* Las categorías traen su color como índice 1..16 de la paleta --cat-*,
     que el usuario elige. Los slots de serie siguen valiendo para lo que
     no es una categoría. */
  function catColor(it) {
    var n = it && it.color;
    return (n >= 1 && n <= 16) ? "var(--cat-" + n + ")" : seriesColor((it && it.slot) || 8);
  }

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
  /* El degradado va de arriba abajo de TODO el svg, no del área, así que
     donde el área se corta —en la línea del cero— la opacidad todavía no
     ha llegado a cero y se ve un canto recto. Con la rejilla puesta pasa
     desapercibido; sin ella, ese canto es lo primero que se ve y parece
     una losa gris. En modo limpio se arranca mucho más bajo. */
  function areaGradient(svg, color, suave) {
    var id = "split-grad-" + (++gradSeq);
    var defs = svgEl("defs");
    var lg = svgEl("linearGradient", {
      id: id, x1: "0", y1: "0", x2: "0", y2: "1"
    });
    lg.appendChild(svgEl("stop", {
      offset: "0%", style: "stop-color:" + color + ";stop-opacity:" + (suave ? "0.11" : "0.24")
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

  /* --- lo que se lleva el espacio común --- */
  G.areaGradient = areaGradient;
  G.capPath = capPath;
  G.catColor = catColor;
  G.colorOf = colorOf;
  G.ensureTooltip = ensureTooltip;
  G.fmtTick = fmtTick;
  G.niceTicks = niceTicks;
  G.placeTooltip = placeTooltip;
  G.seriesColor = seriesColor;
  G.splinePath = splinePath;
  G.svgEl = svgEl;
  G.tipRows = tipRows;
  G.widthOf = widthOf;
})();
