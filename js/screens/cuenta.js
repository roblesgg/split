/* ============================================================
   split — hoja: una cuenta por dentro
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, ui = A.ui, sheets = A.sheets;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function bigAmount() { return A.bigAmount.apply(null, arguments); }
  function emptyHtml() { return A.emptyHtml.apply(null, arguments); }
  function goTo() { return A.goTo.apply(null, arguments); }
  function nombreCiclo() { return A.nombreCiclo.apply(null, arguments); }
  function limiteHtml() { return A.limiteHtml.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function openAdd() { return A.openAdd.apply(null, arguments); }
  function openDetail() { return A.openDetail.apply(null, arguments); }
  function openForm() { return A.openForm.apply(null, arguments); }
  function txRowHtml() { return A.txRowHtml.apply(null, arguments); }

  /* ============================================================
     Una cuenta por dentro

     Tocar una tarjeta abría directamente el formulario de editar, y eso
     no es lo que uno espera: al tocar tu cuenta quieres VERLA —cuánto
     tienes, qué ha entrado y salido este mes, los últimos movimientos— y
     desde ahí decidir si hay algo que cambiar.
     ============================================================ */

  /* Qué cuenta está abierta por dentro vive en ui.cuentaAbierta. */

  /* Todo lo que ha pasado por esta cuenta, entradas y salidas, con el
     signo visto desde ella: un traspaso que sale resta y el mismo
     traspaso visto desde la cuenta de destino suma. */
  function movimientosDe(accId) {
    return S.state.transactions.filter(function (t) {
      return t.accountId === accId || t.toAccountId === accId;
    });
  }

  function efectoEnCuenta(t, accId) {
    if (t.kind === "transfer") return t.toAccountId === accId ? t.amount : -t.amount;
    return t.kind === "in" ? t.amount : -t.amount;
  }

  function renderCuenta() {
    var a = S.state.accounts.find(function (x) { return x.id === ui.cuentaAbierta; });
    if (!a) { sheets.cuenta.close(); return; }

    var body = $("#sheetCuentaBody");
    var curKey = S.cicloActual();
    var propios = movimientosDe(a.id);

    /* del mes en curso, y separando lo que entra de lo que sale */
    var entra = 0, sale = 0;
    propios.forEach(function (t) {
      if (S.ciclo(t.date) !== curKey) return;
      var e = efectoEnCuenta(t, a.id);
      if (e >= 0) entra += e; else sale += -e;
    });

    var ultimos = propios.slice(0, 5);
    var lim = S.estadoDeLimite(a.id, curKey);
    var uso = S.accountUsage(a.id);

    $("#sheetCuentaTitle").textContent = a.name;

    body.innerHTML =
      /* la misma tarjeta que en el Resumen, para que se vea que es ella */
      '<div class="paycard paycard--suelta" style="--acc-color:' + S.catColorVar(a) + '">' +
        '<div class="paycard__top">' +
          '<span class="paycard__dots"><i></i><i></i><i></i><i></i>' + esc(a.name) + '</span>' +
          '<span class="paycard__type">' + esc(a.type) + '</span>' +
        '</div>' +
        '<div>' +
          '<p class="paycard__label">Saldo</p>' +
          '<p class="paycard__value">' + bigAmount(S.accountBalance(a.id)) + '</p>' +
        '</div>' +
      '</div>' +

      /* Si hay objetivo de gasto, lo primero al abrir la cuenta es cuánto
         te queda: es lo que se viene a mirar. */
      (lim
        ? '<div class="card" style="margin-top:var(--sp-5)">' +
            '<div class="card__head">' +
              '<h3 class="card__title">Tu objetivo de gasto</h3>' +
              '<button type="button" class="card__link" data-form="account" ' +
                'data-form-id="' + esc(a.id) + '">Cambiar</button>' +
            '</div>' +
            limiteHtml(lim, a) +
          '</div>'
        : "") +

      '<p class="field__label" style="margin-top:var(--sp-5)">En ' +
        esc(nombreCiclo(curKey)) + '</p>' +
      '<div class="kpi-row">' +
        '<div class="stat stat--compact stat--quiet">' +
          '<p class="stat__label">Ha entrado</p>' +
          '<p class="stat__value" style="color:var(--money-in)">+ ' +
            esc(S.moneyShort(entra)) + '</p>' +
        '</div>' +
        '<div class="stat stat--compact stat--quiet">' +
          '<p class="stat__label">Ha salido</p>' +
          '<p class="stat__value">− ' + esc(S.moneyShort(sale)) + '</p>' +
        '</div>' +
      '</div>' +

      '<div class="field" style="margin-top:var(--sp-6)">' +
        '<div class="card__head" style="margin-bottom:var(--sp-3)">' +
          '<h3 class="card__title">Últimos movimientos</h3>' +
          (propios.length > 5
            ? '<button type="button" class="card__link" id="cuentaVerTodos">Ver todos</button>'
            : "") +
        '</div>' +
        (ultimos.length
          ? ultimos.map(txRowHtml).join("")
          : emptyHtml("list", "Todavía nada",
              "Los movimientos que apuntes en esta cuenta saldrán aquí.")) +
      '</div>' +

      '<div class="field" style="margin-top:var(--sp-6)">' +
        '<button type="button" class="btn btn--primary" id="cuentaGasto" style="width:100%">' +
          icon("plus", 17) + 'Apuntar aquí un movimiento</button>' +
      '</div>' +
      '<div class="field">' +
        '<button type="button" class="btn btn--ghost" id="cuentaTraspaso" style="width:100%">' +
          icon("swap", 17) + 'Hacer un traspaso</button>' +
      '</div>' +
      '<div class="field" style="display:flex;gap:var(--sp-3)">' +
        /* sin icono: con él «Corregir saldo» se parte en dos líneas y la
           pareja de botones queda descuadrada */
        '<button type="button" class="btn btn--ghost" id="cuentaCorregir" style="flex:1">' +
          'Corregir saldo</button>' +
        '<button type="button" class="btn btn--ghost" id="cuentaEditar" style="flex:1">' +
          icon("edit", 16) + 'Editar</button>' +
      '</div>' +
      '<p class="field__hint" style="text-align:center">' +
        (uso.transactions === 1 ? "1 movimiento" : uso.transactions + " movimientos") +
        (uso.recurring
          ? " · " + (uso.recurring === 1 ? "1 programado" : uso.recurring + " programados")
          : "") + '</p>';

    mountIcons(body);
  }

  function openCuenta(id) {
    ui.cuentaAbierta = id;
    renderCuenta();
    sheets.cuenta.show();
  }

  /* ============================================================
     Cableado
     ============================================================ */

  function wire() {
    /* --- una cuenta por dentro --- */
    var cuentaBody = $("#sheetCuentaBody");

    cuentaBody.addEventListener("click", function (e) {
      var id = ui.cuentaAbierta;
      var node;

      /* un movimiento de la lista abre su detalle, como en cualquier
         otra parte de la app */
      if ((node = e.target.closest("[data-tx]"))) {
        sheets.cuenta.close();
        var txId = node.getAttribute("data-tx");
        setTimeout(function () { openDetail(txId); }, 220);
        return;
      }

      if (e.target.closest("#cuentaGasto")) {
        sheets.cuenta.close();
        setTimeout(function () { openAdd("out", null, { accountId: id }); }, 220);
        return;
      }
      if (e.target.closest("#cuentaTraspaso")) {
        sheets.cuenta.close();
        setTimeout(function () { openAdd("transfer", null, { accountId: id }); }, 220);
        return;
      }
      if (e.target.closest("#cuentaCorregir")) {
        ui.cuentaReturn = id;
        sheets.cuenta.close();
        setTimeout(function () { openForm("saldo", id); }, 220);
        return;
      }
      if (e.target.closest("#cuentaEditar")) {
        ui.cuentaReturn = id;
        sheets.cuenta.close();
        setTimeout(function () { openForm("account", id); }, 220);
        return;
      }
      if (e.target.closest("#cuentaVerTodos")) {
        sheets.cuenta.close();
        ui.movsAccount = id;
        goTo("movs");
      }
    });
  }


  /* --- lo que usan otros archivos --- */
  A.openCuenta = openCuenta;
  A.renderCuenta = renderCuenta;

  A.wire(wire);
})();
