/* ============================================================
   split — puente a Chart.js

   Resuelve colores CSS, monta el canvas y destruye el gráfico
   anterior al repintar (cada pantalla se vuelve a generar entera).
   ============================================================ */

(function () {
  "use strict";

  var G = window.Graficos;

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim();
    return v || fallback || "#888";
  }

  function chartColors() {
    return {
      ink: cssVar("--chart-ink", "#1c1c1e"),
      muted: cssVar("--text-muted", "#8e8e93"),
      secondary: cssVar("--text-secondary", "#636366"),
      grid: cssVar("--grid", "#e5e5ea"),
      axis: cssVar("--axis", "#d1d1d6"),
      surface: cssVar("--surface-1", "#ffffff"),
      raised: cssVar("--surface-raised", "#ffffff"),
      accent: cssVar("--accent", "#007aff"),
      pos: cssVar("--div-pos", "#34c759"),
      neg: cssVar("--div-neg", "#ff3b30"),
      deemphasis: cssVar("--deemphasis", "#8e8e93"),
      font: cssVar("--font", "system-ui, sans-serif")
    };
  }

  /* Convierte un color de serie (puede ser var(--x) o un hex) a algo
     que el canvas de Chart.js entienda. */
  function resolveColor(c, fallback) {
    if (!c) return fallback || chartColors().ink;
    if (c.indexOf("var(") === 0) {
      var m = c.match(/var\(\s*(--[^),\s]+)/);
      return m ? cssVar(m[1], fallback) : (fallback || chartColors().ink);
    }
    return c;
  }

  function destroyChart(container) {
    if (container && container._cj) {
      try { container._cj.destroy(); } catch (e) { /* ya muerto */ }
      container._cj = null;
    }
  }

  function mountCanvas(container, height) {
    destroyChart(container);
    container.classList.add("chart", "chart--cj");
    container.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "chart__canvas-wrap";
    wrap.style.height = (height || 160) + "px";
    var canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    wrap.appendChild(canvas);
    container.appendChild(wrap);
    return canvas;
  }

  function baseOptions(colors, ariaLabel) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 520, easing: "easeOutQuart" },
      interaction: {
        mode: "index",
        intersect: false,
        axis: "x"
      },
      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: {
          enabled: true,
          displayColors: true,
          backgroundColor: colors.raised,
          titleColor: colors.secondary,
          bodyColor: colors.ink,
          borderColor: colors.grid,
          borderWidth: 1,
          cornerRadius: 12,
          padding: 12,
          boxPadding: 4,
          titleFont: { family: colors.font, size: 12, weight: "600" },
          bodyFont: { family: colors.font, size: 13, weight: "600" },
          caretSize: 6,
          caretPadding: 8
        }
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: {
            color: colors.muted,
            font: { family: colors.font, size: 11, weight: "500" },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6
          },
          border: { display: false }
        },
        y: {
          grid: {
            color: colors.grid,
            drawBorder: false,
            lineWidth: 1
          },
          ticks: {
            color: colors.muted,
            font: { family: colors.font, size: 11, weight: "500" },
            callback: function (v) { return G.fmtTick(v); }
          },
          border: { display: false }
        }
      }
    };
  }

  G.chartColors = chartColors;
  G.resolveColor = resolveColor;
  G.destroyChart = destroyChart;
  G.mountCanvas = mountCanvas;
  G.baseChartOptions = baseOptions;
})();
