/* ============================================================
   split — gráfico de líneas (Chart.js)
   Curva suave, sin relleno que se vuelva «losa» en negativo,
   tooltip al tocar cada mes.
   ============================================================ */

(function () {
  "use strict";

  var G = window.Graficos;

  function lineChart(container, opts) {
    var Chart = window.Chart;
    var data = opts.data;
    var series = opts.series;
    var fmt = opts.format || function (v) { return String(v); };
    if (!data.length || !Chart) return;

    var colors = G.chartColors();
    var limpio = opts.limpio === true;
    var height = (opts.height || 150) + 36;
    var canvas = G.mountCanvas(container, height);
    if (opts.ariaLabel) canvas.setAttribute("aria-label", opts.ariaLabel);

    var labels = data.map(function (d) { return d.label; });

    var datasets = series.map(function (s, si) {
      var col = G.resolveColor(s.color, si === 0 ? colors.ink : colors.deemphasis);
      /* Sin área bajo la curva: con meses en negativo el relleno
         cerraba contra el cero y se veía un cuadrado negro. */
      return {
        label: s.name,
        data: data.map(function (d) { return d[s.key] || 0; }),
        borderColor: col,
        backgroundColor: col,
        borderWidth: opts.thick || 2.5,
        tension: opts.smooth === false ? 0 : 0.35,
        fill: false,
        pointRadius: function (ctx) {
          return ctx.dataIndex === data.length - 1 ? 5 : 0;
        },
        pointHoverRadius: 7,
        pointHitRadius: 18,
        pointBackgroundColor: col,
        pointBorderColor: colors.surface,
        pointBorderWidth: 2,
        pointHoverBorderWidth: 2
      };
    });

    var options = G.baseChartOptions(colors, opts.ariaLabel);
    options.plugins.tooltip.callbacks = {
      title: function (items) {
        var i = items[0] && items[0].dataIndex;
        var d = data[i];
        return (d && (d.labelFull || d.label)) || "";
      },
      label: function (ctx) {
        return " " + ctx.dataset.label + ": " + fmt(ctx.parsed.y);
      }
    };

    if (limpio) {
      options.scales.y.grid.display = false;
      options.scales.y.ticks.display = false;
      /* línea del cero solo si hay negativos */
      var minV = 0;
      data.forEach(function (d) {
        series.forEach(function (s) {
          var v = d[s.key] || 0;
          if (v < minV) minV = v;
        });
      });
      if (minV < 0) {
        options.scales.y.grid.display = true;
        options.scales.y.grid.color = function (ctx) {
          return ctx.tick && ctx.tick.value === 0 ? colors.axis : "transparent";
        };
        options.scales.y.ticks.display = true;
        options.scales.y.ticks.count = 3;
      }
    }

    container._cj = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: { labels: labels, datasets: datasets },
      options: options
    });
  }

  G.lineChart = lineChart;
})();
