/* ============================================================
   split — formato de cifras

   Euros, porcentajes y decimales, siempre en es-ES.
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;

  /* ---------- formato ---------- */

  var eur = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  var eur0 = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  var num2 = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  /* Enteros con sus puntos de millar. Lo usa el importe mientras se
     teclea: los decimales de ahí van tal como se escriben, así que el
     formateador solo se ocupa del entero. */
  var num0 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

  /* Intl escribe el negativo con un guion de teclado, y signed() lleva
     desde siempre el menos tipográfico. Con las cifras grandes esas dos
     rayas de distinto largo se ven a la primera, así que se unifican
     aquí, que es por donde pasan todas. */
  function menos(txt) { return txt.replace("-", "−"); }

  function money(v) { return menos(eur.format(v)); }
  function moneyShort(v) {
    var a = Math.abs(v);
    if (a >= 10000) return menos(eur0.format(v));
    return menos(eur.format(v));
  }
  function signed(v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + eur.format(Math.abs(v)); }
  function pct(v, digits) {
    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits || 0
    }).format(v) + " %";
  }

  var MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun",
                      "jul", "ago", "sep", "oct", "nov", "dic"];
  var DOW_SHORT = ["L", "M", "X", "J", "V", "S", "D"];


  /* --- lo que se lleva el espacio común --- */
  D.DOW_SHORT = DOW_SHORT;
  D.MONTHS = MONTHS;
  D.MONTHS_SHORT = MONTHS_SHORT;
  D.eur = eur;
  D.money = money;
  D.moneyShort = moneyShort;
  D.num0 = num0;
  D.num2 = num2;
  D.pct = pct;
  D.signed = signed;
})();
