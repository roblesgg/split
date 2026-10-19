/* ============================================================
   split — que no se pierda nada

   Los datos de Álvaro viven en un solo sitio y no hay otra copia. Esta
   prueba comprueba lo único que importa de eso: que nada de lo que
   sustituye el estado entero —importar, vaciar, cargar el ejemplo— lo hace
   sin dejar antes una copia a la que volver, y que un guardado que no se
   puede leer se aparta en vez de machacarse.

   Y de paso, que la comparación de «este mes» del Resumen compara el mismo
   tramo del mes anterior y no el mes entero.
   ============================================================ */

var t = require("./ayuda");

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
})("2026-09-18T12:00:00");

/* Un almacenamiento de mentira que se puede llenar, entero o clave a clave. */
var guardado = {};
var llenas = {};
global.localStorage = {
  getItem: function (k) { return guardado[k] == null ? null : guardado[k]; },
  setItem: function (k, v) {
    if (llenas["*"] || llenas[k]) throw new Error("QuotaExceededError");
    guardado[k] = String(v);
  },
  removeItem: function (k) { delete guardado[k]; }
};

var win = t.cargar(
  ["js/core/base.js", "js/core/format.js", "js/core/dates.js", "js/data/ciclo.js",
   "js/data/catalog.js", "js/data/demo.js", "js/data/state.js", "js/data/tx.js",
   "js/data/accounts.js", "js/data/categories.js", "js/data/tags.js",
   "js/data/goals.js", "js/data/recurring.js", "js/data/pendientes.js",
   "js/data/budget.js", "js/data/apartados.js", "js/data/objetivo.js",
   "js/data/limites.js", "js/data/paneles.js", "js/data/select.js",
   "js/data/prefs.js"],
  { Datos: null });
var D = win.Datos;
var KEY = D.KEY;

function almacenLimpio() {
  guardado = {};
  llenas = {};
}

/* Un estado de verdad, con n movimientos. */
function conMovimientos(n) {
  var s = D.freshState();
  s.transactions = [];
  for (var i = 1; i <= n; i++) {
    s.transactions.push({ id: "m" + i, kind: "out", amount: i, categoryId: "comida",
                          accountId: s.accounts[0].id, date: "2026-09-0" + Math.min(i, 9) });
  }
  return s;
}

function cuenta() { return D.state.transactions.length; }

function lanza(f) {
  try { f(); } catch (e) { return e.message; }
  return null;
}

module.exports = function () {

  /* ============================================================
     Importar
     ============================================================ */

  t.grupo("Importar: primero se mira, sin tocar nada");
  almacenLimpio();
  D.state = conMovimientos(3);
  D.save();
  var antesTexto = guardado[KEY];

  var traen = D.inspeccionarJson(JSON.stringify(conMovimientos(5)));
  t.es("dice cuántos movimientos trae el archivo", traen.movimientos, 5);
  t.es("y cuántas cuentas", traen.cuentas, D.freshState().accounts.length);

  t.es("un texto que no es JSON se rechaza con un mensaje que se puede leer",
       lanza(function () { D.inspeccionarJson("esto no es json"); }),
       "Ese archivo no es una copia de split.");
  t.es("un JSON que no es de split también",
       lanza(function () { D.inspeccionarJson('{"hola": 1}'); }),
       "Ese archivo no tiene el formato de split.");
  t.es("y uno de una versión más nueva que la app",
       lanza(function () { D.inspeccionarJson('{"version": 999, "transactions": []}'); }),
       "Ese archivo es de una versión más nueva de split. Actualiza la app primero.");
  t.es("mirar no cambia lo que tienes", cuenta(), 3);
  t.es("ni lo guardado", guardado[KEY], antesTexto);
  t.es("ni deja ninguna copia", D.hayCopiaAntes(), false);

  /* Lo primero que tiene que valer: lo que exporta la propia app. Esto no
     lo cubría ninguna prueba y la comprobación de versión rechazaba justo
     eso, porque comparaba con un estado en blanco que se queda un escalón
     por debajo del que se guarda de verdad. */
  t.grupo("Importar: lo que exporta la propia app se acepta");
  almacenLimpio();
  D.state = D.migrate(conMovimientos(3));
  D.save();
  t.es("el estado en uso va por delante del de «en blanco» (si no, esta prueba no prueba nada)",
       D.state.version > D.freshState().version, true);
  var exportado = D.exportJson();
  t.es("se acepta su propio archivo", D.inspeccionarJson(exportado).movimientos, 3);
  D.importJson(exportado);
  t.es("y se puede importar de verdad", cuenta(), 3);
  t.es("un archivo UN escalón más nuevo que la app sí se rechaza",
       lanza(function () { D.inspeccionarJson(JSON.stringify({ version: D.state.version + 1, transactions: [] })); }),
       "Ese archivo es de una versión más nueva de split. Actualiza la app primero.");

  almacenLimpio();
  D.state = conMovimientos(3);
  D.save();
  t.grupo("Importar: aparta lo de antes y se puede volver, y volver otra vez");
  D.importJson(JSON.stringify(conMovimientos(5)));
  t.es("lo importado sustituye", cuenta(), 5);
  t.es("y queda guardado", JSON.parse(guardado[KEY]).transactions.length, 5);
  t.es("lo de antes se ha apartado", D.hayCopiaAntes(), true);

  D.restaurarCopiaAntes();
  t.es("volver trae los 3 movimientos de antes", cuenta(), 3);
  t.es("y los deja guardados", JSON.parse(guardado[KEY]).transactions.length, 3);
  t.es("lo importado queda como copia: se puede ir y volver", D.hayCopiaAntes(), true);

  D.restaurarCopiaAntes();
  t.es("y se vuelve a lo importado sin haber perdido nada", cuenta(), 5);

  t.grupo("Importar: un archivo malo no toca ni una cosa");
  almacenLimpio();
  D.state = conMovimientos(3);
  D.save();
  t.es("se rechaza",
       lanza(function () { D.importJson("{{{"); }),
       "Ese archivo no es una copia de split.");
  t.es("sigues con lo tuyo", cuenta(), 3);
  t.es("y no se ha creado ninguna copia", D.hayCopiaAntes(), false);

  t.grupo("Importar: sin sitio para la copia, no importa nada");
  almacenLimpio();
  D.state = conMovimientos(3);
  D.save();
  llenas[KEY + ".antes"] = true;
  t.es("avisa de que no ha hecho nada",
       lanza(function () { D.importJson(JSON.stringify(conMovimientos(5))); }),
       "No hay sitio para guardar una copia de lo que tienes. No he importado nada.");
  t.es("sigues con los 3 de antes", cuenta(), 3);

  t.grupo("Importar: si lo nuevo no se puede guardar, te quedas con lo de antes");
  almacenLimpio();
  D.state = conMovimientos(3);
  D.save();
  llenas[KEY] = true;
  t.es("avisa",
       lanza(function () { D.importJson(JSON.stringify(conMovimientos(5))); }),
       "No he podido guardar lo importado. Sigues con lo de antes.");
  t.es("en memoria sigues con los 3", cuenta(), 3);
  llenas = {};
  t.es("y lo que había guardado no se ha movido", JSON.parse(guardado[KEY]).transactions.length, 3);

  /* ============================================================
     Vaciar y datos de ejemplo
     ============================================================ */

  t.grupo("Vaciar: se puede deshacer");
  almacenLimpio();
  D.state = conMovimientos(4);
  D.save();
  D.clearAll();
  t.es("queda vacío", cuenta(), 0);
  t.es("hay copia", D.hayCopiaAntes(), true);
  D.restaurarCopiaAntes();
  t.es("y se recuperan los 4", cuenta(), 4);

  t.grupo("Vaciar dos veces seguidas no pierde la copia buena");
  almacenLimpio();
  D.state = conMovimientos(4);
  D.save();
  D.clearAll();
  D.clearAll();
  D.restaurarCopiaAntes();
  t.es("sigue habiendo 4 a los que volver, no un estado vacío", cuenta(), 4);

  t.grupo("Datos de ejemplo: lo tuyo se aparta");
  almacenLimpio();
  D.state = conMovimientos(2);
  D.save();
  D.reset();
  t.es("entra el ejemplo (que trae muchos movimientos)", cuenta() > 2, true);
  D.restaurarCopiaAntes();
  t.es("y se vuelve a los 2 tuyos", cuenta(), 2);

  t.grupo("Sin sitio para la copia, vaciar no hace nada");
  almacenLimpio();
  D.state = conMovimientos(4);
  D.save();
  llenas[KEY + ".antes"] = true;
  t.es("devuelve null en vez de vaciar", D.clearAll(), null);
  t.es("sigues con los 4", cuenta(), 4);
  t.es("y con el ejemplo, igual", D.reset(), null);
  t.es("sin tocar nada", cuenta(), 4);

  /* ============================================================
     Un guardado que no se puede leer
     ============================================================ */

  t.grupo("Un guardado ilegible se aparta, no se machaca");
  almacenLimpio();
  var roto = '{"transactions": [{"id": "m1", "amount": 12';   /* cortado a medias */
  guardado[KEY] = roto;
  D.load();
  t.es("la app arranca en blanco", cuenta(), 0);
  t.es("pero lo que había se ha apartado", D.hayRescate(), true);
  t.es("tal cual, sin tocar", D.rescateJson(), roto);
  t.es("y el guardado normal vuelve a ser válido",
       Array.isArray(JSON.parse(guardado[KEY]).transactions), true);

  t.grupo("La segunda vez no pisa el rescate");
  guardado[KEY] = "otra cosa rota";
  D.load();
  t.es("se queda con el primero, que es el que tenía los datos", D.rescateJson(), roto);

  t.grupo("Lo guardado con otra forma también se aparta");
  almacenLimpio();
  var raro = '{"hola": 1}';
  guardado[KEY] = raro;
  D.load();
  t.es("se aparta", D.rescateJson(), raro);

  t.grupo("Un arranque normal no inventa rescates");
  almacenLimpio();
  D.state = conMovimientos(3);
  D.save();
  D.load();
  t.es("se carga lo guardado", cuenta(), 3);
  t.es("sin rescate", D.hayRescate(), false);
  almacenLimpio();
  D.load();
  t.es("y la primera vez de todas tampoco", D.hayRescate(), false);

  /* ============================================================
     La comparación del Resumen
     ============================================================ */

  function mov(id, kind, amount, date, extra) {
    return Object.assign({ id: id, kind: kind, amount: amount, date: date,
                           categoryId: kind === "in" ? "nomina" : "comida",
                           accountId: "banco" }, extra || {});
  }

  function mes() {
    almacenLimpio();
    var s = D.freshState();
    s.accounts = [{ id: "banco", name: "Banco", opening: 0 }];
    s.transactions = [
      /* agosto: lo que cae hasta el día 18 y lo que cae después */
      mov("a1", "in", 2000, "2026-08-01"),
      mov("a2", "out", 100, "2026-08-05"),
      mov("a3", "out", 200, "2026-08-10"),
      mov("a4", "out", 300, "2026-08-25"),                 /* después del 18: fuera */
      mov("a5", "in", 50, "2026-08-20"),                   /* después del 18: fuera */
      /* septiembre, hasta hoy (día 18) */
      mov("s1", "in", 2000, "2026-09-01"),
      mov("s2", "out", 150, "2026-09-05")
    ];
    D.state = s;
    return s;
  }

  t.grupo("«Este mes» se compara con el mes anterior hasta el mismo día");
  mes();
  var ahora = D.totalesResumen();
  var antes = D.totalesResumenAnterior();
  t.es("lo de este mes", [ahora.income, ahora.expense], [2000, 150]);
  t.es("agosto hasta el 18: el sueldo y los dos gastos, no lo del 20 ni el 25",
       [antes.income, antes.expense, antes.net], [2000, 300, 1700]);
  t.es("el gasto baja un 50 % frente a 300, no un 75 % frente a los 600 del mes entero",
       Math.round((ahora.expense - antes.expense) / antes.expense * 100), -50);

  t.grupo("Y de una cuenta, solo lo de esa cuenta");
  mes();
  D.state.accounts.push({ id: "efvo", name: "Efectivo", opening: 0 });
  D.state.transactions.push(mov("e1", "out", 40, "2026-08-03", { accountId: "efvo" }));
  t.es("agosto hasta el 18 solo de efectivo", D.totalesResumenAnterior("efvo").expense, 40);
  t.es("y la del banco no la cuenta", D.totalesResumenAnterior("banco").expense, 300);

  t.grupo("Cuando no hay con qué comparar con justicia, no compara");
  mes();
  D.state.resumen = { periodo: "ano" };
  t.es("con «este año» no hay comparación", D.totalesResumenAnterior(), null);

  mes();
  /* Ya cobrado el sueldo de octubre: el mes en el que estás es octubre, que
     todavía no ha empezado. Compararlo con septiembre entero sería injusto. */
  D.state.transactions.push(mov("o1", "in", 2000, "2026-09-10", { ciclo: "2026-10" }));
  t.es("el mes que estás mirando es octubre", D.cicloEnCurso(), "2026-10");
  t.es("y como no ha empezado, no compara", D.totalesResumenAnterior(), null);
};
