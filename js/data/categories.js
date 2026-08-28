/* ============================================================
   split — categorías: crear, renombrar y borrar
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;
  var CAT_COLORS = D.CAT_COLORS;

  /* Puente a lo que vive en otro archivo. Se resuelve en la llamada, así
     que da igual el orden en que se carguen los scripts. */
  function olvidarCategoria() { return D.olvidarCategoria.apply(null, arguments); }

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
    /* Una hija hereda el icono y el color de su madre: son la misma
       cosa contada más fina, y con cara propia parecían tres categorías
       sueltas —en un gráfico y en la lista de dentro— en vez de tres
       maneras de gastar en lo mismo. */
    if (c.parentId) {
      var madre = catExacta(c.parentId);
      if (madre) { c.color = madre.color; c.emoji = madre.emoji; }
    }
    D.state.categories.push(c);
    /* Antes una categoría de gasto nacía en el reparto al 0 %, y salía
       en la lista como una fila de cero euros que nadie había pedido.
       Con los límites no hace falta: se mete en el que corresponda, o en
       ninguno, y lo que no tenga tope se sigue contando igual. */
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
        if (madre) { c.color = madre.color; c.emoji = madre.emoji; }
      }
    }
    /* Cambiar la cara de una madre la cambia en sus hijas: son la misma
       familia, y verlas distintas en un gráfico o en el cajón de dentro
       despista. Meter una en otra hace lo propio, justo arriba. */
    if (!c.parentId) {
      hijasDe(c.id).forEach(function (h) {
        if (patch.color != null) h.color = c.color;
        if (patch.emoji != null) h.emoji = c.emoji;
      });
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
    olvidarCategoria(id);
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
