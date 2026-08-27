/* ============================================================
   split — los límites de gasto por cuenta

   Lo que hay que asegurar: que solo cuenta lo que de verdad es gasto de
   esa cuenta, que el ciclo recorta lo que entra en la cuenta, y que los
   escalones caen donde deben.
   ============================================================ */

var t = require("./ayuda");

var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
             "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
var CORTOS = ["ene", "feb", "mar", "abr", "may", "jun",
              "jul", "ago", "sep", "oct", "nov", "dic"];

var win = t.cargar(
  ["js/core/dates.js", "js/data/ciclo.js", "js/data/limites.js"],
  { Datos: { MONTHS: MESES, MONTHS_SHORT: CORTOS, state: null,
             /* guardar no hace falta para calcular */
             save: function () {} } });
var D = win.Datos;

function mov(id, kind, amount, date, extra) {
  var t2 = { id: id, kind: kind, amount: amount, date: date,
             categoryId: "otros", accountId: "a" };
  if (extra) Object.keys(extra).forEach(function (k) { t2[k] = extra[k]; });
  return t2;
}

function estado(dia, limite) {
  D.state = {
    ciclo: { dia: dia },
    accounts: [{ id: "a", name: "Cartera", opening: 0, limite: limite },
               { id: "b", name: "Otra", opening: 0 }],
    transactions: [
      mov("1", "out", 100, "2026-09-02"),
      mov("2", "out", 50,  "2026-09-09"),
      mov("3", "out", 30,  "2026-09-03"),
      /* de la otra cuenta: no puede contar aquí */
      mov("4", "out", 900, "2026-09-08", { accountId: "b" }),
      /* un traspaso no es gastar */
      mov("5", "transfer", 500, "2026-09-08", { toAccountId: "b" }),
      /* un ingreso, menos todavía */
      mov("6", "in", 900, "2026-09-07")
    ]
  };
  return D.estadoDeLimite("a", "2026-09");
}

module.exports = function () {

  t.grupo("qué cuenta como gasto de la cuenta");
  var e = estado(1, 400);
  t.es("suma los tres gastos suyos y nada más", e.gastado, 180);
  t.es("y dice lo que queda", e.queda, 220);
  t.es("el porcentaje gastado", e.pct, 45);
  t.es("y el que queda, que es el que se enseña", e.pctQueda, 55);

  t.grupo("el ciclo recorta");
  /* con el corte el día 5, los del 2 y el 3 de septiembre son del ciclo
     anterior y no pueden contar contra este límite */
  t.es("con el corte el 5 solo queda uno", estado(5, 400).gastado, 50);
  t.es("con el corte el 1 cuentan los tres", estado(1, 400).gastado, 180);

  t.grupo("los escalones");
  t.es("por debajo del 85 % va bien", estado(1, 400).nivel, "ok");
  /* 180 de 211 es el 85,3 %: el primer límite que ya avisa */
  t.es("pasado el 85 % ya avisa", estado(1, 211).nivel, "cerca");
  t.es("justo por debajo, todavía no", estado(1, 212).nivel, "ok");
  t.es("gastarlo clavado no es pasarse", estado(1, 180).nivel, "cerca");
  t.es("un euro más sí", estado(1, 179).nivel, "pasado");
  t.es("pasado deja lo que queda en negativo", estado(1, 150).queda, -30);
  t.es("pero la barra no se sale", estado(1, 150).pct, 100);
  t.es("y el porcentaje que queda no baja de cero", estado(1, 150).pctQueda, 0);

  t.grupo("una cuenta sin límite no tiene estado que pintar");
  t.es("sin el campo, null", estado(1, undefined), null);
  t.es("con cero, null", estado(1, 0), null);
  t.es("con un negativo, null", estado(1, -50), null);
  D.state.accounts[0].limite = 400;
  t.es("la otra cuenta tampoco tiene", D.estadoDeLimite("b", "2026-09"), null);
  t.es("y una que no existe, tampoco", D.estadoDeLimite("nada", "2026-09"), null);

  t.grupo("poner y quitar el límite");
  estado(1, 400);
  D.setLimite("a", 250);
  t.es("se guarda redondeado a céntimos", D.limiteDe("a"), 250);
  D.setLimite("a", 33.333);
  t.es("y de verdad redondeado", D.limiteDe("a"), 33.33);
  D.setLimite("a", 0);
  t.es("con cero se quita", D.limiteDe("a"), null);
  D.setLimite("a", 250);
  D.setLimite("a", "");
  t.es("y con el campo vacío también", D.limiteDe("a"), null);
  t.es("sin dejar el campo puesto en la cuenta",
       Object.prototype.hasOwnProperty.call(D.state.accounts[0], "limite"), false);

  t.grupo("cuáles tienen límite");
  D.setLimite("a", 400);
  t.es("solo la que lo tiene",
       D.cuentasConLimite().map(function (c) { return c.id; }), ["a"]);
};
