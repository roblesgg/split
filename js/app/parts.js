/* ============================================================
   split — trozos de interfaz compartidos

   Fragmentos que salen en más de una pantalla: la fila de un movimiento,
   el hueco vacío, el nombre de una cuenta. Viven aquí y no en la pantalla
   donde nacieron para que nadie tenga que importar de un vecino.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function catFace() { return A.catFace.apply(null, arguments); }
  function catOf() { return A.catOf.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function pickField() { return A.pickField.apply(null, arguments); }

  function accName(id) {
    var a = S.state.accounts.find(function (x) { return x.id === id; });
    return a ? a.name : "—";
  }

  function txRowHtml(t) {
    var cat = catOf(t.categoryId);
    var isIn = t.kind === "in";

    /* un traspaso no es ingreso ni gasto: se marca aparte y su importe
       va en tinta neutra, sin signo de más ni de menos */
    if (t.kind === "transfer") {
      return '' +
        '<button type="button" class="row" data-tx="' + esc(t.id) + '">' +
          '<span class="avatar-letter" data-icon="swap" data-icon-size="18"></span>' +
          '<span class="row__body">' +
            '<span class="row__title">' + esc(t.note) + '</span>' +
            '<span class="row__meta">' + esc(accName(t.accountId)) + ' → ' +
              esc(accName(t.toAccountId)) + ' · ' + esc(S.relDayLabel(t.date)) + '</span>' +
          '</span>' +
          '<span class="row__amount" style="color:var(--text-secondary)">' +
            esc(money(t.amount)) + '</span>' +
        '</button>';
    }
    /* el emoji de la categoría hundido en el material, teñido con su
       color; el nombre de la categoría sigue leyéndose en la línea de abajo */
    return '' +
      '<button type="button" class="row" data-tx="' + esc(t.id) + '">' +
        catFace(cat, 22, "avatar-letter") +
        '<span class="row__body">' +
          '<span class="row__title">' + esc(t.note) + '</span>' +
          '<span class="row__meta">' + esc(S.nombreLargo(t.categoryId) || cat.name) +
            ' · ' + esc(S.relDayLabel(t.date)) + '</span>' +
        '</span>' +
        '<span class="row__amount" data-kind="' + (isIn ? "in" : "out") + '">' +
          (isIn ? "+" : "−") + esc(money(t.amount)) +
        '</span>' +
      '</button>';
  }

  function emptyHtml(ic, title, text) {
    return '<div class="empty">' +
        '<span class="empty__icon" data-icon="' + ic + '" data-icon-size="20"></span>' +
        '<p class="empty__title">' + esc(title) + '</p>' +
        '<p class="empty__text">' + esc(text) + '</p>' +
      '</div>';
  }
  /* envuelve cada <section> de primer nivel para escalonar su entrada */
  function wrapStagger(html) {
    var parts = html.split("</section>").filter(function (p) { return p.trim(); });
    return parts.map(function (p, i) {
      return '<div style="--i:' + i + '">' + p + '</section></div>';
    }).join("");
  }
  function accountSelect(id, selected) {
    var a = S.state.accounts.find(function (x) { return x.id === selected; })
            || S.state.accounts[0];
    return pickField(id, a ? a.id : "", a ? a.name : "—");
  }

  /* ============================================================
     El límite de gasto de una cuenta

     La cifra que manda es el porcentaje que te QUEDA, no lo gastado: es
     lo que de verdad quieres saber al mirar. Los euros van debajo, en
     pequeño, para el que quiera el detalle.

     El color de la barra nunca viaja solo: cada escalón lleva su icono y
     su frase, igual que en las barras del presupuesto.
     ============================================================ */

  function colorDeLimite(est, cuenta) {
    if (est.nivel === "pasado") return "var(--status-critical)";
    if (est.nivel === "cerca") return "var(--status-warning)";
    return S.catColorVar(cuenta);
  }

  function pieDeLimite(est) {
    var deCuanto = S.moneyShort(est.gastado) + " de " + S.moneyShort(est.limite);
    /* Arriba ya pone «te has pasado» y en cuánto por ciento: aquí van los
       euros, que es lo que falta por saber. */
    if (est.nivel === "pasado") {
      return icon("warning", 11) + " " + esc(deCuanto) + " · " +
             esc(S.moneyShort(-est.queda)) + " de más";
    }
    var dias = est.diasQuedan === 0 ? "último día"
             : est.diasQuedan === 1 ? "queda 1 día"
             : "quedan " + est.diasQuedan + " días";
    if (est.nivel === "cerca") {
      return icon("warning", 11) + " Al límite · " + esc(deCuanto) + " · " + esc(dias);
    }
    return esc(deCuanto) + " · " + esc(dias);
  }

  /* La versión grande, para la pantalla de la cuenta. */
  function limiteHtml(est, cuenta) {
    var fill = colorDeLimite(est, cuenta);
    var pasado = est.nivel === "pasado";
    return '' +
      '<div class="hero-center" style="padding-bottom:var(--sp-4)">' +
        '<p class="hero-center__label">' +
          (pasado ? "Te has pasado" : "Te queda de tu objetivo") + '</p>' +
        '<p class="hero-center__value" style="' + (pasado ? "color:" + fill : "") + '">' +
          esc(S.pct(pasado ? Math.round((est.ratio - 1) * 100) : est.pctQueda)) + '</p>' +
      '</div>' +
      '<div class="meter">' +
        '<div class="meter__track">' +
          '<div class="meter__fill" style="width:' + est.pct + '%;background:' + fill + '"></div>' +
        '</div>' +
        '<p class="meter__foot">' + pieDeLimite(est) + '</p>' +
      '</div>';
  }

  /* Y la de dentro de la tarjeta de cuenta del Resumen, que va sobre el
     color de la cuenta y en blanco: ahí la severidad la lleva el texto,
     porque una barra roja sobre un fondo de color no se lee. */
  function limiteEnTarjeta(est) {
    var texto = est.nivel === "pasado"
      ? "Te has pasado " + S.moneyShort(-est.queda) + " de " + S.moneyShort(est.limite)
      : "Te queda el " + est.pctQueda + " % de " + S.moneyShort(est.limite);
    return '' +
      '<div class="paycard__limite">' +
        '<div class="paycard__limite-track">' +
          '<div class="paycard__limite-fill" style="width:' + est.pct + '%"></div>' +
        '</div>' +
        '<span class="paycard__label">' + esc(texto) + '</span>' +
      '</div>';
  }


  /* --- lo que usan otros archivos --- */
  A.accName = accName;
  A.limiteHtml = limiteHtml;
  A.limiteEnTarjeta = limiteEnTarjeta;
  A.accountSelect = accountSelect;
  A.emptyHtml = emptyHtml;
  A.txRowHtml = txRowHtml;
  A.wrapStagger = wrapStagger;

})();
