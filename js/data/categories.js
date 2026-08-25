/* ============================================================
   split — categorías: crear, renombrar y borrar
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;
  var CAT_COLORS = D.CAT_COLORS;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function catExacta() { return D.catExacta.apply(null, arguments); }
  function hijasDe() { return D.hijasDe.apply(null, arguments); }
  function invalidateCats() { return D.invalidateCats.apply(null, arguments); }
  function save() { return D.save.apply(null, arguments); }
  function slugId() { return D.slugId.apply(null, arguments); }

  /* ============================================================
     Categorías
     ============================================================ */

  /* Un emoji puede ocupar varios code points (piel, ZWJ, variación), así
     que no vale con cortar a un carácter: se coge el primer grupo que
     Intl considere una unidad, y si no hay soporte, los 4 primeros. */
  function firstGrapheme(s) {
    var str = String(s == null ? "" : s).trim();
    if (!str) return "";
    try {
      if (typeof Intl !== "undefined" && Intl.Segmenter) {
        var seg = new Intl.Segmenter("es", { granularity: "grapheme" });
        var it = seg.segment(str)[Symbol.iterator]().next();
        return it.done ? "" : it.value.segment;
      }
    } catch (e) { /* motor viejo: se cae al recorte de abajo */ }
    return Array.from(str).slice(0, 4).join("");
  }

  function normalizeColor(v) {
    var n = parseInt(v, 10);
    return (n >= 1 && n <= CAT_COLORS) ? n : 16;
  }

  /* Devuelve un id de madre bueno, o null. Se rechaza lo que rompería el
     único nivel permitido, lo de otro tipo, y ser madre de sí misma. */
  function madreValida(parentId, kind, propioId) {
    if (!parentId) return null;
    if (parentId === propioId) return null;
    var m = catExacta(parentId);
    if (!m || m.kind !== kind || m.parentId) return null;
    /* si ya tiene hijas, no puede meterse dentro de otra */
    if (propioId && hijasDe(propioId).length) return null;
    return m.id;
  }

  function addCategory(data) {
    var kind = data.kind === "in" ? "in" : "out";
    var c = {
      id: slugId("cat", data.name || "categoria"),
      name: (data.name || "Categoría").trim(),
      emoji: firstGrapheme(data.emoji) || "📦",
      color: normalizeColor(data.color),
      kind: kind,
      parentId: madreValida(data.parentId, kind, null)
    };
    /* Una hija hereda el color de su madre: así en un gráfico las tres
       deudas se ven como la misma familia y no como tres cosas sueltas. */
    if (c.parentId) {
      var madre = catExacta(c.parentId);
      if (madre) c.color = madre.color;
    }
    D.state.categories.push(c);
    /* una de gasto nace en el reparto al 0 %: no cambia los presupuestos
       de nadie hasta que se le asigne algo a mano */
    if (kind === "out" && D.state.allocation[c.id] == null) D.state.allocation[c.id] = 0;
    invalidateCats();
    save();
    return c;
  }

  function updateCategory(id, patch) {
    var c = D.state.categories.find(function (x) { return x.id === id; });
    if (!c) return null;
    if (patch.name != null) c.name = String(patch.name).trim() || c.name;
    if (patch.emoji != null) c.emoji = firstGrapheme(patch.emoji) || c.emoji;
    if (patch.color != null) c.color = normalizeColor(patch.color);
    if (patch.parentId !== undefined) {
      c.parentId = madreValida(patch.parentId, c.kind, c.id);
      if (c.parentId) {
        var madre = catExacta(c.parentId);
        if (madre) c.color = madre.color;
      }
    }
    /* Cambiar el color de una madre lo cambia en sus hijas: son la misma
       familia y verlas de distinto color en un gráfico despista. */
    if (patch.color != null && !c.parentId) {
      hijasDe(c.id).forEach(function (h) { h.color = c.color; });
    }
    invalidateCats();
    save();
    return c;
  }

  function categoryUsage(id) {
    var tx = D.state.transactions.filter(function (t) {
      return t.kind !== "transfer" && t.categoryId === id;
    }).length;
    var rec = (D.state.recurring || []).filter(function (r) {
      return r.kind !== "transfer" && r.categoryId === id;
    }).length;
    return { transactions: tx, recurring: rec };
  }

  /* Igual que con las cuentas: no se borra una categoría con movimientos,
     porque dejaría importes sin clasificar y descuadraría los totales por
     categoría. Se avisa de cuántos hay y decide el usuario. */
  function deleteCategory(id) {
    var c = D.state.categories.find(function (x) { return x.id === id; });
    if (!c) return { ok: false, reason: "Esa categoría ya no existe." };

    if (c.sistema) {
      return {
        ok: false,
        reason: "Esta la usa la app al corregir un saldo, así que no se puede borrar."
      };
    }

    var dentro = hijasDe(id);
    if (dentro.length) {
      return {
        ok: false,
        reason: "Tiene " + dentro.length + (dentro.length === 1
                  ? " categoría dentro" : " categorías dentro") +
                ". Sácalas o bórralas antes."
      };
    }

    var quedan = D.state.categories.filter(function (x) {
      return x.kind === c.kind && x.id !== id;
    }).length;
    if (!quedan) {
      return {
        ok: false,
        reason: "Tiene que quedar al menos una categoría de " +
                (c.kind === "in" ? "ingreso" : "gasto") + "."
      };
    }

    var use = categoryUsage(id);
    if (use.transactions || use.recurring) {
      return {
        ok: false,
        reason: "Esta categoría tiene " + use.transactions + " movimiento" +
                (use.transactions === 1 ? "" : "s") +
                (use.recurring ? " y " + use.recurring + " programado" +
                  (use.recurring === 1 ? "" : "s") : "") +
                ". Cámbialos de categoría o bórralos antes."
      };
    }

    D.state.categories = D.state.categories.filter(function (x) { return x.id !== id; });
    delete D.state.allocation[id];
    invalidateCats();
    save();
    return { ok: true };
  }


  /* --- lo que se lleva el espacio común --- */
  D.addCategory = addCategory;
  D.categoryUsage = categoryUsage;
  D.deleteCategory = deleteCategory;
  D.normalizeColor = normalizeColor;
  D.updateCategory = updateCategory;
})();
