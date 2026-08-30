/* ============================================================
   split — rosco de reparto
   ============================================================ */

(function () {
  "use strict";

  var G = window.Graficos;
  var catColor = G.catColor, svgEl = G.svgEl;

  /* El nombre de una categoría lo escribe el usuario, así que no puede
     entrar en un innerHTML tal cual. Va aquí y no en el espacio común
     porque es el único gráfico que arma HTML con texto de fuera. */
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ============================================================
     3 bis) Rosco de reparto

     Un anillo con un trozo por categoría y el total en el centro. Dice de
     un vistazo dos cosas a la vez: cuánto en total, y en qué proporciones
     se ha ido. Una lista de doce cifras no hace ni lo uno ni lo otro.

     El anillo es FINO y con las puntas redondeadas. Grueso y a tope
     parecía una tarta de colores de los noventa; fino se lee como una
     medida y deja respirar la cifra del centro, que es el dato que
     primero se busca.

     Los trozos van separados por un hueco para que se distingan sin
     depender solo del color, que en escala de grises o con daltonismo se
     pierde. Como las puntas son redondas, el hueco se descuenta del
     largo: si no, las tapas se comerían la separación.

     Y debajo va la leyenda. Un anillo sin ella obliga a adivinar de qué
     es cada color, que es justo lo que un gráfico no debería pedir: el
     color nunca viaja solo en esta app.
     ============================================================ */

  /* Lo que no llega a un trozo visible se junta en «Otras». Ocho rayas
     de medio grado no informan de nada y ensucian el anillo entero. */
  function agrupar(items, total, maximo) {
    var orden = items.slice().sort(function (a, b) {
      return (b.value || 0) - (a.value || 0);
    });
    var grandes = [], resto = 0;

    orden.forEach(function (it, i) {
      var frac = (it.value || 0) / total;
      if (i < maximo && frac >= 0.03) grandes.push(it);
      else resto += it.value || 0;
    });

    if (resto > 0) {
      grandes.push({ id: "__otras", name: "Otras", value: resto, color: 16 });
    }
    return grandes;
  }

  function donut(container, items, opts) {
    opts = opts || {};
    if (!container) return;

    var total = items.reduce(function (a, it) { return a + (it.value || 0); }, 0);
    if (total <= 0) return;

    var size = opts.size || 190;
    /* 16 de 180. Con 26 el anillo pesaba más que la cifra del centro,
       que es lo que se viene a mirar; con 12 se quedaba en un hilo. */
    var stroke = opts.stroke || 16;
    var hueco = opts.gap == null ? 6 : opts.gap;   /* separación, en píxeles */
    var r = (size - stroke) / 2;
    var cx = size / 2, cy = size / 2;
    var circ = 2 * Math.PI * r;

    var trozos = agrupar(items, total, opts.max || 6);

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
      fill: "none", "stroke-width": stroke, "stroke-linecap": "round"
    }));

    var sumaVis = trozos.reduce(function (a, it) { return a + it.value; }, 0);
    var acumulado = 0;

    trozos.forEach(function (it, i) {
      var frac = it.value / sumaVis;
      var slot = frac * circ;

      /* Con las puntas redondas, lo pintado sobrepasa el trazo en medio
         grosor por cada lado. Se descuenta del largo y se empuja medio
         grosor el arranque, así el trozo cae dentro de su hueco y la
         separación se ve igual entre todos. */
      var largo = slot - hueco - stroke;
      var redondo = largo > 0;
      if (!redondo) largo = Math.max(0.5, slot - hueco);

      var arranque = acumulado * circ + hueco / 2 + (redondo ? stroke / 2 : 0);

      var arco = svgEl("circle", {
        class: "donut__trozo fade-in",
        cx: cx, cy: cy, r: r,
        fill: "none",
        stroke: catColor(it),
        "stroke-width": stroke,
        "stroke-linecap": redondo ? "round" : "butt",
        "stroke-dasharray": largo.toFixed(2) + " " + (circ - largo).toFixed(2),
        "stroke-dashoffset": (-arranque).toFixed(2),
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

    var aro = document.createElement("div");
    aro.className = "donut__aro";
    aro.appendChild(svg);

    /* El centro es HTML y no SVG: así hereda la tipografía y los tamaños
       del resto de la app sin repetirlos aquí.

       Va limitado al agujero y no a la caja entera: con `inset: 0` el
       texto podía crecer hasta el ancho del rosco, y una cifra larga
       —12.850,00 €— se metía por debajo del anillo. Ahora se le da el
       ancho del hueco y, si aun así no cabe, se encoge la cifra hasta
       que quepa. Encogerla es preferible a partirla en dos renglones o a
       recortarla con puntos suspensivos: el número entero es el dato. */
    var agujero = size - stroke * 2;
    var centro = document.createElement("div");
    centro.className = "donut__centro";
    centro.style.width = agujero + "px";
    centro.innerHTML =
      '<span class="donut__label">' + esc(opts.label || "Total") + '</span>' +
      '<span class="donut__valor">' +
        esc(opts.format ? opts.format(total) : total) + '</span>';
    aro.appendChild(centro);
    container.appendChild(aro);

    var valor = centro.querySelector(".donut__valor");
    var cabe = agujero - 14;                     /* aire a los dos lados */
    var mide = valor.scrollWidth;
    if (mide > cabe && cabe > 0) {
      var base = parseFloat(getComputedStyle(valor).fontSize) || 22;
      valor.style.fontSize = Math.max(12, Math.floor(base * cabe / mide)) + "px";
    }

    /* La leyenda: de qué es cada color y cuánto. Va en la misma cadena de
       colores que el anillo, así que no hay forma de que discrepen. */
    if (opts.leyenda === false) return;

    var ley = document.createElement("ul");
    ley.className = "donut__leyenda";
    ley.innerHTML = trozos.map(function (it) {
      var pct = Math.round((it.value / sumaVis) * 100);
      return '<li class="donut__ley">' +
          '<span class="donut__punto" style="background:' + catColor(it) + '"></span>' +
          '<span class="donut__ley-nombre">' +
            (it.emoji ? esc(it.emoji) + " " : "") + esc(it.name) + '</span>' +
          '<span class="donut__ley-pct">' + pct + ' %</span>' +
          '<span class="donut__ley-valor">' +
            esc(opts.format ? opts.format(it.value) : it.value) + '</span>' +
        '</li>';
    }).join("");
    container.appendChild(ley);
  }

  /* --- lo que se lleva el espacio común --- */
  G.donut = donut;
})();
