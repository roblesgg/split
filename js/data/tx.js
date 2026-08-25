/* ============================================================
   split — movimientos
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function catById() { return D.catById.apply(null, arguments); }
  function save() { return D.save.apply(null, arguments); }

  /* ---------- mutaciones ---------- */

  function nextId() {
    return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* Un movimiento tiene dos textos: `note` es el título corto que se ve en
     la lista, y `memo` las notas largas, que solo salen en el detalle.
     `time` es opcional: los movimientos viejos no la tienen y se ordenan
     por el momento en que se apuntaron, como hasta ahora. */
  function addTx(t) {
    var tx = {
      id: nextId(),
      createdAt: Date.now(),
      date: t.date,
      time: normalizeTime(t.time),
      kind: t.kind,
      categoryId: t.categoryId,
      accountId: t.accountId || "banco",
      toAccountId: t.kind === "transfer" ? (t.toAccountId || null) : null,
      amount: Math.round(Math.abs(t.amount) * 100) / 100,
      note: (t.note || "").trim() ||
            (t.kind === "transfer" ? "Traspaso" : catById(t.categoryId).name),
      memo: (t.memo || "").trim(),
      tags: normalizeTags(t.tags),
      attachments: Array.isArray(t.attachments) ? t.attachments.slice() : []
    };
    D.state.transactions.push(tx);
    sortTx();
    save();
    return tx;
  }

  /* "HH:MM" en 24 h, o cadena vacía si no se ha puesto hora */
  function normalizeTime(v) {
    var m = String(v == null ? "" : v).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return "";
    var h = Math.min(23, Math.max(0, +m[1])), mi = Math.min(59, Math.max(0, +m[2]));
    return (h < 10 ? "0" : "") + h + ":" + (mi < 10 ? "0" : "") + mi;
  }

  function normalizeTags(v) {
    if (!Array.isArray(v)) return [];
    var seen = {}, out = [];
    v.forEach(function (id) {
      if (!id || seen[id]) return;
      seen[id] = 1;
      out.push(id);
    });
    return out;
  }

  function updateTx(id, patch) {
    var t = D.state.transactions.find(function (x) { return x.id === id; });
    if (!t) return null;
    Object.keys(patch).forEach(function (k) { t[k] = patch[k]; });
    if (patch.amount != null) t.amount = Math.round(Math.abs(patch.amount) * 100) / 100;
    if (patch.time != null) t.time = normalizeTime(patch.time);
    if (patch.memo != null) t.memo = String(patch.memo).trim();
    if (patch.tags != null) t.tags = normalizeTags(patch.tags);
    sortTx();
    save();
    return t;
  }

  function deleteTx(id) {
    var i = D.state.transactions.findIndex(function (x) { return x.id === id; });
    if (i < 0) return null;
    var removed = D.state.transactions.splice(i, 1)[0];
    save();
    return removed;
  }

  function restoreTx(t) {
    D.state.transactions.push(t);
    sortTx();
    save();
  }

  /* Más reciente primero. A igualdad de fecha manda lo añadido después,
     para que un movimiento recién guardado aparezca arriba de su día
     y no enterrado entre los que ya había. */
  function sortTx() {
    D.state.transactions.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      /* con hora puesta manda la hora; sin ella, lo añadido después */
      var ta = a.time || "", tb = b.time || "";
      if (ta && tb && ta !== tb) return ta < tb ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }


  /* --- lo que se lleva el espacio común --- */
  D.addTx = addTx;
  D.deleteTx = deleteTx;
  D.nextId = nextId;
  D.normalizeTime = normalizeTime;
  D.restoreTx = restoreTx;
  D.sortTx = sortTx;
  D.updateTx = updateTx;
})();
