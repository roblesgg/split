/* ============================================================
   split — fechas

   Todo en hora local, nunca UTC: una fecha aquí es el día que el usuario
   vio en el calendario, no un instante.
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;
  var MONTHS = D.MONTHS, MONTHS_SHORT = D.MONTHS_SHORT;

  /* ---------- fechas (todo en local, sin UTC) ---------- */

  function ymd(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function parseYmd(s) {
    var p = String(s).split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function monthKey(s) { return String(s).slice(0, 7); }

  function monthLabel(key, style) {
    var p = key.split("-");
    var mi = +p[1] - 1;
    if (style === "short") return MONTHS_SHORT[mi];
    if (style === "shortYear") return MONTHS_SHORT[mi] + " " + p[0].slice(2);
    return MONTHS[mi] + " " + p[0];
  }

  function addMonths(key, delta) {
    var p = key.split("-");
    var d = new Date(+p[0], +p[1] - 1 + delta, 1);
    var m = d.getMonth() + 1;
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m;
  }

  function daysInMonth(key) {
    var p = key.split("-");
    return new Date(+p[0], +p[1], 0).getDate();
  }

  /* índice de día de semana con lunes = 0 */
  function dowMon(d) { return (d.getDay() + 6) % 7; }

  function relDayLabel(dateStr, today) {
    var d = parseYmd(dateStr);
    var t = today ? parseYmd(today) : new Date();
    t.setHours(0, 0, 0, 0);
    var diff = Math.round((t - d) / 86400000);
    if (diff === 0) return "Hoy";
    if (diff === 1) return "Ayer";
    if (diff > 1 && diff < 7) {
      var names = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
      return names[dowMon(d)].charAt(0).toUpperCase() + names[dowMon(d)].slice(1);
    }
    return d.getDate() + " " + MONTHS_SHORT[d.getMonth()] +
           (d.getFullYear() !== t.getFullYear() ? " " + d.getFullYear() : "");
  }


  /* --- lo que se lleva el espacio común --- */
  D.addMonths = addMonths;
  D.daysInMonth = daysInMonth;
  D.dowMon = dowMon;
  D.monthKey = monthKey;
  D.monthLabel = monthLabel;
  D.parseYmd = parseYmd;
  D.relDayLabel = relDayLabel;
  D.ymd = ymd;
})();
