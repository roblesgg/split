/* ============================================================
   split — hoja: confirmar un programado
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, C = A.C, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, sheets = A.sheets;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function accName() { return A.accName.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function renderAll() { return A.renderAll.apply(null, arguments); }

  /* ============================================================
     Confirmar un programado antes de apuntarlo

     Un sueldo casi nunca cae clavado. Quien marque «preguntarme el
     importe» no verá el movimiento apuntado solo: al abrir la app se le
     enseña la cifra prevista con el cursor puesto, y con tocar «Apuntar»
     entra tal cual. Se van pasando de uno en uno, que es más fácil de
     entender que una lista con varias casillas.
     ============================================================ */

  function hayPendientes() { return S.pendientes().length > 0; }

  function renderCobro() {
    var cola = S.pendientes();
    var p = cola[0];
    if (!p) { sheets.cobro.close(); return; }

    var esIn = p.kind === "in";
    var body = $("#sheetCobroBody");
    var tarifa = +p.tarifa > 0 ? +p.tarifa : 0;

    $("#sheetCobroTitle").textContent = tarifa
      ? "¿Cuántas horas has echado?"
      : esIn ? "¿Cuánto has cobrado?" : "¿Cuánto ha sido?";

    body.innerHTML =
      (cola.length > 1
        ? '<p class="card__sub" style="text-align:center">Te quedan ' +
            cola.length + ' por confirmar</p>'
        : "") +

      '<div style="text-align:center;padding:var(--sp-3) 0 var(--sp-5)">' +
        '<p class="card__title">' + esc(p.note) + '</p>' +
        '<p class="card__sub" style="margin-top:2px">' +
          esc(S.relDayLabel(p.date)) + ' · ' + esc(accName(p.accountId)) + '</p>' +
      '</div>' +

      (tarifa
        /* Por horas: se piden horas, no euros. Pedir euros obligaría a
           hacer la multiplicación de cabeza cada vez. */
        ? '<div class="field">' +
            '<label class="field__label" for="cobroHoras">Horas</label>' +
            '<div class="input-affix">' +
              '<input type="number" class="field__input field__input--big" id="cobroHoras" ' +
                     'min="0" step="0.25" inputmode="decimal" value="">' +
              '<span class="input-affix__suffix">h</span>' +
            '</div>' +
          '</div>' +
          '<div class="ajuste" id="cobroCalculo" data-dif="cero">' +
            '<span class="ajuste__txt">A ' + esc(money(tarifa)) + ' la hora</span>' +
            '<span class="ajuste__eur" id="cobroTotal">' + esc(money(0)) + '</span>' +
          '</div>'

        : '<div class="field">' +
            '<label class="field__label" for="cobroAmount">Importe</label>' +
            '<div class="input-affix">' +
              '<input type="number" class="field__input field__input--big" id="cobroAmount" ' +
                     'min="0" step="0.01" inputmode="decimal" value="' +
                     (p.amount > 0 ? esc(p.amount) : "") + '">' +
              '<span class="input-affix__suffix">€</span>' +
            '</div>' +
            '<p class="field__hint">' +
              (p.amount > 0
                ? "Lo previsto eran " + esc(money(p.amount)) +
                  ". Cámbialo si esta vez ha sido otra cifra."
                : "No hay una cifra prevista: pon la que te haya quedado.") +
            '</p>' +
          '</div>') +

      '<div class="field" style="margin-top:var(--sp-6)">' +
        '<button type="button" class="btn btn--primary" id="cobroOk">' +
          icon("check", 17) + 'Apuntar</button>' +
      '</div>' +
      '<div class="field">' +
        '<button type="button" class="btn btn--ghost" id="cobroNo" style="width:100%">' +
          (esIn ? "Este mes no lo he cobrado" : "Este mes no lo he pagado") + '</button>' +
      '</div>';

    mountIcons(body);
  }

  /* Siguiente de la cola, o cerrar y repintar si ya no queda ninguno. */
  function seguirCobros() {
    if (hayPendientes()) { renderCobro(); return; }
    sheets.cobro.close();
    renderAll();
  }

  function abrirCobros() {
    if (!hayPendientes()) return;
    renderCobro();
    sheets.cobro.show();
    /* el teclado tapa media pantalla: mejor que no salte solo */
  }

  /* Vuelve a poner las alarmas con lo que haya ahora. Si es el primer
     programado que pide aviso, se pide el permiso: hacerlo antes, sin que
     nadie lo haya pedido, es de las cosas que hacen desinstalar una app. */
  function sincronizarAvisos() {
    if (!window.Avisos || !window.Avisos.hay()) return;

    var quiereAvisos = (S.state.recurring || []).some(function (r) {
      return r.active && r.avisar;
    });

    if (!quiereAvisos) { window.Avisos.sincronizar(S); return; }

    window.Avisos.permitido().then(function (ok) {
      if (ok) return window.Avisos.sincronizar(S);
      return window.Avisos.pedirPermiso().then(function (dado) {
        if (dado) return window.Avisos.sincronizar(S);
        U.toast("Sin permiso de notificaciones no puedo avisarte. " +
                "Se puede dar en los ajustes del móvil.",
                { icon: "warning", duration: 6000 });
      });
    });
  }

  /* ============================================================
     Cableado
     ============================================================ */

  function wire() {
    /* --- confirmar un programado --- */
    var cobroBody = $("#sheetCobroBody");

    cobroBody.addEventListener("click", function (e) {
      var cola = S.pendientes();
      var p = cola[0];
      if (!p) { sheets.cobro.close(); return; }

      if (e.target.closest("#cobroOk")) {
        var importe;
        var horas = $("#cobroHoras", cobroBody);

        if (horas) {
          var h = parseFloat(horas.value);
          if (!(h > 0)) {
            U.toast("Pon cuántas horas has echado", { icon: "warning" });
            return;
          }
          importe = Math.round(h * (+p.tarifa) * 100) / 100;
        } else {
          var campo = $("#cobroAmount", cobroBody);
          importe = campo ? parseFloat(campo.value) : NaN;
        }

        if (!(importe > 0)) {
          U.toast("El importe tiene que ser mayor que cero", { icon: "warning" });
          return;
        }
        S.confirmarPendiente(p.id, importe);
        U.haptic("success");
        U.toast("Apuntado " + money(importe), { icon: "check" });
        seguirCobros();
        return;
      }

      if (e.target.closest("#cobroNo")) {
        S.descartarPendiente(p.id);
        U.haptic("light");
        seguirCobros();
      }
    });

    /* El total se recalcula mientras se teclean las horas, para que se
       vea lo que va a entrar antes de aceptarlo. */
    cobroBody.addEventListener("input", function (e) {
      if (e.target.id !== "cobroHoras") return;
      var p = S.pendientes()[0];
      var total = $("#cobroTotal", cobroBody);
      if (!p || !total) return;
      var h = parseFloat(e.target.value);
      var eur = h > 0 ? Math.round(h * (+p.tarifa) * 100) / 100 : 0;
      total.textContent = money(eur);
      var caja = $("#cobroCalculo", cobroBody);
      if (caja) caja.setAttribute("data-dif", eur > 0 ? "in" : "cero");
    });

    /* Cerrar la hoja no descarta nada: lo que quede sigue en la cola y
       vuelve a preguntarse la próxima vez que se abra la app. */
  }


  /* --- lo que usan otros archivos --- */
  A.abrirCobros = abrirCobros;
  A.hayPendientes = hayPendientes;
  A.sincronizarAvisos = sincronizarAvisos;

  A.wire(wire);
})();
