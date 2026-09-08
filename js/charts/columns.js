/* ============================================================
   split — columnas divergentes (Chart.js)
   Barras sobre el cero, color por signo, tooltip al tocar.
   ============================================================ */

(function () {
  "use strict";

  var G = window.Graficos;

  function divergingColumns(container, opts) {
    var Chart = window.Chart;
    var data = opts.data;
    var fmt = opts.format || function (v) { return String(v); };
    if (!data.length || !Chart) return;

    var colors = G.chartColors();
    var height = (opts.height || 140) + 36;
    var canvas = G.mountCanvas(container, height);
    if (opts.ariaLabel) canvas.setAttribute("aria-label", opts.ariaLabel);

    var labels = data.map(function (d) { return d.label; });
    var values = data.map(function (d) { return d.value; });

    var options = G.baseChartOptions(colors, opts.ariaLabel);
    options.plugins.tooltip.callbacks = {
      title: function (items) {
        var i = items[0] && items[0].dataIndex;
        var d = data[i];
        return (d && (d.labelFull || d.label)) || "";
      },
      label: function (ctx) {
        var v = ctx.parsed.y;
        var name = v >= 0 ? "Ahorrado" : "Descubierto";
        return " " + name + ": " + fmt(v);
      }
    };
    options.datasets = options.datasets || {};
    options.datasets.bar = {
      borderRadius: 6,
      borderSkipped: false,
      maxBarThickness: 22
    };
    options.scales.y.grace = "8%";

    container._cj = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Ahorro",
          data: values,
          backgroundColor: values.map(function (v) {
            return v >= 0 ? colors.pos : colors.neg;
          }),
          hoverBackgroundColor: values.map(function (v) {
            return v >= 0 ? colors.pos : colors.neg;
          })
        }]
      },
      options: options
    });
  }

  G.divergingColumns = divergingColumns;
})();
