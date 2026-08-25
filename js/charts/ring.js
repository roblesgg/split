/* ============================================================
   split — anillo de progreso
   ============================================================ */

(function () {
  "use strict";

  var G = window.Graficos;
  var svgEl = G.svgEl;

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

  /* --- lo que se lleva el espacio común --- */
  G.progressRing = progressRing;
})();
