/* ============================================================
   split — hoja: detalle de un movimiento
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, sheets = A.sheets;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function catOf() { return A.catOf.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function openAdd() { return A.openAdd.apply(null, arguments); }
  function renderAll() { return A.renderAll.apply(null, arguments); }

  /* ============================================================
     Sheet · detalle
     ============================================================ */

  function openDetail(txId) {
    var t = S.state.transactions.find(function (x) { return x.id === txId; });
    if (!t) return;
    var cat = catOf(t.categoryId);
    var acc = S.state.accounts.find(function (a) { return a.id === t.accountId; });
    var isIn = t.kind === "in";
    var etiquetas = (t.tags || []).map(function (id) { return S.tagById(id); })
                                  .filter(Boolean);

    $("#sheetDetailBody").innerHTML =
      '<div style="text-align:center;padding:var(--sp-3) 0 var(--sp-5)">' +
        '<span style="display:inline-grid;place-items:center;width:48px;height:48px;' +
              'border-radius:var(--r-full);font-size:24px;line-height:1;' +
              'background:var(--surface-2);box-shadow:var(--nm-in)" ' +
              'aria-hidden="true">' + esc(cat.emoji || "\uD83D\uDCE6") + '</span>' +
        '<p style="margin-top:var(--sp-3);font-size:30px;font-weight:640;letter-spacing:-.035em;' +
           (isIn ? "color:var(--money-in)" : "") + '">' +
          (isIn ? "+" : "−") + esc(money(t.amount)) + '</p>' +
        '<p style="margin-top:2px;font-size:14px;color:var(--text-secondary)">' + esc(t.note) + '</p>' +
      '</div>' +

      '<div class="card card--quiet" style="padding:0;overflow:hidden">' +
        detailRow("Categoría", cat.emoji + " " + cat.name) +
        detailRow("Cuenta", acc ? acc.name : "—") +
        detailRow("Fecha", S.parseYmd(t.date).toLocaleDateString("es-ES", {
          weekday: "long", day: "numeric", month: "long", year: "numeric"
        })) +
        (t.time ? detailRow("Hora", t.time) : "") +
        detailRow("Tipo", isIn ? "Ingreso" : "Gasto") +
      '</div>' +

      (etiquetas.length
        ? '<div class="field">' +
            '<span class="field__label">Etiquetas</span>' +
            '<div class="chips">' +
              etiquetas.map(function (tg) {
                return '<span class="chip" aria-pressed="true">' + esc(tg.name) + '</span>';
              }).join("") +
            '</div>' +
          '</div>'
        : "") +

      (t.memo
        ? '<div class="field">' +
            '<span class="field__label">Notas</span>' +
            '<p class="detail-memo">' + esc(t.memo) + '</p>' +
          '</div>'
        : "") +

      ((t.attachments && t.attachments.length)
        ? '<div class="field">' +
            '<span class="field__label">Adjuntos</span>' +
            '<div class="attach" id="detailAttach">' +
              '<p class="field__hint">Cargando…</p>' +
            '</div>' +
          '</div>'
        : "") +

      '<div class="field" style="display:flex;gap:var(--sp-3)">' +
        '<button type="button" class="btn btn--ghost" id="detailEdit" style="flex:1">' +
          icon("edit", 16) + 'Editar</button>' +
        '<button type="button" class="btn btn--danger" id="detailDelete" style="flex:1">' +
          icon("trash", 16) + 'Eliminar</button>' +
      '</div>';

    mountIcons($("#sheetDetailBody"));

    if (t.attachments && t.attachments.length && window.Attach) {
      window.Attach.getMany(t.attachments).then(function (list) {
        var box = $("#detailAttach");
        if (!box) return;
        box.innerHTML = list.length
          ? list.map(function (a) {
              return '<a class="attach__item" href="' + esc(a.dataUrl) + '" ' +
                       'target="_blank" rel="noopener">' +
                  '<img class="attach__img" src="' + esc(a.dataUrl) + '" ' +
                       'alt="' + esc(a.name) + '">' +
                '</a>';
            }).join("")
          : '<p class="field__hint">Los adjuntos ya no están disponibles.</p>';
      });
    }

    $("#detailEdit").onclick = function () {
      sheets.detail.close();
      setTimeout(function () { openAdd(t.kind, t.id); }, 220);
    };

    $("#detailDelete").onclick = function () {
      var removed = S.deleteTx(t.id);
      sheets.detail.close();
      renderAll();
      U.toast("Movimiento eliminado", {
        icon: "trash", actionLabel: "Deshacer", duration: 5000,
        onAction: function () {
          S.restoreTx(removed); renderAll(); U.toast("Restaurado", { icon: "check" });
        }
      });
    };

    sheets.detail.show();
  }

  function detailRow(label, value) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;' +
             'gap:var(--sp-4);padding:var(--sp-3) var(--sp-4);' +
             'box-shadow:inset 0 1px 0 var(--hairline)">' +
        '<span style="font-size:var(--t-min);color:var(--text-secondary)">' + esc(label) + '</span>' +
        '<span style="font-size:var(--t-hint);font-weight:var(--w-medium);text-align:right">' +
          esc(value) + '</span>' +
      '</div>';
  }


  /* --- lo que usan otros archivos --- */
  A.openDetail = openDetail;

})();
