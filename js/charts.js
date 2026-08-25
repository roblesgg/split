/* ============================================================
   split — la API de gráficos que ve la app

   Motor propio en SVG, escrito a mano: sin Chart.js, sin D3 y sin
   ninguna otra dependencia. Cada tipo vive en js/charts/.
   ============================================================ */

(function () {
  "use strict";

  var G = window.Graficos;
  var catColor = G.catColor, colorOf = G.colorOf, divergingColumns = G.divergingColumns;
  var donut = G.donut, heatmap = G.heatmap, lineChart = G.lineChart, niceTicks = G.niceTicks;
  var progressRing = G.progressRing, seriesColor = G.seriesColor, sparkline = G.sparkline;
  var stackedBreakdown = G.stackedBreakdown;

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
    donut: donut,
    heatmap: heatmap,
    stackedBreakdown: stackedBreakdown,
    seriesColor: seriesColor,
    catColor: catColor,
    colorOf: colorOf,
    onResize: onResize,
    niceTicks: niceTicks
  };

})();
