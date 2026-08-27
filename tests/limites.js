/* ============================================================
   split — los límites del mes

   Lo que hay que asegurar: que cada límite mira SOLO lo suyo. Ese es el
   trato — si «Gastos» excluye gasolina, un repostaje no lo mueve; y el
   límite «Gasolina», que solo mira gasolina, sí.

   Y que excluir una categoría madre excluye también a sus hijas, que es
   donde esto se rompería sin que nadie se diera cuenta.
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
   "js/data/categories.js", "js/data/accounts.js", "js/data/apartados.js",
   "js/data/objetivo.js", "js/data/tx.js", "js/data/select.js",
   "js/data/recurring.js", "js/data/pendientes.js", "js/data/budget.js",
   "js/data/limites.js"],
  { Datos: { MONTHS: MESES, MONTHS_SHORT: CORTOS, state: null, save: function () {} } });
var D = win.Datos;

function limpio() {
  D.state = {
    ciclo: { dia: 1 },
    categories: D.DEFAULT_CATEGORIES.slice().concat([
      /* dos hijas de Suscripciones, que es donde está la gracia */
      { id: "subs-tv", name: "Netflix", emoji: "📺", color: 11, kind: "out", parentId: "subs" },
      { id: "subs-ia", name: "Claude", emoji: "🤖", color: 12, kind: "out", parentId: "subs" }
    ]),
    accounts: [{ id: "cartera", name: "Cartera", opening: 3000 }],
    apartados: [],
    limites: [],
    recurring: [], pendientes: [],
    income: { mode: "manual", manual: 2000, months: 3 },
    transactions: []
  };
  D.invalidateCats();
}

function gasto(cat, importe, fecha, extra) {
  var t = {
    id: "t" + D.state.transactions.length,
    kind: "out", amount: importe, categoryId: cat,
    accountId: "cartera", date: fecha || "2026-09-05"
  };
  if (extra) Object.keys(extra).forEach(function (k) { t[k] = extra[k]; });
  D.state.transactions.push(t);
}

module.exports = function () {

  /* ---------- el caso que pidió esto ---------- */

  t.grupo("Gasolina y Gastos, en la misma pantalla");

  limpio();

  /* «Gasolina»: 200 €, y solo esa categoría. */
  var gas = D.addLimite({ name: "Gasolina", importe: 200,
                          ambito: "solo", categoryIds: ["gasolina"] });
  /* «Gastos»: todo menos suscripciones (con sus hijas) y gasolina. */
  var gen = D.addLimite({ name: "Gastos", importe: 1200,
                          ambito: "salvo", categoryIds: ["subs", "gasolina"] });

  gasto("comida", 300);
  gasto("gasolina", 60);
  gasto("subs", 12);
  gasto("subs-ia", 22);      /* Claude, hija de Suscripciones */
  gasto("ocio", 40);

  t.es("Gasolina solo cuenta el repostaje", D.estadoDeLimite(gas.id).gastado, 60);
  t.es("Gastos deja fuera gasolina y las suscripciones, hijas incluidas",
       D.estadoDeLimite(gen.id).gastado, 300 + 40);
  t.es("y por eso ninguno cuenta lo mismo dos veces",
       D.estadoDeLimite(gas.id).gastado + D.estadoDeLimite(gen.id).gastado, 400);

  t.es("lo que se enseña de Gasolina",
       [D.estadoDeLimite(gas.id).queda, D.estadoDeLimite(gas.id).pctQueda], [140, 70]);

  /* ---------- las subcategorías ---------- */

  t.grupo("Excluir una madre excluye a sus hijas");

  limpio();
  var sinSubs = D.addLimite({ name: "Sin subs", importe: 1000,
                              ambito: "salvo", categoryIds: ["subs"] });
  var soloSubs = D.addLimite({ name: "Solo subs", importe: 100,
                               ambito: "solo", categoryIds: ["subs"] });

  gasto("subs", 12);
  gasto("subs-tv", 14);
  gasto("subs-ia", 22);
  gasto("comida", 50);

  t.es("la hija tampoco cuenta en el que excluye a la madre",
       D.estadoDeLimite(sinSubs.id).gastado, 50);
  t.es("y elegir la madre trae a todas las hijas",
       D.estadoDeLimite(soloSubs.id).gastado, 12 + 14 + 22);

  /* Y una hija suelta se puede elegir sola, sin arrastrar a la madre. */
  limpio();
  var soloClaude = D.addLimite({ name: "Claude", importe: 25,
                                 ambito: "solo", categoryIds: ["subs-ia"] });
  gasto("subs", 12);
  gasto("subs-ia", 22);
  t.es("una hija sola no arrastra a la madre",
       D.estadoDeLimite(soloClaude.id).gastado, 22);

  /* ---------- los tres ámbitos ---------- */

  t.grupo("A qué gastos afecta");

  limpio();
  var todo = D.addLimite({ name: "Todo", importe: 100, ambito: "todas" });
  var solo = D.addLimite({ name: "Dos", importe: 100, ambito: "solo",
                           categoryIds: ["comida", "ocio"] });
  var salvo = D.addLimite({ name: "Menos dos", importe: 100, ambito: "salvo",
                            categoryIds: ["comida", "ocio"] });

  gasto("comida", 10);
  gasto("ocio", 5);
  gasto("gasolina", 7);

  t.es("«a todos» cuenta los tres", D.estadoDeLimite(todo.id).gastado, 22);
  t.es("«solo estas» cuenta dos", D.estadoDeLimite(solo.id).gastado, 15);
  t.es("«todos menos estas» cuenta el otro", D.estadoDeLimite(salvo.id).gastado, 7);
  t.es("y los dos partidos suman el total",
       D.estadoDeLimite(solo.id).gastado + D.estadoDeLimite(salvo.id).gastado,
       D.estadoDeLimite(todo.id).gastado);

  t.es("«solo estas» sin ninguna marcada no cuenta nada",
       D.estadoDeLimite(D.addLimite({ name: "Vacío", importe: 50, ambito: "solo",
                                      categoryIds: [] }).id).gastado, 0);

  /* ---------- lo que no cuenta nunca ---------- */

  t.grupo("Lo que ningún límite cuenta");

  limpio();
  var l = D.addLimite({ name: "Mes", importe: 500, ambito: "todas" });

  gasto("comida", 30);
  /* un traspaso a la hucha no es gastar */
  D.state.transactions.push({ id: "tr", kind: "transfer", amount: 200,
                              accountId: "cartera", toAccountId: "otra",
                              date: "2026-09-03" });
  /* un ingreso tampoco */
  D.state.transactions.push({ id: "in", kind: "in", amount: 900,
                              categoryId: "nomina", accountId: "cartera",
                              date: "2026-09-01" });
  /* lo que sale de un apartado ya estaba separado */
  D.state.apartados.push({ id: "ap", name: "Gasolina", accountId: "cartera",
                           porCiclo: 100, categoryIds: ["gasolina"],
                           aportes: [{ ciclo: "2026-09", importe: 100 }] });
  gasto("gasolina", 45, "2026-09-05", { apartadoId: "ap" });
  /* y lo del mes pasado es del mes pasado */
  gasto("comida", 70, "2026-08-20");

  t.es("solo cuenta el gasto de verdad de este mes",
       D.estadoDeLimite(l.id).gastado, 30);

  /* ---------- los escalones ---------- */

  t.grupo("Los tres escalones");

  limpio();
  var p = D.addLimite({ name: "Mes", importe: 400, ambito: "todas" });
  gasto("comida", 100);
  t.es("al 25 % va tranquilo", D.estadoDeLimite(p.id).nivel, "ok");
  gasto("ocio", 250);
  t.es("al 87 % avisa", D.estadoDeLimite(p.id).nivel, "cerca");
  gasto("ocio", 100);
  var pasado = D.estadoDeLimite(p.id);
  t.es("y pasado el 100 % lo dice en rojo", pasado.nivel, "pasado");
  t.es("con la barra tope a 100", pasado.pct, 100);
  t.es("y lo que te has pasado, en negativo", pasado.queda, -50);

  /* ---------- el que hay que mirar de un vistazo ---------- */

  t.grupo("El más apurado");

  limpio();
  t.es("sin ninguno, no hay nada que mirar", D.limiteMasApurado(), null);

  var a = D.addLimite({ name: "Comida", importe: 300, ambito: "solo",
                        categoryIds: ["comida"] });
  var b = D.addLimite({ name: "Ocio", importe: 100, ambito: "solo",
                        categoryIds: ["ocio"] });
  gasto("comida", 60);      /* 20 % */
  gasto("ocio", 80);        /* 80 % */
  t.es("se enseña el que va más lleno, no el primero",
       D.limiteMasApurado().name, "Ocio");
  gasto("comida", 240);     /* 100 % */
  t.es("y cambia cuando cambia quién va peor",
       D.limiteMasApurado().name, "Comida");
  t.es("los de cero euros no compiten",
       (function () {
         D.addLimite({ name: "Sin tope", importe: 0, ambito: "todas" });
         return D.limiteMasApurado().name;
       })(), "Comida");

  /* ---------- lo de arriba ---------- */

  t.grupo("Lo que resume la pantalla");

  limpio();
  D.addLimite({ name: "Gasolina", importe: 200, ambito: "solo",
                categoryIds: ["gasolina"] });
  D.addLimite({ name: "Gastos", importe: 1200, ambito: "salvo",
                categoryIds: ["subs", "gasolina"] });

  gasto("gasolina", 60);
  gasto("comida", 300);
  gasto("subs", 22);        /* fuera de los dos límites */

  var r = D.resumenDeLimites();
  t.es("cuántos hay", r.cuantos, 2);
  t.es("lo gastado que tiene tope", r.conTope, 360);
  t.es("y lo que no lo tiene", r.sinTope, 22);
  t.es("suman el gasto del mes", r.conTope + r.sinTope, 382);
  t.es("una categoría sin ningún límite se sabe", D.tieneTope("subs"), false);
  t.es("y una con él, también", D.tieneTope("comida"), true);

  /* El porcentaje es una lectura, no el dato. */
  t.es("lo que supone un límite sobre lo que entra",
       D.pctDeLimite(D.limites()[0]), 10);
  t.es("y el otro", D.pctDeLimite(D.limites()[1]), 60);

  /* ---------- cómo se lee ---------- */

  t.grupo("Cómo se lee un límite");

  t.es("el de una sola categoría",
       D.textoAmbitoLimite({ ambito: "solo", categoryIds: ["gasolina"] }), "1 categoría");
  t.es("el de varias",
       D.textoAmbitoLimite({ ambito: "solo", categoryIds: ["a", "b", "c"] }), "3 categorías");
  t.es("el general con exclusiones",
       D.textoAmbitoLimite({ ambito: "salvo", categoryIds: ["a", "b"] }),
       "todo menos 2 categorías");
  t.es("y el que no filtra nada",
       D.textoAmbitoLimite({ ambito: "todas", categoryIds: [] }), "todos los gastos");
  t.es("el que no cuenta nada lo dice",
       D.textoAmbitoLimite({ ambito: "solo", categoryIds: [] }),
       "sin categorías: no cuenta nada");

  /* ---------- editar y borrar ---------- */

  t.grupo("Editar y borrar");

  limpio();
  var uno = D.addLimite({ name: "Uno", importe: 100, ambito: "todas" });
  var dos = D.addLimite({ name: "Dos", importe: 200, ambito: "solo",
                          categoryIds: ["comida"] });
  gasto("comida", 30);

  D.updateLimite(uno.id, { importe: 250, name: "Uno cambiado" });
  t.es("el importe y el nombre se guardan",
       [D.limitePorId(uno.id).importe, D.limitePorId(uno.id).name], [250, "Uno cambiado"]);
  t.es("los euros que escribes son los que quedan",
       D.estadoDeLimite(uno.id).limite, 250);

  D.deleteLimite(uno.id);
  t.es("se va solo ese", D.limites().map(function (x) { return x.id; }), [dos.id]);
  t.es("y no se borra ningún movimiento", D.state.transactions.length, 1);
  t.es("ni el otro deja de contar", D.estadoDeLimite(dos.id).gastado, 30);

  /* Borrar una categoría la saca de todas las listas: si no, un límite
     «solo estas» se quedaría mirando algo que ya no existe. */
  limpio();
  var mira = D.addLimite({ name: "Dos cosas", importe: 100, ambito: "solo",
                           categoryIds: ["comida", "ocio"] });
  D.olvidarCategoria("ocio");
  t.es("la categoría borrada se cae de la lista",
       D.limitePorId(mira.id).categoryIds, ["comida"]);

  D.vaciarLimites();
  t.es("y vaciar los deja en nada", D.limites(), []);

  /* ---------- los euros no se mueven solos ---------- */

  t.grupo("Los euros que escribes son los que quedan");

  /* Esto existe por un fallo de verdad: cuando el tope se guardaba en
     porcentaje redondeado, 200 € sobre 2.178 volvían convertidos en
     196 €, y bastaba con repintar la lista —quitar otra partida, por
     ejemplo— para que las cifras que habías escrito se movieran. */
  limpio();
  D.state.income = { mode: "manual", manual: 2178, months: 3 };

  var g1 = D.addLimite({ name: "Gasolina", importe: 200, ambito: "solo",
                         categoryIds: ["gasolina"] });
  var g2 = D.addLimite({ name: "Suscripciones", importe: 22, ambito: "solo",
                         categoryIds: ["subs"] });
  var g3 = D.addLimite({ name: "Comida", importe: 350, ambito: "solo",
                         categoryIds: ["comida"] });

  t.es("los tres, tal cual se escribieron",
       [g1, g2, g3].map(function (l) { return D.estadoDeLimite(l.id).limite; }),
       [200, 22, 350]);

  D.deleteLimite(g3.id);
  t.es("al quitar uno, los otros no se mueven ni un euro",
       [D.estadoDeLimite(g1.id).limite, D.estadoDeLimite(g2.id).limite], [200, 22]);
  t.es("ni su porcentaje", [D.pctDeLimite(g1), D.pctDeLimite(g2)], [9, 1]);

  /* Veinte idas y venidas entre el campo y el estado. */
  for (var i = 0; i < 20; i++) {
    D.updateLimite(g1.id, { importe: D.estadoDeLimite(g1.id).limite });
  }
  t.es("y veinte reescrituras siguen siendo 200",
       D.estadoDeLimite(g1.id).limite, 200);

  D.updateLimite(g2.id, { importe: 12.5 });
  t.es("los céntimos tampoco se pierden", D.estadoDeLimite(g2.id).limite, 12.5);
};
