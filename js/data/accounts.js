/* ============================================================
   split — cuentas
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;
  var CAT_COLORS = D.CAT_COLORS;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function normalizeColor() { return D.normalizeColor.apply(null, arguments); }
  function save() { return D.save.apply(null, arguments); }

  /* ============================================================
     Cuentas
     ============================================================ */

  function slugId(prefix, name) {
    var base = prefix + "-" + String(name).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 18);
    var id = base, n = 2;
    var taken = {};
    (D.state.accounts || []).forEach(function (a) { taken[a.id] = 1; });
    (D.state.goals || []).forEach(function (g) { taken[g.id] = 1; });
    (D.state.recurring || []).forEach(function (r) { taken[r.id] = 1; });
    (D.state.categories || []).forEach(function (c) { taken[c.id] = 1; });
    (D.state.tags || []).forEach(function (t) { taken[t.id] = 1; });
    (D.state.apartados || []).forEach(function (a) { taken[a.id] = 1; });
    while (taken[id]) { id = base + "-" + (n++); }
    return id;
  }

  function addAccount(data) {
    var acc = {
      id: slugId("acc", data.name || "cuenta"),
      name: (data.name || "Cuenta").trim(),
      type: (data.type || "Banco").trim(),
      icon: data.icon || "wallet",
      slot: ((D.state.accounts.length) % 8) + 1,
      /* si no se elige, va rotando por la paleta para que dos cuentas
         seguidas no salgan del mismo color */
      color: normalizeColor(data.color != null
        ? data.color : ((D.state.accounts.length * 5) % CAT_COLORS) + 1),
      opening: Math.round((+data.opening || 0) * 100) / 100
    };
    /* El límite es opcional: una cuenta sin él es lo normal, y no tener
       el campo se lee igual que no tener límite. */
    var lim = parseFloat(data.limite);
    if (isFinite(lim) && lim > 0) acc.limite = Math.round(lim * 100) / 100;
    D.state.accounts.push(acc);
    save();
    return acc;
  }

  function updateAccount(id, patch) {
    var a = D.state.accounts.find(function (x) { return x.id === id; });
    if (!a) return null;
    if (patch.name != null) a.name = String(patch.name).trim() || a.name;
    if (patch.type != null) a.type = String(patch.type).trim() || a.type;
    if (patch.icon != null) a.icon = patch.icon;
    if (patch.color != null) a.color = normalizeColor(patch.color);
    if (patch.opening != null) a.opening = Math.round((+patch.opening || 0) * 100) / 100;
    if (patch.limite !== undefined) {
      var lim = parseFloat(patch.limite);
      if (isFinite(lim) && lim > 0) a.limite = Math.round(lim * 100) / 100;
      else delete a.limite;
    }
    save();
    return a;
  }

  /* Todo lo que cuelga de una cuenta. Se cuenta antes de borrarla para
     poder decir en el aviso qué se va exactamente: «esta cuenta tiene
     cosas» no le sirve a nadie para decidir. */
  function accountUsage(id) {
    var tocaLa = function (x) { return x.accountId === id || x.toAccountId === id; };

    var movs = D.state.transactions.filter(tocaLa);
    var rec = (D.state.recurring || []).filter(tocaLa).length;
    var pend = (D.state.pendientes || []).filter(tocaLa).length;
    var apart = (D.state.apartados || []).filter(function (ap) {
      return ap.accountId === id;
    }).length;

    /* Un traspaso tiene dos cuentas. Al borrar esta, el traspaso se va
       entero y el saldo de la otra cambia también, y eso hay que decirlo:
       es dinero de una cuenta que el usuario no está borrando. */
    var traspasos = movs.filter(function (t) { return t.kind === "transfer"; }).length;

    return {
      transactions: movs.length,
      recurring: rec,
      pendientes: pend,
      apartados: apart,
      traspasos: traspasos,
      total: movs.length + rec + pend + apart
    };
  }

  /* Borrar una cuenta se lleva por delante todo lo suyo, así que por su
     cuenta no borra nada: cuenta lo que hay y lo devuelve para que quien
     llame pregunte. Con `conTodo` ya se ha preguntado y se hace.

     Se va todo junto a propósito. Dejar los movimientos de una cuenta que
     ya no existe descuadraría el saldo total y los dejaría fuera de todas
     las pantallas, que es peor que borrarlos: seguirían contando en las
     cifras sin poder verlos ni arreglarlos. */
  function deleteAccount(id, opciones) {
    if (D.state.accounts.length <= 1) {
      return { ok: false, ultima: true,
               reason: "Tiene que quedar al menos una cuenta." };
    }
    var use = accountUsage(id);
    if (use.total && !(opciones && opciones.conTodo)) {
      return { ok: false, confirmar: true, use: use,
               reason: "Esta cuenta no está vacía." };
    }

    if (use.total) {
      var noTocaLa = function (x) { return x.accountId !== id && x.toAccountId !== id; };
      D.state.transactions = D.state.transactions.filter(noTocaLa);
      if (Array.isArray(D.state.recurring)) D.state.recurring = D.state.recurring.filter(noTocaLa);
      if (Array.isArray(D.state.pendientes)) D.state.pendientes = D.state.pendientes.filter(noTocaLa);
      if (Array.isArray(D.state.apartados)) {
        D.state.apartados = D.state.apartados.filter(function (ap) {
          return ap.accountId !== id;
        });
      }
    }

    D.state.accounts = D.state.accounts.filter(function (a) { return a.id !== id; });
    save();
    return { ok: true, use: use };
  }


  /* --- lo que se lleva el espacio común --- */
  D.accountUsage = accountUsage;
  D.addAccount = addAccount;
  D.deleteAccount = deleteAccount;
  D.slugId = slugId;
  D.updateAccount = updateAccount;
})();
