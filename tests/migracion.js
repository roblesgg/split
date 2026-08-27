/* ============================================================
   split — la migración, de una pieza

   Esta es la única prueba que no tiene segunda oportunidad: si la
   migración pierde algo, lo pierde en el móvil de alguien que ya tenía
   sus datos dentro, y no hay vuelta atrás.

   Así que no se comprueba paso a paso, sino de punta a punta: un estado
   real de la versión publicada (v11) entra, sale en v14, y se cuenta que
   siga estando todo. Más el camino largo desde v1, que es lo que tiene
   quien no actualiza desde hace un año.
   ============================================================ */

var t = require("./ayuda");

/* El reloj se congela: `createdAt` de un estado nuevo sale de hoy. */
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

/* La migración guarda al terminar; aquí el almacenamiento es un objeto. */
var guardado = {};
global.localStorage = {
  getItem: function (k) { return guardado[k] == null ? null : guardado[k]; },
  setItem: function (k, v) { guardado[k] = String(v); },
  removeItem: function (k) { delete guardado[k]; }
};

var win = t.cargar(
  ["js/core/base.js", "js/core/format.js", "js/core/dates.js", "js/data/ciclo.js",
   "js/data/catalog.js", "js/data/demo.js", "js/data/state.js"],
  { Datos: null });
var D = win.Datos;

/* ============================================================
   Un estado de v11 como el que hay hoy en un móvil de verdad
   ============================================================ */

function estadoV11() {
  return {
    version: 11,
    createdAt: "2025-02-14",
    categories: [
      { id: "comida", name: "Comida", emoji: "🍽️", color: 1, kind: "out" },
      { id: "gasolina", name: "Gasolina", emoji: "⛽", color: 5, kind: "out" },
      { id: "hogar", name: "Hogar", emoji: "🏠", color: 8, kind: "out" },
      { id: "subs", name: "Suscripciones", emoji: "📺", color: 11, kind: "out" },
      { id: "nomina", name: "Sueldo", emoji: "💼", color: 3, kind: "in" },
      /* una categoría propia, de las que se crean desde el selector */
      { id: "perro", name: "El perro", emoji: "🐕", color: 14, kind: "out" }
    ],
    tags: [{ id: "vacaciones", name: "Vacaciones" }],
    income: { mode: "manual", manual: 1740, months: 3 },
    allocation: { comida: 22, gasolina: 8, hogar: 30, subs: 4, perro: 5 },
    accounts: [
      { id: "banco", name: "Cuenta corriente", type: "Banco", slot: 1, color: 1, icon: "wallet", opening: 812.44 },
      { id: "efvo", name: "Efectivo", type: "Efectivo", slot: 4, color: 15, icon: "cash", opening: 45 },
      { id: "ahorro", name: "Hucha", type: "Ahorro", slot: 3, color: 3, icon: "piggy", opening: 2100 }
    ],
    goals: [{ id: "g1", name: "Colchón", target: 6000, saved: 2100, monthly: 150 }],
    recurring: [
      /* mensual con día, el caso normal */
      { id: "r1", kind: "in", amount: 1740, categoryId: "nomina", accountId: "banco",
        toAccountId: null, note: "Sueldo", freq: "mensual", day: 25, pagas: 14,
        weekdays: [0], hora: "09:00", avisar: false, importeAbierto: false,
        tarifa: null, cuotas: null, pagadas: 0, active: true, lastPosted: "2026-09" },
      /* semanal, con su día de la semana y aviso */
      { id: "r2", kind: "in", amount: 0, categoryId: "nomina", accountId: "efvo",
        toAccountId: null, note: "Bar los sábados", freq: "semanal", day: 1, pagas: 12,
        weekdays: [6], hora: "20:30", avisar: true, importeAbierto: true,
        tarifa: 9.5, cuotas: null, pagadas: 0, active: true, lastDate: "2026-09-05" },
      /* un préstamo a plazos, que es lo que estrenó v11 */
      { id: "r3", kind: "out", amount: 148.2, categoryId: "hogar", accountId: "banco",
        toAccountId: null, note: "Préstamo del coche", freq: "mensual", day: 5, pagas: 12,
        weekdays: [0], hora: "09:00", avisar: false, importeAbierto: false,
        tarifa: null, cuotas: 36, pagadas: 11, active: true, lastPosted: "2026-09" },
      /* un traspaso programado, que no tiene categoría de gasto */
      { id: "r4", kind: "transfer", amount: 200, categoryId: "otros", accountId: "banco",
        toAccountId: "ahorro", note: "Ahorro del mes", freq: "mensual", day: 26, pagas: 12,
        weekdays: [0], hora: "09:00", avisar: false, importeAbierto: false,
        tarifa: null, cuotas: null, pagadas: 0, active: false, lastPosted: "2026-08" }
    ],
    transactions: [
      { id: "t1", kind: "out", amount: 42.6, categoryId: "comida", accountId: "banco",
        date: "2026-09-08", time: "13:20", title: "Compra semanal", note: "", tags: [] },
      { id: "t2", kind: "out", amount: 60, categoryId: "gasolina", accountId: "banco",
        date: "2026-09-02", time: "08:05", title: "Repostaje", note: "", tags: ["vacaciones"] },
      { id: "t3", kind: "in", amount: 1740, categoryId: "nomina", accountId: "banco",
        date: "2026-08-25", time: "09:00", title: "Sueldo", note: "", tags: [] },
      { id: "t4", kind: "transfer", amount: 200, accountId: "banco", toAccountId: "ahorro",
        date: "2026-08-26", time: "09:00", title: "Ahorro del mes", note: "", tags: [] },
      { id: "t5", kind: "out", amount: 12.99, categoryId: "subs", accountId: "banco",
        date: "2026-07-08", time: "10:00", title: "Netflix", note: "", tags: [] }
    ],
    pendientes: []
  };
}

module.exports = function () {

  /* ---------- de v11 a hoy, sin perder nada ---------- */

  t.grupo("De la versión publicada a la de hoy");

  var antes = estadoV11();
  var copia = JSON.parse(JSON.stringify(antes));
  var s = D.migrate(JSON.parse(JSON.stringify(antes)));

  t.es("sube a la versión 15", s.version, 15);
  t.es("no se pierde ningún movimiento", s.transactions.length, copia.transactions.length);
  t.es("los movimientos salen tal cual", s.transactions, copia.transactions);
  t.es("no se pierde ninguna cuenta", s.accounts, copia.accounts);
  t.es("no se pierde ninguna categoría, ni la propia", s.categories, copia.categories);
  t.es("las etiquetas siguen ahí", s.tags, copia.tags);
  t.es("las metas siguen ahí", s.goals, copia.goals);
  /* v15: el reparto por porcentajes se convierte en límites con nombre,
     en euros, sobre lo que se contaba al mes en el momento de migrar.
     Con 1.740 € manuales, el 22 % de comida son 382,80 €. */
  t.es("el reparto se convierte en límites, uno por partida",
       s.limites.map(function (l) { return [l.name, l.importe, l.ambito, l.categoryIds]; }),
       [["Comida", 382.8, "solo", ["comida"]],
        ["Gasolina", 139.2, "solo", ["gasolina"]],
        ["Hogar", 522, "solo", ["hogar"]],
        ["Suscripciones", 69.6, "solo", ["subs"]],
        ["El perro", 87, "solo", ["perro"]]]);
  t.es("y el reparto viejo ya no está", s.allocation, undefined);
  t.es("el ingreso que cuenta al mes no se toca", s.income, copia.income);
  t.es("no se pierde ningún programado", s.recurring.length, copia.recurring.length);

  /* Lo que de verdad importa del salto: que actualizar no le cambie a
     nadie una sola cifra. El ciclo nace en día 1, que es el mes natural,
     que es exactamente lo que la app venía haciendo. */
  t.es("el ciclo arranca en el mes natural", s.ciclo, { dia: 1 });
  t.es("no hay ningún apartado inventado", s.apartados, []);

  /* Y que cada programado siga tocando el mismo día. */
  var r1 = s.recurring[0], r2 = s.recurring[1], r3 = s.recurring[2], r4 = s.recurring[3];

  t.es("el sueldo sigue siendo el 25 de cada mes",
       [r1.freq, r1.cada, r1.day], ["mensual", 1, 25]);
  t.es("y conserva sus 14 pagas y lo ya apuntado",
       [r1.pagas, r1.lastPosted, r1.amount], [14, "2026-09", 1740]);
  t.es("el semanal sigue siendo el sábado",
       [r2.freq, r2.cada, r2.weekdays], ["semanal", 1, [6]]);
  t.es("y conserva su aviso, su hora y su tarifa",
       [r2.avisar, r2.hora, r2.importeAbierto, r2.tarifa], [true, "20:30", true, 9.5]);
  t.es("el préstamo conserva las cuotas que lleva pagadas",
       [r3.cuotas, r3.pagadas], [36, 11]);
  t.es("el traspaso sigue apagado y con su cuenta destino",
       [r4.active, r4.toAccountId], [false, "ahorro"]);

  /* El ancla es desde donde se cuenta un «cada N». Nadie tiene ninguno
     todavía, pero si mañana lo pone, tiene que contarse desde lo último
     apuntado y no desde el día en que actualizó la app. */
  t.es("el ancla del semanal es su último apuntado", r2.ancla, "2026-09-05");
  t.es("el ancla del que nunca se apuntó cae en la creación",
       s.recurring[0].ancla, copia.createdAt);

  /* ---------- pasar dos veces no rompe nada ---------- */

  t.grupo("Volver a migrar lo ya migrado");

  var otraVez = D.migrate(JSON.parse(JSON.stringify(s)));
  t.es("el estado sale idéntico", otraVez, s);

  /* Abrir la app veinte veces migra veinte veces: la garantía es que la
     segunda no tenga efecto ninguno. */
  var tres = D.migrate(D.migrate(JSON.parse(JSON.stringify(s))));
  t.es("y a la tercera, también", tres, s);

  /* ---------- el camino largo, desde el principio ---------- */

  t.grupo("Desde la primera versión de todas");

  /* v1 no conocía los ingresos y presupuestaba en euros. Lo suyo es que
     esas cifras se traduzcan a porcentajes en vez de perderse. */
  var v1 = {
    createdAt: "2024-06-01",
    income: { nomina: 1200, pagas: 14, extra: 0 },
    budgets: { comida: 300, hogar: 450 },
    accounts: [{ id: "banco", name: "Banco", opening: 500 }],
    categories: undefined,
    transactions: [
      { id: "x1", kind: "out", amount: 20, categoryId: "comida",
        accountId: "banco", date: "2024-06-04" }
    ],
    recurring: [{ id: "y1", kind: "out", amount: 30, categoryId: "hogar",
                  accountId: "banco", note: "Luz", day: 9, active: true }]
  };
  var viejo = D.migrate(JSON.parse(JSON.stringify(v1)));

  t.es("llega hasta la 15", viejo.version, 15);
  t.es("el movimiento de hace dos años sigue ahí", viejo.transactions.length, 1);
  /* El presupuesto en euros de la v1 pasó a porcentaje en la v2 y vuelve
     a euros en la v15, ya como límites con nombre. Un viaje de ida y
     vuelta con un redondeo por medio, así que no salen los 300 y 450
     clavados: salen los que la app llevaba años enseñando. */
  t.es("las dos partidas que había puestas acaban siendo límites",
       viejo.limites.filter(function (l) {
         return l.name === "Comida" || l.name === "Hogar";
       }).map(function (l) { return [l.name, l.importe, l.categoryIds]; }),
       [["Hogar", 448, ["hogar"]], ["Comida", 294, ["comida"]]]);
  /* La v1 rellenaba con el reparto de fábrica lo que no tuvieras puesto,
     y eso sigue igual: se convierte también, no se pierde. */
  t.es("y las de fábrica que rellenó la v2, también", viejo.limites.length, 10);
  t.es("y ya no queda rastro de los dos formatos viejos",
       [viejo.budgets, viejo.allocation], [undefined, undefined]);
  t.es("las categorías, que no tenía, vienen de fábrica",
       viejo.categories.length > 0, true);
  t.es("el programado de v1 sale con las tres reglas de hoy",
       [viejo.recurring[0].freq, viejo.recurring[0].cada,
        Array.isArray(viejo.recurring[0].weekdays)], ["mensual", 1, true]);
  t.es("el ciclo también le nace en el mes natural", viejo.ciclo, { dia: 1 });

  /* ---------- un estado roto no tiene que reventar ---------- */

  t.grupo("Un estado a medias");

  /* Un export editado a mano, o un guardado que se cortó. La migración es
     la última línea antes de que la app pinte: si revienta aquí, la app
     no abre. */
  var roto = D.migrate({ version: 13, transactions: [], accounts: [] });
  t.es("se le ponen las categorías de fábrica", roto.categories.length > 0, true);
  t.es("se le pone un ciclo", roto.ciclo, { dia: 1 });
  t.es("y una lista de apartados vacía", roto.apartados, []);
  t.es("sin lista de programados, no falla", D.migrate({ version: 11 }).version, 15);

  /* ---------- y lo que carga la app de verdad ---------- */

  t.grupo("El camino completo, por localStorage");

  /* Hasta aquí se ha llamado a migrate() a mano. Esto es lo que ocurre de
     verdad al abrir la app: leer, migrar y volver a guardar. */
  guardado[D.KEY] = JSON.stringify(estadoV11());
  var cargado = D.load();

  t.es("carga y migra lo que había guardado", cargado.version, 15);
  t.es("con todos sus movimientos", cargado.transactions.length, 5);
  t.es("y deja guardado ya el formato nuevo",
       JSON.parse(guardado[D.KEY]).version, 15);
  t.es("de forma que la siguiente vez no cambia nada",
       JSON.parse(guardado[D.KEY]), cargado);
};
