/* ============================================================
   split — el reparto en euros

   El reparto se guarda en porcentaje, para que se ajuste solo cuando
   cambia lo que entra. Pero lo que se escribe son euros, y ahí está la
   trampa: si el porcentaje se redondea al guardarlo, los euros que
   vuelven no son los que escribiste, y basta con repintar la lista para
   que las cifras se muevan solas.

   Esta prueba existe por eso: para que 200 sigan siendo 200.
   ============================================================ */

var t = require("./ayuda");

var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
             "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
var CORTOS = ["ene", "feb", "mar", "abr", "may", "jun",
              "jul", "ago", "sep", "oct", "nov", "dic"];

var REAL = Date;
(function congelar(iso) {
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
})("2026-09-10T12:00:00");

var win = t.cargar(
  ["js/core/dates.js", "js/core/format.js", "js/data/ciclo.js", "js/data/catalog.js",
   "js/data/accounts.js", "js/data/apartados.js", "js/data/limites.js",
   "js/data/tx.js", "js/data/select.js", "js/data/recurring.js",
   "js/data/pendientes.js", "js/data/budget.js"],
  { Datos: { MONTHS: MESES, MONTHS_SHORT: CORTOS, state: null, save: function () {} } });
var D = win.Datos;

/* Una cifra fea a propósito: 2.178 € al mes. Con una redonda el
   redondeo no se nota, que es justo lo que dejó pasar el fallo. */
function limpio() {
  D.state = {
    ciclo: { dia: 1 },
    categories: D.DEFAULT_CATEGORIES.slice(),
    accounts: [{ id: "cartera", name: "Cartera", opening: 0 }],
    apartados: [], limites: [], recurring: [], pendientes: [],
    transactions: [],
    income: { mode: "manual", manual: 2178, months: 3 },
    allocation: {}
  };
}

module.exports = function () {

  t.grupo("Los euros que escribes son los que quedan");

  limpio();
  t.es("lo que se reparte", D.plannedIncome(), 2178);

  D.setAllocationEuros("gasolina", 200);
  t.es("200 € siguen siendo 200 €", D.budgetFor("gasolina"), 200);
  t.es("y el porcentaje que se enseña es el redondo",
       D.allocationPct("gasolina"), 9);

  D.setAllocationEuros("subs", 22);
  t.es("22 € siguen siendo 22 €", D.budgetFor("subs"), 22);
  t.es("con su 1 %", D.allocationPct("subs"), 1);

  /* Esto es lo que se veía en pantalla: quitar una partida repinta la
     lista, y las demás volvían de su porcentaje redondeado. */
  t.grupo("Quitar una partida no toca las demás");

  D.setAllocationEuros("comida", 350);
  var antes = ["gasolina", "subs", "comida"].map(D.budgetFor);
  t.es("las tres, tal cual", antes, [200, 22, 350]);

  D.removeAllocation("comida");
  t.es("se va la que se quita",
       Object.keys(D.state.allocation).sort(), ["gasolina", "subs"]);
  t.es("y las otras dos no se mueven ni un euro",
       [D.budgetFor("gasolina"), D.budgetFor("subs")], [200, 22]);
  t.es("ni su porcentaje",
       [D.allocationPct("gasolina"), D.allocationPct("subs")], [9, 1]);

  /* Ni volver a escribir la misma cifra, ni escribirla veinte veces. */
  t.grupo("Escribir y reescribir");

  limpio();
  D.setAllocationEuros("comida", 333);
  for (var i = 0; i < 20; i++) D.setAllocationEuros("comida", D.budgetFor("comida"));
  t.es("veinte idas y venidas y sigue siendo 333", D.budgetFor("comida"), 333);

  /* Con céntimos también: 12,50 € no son 13. */
  limpio();
  D.setAllocationEuros("subs", 12.5);
  t.es("los céntimos no se pierden", D.budgetFor("subs"), 12.5);

  /* ---------- lo que no cambia ---------- */

  t.grupo("Lo que sigue igual");

  /* El porcentaje sigue mandando cuando cambia lo que entra: es para lo
     que se guarda así, y no se ha tocado. */
  limpio();
  D.setAllocationEuros("comida", 200);
  D.setIncome({ manual: 4356 });          /* el doble */
  t.es("si cobras el doble, el presupuesto sube solo",
       D.budgetFor("comida"), 400);
  t.es("y el porcentaje es el mismo", D.allocationPct("comida"), 9);

  /* Elegir el porcentaje a mano sí es un número redondo. */
  limpio();
  D.setAllocation("ocio", 12.6);
  t.es("a mano se guarda redondo", D.state.allocation.ocio, 13);

  /* Y las cuentas de arriba: lo repartido y lo que queda para ahorro. */
  limpio();
  D.setAllocationEuros("gasolina", 200);
  D.setAllocationEuros("subs", 22);
  t.es("lo repartido, redondeado para pintarlo", D.allocationSumPct(), 10);
  t.es("y lo que queda para ahorro", D.savingsPctRedondo(), 90);
  t.es("los dos suman 100, siempre",
       D.allocationSumPct() + D.savingsPctRedondo(), 100);

  /* Sin saber lo que entra no se puede pasar de euros a porcentaje. */
  limpio();
  D.state.income = { mode: "manual", manual: 0, months: 3 };
  t.es("sin ingreso, no se guarda nada y lo dice",
       D.setAllocationEuros("comida", 100), false);
};
