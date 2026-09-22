/* ============================================================
   split — el sueldo que se cobra por adelantado

   Quien cobra el día 25 no cobra por el mes que se acaba: cobra para el
   que entra. Si la app no sabe eso, el mes nuevo empieza marcando cero
   ingresos —y con él la tasa de ahorro, la media y todo lo que se
   calcula sobre lo que entra— hasta que llegue el siguiente cobro.

   El caso de verdad, el que hay que sostener, es el de dos sueldos en
   casa: uno el 25 del mes anterior y otro el 1, o el 30 si ese mes cae
   en fin de semana. Los tres tienen que acabar contando para el mismo
   mes, que es el que se paga con ellos.
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
   "js/data/pendientes.js", "js/data/select.js", "js/data/budget.js"],
  { Datos: { MONTHS: MESES, MONTHS_SHORT: CORTOS, state: null, save: function () {},
             eur: { format: function (v) { return v + " €"; } } } });
var D = win.Datos, C = D.Ciclo;

function limpio(dia) {
  D.state = {
    ciclo: { dia: dia || 1 },
    categories: D.DEFAULT_CATEGORIES.slice(),
    accounts: [{ id: "banco", name: "Banco", opening: 0 }],
    apartados: [], transactions: [], pendientes: [],
    recurring: [], goals: [], tags: [],
    income: { mode: "auto", manual: 0, months: 3 }
  };
}

/* Lo que entra en un mes, mirando ya por el mes para el que cuenta. */
function ingresosDe(key) {
  return D.totals(D.txDeCiclo(key)).income;
}

module.exports = function () {

  t.grupo("qué mes arranca a partir de una fecha");
  t.es("el sueldo del 25 es para octubre", C.queEmpieza("2026-09-25", 1), "2026-10");
  t.es("el del 30 también", C.queEmpieza("2026-09-30", 1), "2026-10");
  t.es("y el del 1 de octubre, que ya es octubre",
       C.queEmpieza("2026-10-01", 1), "2026-10");
  t.es("cobrar a mitad de mes tira para el siguiente",
       C.queEmpieza("2026-09-15", 1), "2026-10");
  t.es("con el mes empezando el 25, el del 25 se queda donde está",
       C.queEmpieza("2026-09-25", 25), "2026-09");
  t.es("y el del 1 de octubre ya es de ese mismo ciclo… no: del que viene",
       C.queEmpieza("2026-10-01", 25), "2026-10");

  t.grupo("un sueldo marcado como adelantado");
  limpio();
  D.addRecurring({ kind: "in", note: "Nómina", amount: 1600, day: 25,
                   freq: "mensual", categoryId: "nomina", accountId: "banco",
                   adelantado: true });
  congelar("2026-09-26T12:00:00");
  D.runRecurring();

  var mov = D.state.transactions[0];
  t.es("se apunta con su fecha de verdad", mov.date, "2026-09-25");
  t.es("pero contando para octubre", mov.ciclo, "2026-10");
  t.es("septiembre no lo ve", ingresosDe("2026-09"), 0);
  t.es("y octubre sí", ingresosDe("2026-10"), 1600);

  t.grupo("sin marcar, todo sigue como siempre");
  limpio();
  D.addRecurring({ kind: "in", note: "Nómina", amount: 1600, day: 25,
                   freq: "mensual", categoryId: "nomina", accountId: "banco" });
  congelar("2026-09-26T12:00:00");
  D.runRecurring();
  t.es("no se le pone mes a mano", D.state.transactions[0].ciclo, undefined);
  t.es("y cuenta en septiembre, como su fecha", ingresosDe("2026-09"), 1600);

  t.grupo("los dos sueldos de casa acaban en el mismo mes");
  limpio();
  /* uno el 25 del mes anterior */
  D.addRecurring({ kind: "in", note: "Nómina de ella", amount: 1600, day: 25,
                   freq: "mensual", categoryId: "nomina", accountId: "banco",
                   adelantado: true });
  /* y otro el 1, que es el mismo día en que arranca el mes */
  D.addRecurring({ kind: "in", note: "Nómina de él", amount: 1400, day: 1,
                   freq: "mensual", categoryId: "nomina", accountId: "banco",
                   adelantado: true });
  congelar("2026-10-02T12:00:00");
  D.runRecurring();
  t.es("los dos suman en octubre", ingresosDe("2026-10"), 3000);
  /* En septiembre queda el cobro del 1 de septiembre, que es de
     septiembre: ese mes también se paga con el sueldo que entra su
     día 1. Lo que NO queda es el del 25, que ya se fue a octubre. */
  t.es("y en septiembre solo lo que de verdad es suyo",
       ingresosDe("2026-09"), 1400);

  t.grupo("y el que cobra el 30 porque el 1 cae en domingo");
  limpio();
  D.addTx({ kind: "in", amount: 1400, categoryId: "nomina", accountId: "banco",
            date: "2026-09-30", note: "Nómina", ciclo: D.cicloQueEmpieza("2026-09-30") });
  t.es("cuenta para octubre igual que el del 25", ingresosDe("2026-10"), 1400);

  t.grupo("a mano, desde el movimiento");
  limpio();
  var a = D.addTx({ kind: "in", amount: 500, categoryId: "nomina",
                    accountId: "banco", date: "2026-09-25", note: "Extra" });
  t.es("nace en el mes de su fecha", ingresosDe("2026-09"), 500);
  D.updateTx(a.id, { ciclo: "2026-10" });
  t.es("se puede mover al siguiente", ingresosDe("2026-10"), 500);
  t.es("y deja de estar en el suyo", ingresosDe("2026-09"), 0);
  D.updateTx(a.id, { ciclo: "" });
  t.es("y se puede devolver a su fecha", ingresosDe("2026-09"), 500);
  t.es("sin dejar el campo puesto", D.state.transactions[0].ciclo, undefined);

  t.grupo("lo que no se guarda porque no dice nada");
  limpio();
  var b = D.addTx({ kind: "in", amount: 100, categoryId: "nomina",
                    accountId: "banco", date: "2026-09-25", note: "Extra",
                    ciclo: "2026-09" });
  t.es("poner el mes que ya toca no escribe nada", b.ciclo, undefined);
  var c = D.addTx({ kind: "in", amount: 100, categoryId: "nomina",
                    accountId: "banco", date: "2026-09-25", note: "Extra",
                    ciclo: "octubre" });
  t.es("y una clave con mala pinta se ignora", c.ciclo, undefined);

  t.grupo("lo ya cobrado no se recoloca solo");
  congelar("2026-09-10T12:00:00");
  limpio();
  var r = D.addRecurring({ kind: "in", note: "Nómina", amount: 1600, day: 25,
                           freq: "mensual", categoryId: "nomina",
                           accountId: "banco", adelantado: true });
  congelar("2026-09-26T12:00:00");
  D.runRecurring();
  D.updateRecurring(r.id, { adelantado: false });
  t.es("quitar la marca no toca el que ya está", ingresosDe("2026-10"), 1600);
  t.es("solo cambia lo que venga después",
       D.state.recurring[0].adelantado, false);

  t.grupo("y si el sueldo se confirma a mano, también");
  congelar("2026-09-10T12:00:00");
  limpio();
  D.addRecurring({ kind: "in", note: "Nómina", amount: 1600, day: 25,
                   freq: "mensual", categoryId: "nomina", accountId: "banco",
                   adelantado: true, confirmar: true });
  congelar("2026-09-26T12:00:00");
  D.runRecurring();
  t.es("se queda esperando a que digas cuánto", D.state.pendientes.length, 1);
  t.es("ya con su mes escrito", D.state.pendientes[0].ciclo, "2026-10");
  D.confirmarPendiente(D.state.pendientes[0].id, 1650);
  t.es("y al confirmarlo se va a octubre con la cifra de verdad",
       ingresosDe("2026-10"), 1650);
  t.es("sin pasar por septiembre", ingresosDe("2026-09"), 0);

  t.grupo("y al confirmarlo se puede decidir ahí mismo");
  congelar("2026-09-10T12:00:00");
  limpio();
  /* un sueldo que NO viene marcado: la pregunta se responde al confirmar */
  D.addRecurring({ kind: "in", note: "Nómina", amount: 1600, day: 25,
                   freq: "mensual", categoryId: "nomina", accountId: "banco",
                   confirmar: true });
  congelar("2026-09-26T12:00:00");
  D.runRecurring();
  t.es("llega sin mes puesto", D.state.pendientes[0].ciclo, undefined);
  D.confirmarPendiente(D.state.pendientes[0].id, 1600, "2026-10");
  t.es("y se le puede dar uno al apuntarlo", ingresosDe("2026-10"), 1600);
  t.es("sin quedarse en el de su fecha", ingresosDe("2026-09"), 0);

  t.grupo("la media de ingresos lo cuenta donde toca");
  limpio();
  /* tres sueldos cobrados el 25, para los tres meses siguientes */
  ["2026-06-25", "2026-07-25", "2026-08-25"].forEach(function (f) {
    D.addTx({ kind: "in", amount: 1500, categoryId: "nomina", accountId: "banco",
              date: f, note: "Nómina", ciclo: D.cicloQueEmpieza(f) });
  });
  congelar("2026-09-10T12:00:00");
  t.es("la media de los tres meses cerrados sale de los tres cobros",
       D.averageIncome(3), 1500);

  congelar("2026-09-10T12:00:00");
};
