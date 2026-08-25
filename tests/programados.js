/* ============================================================
   split — cuándo toca un programado

   El calendario es lo que más tarde se nota cuando falla: un recibo que
   no se apunta, o que se apunta dos veces, no se ve hasta que cuadras las
   cuentas. Así que aquí se comprueba cada ritmo contra fechas concretas.
   ============================================================ */

var t = require("./ayuda");

var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
             "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
var CORTOS = ["ene", "feb", "mar", "abr", "may", "jun",
              "jul", "ago", "sep", "oct", "nov", "dic"];

var REAL = Date;
function congelar(iso) {
  var F = REAL.parse(iso);
  function D2() {
    if (arguments.length === 0) return new REAL(F);
    return new (Function.prototype.bind.apply(REAL, [null].concat([].slice.call(arguments))))();
  }
  D2.prototype = REAL.prototype;
  D2.now = function () { return F; };
  D2.parse = REAL.parse;
  D2.UTC = REAL.UTC;
  global.Date = D2;
}
congelar("2026-09-10T12:00:00");

var win = t.cargar(
  ["js/core/dates.js", "js/data/ciclo.js", "js/data/catalog.js",
   "js/data/accounts.js", "js/data/categories.js", "js/data/apartados.js",
   "js/data/limites.js", "js/data/tx.js", "js/data/recurring.js",
   "js/data/pendientes.js"],
  { Datos: { MONTHS: MESES, MONTHS_SHORT: CORTOS, state: null, save: function () {} } });
var D = win.Datos;

function limpio() {
  D.state = {
    ciclo: { dia: 1 },
    categories: D.DEFAULT_CATEGORIES.slice(),
    accounts: [{ id: "banco", name: "Banco", opening: 0 }],
    apartados: [], transactions: [], pendientes: [],
    recurring: [], goals: [], tags: []
  };
}

/* Qué fechas apunta desde su alta hasta un día dado. */
function fechasHasta(datos, hastaIso) {
  limpio();
  D.addRecurring(datos);
  congelar(hastaIso);
  D.runRecurring();
  var todas = D.state.transactions.concat(D.state.pendientes);
  return todas.map(function (x) { return x.date; }).sort();
}

module.exports = function () {

  t.grupo("todos los días");
  congelar("2026-09-10T12:00:00");
  t.es("desde mañana, uno por día", fechasHasta(
      { note: "Café", amount: 2, freq: "diario", categoryId: "comida" },
      "2026-09-14T12:00:00"),
    ["2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"]);

  congelar("2026-09-10T12:00:00");
  t.es("cada 3 días", fechasHasta(
      { note: "Café", amount: 2, freq: "diario", cada: 3, categoryId: "comida" },
      "2026-09-20T12:00:00"),
    ["2026-09-13", "2026-09-16", "2026-09-19"]);

  t.grupo("por semana");
  /* el 10 de septiembre de 2026 es jueves; lunes = 0 */
  congelar("2026-09-10T12:00:00");
  t.es("los lunes", fechasHasta(
      { note: "Clase", amount: 20, freq: "semanal", weekdays: [0], categoryId: "ocio" },
      "2026-10-01T12:00:00"),
    ["2026-09-14", "2026-09-21", "2026-09-28"]);

  congelar("2026-09-10T12:00:00");
  t.es("martes y jueves", fechasHasta(
      { note: "Curro", amount: 40, freq: "semanal", weekdays: [1, 3], categoryId: "extra" },
      "2026-09-25T12:00:00"),
    ["2026-09-15", "2026-09-17", "2026-09-22", "2026-09-24"]);

  congelar("2026-09-10T12:00:00");
  t.es("los lunes, cada dos semanas", fechasHasta(
      { note: "Clase", amount: 20, freq: "semanal", cada: 2, weekdays: [0], categoryId: "ocio" },
      "2026-10-20T12:00:00"),
    ["2026-09-14", "2026-09-28", "2026-10-12"]);

  t.grupo("por mes");
  congelar("2026-09-10T12:00:00");
  t.es("el día 5, que ya pasó este mes, entra igual", fechasHasta(
      { note: "Alquiler", amount: 500, freq: "mensual", day: 5, categoryId: "hogar" },
      "2026-11-10T12:00:00"),
    ["2026-09-05", "2026-10-05", "2026-11-05"]);

  congelar("2026-09-10T12:00:00");
  t.es("cada tres meses", fechasHasta(
      { note: "Seguro", amount: 90, freq: "mensual", cada: 3, day: 5, categoryId: "hogar" },
      "2027-04-10T12:00:00"),
    ["2026-09-05", "2026-12-05", "2027-03-05"]);

  congelar("2026-09-10T12:00:00");
  t.es("cada doce meses es una vez al año", fechasHasta(
      { note: "Seguro del coche", amount: 400, freq: "mensual", cada: 12, day: 5,
        categoryId: "transp" },
      "2028-10-10T12:00:00"),
    ["2026-09-05", "2027-09-05", "2028-09-05"]);

  t.grupo("el día 31 en los meses que no lo tienen");
  congelar("2026-01-01T12:00:00");
  t.es("cae en el último día de cada mes", fechasHasta(
      { note: "Nómina", amount: 1500, kind: "in", freq: "mensual", day: 31,
        categoryId: "nomina" },
      "2026-05-10T12:00:00"),
    ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);

  congelar("2024-01-01T12:00:00");
  t.es("y en un febrero bisiesto, el 29", fechasHasta(
      { note: "Nómina", amount: 1500, kind: "in", freq: "mensual", day: 31,
        categoryId: "nomina" },
      "2024-03-05T12:00:00"),
    ["2024-01-31", "2024-02-29"]);

  t.grupo("nunca dos veces por lo mismo");
  congelar("2026-09-10T12:00:00");
  limpio();
  D.addRecurring({ note: "Alquiler", amount: 500, freq: "mensual", day: 5,
                   categoryId: "hogar" });
  congelar("2026-11-10T12:00:00");
  D.runRecurring();
  var n1 = D.state.transactions.length;
  D.runRecurring();
  D.runRecurring();
  t.es("volver a arrancar la app no repite nada", D.state.transactions.length, n1);
  t.es("y son tres", n1, 3);

  t.grupo("lo que cuesta al mes");
  limpio();
  var mens = function (o) {
    limpio();
    return Math.round(D.mensualizar(D.addRecurring(o)) * 100) / 100;
  };
  t.es("mensual de 100", mens({ note: "x", amount: 100, freq: "mensual", day: 1 }), 100);
  t.es("cada 3 meses, un tercio", mens({ note: "x", amount: 300, freq: "mensual", cada: 3, day: 1 }), 100);
  t.es("anual, la doceava parte", mens({ note: "x", amount: 1200, freq: "mensual", cada: 12, day: 1 }), 100);
  t.es("semanal de 10, 52 semanas entre 12",
       mens({ note: "x", amount: 10, freq: "semanal", weekdays: [0] }), 43.33);
  t.es("dos días a la semana cobra el doble",
       mens({ note: "x", amount: 10, freq: "semanal", weekdays: [0, 3] }), 86.67);
  t.es("cada dos semanas, la mitad",
       mens({ note: "x", amount: 10, freq: "semanal", cada: 2, weekdays: [0] }), 21.67);
  t.es("diario de 2, 365 entre 12", mens({ note: "x", amount: 2, freq: "diario" }), 60.83);
  t.es("cada 5 días", mens({ note: "x", amount: 2, freq: "diario", cada: 5 }), 12.17);
  t.es("14 pagas reparte las dos extras",
       mens({ note: "x", amount: 1200, kind: "in", freq: "mensual", day: 1, pagas: 14 }), 1400);
  t.es("pero no con otro ritmo",
       mens({ note: "x", amount: 1200, kind: "in", freq: "mensual", cada: 3, day: 1, pagas: 14 }), 400);

  t.grupo("la próxima vez que toca");
  congelar("2026-09-10T12:00:00");
  limpio();
  var r = D.addRecurring({ note: "Alquiler", amount: 500, freq: "mensual", day: 20,
                           categoryId: "hogar" });
  t.es("este mes, que aún no ha llegado", D.ymd(D.nextDue(r)), "2026-09-20");
  limpio();
  r = D.addRecurring({ note: "Clase", amount: 20, freq: "semanal", weekdays: [0],
                       categoryId: "ocio" });
  t.es("el lunes que viene", D.ymd(D.nextDue(r)), "2026-09-14");
  limpio();
  r = D.addRecurring({ note: "Clase", amount: 20, freq: "semanal", cada: 2, weekdays: [0],
                       categoryId: "ocio" });
  t.es("con cada dos semanas, sigue siendo el próximo lunes",
       D.ymd(D.nextDue(r)), "2026-09-14");
  limpio();
  r = D.addRecurring({ note: "Café", amount: 2, freq: "diario", categoryId: "comida" });
  t.es("un diario toca hoy mismo", D.ymd(D.nextDue(r)), "2026-09-10");

  t.grupo("los topes");
  limpio();
  t.es("cada 99 días se queda en 30",
       D.addRecurring({ note: "x", amount: 1, freq: "diario", cada: 99 }).cada, 30);
  t.es("cada 99 semanas, en 8",
       D.addRecurring({ note: "x", amount: 1, freq: "semanal", cada: 99, weekdays: [0] }).cada, 8);
  t.es("cada 99 meses, en 12",
       D.addRecurring({ note: "x", amount: 1, freq: "mensual", cada: 99, day: 1 }).cada, 12);
  t.es("un ritmo inventado cae en mensual",
       D.addRecurring({ note: "x", amount: 1, freq: "cada luna llena", day: 1 }).freq, "mensual");
  t.es("el día 40 se queda en 31",
       D.addRecurring({ note: "x", amount: 1, freq: "mensual", day: 40 }).day, 31);
  t.es("y el día 0, en 1",
       D.addRecurring({ note: "x", amount: 1, freq: "mensual", day: 0 }).day, 1);

  t.grupo("cambiar el ritmo empieza de cero");
  congelar("2026-09-10T12:00:00");
  limpio();
  r = D.addRecurring({ note: "Alquiler", amount: 500, freq: "mensual", day: 5,
                       categoryId: "hogar" });
  D.updateRecurring(r.id, { freq: "semanal", weekdays: [0] });
  t.es("el ancla se pone hoy", r.ancla, "2026-09-10");
  congelar("2026-09-20T12:00:00");
  D.runRecurring();
  t.es("y solo apunta desde el cambio, no meses atrás",
       D.state.transactions.map(function (x) { return x.date; }), ["2026-09-14"]);

  t.grupo("las próximas veces que toca, para los avisos del móvil");
  congelar("2026-09-10T12:00:00");
  limpio();
  r = D.addRecurring({ note: "Alquiler", amount: 500, freq: "mensual", day: 20,
                       categoryId: "hogar" });
  t.es("un mensual da fechas de mes en mes",
       D.proximasFechas(r, 3).map(D.ymd), ["2026-09-20", "2026-10-20", "2026-11-20"]);

  limpio();
  r = D.addRecurring({ note: "Seguro", amount: 90, freq: "mensual", cada: 3, day: 20,
                       categoryId: "hogar" });
  t.es("cada tres meses, de tres en tres",
       D.proximasFechas(r, 3).map(D.ymd), ["2026-09-20", "2026-12-20", "2027-03-20"]);

  limpio();
  r = D.addRecurring({ note: "Clase", amount: 20, freq: "semanal", cada: 2, weekdays: [0],
                       categoryId: "ocio" });
  t.es("cada dos semanas, saltando una",
       D.proximasFechas(r, 3).map(D.ymd), ["2026-09-14", "2026-09-28", "2026-10-12"]);

  limpio();
  r = D.addRecurring({ note: "Nómina", amount: 1500, kind: "in", freq: "mensual", day: 31,
                       categoryId: "nomina" });
  t.es("el día 31 cae en el último de cada mes",
       D.proximasFechas(r, 4).map(D.ymd),
       ["2026-09-30", "2026-10-31", "2026-11-30", "2026-12-31"]);

  limpio();
  r = D.addRecurring({ note: "Café", amount: 2, freq: "diario", categoryId: "comida" });
  t.es("un diario, día tras día",
       D.proximasFechas(r, 3).map(D.ymd), ["2026-09-10", "2026-09-11", "2026-09-12"]);

  global.Date = REAL;
};
