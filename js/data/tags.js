/* ============================================================
   split — etiquetas
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function save() { return D.save.apply(null, arguments); }
  function slugId() { return D.slugId.apply(null, arguments); }

  /* ============================================================
     Etiquetas — subcategorías libres que cuelgan del movimiento
     ============================================================ */

  /* Son transversales a la categoría: "Vacaciones" puede caer en Comida y
     en Transporte a la vez. Por eso van aparte y un movimiento puede
     llevar varias. */
  function addTag(name) {
    var limpio = String(name == null ? "" : name).trim().slice(0, 24);
    if (!limpio) return null;
    var ya = D.state.tags.find(function (t) {
      return t.name.toLowerCase() === limpio.toLowerCase();
    });
    if (ya) return ya;
    var tag = { id: slugId("tag", limpio), name: limpio };
    D.state.tags.push(tag);
    save();
    return tag;
  }

  function tagById(id) {
    return D.state.tags.find(function (t) { return t.id === id; }) || null;
  }

  function tagUsage(id) {
    return D.state.transactions.filter(function (t) {
      return Array.isArray(t.tags) && t.tags.indexOf(id) >= 0;
    }).length;
  }

  /* Borrar una etiqueta sí puede hacerse siempre: no descuadra ningún
     importe, solo se cae de los movimientos que la llevaban. */
  function deleteTag(id) {
    D.state.tags = D.state.tags.filter(function (t) { return t.id !== id; });
    D.state.transactions.forEach(function (t) {
      if (Array.isArray(t.tags) && t.tags.indexOf(id) >= 0) {
        t.tags = t.tags.filter(function (x) { return x !== id; });
      }
    });
    save();
  }


  /* --- lo que se lleva el espacio común --- */
  D.addTag = addTag;
  D.deleteTag = deleteTag;
  D.tagById = tagById;
  D.tagUsage = tagUsage;
})();
