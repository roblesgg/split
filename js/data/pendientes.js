/* ============================================================
   split — la cola de lo que hay que confirmar

   Lo que no se apunta solo porque el importe no se sabe hasta que llega.
   Aquí se guarda esperando a que el usuario diga cuánto ha sido.
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;
  var eur = D.eur;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function accountBalance() { return D.accountBalance.apply(null, arguments); }
  function addMonths() { return D.addMonths.apply(null, arguments); }
  function addTx() { return D.addTx.apply(null, arguments); }
  function currentMonthKey() { return D.currentMonthKey.apply(null, arguments); }
  function dateOfMonth() { return D.dateOfMonth.apply(null, arguments); }
  function diasDe() { return D.diasDe.apply(null, arguments); }
  function dowMon() { return D.dowMon.apply(null, arguments); }
  function esAbierto() { return D.esAbierto.apply(null, arguments); }
  function esSemanal() { return D.esSemanal.apply(null, arguments); }
  function save() { return D.save.apply(null, arguments); }
  function sortTx() { return D.sortTx.apply(null, arguments); }
  function totals() { return D.totals.apply(null, arguments); }
  function ymd() { return D.ymd.apply(null, arguments); }

  /* ---------- cola de confirmación ---------- */

  function pendientes() {
    return Array.isArray(D.state.pendientes) ? D.state.pendientes : [];
  }

  /* Se acepta con el importe que diga el usuario, que para eso se pregunta. */
  function confirmarPendiente(id, importe) {
    var i = D.state.pendientes.findIndex(function (p) { return p.id === id; });
    if (i < 0) return null;
    var mov = D.state.pendientes.splice(i, 1)[0];
    if (importe != null && isFinite(+importe) && +importe > 0) {
      mov.amount = Math.round(Math.abs(+importe) * 100) / 100;
    }
    D.state.transactions.push(mov);
    sortTx();
    save();
    return mov;
  }

  /* Descartar no reprograma nada: el mes que viene volverá a tocar. */
  function descartarPendiente(id) {
    D.state.pendientes = D.state.pendientes.filter(function (p) { return p.id !== id; });
    save();
  }

  /* próxima fecha en que se apuntará */
  function nextDue(r) {
    var hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (esSemanal(r)) {
      var dias = diasDe(r);
      var d = new Date(hoy);
      var guard = 0;
      while (dias.indexOf(dowMon(d)) < 0 && guard++ < 8) d.setDate(d.getDate() + 1);
      return d;
    }

    var cur = currentMonthKey();
    var m = r.lastPosted ? addMonths(r.lastPosted, 1) : cur;
    if (m < cur) m = cur;
    var f = dateOfMonth(m, r.day);
    if (f < hoy) f = dateOfMonth(addMonths(m, 1), r.day);
    return f;
  }

  function upcomingRecurring(limit) {
    return (D.state.recurring || [])
      .filter(function (r) { return r.active; })
      .map(function (r) { return { r: r, due: nextDue(r) }; })
      .sort(function (a, b) { return a.due - b.due; })
      .slice(0, limit || 4);
  }

  /* Lo que supone al mes un programado, sea cual sea su ritmo.
     Semanal: hay 52 semanas en el año, no 48, así que cuatro pagos al mes
     se quedan cortos; se reparte 52/12.
     Catorce pagas: las dos extras también se reparten, para que el mes de
     junio no parezca de golpe un sueldazo y los demás una miseria. */
  /* Cuántas letras faltan. null si no es de cuotas contadas. */
  function cuotasQueQuedan(r) {
    if (!r.cuotas) return null;
    return Math.max(0, r.cuotas - (r.pagadas || 0));
  }

  function mensualizar(r) {
    var base = +r.amount || 0;

    /* Sin importe fijo, `amount` es solo una estimación que el usuario
       puede haber dejado a cero. Entonces se mira lo que de verdad se ha
       cobrado por ese programado en los últimos meses: es la única cifra
       honesta que hay. */
    if (esAbierto(r) && base <= 0) base = mediaCobradaDe(r.id);

    if (esSemanal(r)) return base * 52 / 12;
    if (r.kind === "in" && +r.pagas === 14) return base * 14 / 12;
    return base;
  }

  /* Media por vencimiento de lo realmente apuntado desde un programado.
     Con menos de dos apuntes no se inventa nada: se devuelve 0. */
  function mediaCobradaDe(recId) {
    var suyos = D.state.transactions.filter(function (t) {
      return t.fromRecurring === recId;
    });
    if (suyos.length < 2) return 0;
    var suma = suyos.reduce(function (a, t) { return a + t.amount; }, 0);
    return Math.round((suma / suyos.length) * 100) / 100;
  }

  /* cuánto compromete al mes lo que está programado */
  function recurringMonthly() {
    var out = 0, inc = 0, moved = 0;
    (D.state.recurring || []).forEach(function (r) {
      if (!r.active) return;
      var m = mensualizar(r);
      if (r.kind === "out") out += m;
      else if (r.kind === "in") inc += m;
      else moved += m;
    });
    return {
      expense: Math.round(out * 100) / 100,
      income: Math.round(inc * 100) / 100,
      transfer: Math.round(moved * 100) / 100
    };
  }

  /* ---------- las tres cifras del Resumen ----------
     Ingresos, gastos y ahorro son «del mes y de todas las cuentas» por
     defecto, que es lo que quiere ver casi todo el mundo casi siempre.
     Pero no todo el mundo: hay quien lleva una cuenta de gastos comunes
     aparte y no quiere que le ensucie sus números, y hay quien mira el
     año, no el mes.

     Se guarda en el estado, no en memoria: si lo cambias es porque así lo
     quieres ver, no solo esta vez. */

  var RESUMEN_POR_DEFECTO = { cuentas: null, periodo: "mes", dias: 30 };

  function resumenCfg() {
    var c = D.state.resumen || {};

    /* null = todas. Se quitan las que ya no existan, y si al quitarlas no
       queda ninguna se vuelve a «todas»: una lista vacía dejaría las tres
       cifras a cero sin que nadie entienda por qué. */
    var elegidas = Array.isArray(c.cuentas)
      ? c.cuentas.filter(function (id) {
          return D.state.accounts.some(function (a) { return a.id === id; });
        })
      : null;

    return {
      cuentas: elegidas && elegidas.length ? elegidas : null,
      periodo: ["mes", "ano", "dias", "todo"].indexOf(c.periodo) >= 0 ? c.periodo : "mes",
      dias: Math.min(3650, Math.max(1, parseInt(c.dias, 10) || 30))
    };
  }

  function setResumen(patch) {
    D.state.resumen = Object.assign({}, resumenCfg(), patch);
    save();
  }

  /* Desde qué fecha cuenta. null = desde siempre. */
  function desdeDelResumen(cfg) {
    var hoy = new Date();
    if (cfg.periodo === "todo") return null;
    if (cfg.periodo === "ano") return ymd(new Date(hoy.getFullYear(), 0, 1));
    if (cfg.periodo === "dias") {
      var d = new Date(hoy);
      d.setDate(d.getDate() - (cfg.dias - 1));
      return ymd(d);
    }
    return ymd(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  }

  function txDelResumen() {
    var cfg = resumenCfg();
    var desde = desdeDelResumen(cfg);
    var hasta = ymd(new Date());

    return D.state.transactions.filter(function (t) {
      if (desde && (t.date < desde || t.date > hasta)) return false;
      if (!cfg.cuentas) return true;
      /* de un traspaso solo cuenta la punta que esté dentro del filtro, y
         como los traspasos no son ni ingreso ni gasto, da igual: totals()
         ya los ignora */
      return cfg.cuentas.indexOf(t.accountId) >= 0 ||
             (t.toAccountId && cfg.cuentas.indexOf(t.toAccountId) >= 0);
    });
  }

  function totalesResumen() { return totals(txDelResumen()); }

  /* Cómo se lee el filtro puesto, para escribirlo debajo de las cifras. */
  function etiquetaResumen() {
    var cfg = resumenCfg();
    var cuando = cfg.periodo === "ano" ? "Este año"
               : cfg.periodo === "todo" ? "Desde el principio"
               : cfg.periodo === "dias" ? "Últimos " + cfg.dias + " días"
               : "Este mes";

    if (!cfg.cuentas) return cuando;
    if (cfg.cuentas.length === 1) {
      var a = D.state.accounts.find(function (x) { return x.id === cfg.cuentas[0]; });
      return cuando + " · " + (a ? a.name : "una cuenta");
    }
    return cuando + " · " + cfg.cuentas.length + " cuentas";
  }

  /* ---------- corregir el saldo ----------
     A todos se nos escapa algún gasto: pagas un café en efectivo, no lo
     apuntas, y al cabo del mes la app dice una cifra y el banco otra. En
     vez de ponerse a buscar qué falta, se dice cuánto hay de verdad y la
     app apunta la diferencia como un movimiento más, con su fecha y su
     categoría. Así el saldo cuadra y queda constancia de cuánto se ha
     escapado, que es un dato que interesa. */

  function corregirSaldo(accId, saldoReal) {
    var acc = D.state.accounts.find(function (a) { return a.id === accId; });
    if (!acc) return null;

    var real = Math.round((+saldoReal || 0) * 100) / 100;
    var actual = accountBalance(accId);
    var dif = Math.round((real - actual) * 100) / 100;

    /* ya cuadraba: no se apunta un movimiento de cero euros */
    if (Math.abs(dif) < 0.005) return { dif: 0, tx: null };

    var entra = dif > 0;
    var tx = addTx({
      date: ymd(new Date()),
      time: "",
      kind: entra ? "in" : "out",
      amount: Math.abs(dif),
      categoryId: entra ? "ajusteIn" : "ajuste",
      accountId: accId,
      note: "Ajuste de saldo",
      memo: "Corrección para cuadrar con " + eur.format(real) + " en " + acc.name + "."
    });

    return { dif: dif, tx: tx };
  }


  /* --- lo que se lleva el espacio común --- */
  D.RESUMEN_POR_DEFECTO = RESUMEN_POR_DEFECTO;
  D.confirmarPendiente = confirmarPendiente;
  D.corregirSaldo = corregirSaldo;
  D.cuotasQueQuedan = cuotasQueQuedan;
  D.descartarPendiente = descartarPendiente;
  D.etiquetaResumen = etiquetaResumen;
  D.mediaCobradaDe = mediaCobradaDe;
  D.mensualizar = mensualizar;
  D.nextDue = nextDue;
  D.pendientes = pendientes;
  D.recurringMonthly = recurringMonthly;
  D.resumenCfg = resumenCfg;
  D.setResumen = setResumen;
  D.totalesResumen = totalesResumen;
  D.upcomingRecurring = upcomingRecurring;
})();
