/* ============================================================
   split — rosco de reparto
   ============================================================ */

(function () {
  "use strict";

  var G = window.Graficos;
  var catColor = G.catColor, svgEl = G.svgEl;

  /* ============================================================
     3 bis) Rosco de reparto

     Un anillo con un trozo por categoría y el total en el centro. Dice de
     un vistazo dos cosas a la vez: cuánto en total, y en qué proporciones
     se ha ido. Una lista de doce cifras no hace ni lo uno ni lo otro.

     Los trozos van separados por un hueco para que se distingan sin
     depender solo del color, que en escala de grises o con daltonismo se
     pierde. Y solo se dibujan los que se ven: por debajo del 1,5 % un
     trozo es una raya que ensucia y no se puede tocar.
     ============================================================ */

  function donut(container, items, opts) {
    opts = opts || {};
    if (!container) return;

    var total = items.reduce(function (a, it) { return a + (it.value || 0); }, 0);
    if (total <= 0) return;

    var size = opts.size || 190;
    var stroke = opts.stroke || 26;
    var hueco = 0.012;                    /* separación entre trozos, en vueltas */
    var r = (size - stroke) / 2;
    var cx = size / 2, cy = size / 2;
    var circ = 2 * Math.PI * r;

    container.classList.add("chart");
    container.innerHTML = "";

    var svg = svgEl("svg", {
      class: "donut__svg",
      viewBox: "0 0 " + size + " " + size,
      width: size, height: size,
      role: "img",
      "aria-label": opts.ariaLabel || "Reparto por categoría"
    });

    /* canal de fondo, para que el anillo se lea aunque falten trozos */
    svg.appendChild(svgEl("circle", {
      class: "donut__pista", cx: cx, cy: cy, r: r,
      fill: "none", "stroke-width": stroke
    }));

    var visibles = items.filter(function (it) {
      return (it.value || 0) / total >= 0.015;
    });
    var sumaVis = visibles.reduce(function (a, it) { return a + it.value; }, 0);

    var acumulado = 0;
    visibles.forEach(function (it, i) {
      var frac = it.value / sumaVis;
      var largo = Math.max(0, frac - hueco) * circ;

      var arco = svgEl("circle", {
        class: "donut__trozo fade-in",
        cx: cx, cy: cy, r: r,
        fill: "none",
        stroke: catColor(it),
        "stroke-width": stroke,
        "stroke-linecap": "butt",
        "stroke-dasharray": largo.toFixed(2) + " " + (circ - largo).toFixed(2),
        "stroke-dashoffset": (-acumulado * circ).toFixed(2),
        /* el dash empieza a las tres en punto; se gira para empezar arriba */
        transform: "rotate(-90 " + cx + " " + cy + ")",
        style: "--i:" + i
      });
      var titulo = svgEl("title");
      titulo.textContent = it.name + " · " + (opts.format ? opts.format(it.value) : it.value);
      arco.appendChild(titulo);
      svg.appendChild(arco);

      acumulado += frac;
    });

    container.appendChild(svg);

    /* El centro es HTML y no SVG: así hereda la tipografía y los tamaños
       del resto de la app sin repetirlos aquí.

       Va limitado al agujero y no a la caja entera: con `inset: 0` el
       texto podía crecer hasta el ancho del rosco, y una cifra larga
       —12.850,00 €— se metía por debajo del anillo. Ahora se le da el
       ancho del hueco y, si aun así no cabe, se encoge la cifra hasta
       que quepa. Encogerla es preferible a partirla en dos renglones o a
       recortarla con puntos suspensivos: el número entero es el dato. */
    var hueco = size - stroke * 2;
    var centro = document.createElement("div");
    centro.className = "donut__centro";
    centro.style.width = hueco + "px";
    centro.innerHTML =
      '<span class="donut__label">' + (opts.label || "Total") + '</span>' +
      '<span class="donut__valor">' +
        (opts.format ? opts.format(total) : total) + '</span>';
    container.appendChild(centro);

    var valor = centro.querySelector(".donut__valor");
    var cabe = hueco - 14;                       /* aire a los dos lados */
    var mide = valor.scrollWidth;
    if (mide > cabe && cabe > 0) {
      var base = parseFloat(getComputedStyle(valor).fontSize) || 22;
      valor.style.fontSize = Math.max(12, Math.floor(base * cabe / mide)) + "px";
    }
  }

  /* --- lo que se lleva el espacio común --- */
  G.donut = donut;
})();
