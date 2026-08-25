/* ============================================================
   split — selectores y estadísticas

   Todo lo que se calcula a partir del estado sin guardarse: totales del
   ciclo, series, proyección y tasa de ahorro.

   «Ciclo» y no «mes» a propósito: desde la v12 el mes de la app empieza
   el día que diga el usuario. Con día 1 —lo de fábrica— un ciclo es un
   mes natural y esto calcula exactamente lo mismo que calculaba antes.
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function addMonths() { return D.addMonths.apply(null, arguments); }
  function catById() { return D.catById.apply(null, arguments); }
  function ciclo() { return D.ciclo.apply(null, arguments); }
  function cicloActual() { return D.cicloActual.apply(null, arguments); }
  function diaDeCiclo() { return D.diaDeCiclo.apply(null, arguments); }
  function diasCorridos() { return D.diasCorridos.apply(null, arguments); }
  function diasDeCiclo() { return D.diasDeCiclo.apply(null, arguments); }
  function dowMon() { return D.dowMon.apply(null, arguments); }
  function etiquetaCiclo() { return D.etiquetaCiclo.apply(null, arguments); }
  function parseYmd() { return D.parseYmd.apply(null, arguments); }
  function raizDe() { return D.raizDe.apply(null, arguments); }
  function rangoDeCiclo() { return D.rangoDeCiclo.apply(null, arguments); }
  function ymd() { return D.ymd.apply(null, arguments); }

  /* ============================================================
     Selectores derivados
     ============================================================ */

  function txDeCiclo(key) {
    return D.state.transactions.filter(function (t) { return ciclo(t.date) === key; });
  }

  /* Un traspaso mueve dinero entre cuentas propias: no es ingreso ni
     gasto, así que no entra en ningún total ni en las estadísticas. */
  function totals(list) {
    var inc = 0, out = 0;
    list.forEach(function (t) {
      if (t.kind === "transfer") return;
      if (t.kind === "in") inc += t.amount; else out += t.amount;
    });
    return {
      income: Math.round(inc * 100) / 100,
      expense: Math.round(out * 100) / 100,
      net: Math.round((inc - out) * 100) / 100
    };
  }

  /* saldo total = aperturas + todos los movimientos */
  function balance() {
    var b = D.state.accounts.reduce(function (s, a) { return s + a.opening; }, 0);
    D.state.transactions.forEach(function (t) {
      if (t.kind === "transfer") return;   /* neto cero */
      b += t.kind === "in" ? t.amount : -t.amount;
    });
    return Math.round(b * 100) / 100;
  }

  function accountBalance(accId) {
    var acc = D.state.accounts.find(function (a) { return a.id === accId; });
    var b = acc ? acc.opening : 0;
    D.state.transactions.forEach(function (t) {
      if (t.kind === "transfer") {
        if (t.accountId === accId) b -= t.amount;      /* sale de aquí */
        if (t.toAccountId === accId) b += t.amount;    /* entra aquí */
        return;
      }
      if (t.accountId !== accId) return;
      b += t.kind === "in" ? t.amount : -t.amount;
    });
    return Math.round(b * 100) / 100;
  }

  /* gasto por categoría en un ciclo, ordenado de mayor a menor */
  /* Los totales por categoría suman las hijas dentro de su madre: si
     «Deudas» tiene dentro la del coche y la de la casa, en el gráfico se
     ve «Deudas» con lo de las dos. Para verlas por separado está la lista
     de movimientos, que sí distingue.

     `sinApartados` es para el presupuesto: lo que sale de un sobre ya
     estaba separado y no puede volver a consumir el reparto del sueldo.
     Los gráficos NO lo pasan, porque ahí la pregunta es otra —en qué se
     te va el dinero— y ese gasto existió igual. */
  function byCategory(key, kind, sinApartados) {
    var want = kind || "out";
    var sums = {};
    txDeCiclo(key).forEach(function (t) {
      if (t.kind !== want) return;
      if (sinApartados && t.apartadoId) return;
      var raiz = raizDe(t.categoryId);
      var id = raiz ? raiz.id : t.categoryId;
      sums[id] = (sums[id] || 0) + t.amount;
    });
    return Object.keys(sums).map(function (id) {
      var c = catById(id);
      return {
        id: id,
        name: c.name,
        emoji: c.emoji,
        color: c.color,
        value: Math.round(sums[id] * 100) / 100
      };
    }).sort(function (a, b) { return b.value - a.value; });
  }

  /* serie de los últimos n ciclos */
  function serieDeCiclos(n) {
    var out = [];
    var cur = cicloActual();
    for (var i = n - 1; i >= 0; i--) {
      var key = addMonths(cur, -i);
      var t = totals(txDeCiclo(key));
      out.push({
        key: key,
        label: etiquetaCiclo(key, "short"),
        labelFull: etiquetaCiclo(key),
        income: t.income,
        expense: t.expense,
        net: t.net
      });
    }
    return out;
  }

  /* gasto día a día del ciclo, para el heatmap. Las celdas van seguidas
     desde el primer día del ciclo, así que con un corte a mitad de mes la
     rejilla empieza por el 25 y sigue hasta el 24 del siguiente. */
  function dailySpend(key) {
    var n = diasDeCiclo(key);
    var desde = parseYmd(rangoDeCiclo(key).desde);
    var days = [];
    for (var d = 0; d < n; d++) days.push(0);
    txDeCiclo(key).forEach(function (t) {
      if (t.kind !== "out") return;
      var i = diaDeCiclo(t.date, key) - 1;
      if (i >= 0 && i < n) days[i] += t.amount;
    });
    return days.map(function (v, i) {
      var date = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + i);
      return {
        day: date.getDate(),
        date: ymd(date),
        dow: dowMon(date),
        value: Math.round(v * 100) / 100
      };
    });
  }

  /* tasa de ahorro = neto / ingresos */
  function savingsRate(key) {
    var t = totals(txDeCiclo(key));
    if (t.income <= 0) return 0;
    return (t.net / t.income) * 100;
  }

  /* comercios más frecuentes por importe */
  function topMerchants(key, limit) {
    var sums = {};
    txDeCiclo(key).forEach(function (t) {
      if (t.kind !== "out") return;
      var k = t.note || "Sin concepto";
      if (!sums[k]) sums[k] = { name: k, value: 0, count: 0, categoryId: t.categoryId };
      sums[k].value += t.amount;
      sums[k].count++;
    });
    return Object.keys(sums).map(function (k) {
      var s = sums[k];
      s.value = Math.round(s.value * 100) / 100;
      return s;
    }).sort(function (a, b) { return b.value - a.value; }).slice(0, limit || 5);
  }

  /* media de los ciclos completos anteriores (excluye el que va en curso) */
  function averageExpense(months) {
    var s = serieDeCiclos((months || 6) + 1);
    s.pop();
    if (!s.length) return 0;
    var sum = s.reduce(function (a, m) { return a + m.expense; }, 0);
    return Math.round((sum / s.length) * 100) / 100;
  }

  /* Proyección del cierre del ciclo en curso.
     Extrapolar en línea recta engaña: los gastos fijos (alquiler, cuotas)
     caen al principio, así que al octavo día el ritmo aparente es enorme
     y multiplicarlo por 31 da cifras absurdas.
     En su lugar se mide la *forma* real del gasto: qué fracción del total
     llevabas gastada a esta misma altura del ciclo en los anteriores. Si
     al octavo día sueles llevar el 45 %, lo gastado hasta hoy se divide
     entre 0,45. Así los fijos ya pagados no se duplican. */
  function expenseShapeFraction(key, diaDentro, lookback) {
    var fracs = [];
    for (var i = 1; i <= (lookback || 6); i++) {
      var previo = addMonths(key, -i);
      var list = txDeCiclo(previo).filter(function (t) {
        return t.kind === "out";
      });
      if (!list.length) continue;
      var total = 0, upto = 0;
      list.forEach(function (t) {
        total += t.amount;
        if (diaDeCiclo(t.date, previo) <= diaDentro) upto += t.amount;
      });
      if (total > 0) fracs.push(upto / total);
    }
    if (!fracs.length) return null;
    return fracs.reduce(function (a, b) { return a + b; }, 0) / fracs.length;
  }

  function projectedExpense(key) {
    var dim = diasDeCiclo(key);
    var spent = totals(txDeCiclo(key)).expense;
    if (key !== cicloActual()) return spent;      /* ciclo cerrado: es el dato */

    var elapsed = diasCorridos(key);
    if (elapsed <= 0) return 0;
    if (elapsed >= dim) return spent;

    var f = expenseShapeFraction(key, elapsed, 6);
    /* sin historial suficiente se cae al reparto lineal */
    if (f == null || f < 0.05) return Math.round((spent / elapsed) * dim * 100) / 100;
    return Math.round((spent / f) * 100) / 100;
  }


  /* --- lo que se lleva el espacio común --- */
  D.accountBalance = accountBalance;
  D.averageExpense = averageExpense;
  D.balance = balance;
  D.byCategory = byCategory;
  D.serieDeCiclos = serieDeCiclos;
  D.dailySpend = dailySpend;
  D.expenseShapeFraction = expenseShapeFraction;
  D.projectedExpense = projectedExpense;
  D.savingsRate = savingsRate;
  D.topMerchants = topMerchants;
  D.totals = totals;
  D.txDeCiclo = txDeCiclo;
})();
