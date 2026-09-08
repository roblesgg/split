/* ============================================================
   split — la API de gráficos que ve la app

   Líneas y columnas van con Chart.js (vendor/); el resto sigue en SVG
   propio. Cada tipo vive en js/charts/.
   ============================================================ */

(function () {
  "use strict";

  var G = window.Graficos;
  var catColor = G.catColor, colorOf = G.colorOf, divergingColumns = G.divergingColumns;
  var donut = G.donut, heatmap = G.heatmap, lineChart = G.lineChart, niceTicks = G.niceTicks;
  var progressRing = G.progressRing, seriesColor = G.seriesColor, sparkline = G.sparkline;
  var stackedBreakdown = G.stackedBreakdown;
  var destroyChart = G.destroyChart;

  function destroyChartsIn(root) {
    if (!root || !destroyChart) return;
    var nodes = root.querySelectorAll(".chart--cj");
    for (var i = 0; i < nodes.length; i++) destroyChart(nodes[i]);
  }

  /* ============================================================
     Re-render en cambio de tamaño — Chart.js es responsive; los SVG
     antiguos se remiden si alguien se registró.
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
    donut: donut,
    heatmap: heatmap,
    stackedBreakdown: stackedBreakdown,
    seriesColor: seriesColor,
    catColor: catColor,
    colorOf: colorOf,
    onResize: onResize,
    niceTicks: niceTicks,
    destroyChartsIn: destroyChartsIn
  };

})();
