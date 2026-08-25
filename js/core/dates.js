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

  /* El mes natural en el que estamos hoy. Ojo: esto NO es el ciclo. Lo
     usan los programados, porque un recibo del día 3 es el 3 del
     calendario, se corte el mes de la app donde se corte. */
  function mesActual() { return monthKey(ymd(new Date())); }

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


  /* ============================================================
     El ciclo

     Un ciclo es un mes que no tiene por qué empezar el día 1. `dia` es el
     día en que se reinicia: con dia = 1 un ciclo es exactamente un mes
     natural, que es como arrancó siempre la app.

     La clave de un ciclo sigue siendo "AAAA-MM": el mes en el que
     EMPIEZA. Eso vale mucho más de lo que parece — addMonths, ordenar
     alfabéticamente y todo lo que ya guardaba claves de mes siguen
     funcionando sin enterarse de que ahora hay ciclos.

     El día se topa en 28 por lo mismo que los programados: un ciclo que
     empezara el 31 no existiría en febrero.
     ============================================================ */

  var CICLO_DIA_MAX = 28;

  function diaValido(dia) {
    var n = parseInt(dia, 10);
    return (n >= 1 && n <= CICLO_DIA_MAX) ? n : 1;
  }

  /* En qué ciclo cae una fecha. Con dia = 25, el 24 de agosto todavía es
     del ciclo que empezó el 25 de julio. */
  function cicloDe(dateStr, dia) {
    dia = diaValido(dia);
    var key = String(dateStr).slice(0, 7);
    if (dia === 1) return key;
    return (+String(dateStr).slice(8, 10) >= dia) ? key : addMonths(key, -1);
  }

  /* Primer y último día del ciclo, los dos incluidos. */
  function rangoDeCiclo(key, dia) {
    dia = diaValido(dia);
    var p = key.split("-");
    if (dia === 1) {
      return { desde: key + "-01", hasta: key + "-" + daysInMonth(key) };
    }
    var fin = new Date(+p[0], +p[1], dia);
    fin.setDate(fin.getDate() - 1);
    return { desde: ymd(new Date(+p[0], +p[1] - 1, dia)), hasta: ymd(fin) };
  }

  /* Días entre dos fechas. Se redondea porque el cambio de hora mete o
     saca una hora y 30 días pasarían a ser 29,96. */
  function diasEntre(a, b) {
    return Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
  }

  function diasDelCiclo(key, dia) {
    if (diaValido(dia) === 1) return daysInMonth(key);
    var r = rangoDeCiclo(key, dia);
    return diasEntre(r.desde, r.hasta) + 1;
  }

  /* Qué día del ciclo es una fecha, contando el primero como 1. Es lo que
     sustituye a getDate() en todo lo que mide «por dónde vas del mes». */
  function diaDelCiclo(dateStr, key, dia) {
    if (diaValido(dia) === 1) return parseYmd(dateStr).getDate();
    return diasEntre(rangoDeCiclo(key, dia).desde, dateStr) + 1;
  }

  function diaCorto(d) { return d.getDate() + " " + MONTHS_SHORT[d.getMonth()]; }

  /* «25 de agosto», para cuando hay sitio y se está explicando algo. */
  function fechaLarga(dateStr) {
    var d = parseYmd(dateStr);
    return d.getDate() + " de " + MONTHS[d.getMonth()];
  }

  /* Con el mes natural, la etiqueta de siempre. Con un ciclo de verdad no
     hay más remedio que decir las dos fechas: llamarle «agosto» a algo que
     va del 25 de agosto al 24 de septiembre es mentir. */
  function etiquetaCiclo(key, style, dia) {
    if (diaValido(dia) === 1) return monthLabel(key, style);
    var r = rangoDeCiclo(key, dia);
    var a = parseYmd(r.desde), b = parseYmd(r.hasta);
    if (style === "short") return diaCorto(a) + " – " + diaCorto(b);
    if (style === "shortYear") {
      return diaCorto(a) + " – " + diaCorto(b) + " " + String(b.getFullYear()).slice(2);
    }
    return diaCorto(a) + " – " + diaCorto(b) + " de " + b.getFullYear();
  }

  /* La versión para un título, sin el año. */
  function nombreCiclo(key, dia) {
    if (diaValido(dia) === 1) return monthLabel(key).split(" ")[0];
    return etiquetaCiclo(key, "short", dia);
  }


  /* --- lo que se lleva el espacio común --- */
  D.addMonths = addMonths;
  D.fechaLarga = fechaLarga;
  D.mesActual = mesActual;
  D.diasEntre = diasEntre;

  /* La matemática del ciclo va junta y aparte: aquí no sabe qué día tiene
     configurado el usuario, se le pasa. Quien lo lee de los ajustes es
     data/ciclo.js, que es el que usa el resto de la app. */
  D.Ciclo = {
    DIA_MAX: CICLO_DIA_MAX,
    diaValido: diaValido,
    de: cicloDe,
    rango: rangoDeCiclo,
    dias: diasDelCiclo,
    diaDentro: diaDelCiclo,
    etiqueta: etiquetaCiclo,
    nombre: nombreCiclo
  };
  D.daysInMonth = daysInMonth;
  D.dowMon = dowMon;
  D.monthKey = monthKey;
  D.monthLabel = monthLabel;
  D.parseYmd = parseYmd;
  D.relDayLabel = relDayLabel;
  D.ymd = ymd;
})();
