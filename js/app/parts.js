/* ============================================================
   split — trozos de interfaz compartidos

   Fragmentos que salen en más de una pantalla: la fila de un movimiento,
   el hueco vacío, el nombre de una cuenta. Viven aquí y no en la pantalla
   donde nacieron para que nadie tenga que importar de un vecino.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, $ = A.$, $$ = A.$$, esc = A.esc;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function catFace() { return A.catFace.apply(null, arguments); }
  function catOf() { return A.catOf.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }

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

  /* --- lo que usan otros archivos --- */
  A.accName = accName;
  A.emptyHtml = emptyHtml;
  A.txRowHtml = txRowHtml;
  A.wrapStagger = wrapStagger;

})();
