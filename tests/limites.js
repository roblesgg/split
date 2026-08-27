/* ============================================================
   split — límites de gasto

   Ahora una cuenta puede tener varios, cada uno con su ámbito de
   categorías y su reinicio. Lo que hay que asegurar:

   - Que cada límite mira SOLO lo suyo. Ese es el trato: si «Gasto del
     mes» excluye gasolina, un repostaje no lo mueve; y el límite
     «Gasolina», que solo mira gasolina, sí.
   - Que un traspaso y lo que sale de un apartado no cuentan en ninguno.
   - Que el periodo en curso sale bien de las tres formas de contar.
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
/* Jueves 10 de septiembre de 2026. */
congelar("2026-09-10T12:00:00");

var win = t.cargar(
  ["js/core/dates.js", "js/core/format.js", "js/data/ciclo.js", "js/data/catalog.js",
   "js/data/categories.js", "js/data/accounts.js", "js/data/apartados.js",
   "js/data/limites.js", "js/data/tx.js"],
  { Datos: { MONTHS: MESES, MONTHS_SHORT: CORTOS, state: null, save: function () {} } });
var D = win.Datos;

function limpio() {
  D.state = {
    ciclo: { dia: 1 },
    categories: D.DEFAULT_CATEGORIES.slice(),
    accounts: [
      { id: "cartera", name: "Cartera", opening: 2000 },
      { id: "banco", name: "Banco", opening: 5000 }
    ],
    apartados: [],
    limites: [],
    transactions: []
  };
}

function gasto(cat, importe, fecha, acc) {
  D.state.transactions.push({
    id: "t" + D.state.transactions.length,
    kind: "out", amount: importe, categoryId: cat,
    accountId: acc || "cartera", date: fecha
  });
}

module.exports = function () {

  /* ---------- el caso que pidió esto ---------- */

  t.grupo("Dos límites en la misma cuenta");

  limpio();

  /* El general: todo lo que gasto, menos los préstamos y las
     suscripciones, que no son decisiones del mes. */
  var mes = D.addLimite({
    name: "Gasto del mes", accountId: "cartera", importe: 400,
    ambito: "salvo", categoryIds: ["hogar", "subs"]
  });
  /* Y el de gasolina, que solo mira gasolina. */
  var gas = D.addLimite({
    name: "Gasolina", accountId: "cartera", importe: 120,
    ambito: "solo", categoryIds: ["gasolina"]
  });

  gasto("comida", 50, "2026-09-02");
  gasto("gasolina", 40, "2026-09-04");
  gasto("hogar", 500, "2026-09-05");        /* el préstamo: excluido */
  gasto("subs", 22, "2026-09-06");          /* la suscripción: excluida */
  gasto("ocio", 30, "2026-09-08");

  t.es("el general no cuenta ni el préstamo ni la suscripción",
       D.estadoDeLimite(mes.id).gastado, 50 + 40 + 30);
  t.es("pero sí cuenta la gasolina, que no está excluida",
       D.afectaA(mes, "gasolina"), true);
  t.es("el de gasolina solo cuenta gasolina",
       D.estadoDeLimite(gas.id).gastado, 40);

  /* Y esto es el trato que se eligió: si no quieres que cuente dos
     veces, lo excluyes del general. Es explícito y se ve en su ficha. */
  D.updateLimite(mes.id, { categoryIds: ["hogar", "subs", "gasolina"] });
  t.es("excluyendo gasolina del general, deja de contarle",
       D.estadoDeLimite(mes.id).gastado, 50 + 30);
  t.es("y el de gasolina sigue igual",
       D.estadoDeLimite(gas.id).gastado, 40);

  /* ---------- los tres ámbitos ---------- */

  t.grupo("A qué gastos afecta");

  limpio();
  var todo = D.addLimite({ name: "Todo", accountId: "cartera", importe: 100,
                           ambito: "todas" });
  var solo = D.addLimite({ name: "Solo dos", accountId: "cartera", importe: 100,
                           ambito: "solo", categoryIds: ["comida", "ocio"] });
  var salvo = D.addLimite({ name: "Menos dos", accountId: "cartera", importe: 100,
                            ambito: "salvo", categoryIds: ["comida", "ocio"] });

  gasto("comida", 10, "2026-09-01");
  gasto("ocio", 5, "2026-09-02");
  gasto("gasolina", 7, "2026-09-03");

  t.es("«a todos» cuenta los tres", D.estadoDeLimite(todo.id).gastado, 22);
  t.es("«solo estas» cuenta dos", D.estadoDeLimite(solo.id).gastado, 15);
  t.es("«todos menos estas» cuenta el otro", D.estadoDeLimite(salvo.id).gastado, 7);
  t.es("y los tres suman lo mismo que el total",
       D.estadoDeLimite(solo.id).gastado + D.estadoDeLimite(salvo.id).gastado,
       D.estadoDeLimite(todo.id).gastado);

  /* ---------- lo que no cuenta nunca ---------- */

  t.grupo("Lo que ningún límite cuenta");

  limpio();
  var l = D.addLimite({ name: "Mes", accountId: "cartera", importe: 500,
                        ambito: "todas" });

  gasto("comida", 30, "2026-09-02");
  /* un traspaso a la hucha no es gastar */
  D.state.transactions.push({ id: "tr", kind: "transfer", amount: 200,
                              accountId: "cartera", toAccountId: "banco",
                              date: "2026-09-03" });
  /* un gasto de otra cuenta tampoco es de esta */
  gasto("comida", 90, "2026-09-04", "banco");
  /* y lo que sale de un apartado ya estaba separado */
  D.state.apartados.push({ id: "ap", name: "Gasolina", accountId: "cartera",
                           porCiclo: 100, categoryIds: ["gasolina"],
                           aportes: [{ ciclo: "2026-09", importe: 100 }] });
  D.state.transactions.push({ id: "tap", kind: "out", amount: 45,
                              categoryId: "gasolina", accountId: "cartera",
                              date: "2026-09-05", apartadoId: "ap" });

  t.es("solo cuenta el gasto de verdad de esta cuenta",
       D.estadoDeLimite(l.id).gastado, 30);

  /* ---------- las cifras que se pintan ---------- */

  t.grupo("Lo que se enseña");

  limpio();
  var p = D.addLimite({ name: "Mes", accountId: "cartera", importe: 400,
                        ambito: "todas" });
  gasto("comida", 100, "2026-09-02");
  var e = D.estadoDeLimite(p.id);

  t.es("lo gastado y lo que queda", [e.gastado, e.queda], [100, 300]);
  t.es("el porcentaje que queda, que es la cifra grande", e.pctQueda, 75);
  t.es("y va tranquilo", e.nivel, "ok");

  gasto("ocio", 250, "2026-09-03");
  t.es("al 87 % avisa", D.estadoDeLimite(p.id).nivel, "cerca");

  gasto("ocio", 100, "2026-09-04");
  var pasado = D.estadoDeLimite(p.id);
  t.es("y pasado el 100 % lo dice en rojo", pasado.nivel, "pasado");
  t.es("con la barra tope a 100", pasado.pct, 100);
  t.es("y lo que se ha pasado, en negativo", pasado.queda, -50);

  /* ---------- cuándo se vacía ---------- */

  t.grupo("Cuándo se vacía");

  limpio();

  /* Con el mes de la app, que hoy es el natural: del 1 al 30. */
  var conCiclo = D.addLimite({ name: "Mes", accountId: "cartera", importe: 100,
                               ambito: "todas", reinicio: { modo: "ciclo" } });
  t.es("con el mes de la app va del 1 al 30",
       [D.periodoDeLimite(conCiclo).desde, D.periodoDeLimite(conCiclo).hasta],
       ["2026-09-01", "2026-09-30"]);

  /* Y sigue al día de corte si el usuario lo cambia. */
  D.state.ciclo = { dia: 25 };
  t.es("y si tu mes empieza el 25, también",
       [D.periodoDeLimite(conCiclo).desde, D.periodoDeLimite(conCiclo).hasta],
       ["2026-08-25", "2026-09-24"]);
  D.state.ciclo = { dia: 1 };

  /* Su propio día del mes, al margen del ciclo. */
  var propio = D.addLimite({ name: "Día 5", accountId: "cartera", importe: 100,
                             ambito: "todas", reinicio: { modo: "mes", dia: 5 } });
  t.es("con día propio, el 10 de septiembre va del 5 al 4",
       [D.periodoDeLimite(propio).desde, D.periodoDeLimite(propio).hasta],
       ["2026-09-05", "2026-10-04"]);

  var dia20 = D.addLimite({ name: "Día 20", accountId: "cartera", importe: 100,
                            ambito: "todas", reinicio: { modo: "mes", dia: 20 } });
  t.es("y si el día aún no ha llegado, el periodo es el del mes pasado",
       [D.periodoDeLimite(dia20).desde, D.periodoDeLimite(dia20).hasta],
       ["2026-08-20", "2026-09-19"]);

  /* Por semanas. Hoy es jueves. */
  var lunes = D.addLimite({ name: "Semana", accountId: "cartera", importe: 100,
                            ambito: "todas", reinicio: { modo: "semana", dia: 0 } });
  t.es("cada lunes, la semana en curso empieza el lunes de esta semana",
       [D.periodoDeLimite(lunes).desde, D.periodoDeLimite(lunes).hasta],
       ["2026-09-07", "2026-09-13"]);
  t.es("y son siete días", D.periodoDeLimite(lunes).dias, 7);

  var jueves = D.addLimite({ name: "Jueves", accountId: "cartera", importe: 100,
                             ambito: "todas", reinicio: { modo: "semana", dia: 3 } });
  t.es("si hoy ES el día, la semana empieza hoy y no hace siete",
       [D.periodoDeLimite(jueves).desde, D.periodoDeLimite(jueves).hasta],
       ["2026-09-10", "2026-09-16"]);

  /* Y cada uno cuenta lo suyo dentro de SU periodo. */
  limpio();
  var sem = D.addLimite({ name: "Semana", accountId: "cartera", importe: 100,
                          ambito: "todas", reinicio: { modo: "semana", dia: 0 } });
  var men = D.addLimite({ name: "Mes", accountId: "cartera", importe: 500,
                          ambito: "todas", reinicio: { modo: "ciclo" } });
  gasto("comida", 60, "2026-09-02");   /* de este mes, pero de la semana pasada */
  gasto("comida", 25, "2026-09-08");   /* de esta semana */

  t.es("el semanal solo ve lo de esta semana", D.estadoDeLimite(sem.id).gastado, 25);
  t.es("y el mensual lo ve todo", D.estadoDeLimite(men.id).gastado, 85);

  /* ---------- el que se enseña cuando solo cabe uno ---------- */

  t.grupo("El principal de una cuenta");

  limpio();
  t.es("sin ninguno, no hay principal", D.limitePrincipalDe("cartera"), null);

  var soloGas = D.addLimite({ name: "Gasolina", accountId: "cartera", importe: 120,
                              ambito: "solo", categoryIds: ["gasolina"] });
  t.es("con uno solo, ese es", D.limitePrincipalDe("cartera").id, soloGas.id);

  var general = D.addLimite({ name: "Gasto del mes", accountId: "cartera",
                              importe: 400, ambito: "salvo", categoryIds: ["hogar"] });
  t.es("en cuanto hay uno general, manda el general",
       D.limitePrincipalDe("cartera").id, general.id);
  t.es("y el de la otra cuenta no se cuela", D.limitePrincipalDe("banco"), null);

  t.es("los de una cuenta son los suyos",
       D.limitesDe("cartera").map(function (x) { return x.name; }),
       ["Gasolina", "Gasto del mes"]);

  /* ---------- cómo se lee ---------- */

  t.grupo("Cómo se lee un límite");

  t.es("el ámbito de un general con exclusiones",
       D.textoAmbitoLimite(general), "todo menos 1 categoría");
  t.es("el de uno específico", D.textoAmbitoLimite(soloGas), "solo 1 categoría");
  t.es("y el de uno sin filtros",
       D.textoAmbitoLimite({ ambito: "todas", categoryIds: [] }), "todos los gastos");

  t.es("el reinicio con el mes de la app",
       D.textoReinicioLimite({ reinicio: { modo: "ciclo" } }), "con el mes de la app");
  t.es("con día propio",
       D.textoReinicioLimite({ reinicio: { modo: "mes", dia: 25 } }), "cada día 25");
  t.es("y por semanas",
       D.textoReinicioLimite({ reinicio: { modo: "semana", dia: 0 } }), "cada lunes");

  /* ---------- borrar uno no toca nada más ---------- */

  t.grupo("Borrar un límite");

  limpio();
  var a1 = D.addLimite({ name: "Uno", accountId: "cartera", importe: 100, ambito: "todas" });
  var a2 = D.addLimite({ name: "Dos", accountId: "cartera", importe: 200,
                         ambito: "solo", categoryIds: ["comida"] });
  gasto("comida", 30, "2026-09-02");

  var antes = D.estadoDeLimite(a2.id).gastado;
  D.deleteLimite(a1.id);

  t.es("se va solo ese", D.limitesDe("cartera").map(function (x) { return x.id; }), [a2.id]);
  t.es("no se borra ningún movimiento", D.state.transactions.length, 1);
  t.es("y el otro límite sigue contando lo mismo",
       D.estadoDeLimite(a2.id).gastado, antes);
};
