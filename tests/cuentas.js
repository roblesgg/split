/* ============================================================
   split — borrar una cuenta

   Borrar una cuenta se lleva por delante todo lo suyo, así que lo que
   hay que asegurar es exactamente eso: que se lleva TODO lo suyo —nada
   huérfano que siga contando sin poder verse— y que no toca ni un dato
   de las demás.
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
  ["js/core/dates.js", "js/data/ciclo.js", "js/data/catalog.js",
   "js/data/accounts.js", "js/data/apartados.js", "js/data/paneles.js",
   "js/data/objetivo.js",
   "js/data/tx.js", "js/data/select.js"],
  { Datos: { MONTHS: MESES, MONTHS_SHORT: CORTOS, state: null, save: function () {} } });
var D = win.Datos;

/* Tres cuentas con cosas colgando de dos de ellas. La tercera es el
   testigo: nada de lo que se haga con las otras puede tocarla. */
function limpio() {
  D.state = {
    ciclo: { dia: 1 },
    categories: D.DEFAULT_CATEGORIES.slice(),
    accounts: [
      { id: "banco", name: "Cuenta corriente", opening: 1000 },
      { id: "efvo", name: "Efectivo", opening: 50 },
      { id: "ahorro", name: "Hucha", opening: 3000 }
    ],
    apartados: [
      { id: "ap-gas", name: "Gasolina", accountId: "efvo", porCiclo: 100,
        categoryIds: ["gasolina"], aportes: [{ ciclo: "2026-09", importe: 100 }] },
      { id: "ap-reg", name: "Regalos", accountId: "efvo", porCiclo: 30,
        categoryIds: [], aportes: [{ ciclo: "2026-09", importe: 30 }] },
      { id: "ap-via", name: "Viaje", accountId: "banco", porCiclo: 50,
        categoryIds: [], aportes: [{ ciclo: "2026-09", importe: 50 }] }
    ],
    transactions: [
      { id: "t1", kind: "out", amount: 20, categoryId: "comida",
        accountId: "efvo", date: "2026-09-03" },
      { id: "t2", kind: "out", amount: 40, categoryId: "gasolina",
        accountId: "efvo", date: "2026-09-04", apartadoId: "ap-gas" },
      { id: "t3", kind: "in", amount: 1500, categoryId: "nomina",
        accountId: "banco", date: "2026-09-01" },
      /* el traspaso: toca las dos, y al borrar una cambia el saldo de la otra */
      { id: "t4", kind: "transfer", amount: 100, accountId: "banco",
        toAccountId: "efvo", date: "2026-09-05" },
      { id: "t5", kind: "out", amount: 10, categoryId: "ocio",
        accountId: "ahorro", date: "2026-09-06" }
    ],
    recurring: [
      { id: "r1", kind: "out", amount: 30, accountId: "efvo", freq: "mensual",
        day: 10, active: true },
      { id: "r2", kind: "transfer", amount: 200, accountId: "banco",
        toAccountId: "efvo", freq: "mensual", day: 30, active: true },
      { id: "r3", kind: "in", amount: 900, accountId: "ahorro", freq: "mensual",
        day: 1, active: true }
    ],
    pendientes: [
      { id: "p1", kind: "in", amount: 0, accountId: "efvo", date: "2026-09-09" },
      { id: "p2", kind: "in", amount: 0, accountId: "ahorro", date: "2026-09-09" }
    ]
  };
}

module.exports = function () {

  /* ---------- lo que cuelga de una cuenta ---------- */

  t.grupo("Qué tiene dentro una cuenta");

  limpio();
  var uso = D.accountUsage("efvo");

  t.es("cuenta los movimientos, traspaso incluido", uso.transactions, 3);
  t.es("y los programados, el traspaso también", uso.recurring, 2);
  t.es("y los apartados que viven en ella", uso.apartados, 2);
  t.es("y lo que está esperando confirmación", uso.pendientes, 1);
  t.es("los traspasos se cuentan aparte, que tocan otra cuenta", uso.traspasos, 1);
  t.es("el total es la suma de las cuatro listas", uso.total, 3 + 2 + 2 + 1);

  t.es("una cuenta vacía no tiene nada que perder",
       (function () {
         D.state.accounts.push({ id: "nueva", name: "Nueva", opening: 0 });
         return D.accountUsage("nueva").total;
       })(), 0);

  /* ---------- no borra sin preguntar ---------- */

  t.grupo("Antes de borrar, pregunta");

  limpio();
  var res = D.deleteAccount("efvo");

  t.es("no la borra a la primera", res.ok, false);
  t.es("dice que hay que confirmar", res.confirmar, true);
  t.es("y devuelve las cifras para poder preguntar con ellas",
       [res.use.transactions, res.use.recurring, res.use.apartados, res.use.pendientes],
       [3, 2, 2, 1]);
  t.es("y no ha tocado nada",
       [D.state.accounts.length, D.state.transactions.length,
        D.state.recurring.length, D.state.apartados.length],
       [3, 5, 3, 3]);

  /* Una cuenta vacía no pregunta: no hay nada que perder. */
  limpio();
  D.state.accounts.push({ id: "nueva", name: "Nueva", opening: 0 });
  t.es("una cuenta vacía se borra sin preguntar",
       D.deleteAccount("nueva").ok, true);

  /* ---------- y al confirmar, se lo lleva todo ---------- */

  t.grupo("Al confirmar, se va todo lo suyo");

  limpio();
  var hecho = D.deleteAccount("efvo", { conTodo: true });

  t.es("la borra", hecho.ok, true);
  t.es("la cuenta ya no está",
       D.state.accounts.map(function (a) { return a.id; }), ["banco", "ahorro"]);
  t.es("sus movimientos tampoco",
       D.state.transactions.map(function (x) { return x.id; }), ["t3", "t5"]);
  t.es("ni sus programados",
       D.state.recurring.map(function (x) { return x.id; }), ["r3"]);
  t.es("ni sus apartados",
       D.state.apartados.map(function (x) { return x.id; }), ["ap-via"]);
  t.es("ni lo que esperaba confirmación",
       D.state.pendientes.map(function (x) { return x.id; }), ["p2"]);

  /* Lo importante de verdad: nada huérfano. Un movimiento de una cuenta
     que ya no existe seguiría contando en los totales sin salir en
     ninguna pantalla, que es peor que haberlo borrado. */
  var vivas = D.state.accounts.map(function (a) { return a.id; });
  var huerfanos = D.state.transactions.concat(D.state.recurring, D.state.pendientes)
    .filter(function (x) {
      return vivas.indexOf(x.accountId) < 0 ||
             (x.toAccountId && vivas.indexOf(x.toAccountId) < 0);
    });
  t.es("no queda nada apuntado a una cuenta que ya no existe", huerfanos, []);
  t.es("ni un apartado colgando de la nada",
       D.state.apartados.filter(function (ap) {
         return vivas.indexOf(ap.accountId) < 0;
       }), []);

  /* ---------- las demás cuentas, intactas ---------- */

  t.grupo("Las demás cuentas no se enteran");

  limpio();
  D.deleteAccount("efvo", { conTodo: true });

  t.es("la hucha conserva su movimiento, su programado y su pendiente",
       [D.state.transactions.filter(function (x) { return x.accountId === "ahorro"; }).length,
        D.state.recurring.filter(function (x) { return x.accountId === "ahorro"; }).length,
        D.state.pendientes.filter(function (x) { return x.accountId === "ahorro"; }).length],
       [1, 1, 1]);
  t.es("y su saldo es exactamente el de antes",
       D.accountBalance("ahorro"), 3000 - 10);

  /* El traspaso sí cambia el saldo de la otra: 1000 + 1500 − 100 antes,
     1000 + 1500 después, porque el traspaso se ha ido con la cuenta. Por
     eso el aviso lo dice. */
  t.es("la cuenta del traspaso sube lo que el traspaso le quitaba",
       D.accountBalance("banco"), 2500);

  /* ---------- la última no se borra ---------- */

  t.grupo("La última cuenta");

  limpio();
  D.deleteAccount("efvo", { conTodo: true });
  D.deleteAccount("ahorro", { conTodo: true });
  var ultima = D.deleteAccount("banco", { conTodo: true });

  t.es("no se borra ni confirmando", ultima.ok, false);
  t.es("y lo dice", ultima.ultima, true);
  t.es("queda una cuenta en pie", D.state.accounts.length, 1);
};
