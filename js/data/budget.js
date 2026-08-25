/* ============================================================
   split — ingresos y reparto del sueldo
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function addMonths() { return D.addMonths.apply(null, arguments); }
  function categoriesOf() { return D.categoriesOf.apply(null, arguments); }
  function cicloActual() { return D.cicloActual.apply(null, arguments); }
  function mensualizar() { return D.mensualizar.apply(null, arguments); }
  function pct() { return D.pct.apply(null, arguments); }
  function save() { return D.save.apply(null, arguments); }
  function totals() { return D.totals.apply(null, arguments); }
  function txDeCiclo() { return D.txDeCiclo.apply(null, arguments); }

  /* ---------- ingresos y reparto ---------- */

  /* Media de lo que ha entrado de verdad en los últimos ciclos cerrados.
     Se excluye el que va en curso porque va a medias y tiraría la media
     hacia abajo. Un ciclo con paga extra o con más horas sube la media
     solo, sin tener que declarar nada. */
  function averageIncome(months) {
    var n = Math.max(1, months || 3);
    var cur = cicloActual();
    var suma = 0, contados = 0;
    for (var i = 1; i <= n; i++) {
      var key = addMonths(cur, -i);
      var t = totals(txDeCiclo(key));
      /* un ciclo sin ningún ingreso no cuenta: normalmente es que aún no
         usabas la app, y meterlo como cero hundiría la media */
      if (t.income > 0) { suma += t.income; contados++; }
    }
    if (!contados) return 0;
    return Math.round((suma / contados) * 100) / 100;
  }

  /* Suma de los ingresos programados, ya repartidos al mes. Es lo que
     cobras "de nómina": no cuenta lo que apuntes a mano por tu cuenta. */
  function declaredIncome() {
    var total = 0;
    (D.state.recurring || []).forEach(function (r) {
      if (r.active && r.kind === "in") total += mensualizar(r);
    });
    return Math.round(total * 100) / 100;
  }

  var INCOME_MODES = ["auto", "manual", "trabajos"];

  /* Cuánto hay para repartir este ciclo. */
  function plannedIncome() {
    var i = D.state.income || { mode: "auto", manual: 0, months: 3 };

    if (i.mode === "manual") return Math.max(0, +i.manual || 0);

    if (i.mode === "trabajos") {
      var d = declaredIncome();
      /* si todavía no hay ningún ingreso programado no se deja el reparto
         a cero: se cae a la media real, y de ahí a la cifra manual */
      if (d > 0) return d;
    }

    var media = averageIncome(i.months);
    /* sin historial todavía, cae a la cifra manual para no dejar los
       presupuestos a cero el primer mes */
    return media > 0 ? media : Math.max(0, +i.manual || 0);
  }

  function setIncome(patch) {
    D.state.income = Object.assign({}, D.state.income, patch);
    if (INCOME_MODES.indexOf(D.state.income.mode) < 0) D.state.income.mode = "auto";
    D.state.income.manual = Math.max(0, +D.state.income.manual || 0);
    D.state.income.months = Math.min(12, Math.max(1, parseInt(D.state.income.months, 10) || 3));
    save();
  }

  function allocationSum() {
    return Object.keys(D.state.allocation).reduce(function (s, k) {
      return s + (D.state.allocation[k] || 0);
    }, 0);
  }

  /* lo que no se reparte entre categorías es ahorro */
  function savingsPct() {
    return Math.max(0, 100 - allocationSum());
  }

  function setAllocation(catId, pct) {
    D.state.allocation[catId] = Math.max(0, Math.min(100, Math.round(pct)));
    save();
  }

  /* La gente piensa en euros, no en porcentajes: «doscientos al mes de
     comida». Por dentro se sigue guardando el porcentaje, que es lo que
     hace que el presupuesto se ajuste solo cuando cambia el ingreso. */
  function setAllocationEuros(catId, euros) {
    var base = plannedIncome();
    if (!(base > 0)) return false;
    var pct = Math.max(0, Math.min(100, Math.round((+euros || 0) / base * 100)));
    D.state.allocation[catId] = pct;
    save();
    return true;
  }

  /* Quitar una categoría del presupuesto no es lo mismo que ponerla a
     cero: deja de aparecer en la lista. */
  function removeAllocation(catId) {
    delete D.state.allocation[catId];
    save();
  }

  /* Las que aún no están presupuestadas, para poder añadirlas. */
  function unbudgetedCategories() {
    return categoriesOf("out").filter(function (c) {
      return !c.sistema && D.state.allocation[c.id] == null;
    });
  }

  /* Las que sí, en el orden en que se pusieron. */
  function budgetedCategories() {
    return categoriesOf("out").filter(function (c) {
      return D.state.allocation[c.id] != null;
    });
  }

  /* Vaciarlo, no volver a un reparto de fábrica: el presupuesto es de
     quien lo hace, y empezar de cero es una opción legítima. */
  function resetAllocation() {
    D.state.allocation = {};
    save();
  }

  /* presupuesto en euros derivado del porcentaje */
  function budgetFor(catId) {
    var pct = (D.state.allocation || {})[catId] || 0;
    return Math.round((pct / 100) * plannedIncome());
  }

  function budgetTotal() {
    return Object.keys(D.state.allocation).reduce(function (s, k) {
      return s + budgetFor(k);
    }, 0);
  }

  function addGoalSaving(goalId, amount) {
    var g = D.state.goals.find(function (x) { return x.id === goalId; });
    if (!g) return null;
    g.saved = Math.max(0, Math.round((g.saved + amount) * 100) / 100);
    save();
    return g;
  }


  /* --- lo que se lleva el espacio común --- */
  D.addGoalSaving = addGoalSaving;
  D.allocationSum = allocationSum;
  D.averageIncome = averageIncome;
  D.budgetFor = budgetFor;
  D.budgetTotal = budgetTotal;
  D.budgetedCategories = budgetedCategories;
  D.declaredIncome = declaredIncome;
  D.plannedIncome = plannedIncome;
  D.removeAllocation = removeAllocation;
  D.resetAllocation = resetAllocation;
  D.savingsPct = savingsPct;
  D.setAllocation = setAllocation;
  D.setAllocationEuros = setAllocationEuros;
  D.setIncome = setIncome;
  D.unbudgetedCategories = unbudgetedCategories;
})();
