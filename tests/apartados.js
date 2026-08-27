/* ============================================================
   split — apartados

   Lo que hay que asegurar: que el saldo sale de restar y nunca se
   descuadra, que el relleno de cada ciclo acumula y no duplica, que un
   gasto de la categoría atada se descuenta solo, y sobre todo que ese
   gasto NO vuelve a contar en el objetivo de la cuenta.
   ============================================================ */

var t = require("./ayuda");

var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
             "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
var CORTOS = ["ene", "feb", "mar", "abr", "may", "jun",
              "jul", "ago", "sep", "oct", "nov", "dic"];

/* El reloj de la app se congela: los ciclos dependen de hoy. */
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
   "js/data/objetivo.js", "js/data/tx.js"],
  { Datos: { MONTHS: MESES, MONTHS_SHORT: CORTOS, state: null, save: function () {} } });
var D = win.Datos;

function limpio() {
  D.state = {
    ciclo: { dia: 1 },
    categories: D.DEFAULT_CATEGORIES.slice(),
    accounts: [{ id: "cartera", name: "Cartera", opening: 1000, limite: 500 }],
    apartados: [],
    transactions: [],
    goals: [],
    recurring: [],
    tags: []
  };
}

function gasto(importe, cat, fecha, extra) {
  var t2 = { kind: "out", amount: importe, categoryId: cat,
             accountId: "cartera", date: fecha };
  if (extra) Object.keys(extra).forEach(function (k) { t2[k] = extra[k]; });
  return D.addTx(t2);
}

module.exports = function () {

  t.grupo("crear un apartado");
  limpio();
  var ap = D.addApartado({ name: "Gasolina", accountId: "cartera",
                           porCiclo: 200, categoryIds: ["gasolina"], emoji: "⛽" });
  t.es("nace con lo del ciclo dentro", D.estadoDeApartado(ap.id).metido, 200);
  t.es("sin gastar nada todavía", D.estadoDeApartado(ap.id).gastado, 0);
  t.es("así que el saldo es lo apartado", D.estadoDeApartado(ap.id).saldo, 200);
  t.es("y queda el 100 %", D.estadoDeApartado(ap.id).pctQueda, 100);

  t.grupo("un gasto de su categoría se descuenta solo");
  var g = gasto(30, "gasolina", "2026-09-05");
  t.es("el movimiento sale marcado", g.apartadoId, ap.id);
  t.es("y baja el saldo del sobre", D.estadoDeApartado(ap.id).saldo, 170);
  t.es("queda el 85 %", D.estadoDeApartado(ap.id).pctQueda, 85);

  t.grupo("y NO cuenta en el objetivo de la cuenta");
  t.es("el objetivo sigue a cero gastado", D.estadoDeObjetivo("cartera").gastado, 0);
  gasto(40, "comida", "2026-09-06");
  t.es("un gasto normal sí cuenta", D.estadoDeObjetivo("cartera").gastado, 40);
  t.es("y el del sobre sigue sin contar", D.estadoDeObjetivo("cartera").gastado, 40);

  t.grupo("lo reservado sale del disponible de la cuenta");
  t.es("quedan 170 apartados", D.reservadoDe("cartera"), 170);

  t.grupo("apartar más y devolver");
  D.aportar(ap.id, 50);
  t.es("apartar sube el saldo", D.estadoDeApartado(ap.id).saldo, 220);
  D.aportar(ap.id, -70);
  t.es("un negativo lo devuelve a la cuenta", D.estadoDeApartado(ap.id).saldo, 150);
  t.es("y lo reservado baja con él", D.reservadoDe("cartera"), 150);

  t.grupo("pasarse del sobre");
  gasto(200, "gasolina", "2026-09-07");
  var e = D.estadoDeApartado(ap.id);
  t.es("el saldo se va a negativo", e.saldo, -50);
  t.es("y lo dice", e.nivel, "pasado");
  t.es("la barra no se sale", e.pct, 100);
  t.es("un sobre en negativo ya no reserva nada", D.reservadoDe("cartera"), 0);
  t.es("pero sigue sin tocar el objetivo de la cuenta",
       D.estadoDeObjetivo("cartera").gastado, 40);

  t.grupo("el saldo se calcula, así que borrar un gasto lo devuelve");
  limpio();
  ap = D.addApartado({ name: "Gasolina", accountId: "cartera",
                       porCiclo: 200, categoryIds: ["gasolina"] });
  var g1 = gasto(60, "gasolina", "2026-09-05");
  t.es("baja al gastar", D.estadoDeApartado(ap.id).saldo, 140);
  D.deleteTx(g1.id);
  t.es("y vuelve al borrar, sin tener que arreglar nada",
       D.estadoDeApartado(ap.id).saldo, 200);

  t.grupo("cambiar la categoría de un gasto lo saca o lo mete");
  var g2 = gasto(25, "comida", "2026-09-05");
  t.es("una comida no va al sobre", g2.apartadoId, undefined);
  D.updateTx(g2.id, { categoryId: "gasolina" });
  t.es("cambiada a gasolina, sí", D.state.transactions[0].apartadoId, ap.id);
  t.es("y el sobre lo nota", D.estadoDeApartado(ap.id).saldo, 175);
  D.updateTx(g2.id, { categoryId: "comida" });
  t.es("y al revés lo suelta", D.state.transactions[0].apartadoId, undefined);
  t.es("con el sobre otra vez entero", D.estadoDeApartado(ap.id).saldo, 200);

  t.grupo("se puede decir que no a mano");
  var g3 = gasto(10, "gasolina", "2026-09-05", { apartadoId: "" });
  t.es("un gasto de gasolina fuera del sobre", g3.apartadoId, undefined);
  t.es("el sobre no se entera", D.estadoDeApartado(ap.id).saldo, 200);
  t.es("y el objetivo de la cuenta sí", D.estadoDeObjetivo("cartera").gastado, 35);

  t.grupo("el relleno de cada ciclo acumula");
  limpio();
  ap = D.addApartado({ name: "Gasolina", accountId: "cartera", porCiclo: 200,
                       categoryIds: ["gasolina"] });
  gasto(160, "gasolina", "2026-09-05");
  t.es("este ciclo: apartas 200, gastas 160", D.estadoDeApartado(ap.id).saldo, 40);
  t.es("rellenar ahora no hace nada: ya está el de este ciclo",
       D.rellenarApartados(), 0);
  congelar("2026-10-10T12:00:00");
  t.es("al ciclo siguiente entra uno", D.rellenarApartados(), 1);
  t.es("y el sobrante se acumula: 40 + 200", D.estadoDeApartado(ap.id).saldo, 240);
  t.es("volver a llamarlo no duplica", D.rellenarApartados(), 0);
  t.es("sigue en 240", D.estadoDeApartado(ap.id).saldo, 240);

  t.grupo("tres ciclos sin abrir la app se recuperan de una vez");
  congelar("2027-01-10T12:00:00");
  t.es("entran los tres que faltan", D.rellenarApartados(), 3);
  t.es("240 + 600", D.estadoDeApartado(ap.id).saldo, 840);

  t.grupo("un apartado sin relleno automático no se toca");
  limpio();
  congelar("2026-09-10T12:00:00");
  var manual = D.addApartado({ name: "Viaje", accountId: "cartera",
                               porCiclo: 0, inicial: 300, categoryIds: [] });
  t.es("empieza con lo que le metiste", D.estadoDeApartado(manual.id).saldo, 300);
  congelar("2026-12-10T12:00:00");
  t.es("y tres ciclos después sigue igual", D.rellenarApartados(), 0);
  t.es("con sus 300", D.estadoDeApartado(manual.id).saldo, 300);

  t.grupo("borrar el apartado suelta sus gastos, no los borra");
  limpio();
  congelar("2026-09-10T12:00:00");
  ap = D.addApartado({ name: "Gasolina", accountId: "cartera", porCiclo: 200,
                       categoryIds: ["gasolina"] });
  gasto(30, "gasolina", "2026-09-05");
  gasto(20, "gasolina", "2026-09-06");
  t.es("dos gastos en el sobre", D.estadoDeApartado(ap.id).gastado, 50);
  t.es("y el objetivo de la cuenta a cero", D.estadoDeObjetivo("cartera").gastado, 0);
  var res = D.deleteApartado(ap.id);
  t.es("se sueltan los dos", res.sueltos, 2);
  t.es("los movimientos siguen ahí", D.state.transactions.length, 2);
  t.es("y ahora sí cuentan en el objetivo", D.estadoDeObjetivo("cartera").gastado, 50);

  t.grupo("cada apartado es de su cuenta");
  limpio();
  D.state.accounts.push({ id: "banco", name: "Banco", opening: 0 });
  ap = D.addApartado({ name: "Gasolina", accountId: "cartera", porCiclo: 200,
                       categoryIds: ["gasolina"] });
  var otro = D.addTx({ kind: "out", amount: 40, categoryId: "gasolina",
                       accountId: "banco", date: "2026-09-05" });
  t.es("gasolina pagada con el banco no toca el sobre de la cartera",
       otro.apartadoId, undefined);
  t.es("el sobre sigue entero", D.estadoDeApartado(ap.id).saldo, 200);
  t.es("y la cartera no tiene ese gasto", D.estadoDeObjetivo("cartera").gastado, 0);

  global.Date = REAL;
};
