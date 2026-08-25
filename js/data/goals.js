/* ============================================================
   split — metas de ahorro
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function save() { return D.save.apply(null, arguments); }
  function slugId() { return D.slugId.apply(null, arguments); }

  /* ============================================================
     Metas de ahorro
     ============================================================ */

  function addGoal(data) {
    var g = {
      id: slugId("goal", data.name || "meta"),
      name: (data.name || "Meta").trim(),
      target: Math.max(0, Math.round((+data.target || 0) * 100) / 100),
      saved: Math.max(0, Math.round((+data.saved || 0) * 100) / 100),
      monthly: Math.max(0, Math.round((+data.monthly || 0) * 100) / 100)
    };
    D.state.goals.push(g);
    save();
    return g;
  }

  function updateGoal(id, patch) {
    var g = D.state.goals.find(function (x) { return x.id === id; });
    if (!g) return null;
    if (patch.name != null) g.name = String(patch.name).trim() || g.name;
    ["target", "saved", "monthly"].forEach(function (k) {
      if (patch[k] != null) g[k] = Math.max(0, Math.round((+patch[k] || 0) * 100) / 100);
    });
    save();
    return g;
  }

  function deleteGoal(id) {
    D.state.goals = D.state.goals.filter(function (g) { return g.id !== id; });
    save();
  }


  /* --- lo que se lleva el espacio común --- */
  D.addGoal = addGoal;
  D.deleteGoal = deleteGoal;
  D.updateGoal = updateGoal;
})();
