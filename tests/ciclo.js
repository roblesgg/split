/* ============================================================
   split — la matemática del ciclo

   Todo lo que hay debajo de «mi mes empieza el día 25»: en qué ciclo cae
   una fecha, dónde empieza y acaba, cuántos días tiene y cómo se llama.

   La comprobación que más vale es la última: que los 365 días de un año
   caigan cada uno en un ciclo y solo en uno, sin huecos ni solapes. Si
   eso se rompe, hay dinero que no aparece en ningún sitio.
   ============================================================ */

var t = require("./ayuda");

var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
             "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
var CORTOS = ["ene", "feb", "mar", "abr", "may", "jun",
              "jul", "ago", "sep", "oct", "nov", "dic"];

var win = t.cargar(["js/core/dates.js"],
  { Datos: { MONTHS: MESES, MONTHS_SHORT: CORTOS } });
var D = win.Datos, C = D.Ciclo;

module.exports = function () {

  t.grupo("con día 1 se comporta como el mes natural de siempre");
  t.es("el 1 de agosto es de agosto", C.de("2026-08-01", 1), "2026-08");
  t.es("el 31 también", C.de("2026-08-31", 1), "2026-08");
  t.es("agosto va del 1 al 31", C.rango("2026-08", 1),
       { desde: "2026-08-01", hasta: "2026-08-31" });
  t.es("febrero bisiesto tiene 29", C.rango("2024-02", 1),
       { desde: "2024-02-01", hasta: "2024-02-29" });
  t.es("y 28 cuando no lo es", C.dias("2026-02", 1), 28);
  t.es("el día 17 es el 17", C.diaDentro("2026-08-17", "2026-08", 1), 17);
  t.es("se sigue llamando agosto", C.etiqueta("2026-08", null, 1), "agosto 2026");
  t.es("y en corto, ago", C.etiqueta("2026-08", "short", 1), "ago");
  t.es("el nombre a secas", C.nombre("2026-08", 1), "agosto");

  t.grupo("con día 25");
  t.es("el 25 de agosto abre el ciclo", C.de("2026-08-25", 25), "2026-08");
  t.es("el 24 todavía es del anterior", C.de("2026-08-24", 25), "2026-07");
  t.es("el 1 de septiembre sigue en el de agosto", C.de("2026-09-01", 25), "2026-08");
  t.es("el 24 de septiembre lo cierra", C.de("2026-09-24", 25), "2026-08");
  t.es("y el 25 abre el siguiente", C.de("2026-09-25", 25), "2026-09");
  t.es("el ciclo de agosto va del 25 al 24", C.rango("2026-08", 25),
       { desde: "2026-08-25", hasta: "2026-09-24" });
  t.es("y tiene 31 días", C.dias("2026-08", 25), 31);
  t.es("el de febrero, 28", C.dias("2026-02", 25), 28);
  t.es("el primer día es el 1", C.diaDentro("2026-08-25", "2026-08", 25), 1);
  t.es("el 1 de septiembre es el octavo", C.diaDentro("2026-09-01", "2026-08", 25), 8);
  t.es("y el último, el 31", C.diaDentro("2026-09-24", "2026-08", 25), 31);
  t.es("se llama por sus dos fechas", C.etiqueta("2026-08", null, 25),
       "25 ago – 24 sep de 2026");
  t.es("en corto, sin año", C.etiqueta("2026-08", "short", 25), "25 ago – 24 sep");

  t.grupo("los bordes");
  t.es("el ciclo de diciembre acaba en enero", C.rango("2026-12", 25),
       { desde: "2026-12-25", hasta: "2027-01-24" });
  t.es("y una fecha de enero es de diciembre", C.de("2027-01-10", 25), "2026-12");
  t.es("el día 28 en enero acaba en febrero", C.rango("2026-01", 28),
       { desde: "2026-01-28", hasta: "2026-02-27" });
  t.es("y en un febrero bisiesto", C.rango("2024-02", 28),
       { desde: "2024-02-28", hasta: "2024-03-27" });

  t.grupo("un día imposible se cae al 1");
  t.es("el 31 no vale: no existe en febrero", C.diaValido(31), 1);
  t.es("el 0 tampoco", C.diaValido(0), 1);
  t.es("ni algo que no es un número", C.diaValido("hola"), 1);
  t.es("el 28 sí", C.diaValido(28), 28);

  t.grupo("el cambio de hora no descuadra las cuentas");
  /* En España marzo y octubre tienen un día de 23 y otro de 25 horas.
     Dividir milisegundos entre 86.400.000 daría 30,96 días si no se
     redondeara, y el ciclo se quedaría corto. */
  t.es("el ciclo que cruza marzo tiene 31 días", C.dias("2026-03", 25), 31);
  t.es("el que cruza octubre, también", C.dias("2026-10", 25), 31);
  t.es("y el día de dentro se cuenta bien en marzo",
       C.diaDentro("2026-04-01", "2026-03", 25), 8);
  t.es("y en octubre", C.diaDentro("2026-11-01", "2026-10", 25), 8);

  t.grupo("ningún día del año se queda fuera ni cuenta dos veces");
  [1, 5, 25, 28].forEach(function (dia) {
    var vistos = {}, total = 0, malos = 0;
    for (var m = 1; m <= 12; m++) {
      var key = "2026-" + (m < 10 ? "0" : "") + m;
      var r = C.rango(key, dia);
      var n = C.dias(key, dia);
      total += n;
      for (var i = 0; i < n; i++) {
        var d = new Date(+r.desde.slice(0, 4), +r.desde.slice(5, 7) - 1,
                         +r.desde.slice(8, 10) + i);
        var s = D.ymd(d);
        if (vistos[s] || C.de(s, dia) !== key) malos++;
        vistos[s] = true;
      }
    }
    var esperados = D.diasEntre(C.rango("2026-01", dia).desde,
                                C.rango("2026-12", dia).hasta) + 1;
    t.es("día " + dia + ": " + total + " días seguidos, ni uno repetido ni perdido",
         [total, malos], [esperados, 0]);
  });
};
