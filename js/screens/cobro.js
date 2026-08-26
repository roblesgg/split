/* ============================================================
   split — hoja: confirmar un programado
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, C = A.C, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon;
  var ui = A.ui, sheets = A.sheets;

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

  /* Lo que se va tecleando, en céntimos (o en centésimas de hora). Vive
     aparte del estado de datos: es lo que hay a medio escribir. */
  function digitos() {
    if (ui.cobro == null) ui.cobro = "";
    return ui.cobro;
  }

  function valorCobro() {
    var d = digitos();
    return d ? parseInt(d, 10) / 100 : 0;
  }

  /* Lo que se propone al abrir: la media de lo que de verdad ha entrado
     por ese programado. Es la única cifra honesta que hay cuando el
     importe cambia cada vez, y ahorra teclear lo mismo todos los meses.
     Si no hay historial, lo previsto. */
  function propuestaDe(p) {
    var media = p.fromRecurring ? S.mediaCobradaDe(p.fromRecurring) : 0;
    if (media > 0) return { valor: media, deLaMedia: true };
    if (p.amount > 0) return { valor: p.amount, deLaMedia: false };
    return { valor: 0, deLaMedia: false };
  }

  function renderCobro() {
    var cola = S.pendientes();
    var p = cola[0];
    if (!p) { sheets.cobro.close(); return; }

    var esIn = p.kind === "in";
    var body = $("#sheetCobroBody");
    var tarifa = +p.tarifa > 0 ? +p.tarifa : 0;
    var v = valorCobro();
    var total = tarifa ? Math.round(v * tarifa * 100) / 100 : v;
    var prop = propuestaDe(p);

    $("#sheetCobroTitle").textContent = tarifa
      ? "¿Cuántas horas has echado?"
      : esIn ? "¿Cuánto has cobrado?" : "¿Cuánto ha sido?";

    body.innerHTML =
      (cola.length > 1
        ? '<p class="card__sub" style="text-align:center">Te quedan ' +
            cola.length + ' por confirmar</p>'
        : "") +

      '<div style="text-align:center;padding:var(--sp-3) 0 var(--sp-2)">' +
        '<p class="card__title">' + esc(p.note) + '</p>' +
        '<p class="card__sub" style="margin-top:2px">' +
          esc(S.relDayLabel(p.date)) + ' · ' + esc(accName(p.accountId)) + '</p>' +
      '</div>' +

      /* La cifra, grande y en el centro, como al apuntar un movimiento:
         es lo único que se está haciendo en esta pantalla. */
      '<div class="amount-display' + (v === 0 ? " is-zero" : "") + '" id="cobroDisplay" ' +
           'data-kind="' + (esIn ? "in" : "out") + '" aria-live="polite">' +
        '<span class="amount-display__sign">' + (esIn ? "+" : "−") + '</span>' +
        '<span id="cobroTexto">' + esc(S.num2.format(v)) + '</span>' +
        '<span class="amount-display__cur">' + (tarifa ? "h" : "€") + '</span>' +
      '</div>' +

      (tarifa
        /* Por horas se piden horas, no euros: hacer la multiplicación de
           cabeza cada vez es justo lo que la app tiene que ahorrarte. */
        ? '<div class="ajuste" id="cobroCalculo" data-dif="' + (total > 0 ? "in" : "cero") + '">' +
            '<span class="ajuste__txt">A ' + esc(money(tarifa)) + ' la hora</span>' +
            '<span class="ajuste__eur" id="cobroTotal">' + esc(money(total)) + '</span>' +
          '</div>'
        : "") +

      '<div class="keypad" id="cobroKeypad" style="margin-top:var(--sp-4)">' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) {
          return '<button type="button" class="key" data-ckey="' + n + '">' + n + '</button>';
        }).join("") +
        '<button type="button" class="key" data-ckey="00">00</button>' +
        '<button type="button" class="key" data-ckey="0">0</button>' +
        '<button type="button" class="key" data-ckey="del" aria-label="Borrar">' +
          icon("backspace", 18) + '</button>' +
      '</div>' +

      /* La propuesta es un botón, no un valor puesto de oficio: verlo y
         decidir es distinto de encontrártelo escrito y no saber de dónde
         sale. */
      (prop.valor > 0 && v === 0
        ? '<div class="field" style="margin-top:var(--sp-4)">' +
            '<button type="button" class="btn btn--ghost" id="cobroProp" style="width:100%">' +
              (tarifa
                ? "Poner " + esc(S.num2.format(horasDe(prop.valor, tarifa))) + " h, como de costumbre"
                : "Poner " + esc(money(prop.valor)) +
                  (prop.deLaMedia ? ", tu media" : ", lo previsto")) +
            '</button>' +
            '<p class="field__hint">' +
              (prop.deLaMedia
                ? "Es la media de lo que de verdad ha entrado por esto."
                : "Es lo que tenías previsto. Cámbialo si esta vez ha sido otra cifra.") +
            '</p>' +
          '</div>'
        : "") +

      '<div class="field" style="margin-top:var(--sp-5)">' +
        '<button type="button" class="btn btn--primary" id="cobroOk">' +
          icon("check", 17) + 'Apuntar' +
          (total > 0 ? " " + esc(money(total)) : "") + '</button>' +
      '</div>' +
      '<div class="field">' +
        '<button type="button" class="btn btn--ghost" id="cobroNo" style="width:100%">' +
          (esIn ? "Esta vez no lo he cobrado" : "Esta vez no lo he pagado") + '</button>' +
      '</div>';

    mountIcons(body);
  }

  /* Cuántas horas salen de un importe, redondeadas al cuarto de hora, que
     es como se cuentan. */
  function horasDe(importe, tarifa) {
    if (!(tarifa > 0)) return 0;
    return Math.round((importe / tarifa) * 4) / 4;
  }

  /* Repinta solo la cifra y lo que cuelga de ella: repintar la hoja
     entera en cada tecla movería el teclado debajo del dedo. */
  function refreshCobro() {
    var p = S.pendientes()[0];
    if (!p) return;
    var tarifa = +p.tarifa > 0 ? +p.tarifa : 0;
    var v = valorCobro();
    var total = tarifa ? Math.round(v * tarifa * 100) / 100 : v;

    var disp = $("#cobroDisplay");
    var texto = $("#cobroTexto");
    if (texto) texto.textContent = S.num2.format(v);
    if (disp) disp.classList.toggle("is-zero", v === 0);

    var eur = $("#cobroTotal");
    if (eur) eur.textContent = money(total);
    var caja = $("#cobroCalculo");
    if (caja) caja.setAttribute("data-dif", total > 0 ? "in" : "cero");

    /* La propuesta desaparece en cuanto escribes, y el botón de apuntar
       lleva la cifra: hay que repintar la hoja para eso. */
    var prop = $("#cobroProp");
    if ((prop && v > 0) || (!prop && v === 0)) renderCobro();
    else {
      var ok = $("#cobroOk");
      if (ok) {
        ok.innerHTML = icon("check", 17) + "Apuntar" + (total > 0 ? " " + money(total) : "");
      }
    }
  }

  function seguirCobros() {
    if (hayPendientes()) { renderCobro(); return; }
    sheets.cobro.close();
    renderAll();
  }

  function abrirCobros() {
    if (!hayPendientes()) return;
    ui.cobro = "";
    renderCobro();
    sheets.cobro.show();
  }

  /* Vuelve a poner las alarmas con lo que haya ahora. Si es el primer
     programado que pide aviso, se pide el permiso: hacerlo antes, sin que
     nadie lo haya pedido, es de las cosas que hacen desinstalar una app. */
  /* `pedir` solo va en true cuando el usuario acaba de guardar un
     programado que quiere aviso: es el momento en que pedir el permiso se
     entiende. En el arranque no se pide nada —salir de la nada con un
     diálogo de permisos es de las cosas que hacen desinstalar una app—,
     pero sí se reponen las alarmas y se mira si van a llegar a su hora. */
  function sincronizarAvisos(opts) {
    if (!window.Avisos || !window.Avisos.hay()) return;
    var pedir = !!(opts && opts.pedir);

    var quiereAvisos = (S.state.recurring || []).some(function (r) {
      return r.active && r.avisar;
    });

    if (!quiereAvisos) { window.Avisos.sincronizar(S); return; }

    window.Avisos.permitido().then(function (ok) {
      if (ok || !pedir) return ok;
      return window.Avisos.pedirPermiso().then(function (dado) {
        if (dado) return true;
        U.toast("Sin permiso de notificaciones no puedo avisarte. " +
                "Se puede dar en los ajustes del móvil.",
                { icon: "warning", duration: 6000 });
        return false;
      });
    }).then(function (ok) {
      if (!ok) return;
      window.Avisos.sincronizar(S);
      /* Y una segunda comprobación que nadie espera: con el permiso de
         notificar dado, la alarma todavía puede llegar horas tarde si el
         sistema no deja ponerla a su hora. Se avisa una vez, con la forma
         de arreglarlo, y no se vuelve a insistir. */
      return window.Avisos.alarmasExactas().then(function (a) {
        if (a.exactas || !a.sePuedePedir) return;
        if (ui.avisadoDeAlarmas) return;
        ui.avisadoDeAlarmas = true;
        U.toast("Los avisos pueden llegar tarde: el móvil no deja poner la " +
                "alarma a su hora.",
                { icon: "warning", duration: 9000,
                  actionLabel: "Ajustes",
                  onAction: window.Avisos.pedirAlarmasExactas });
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
      var tarifa = +p.tarifa > 0 ? +p.tarifa : 0;
      var node;

      if ((node = e.target.closest("[data-ckey]"))) {
        var k = node.getAttribute("data-ckey");
        if (k === "del") ui.cobro = digitos().slice(0, -1);
        else if (digitos().length < 9) {
          ui.cobro = (digitos() + k).replace(/^0+(?=\d)/, "");
        }
        refreshCobro();
        U.haptic("light");
        return;
      }

      if (e.target.closest("#cobroProp")) {
        var prop = propuestaDe(p);
        var valor = tarifa ? horasDe(prop.valor, tarifa) : prop.valor;
        ui.cobro = String(Math.round(valor * 100));
        renderCobro();
        U.haptic("light");
        return;
      }

      if (e.target.closest("#cobroOk")) {
        var v = valorCobro();
        if (!(v > 0)) {
          U.toast(tarifa ? "Pon cuántas horas has echado" : "Pon cuánto ha sido",
                  { icon: "warning" });
          return;
        }
        var importe = tarifa ? Math.round(v * tarifa * 100) / 100 : v;
        S.confirmarPendiente(p.id, importe);
        U.haptic("success");
        U.toast("Apuntado " + money(importe), { icon: "check" });
        ui.cobro = "";
        seguirCobros();
        return;
      }

      if (e.target.closest("#cobroNo")) {
        S.descartarPendiente(p.id);
        U.haptic("light");
        ui.cobro = "";
        seguirCobros();
      }
    });

    /* En escritorio hay teclado de verdad: teclearlo tiene que funcionar
       igual que las teclas de la pantalla. */
    document.addEventListener("keydown", function (e) {
      if (!sheets.cobro || !sheets.cobro.open) return;
      if (document.activeElement &&
          /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (/^[0-9]$/.test(e.key)) {
        if (digitos().length < 9) {
          ui.cobro = (digitos() + e.key).replace(/^0+(?=\d)/, "");
        }
        refreshCobro();
      } else if (e.key === "Backspace") {
        ui.cobro = digitos().slice(0, -1);
        refreshCobro();
      } else if (e.key === "Enter") {
        var ok = $("#cobroOk");
        if (ok) ok.click();
      }
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
