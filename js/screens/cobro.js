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

  function hayPendientes() { return S.pendientesDeHoy().length > 0; }

  /* Cuál se está confirmando.

     Normalmente el primero de la cola de hoy. Pero se puede pedir uno
     concreto —`ui.cobroId`—, y ese se abre aunque esté aplazado: aplazar
     es «no me preguntes», no «no me dejes». Si lo aplazado no se pudiera
     abrir a mano, aplazar sería una trampa cuya única salida es esperar
     al día que dijiste. */
  function cobroActual() {
    if (ui.cobroId) {
      var suyo = S.pendientes().find(function (x) { return x.id === ui.cobroId; });
      if (suyo) return suyo;
      ui.cobroId = null;          /* ya no está: se sigue con la cola */
    }
    return S.pendientesDeHoy()[0] || null;
  }

  /* Lo que se va tecleando —"12", "12," o "12,5"— en euros, o en horas
     si el programado va por tarifa. Vive aparte del estado de datos: es
     lo que hay a medio escribir. La regla de teclado es la misma que al
     apuntar un gasto y vive en un solo sitio, app/importe.js. */
  function digitos() {
    if (ui.cobro == null) ui.cobro = "";
    return ui.cobro;
  }

  /* La cifra viene escrita, no en blanco.

     Antes se ofrecía en un botón —«poner 1.600 €»— para que la vieras y
     decidieras en vez de encontrártela puesta sin saber de dónde salía.
     Pero el botón estaba por debajo del teclado, y el caso normal, con
     diferencia, es que hayas cobrado exactamente lo previsto: teclear
     1600 todos los meses teniendo la cifra delante no lo justifica.

     Así que se pone, y debajo se dice de dónde sale, que era lo que el
     botón protegía. La primera tecla la borra entera y empieza de cero,
     como cuando un campo viene seleccionado: si vas a escribir otra
     cifra, escribirla tiene que costar lo mismo que antes. */
  /* Los plazos que se ofrecen. Cuatro, que es lo que cabe en una fila y
     cubre lo que pasa de verdad: mañana, pasado, el lunes que viene. */
  var APLAZOS = [[1, "Mañana"], [2, "En 2 días"], [3, "En 3 días"], [7, "En una semana"]];

  function ponerPropuesta(p) {
    var prop = propuestaDe(p);
    ui.cobro = prop.valor > 0
      ? A.importeDesde(+p.tarifa > 0 ? horasDe(prop.valor, +p.tarifa) : prop.valor)
      : "";
    ui.cobroPuesto = !!ui.cobro;
  }

  function valorCobro() { return A.valorImporte(digitos()); }

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
    var cola = S.pendientesDeHoy();
    var p = cobroActual();
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
      '<div class="amount-display' + (digitos() ? "" : " is-zero") + '" id="cobroDisplay" ' +
           'data-kind="' + (esIn ? "in" : "out") + '" aria-live="polite">' +
        '<span class="amount-display__sign">' + (esIn ? "+" : "−") + '</span>' +
        '<span id="cobroTexto">' + esc(A.textoImporte(digitos())) + '</span>' +
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
        '<button type="button" class="key key--coma" data-ckey="," aria-label="Coma decimal">,</button>' +
        '<button type="button" class="key" data-ckey="0">0</button>' +
        '<button type="button" class="key" data-ckey="del" aria-label="Borrar">' +
          icon("backspace", 18) + '</button>' +
      '</div>' +

      /* De dónde sale la cifra que ya está puesta. Es lo que antes
         protegía el botón de la propuesta: que no te encuentres un número
         escrito sin saber quién lo ha puesto. */
      (ui.cobroPuesto && prop.valor > 0
        ? '<p class="field__hint" id="cobroProp" style="text-align:center;margin-top:var(--sp-3)">' +
            (prop.deLaMedia
              ? "Es tu media de lo cobrado. Teclea si esta vez ha sido otra cifra."
              : "Es lo que tenías previsto. Teclea si esta vez ha sido otra cifra.") +
          '</p>'
        : "") +

      /* Para qué mes es. La misma pregunta que al apuntar un ingreso a
         mano, porque esto es apuntar un ingreso: aquí llega el sueldo del
         día 25. Viene contestada con lo que dijera el programado, así que
         quien ya lo tenga marcado no tiene que volver a decidir nada. */
      A.preguntaMesHtml(mesDelCobro(p), "cobro") +

      '<div class="field" style="margin-top:var(--sp-5)">' +
        '<button type="button" class="btn btn--primary" id="cobroOk">' +
          icon("check", 17) + 'Apuntar' +
          (total > 0 ? " " + esc(money(total)) : "") + '</button>' +
      '</div>' +
      /* Dos salidas distintas y hay que poder distinguirlas de un
         vistazo: «todavía no» es un «pregúntame en unos días», y «este
         mes no» es un «este ya no va a llegar, olvídalo». Confundirlas
         cuesta o un sueldo fantasma o un sueldo perdido. */
      (ui.cobroAplazar
        ? '<div class="field">' +
            '<p class="field__hint" style="text-align:center">' +
              '¿Cuándo te lo vuelvo a preguntar?</p>' +
            '<div class="chips chips--aplazo" style="margin-top:var(--sp-3)">' +
              APLAZOS.map(function (a) {
                return '<button type="button" class="chip" data-aplazo="' + a[0] + '">' +
                       esc(a[1]) + '</button>';
              }).join("") +
            '</div>' +
          '</div>'
        : '<div class="field">' +
            '<button type="button" class="btn btn--ghost" id="cobroLuego" style="width:100%">' +
              icon("clock", 15) +
              (esIn ? "Todavía no lo he cobrado" : "Todavía no lo he pagado") + '</button>' +
          '</div>') +

      '<div class="field">' +
        '<button type="button" class="btn btn--ghost" id="cobroNo" style="width:100%">' +
          (esIn ? "Este mes no lo voy a cobrar" : "Este mes no lo voy a pagar") + '</button>' +
      '</div>';

    mountIcons(body);
    A.colocarMesThumb(body, mesDelCobro(p), "cobro");
  }

  /* Lo que el bloque de la pregunta necesita saber del pendiente: de qué
     tipo es, de qué día y para qué mes va por ahora. `ui.cobroCiclo` es
     lo que se haya tocado en esta hoja; mientras no se toque nada manda
     lo que trajera el pendiente. */
  function mesDelCobro(p) {
    return {
      kind: p.kind,
      date: p.date,
      ciclo: ui.cobroCiclo !== undefined ? ui.cobroCiclo : (p.ciclo || "")
    };
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
    var p = cobroActual();
    if (!p) return;
    var tarifa = +p.tarifa > 0 ? +p.tarifa : 0;
    var v = valorCobro();
    var total = tarifa ? Math.round(v * tarifa * 100) / 100 : v;

    var disp = $("#cobroDisplay");
    var texto = $("#cobroTexto");
    if (texto) texto.textContent = A.textoImporte(digitos());
    /* Apagado mientras no hayas escrito nada, no mientras valga cero. */
    if (disp) disp.classList.toggle("is-zero", !digitos());

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

  /* Lo que se ha contestado de este cobro se va con él: el siguiente de
     la cola es otro movimiento, con su cifra y su mes. Arrastrar lo
     anterior apuntaría el sueldo de uno con el importe del otro. */
  function limpiarCobro() {
    ui.cobroId = null;
    ui.cobro = "";
    ui.cobroPuesto = false;
    ui.cobroCiclo = undefined;
    ui.cobroAplazar = false;
  }

  function seguirCobros() {
    limpiarCobro();
    var p = cobroActual();
    if (p) { ponerPropuesta(p); renderCobro(); return; }
    sheets.cobro.close();
    renderAll();
  }

  /* `id` abre ese en concreto —viene de tocarlo en Movimientos—; sin él,
     el primero que toque hoy. */
  function abrirCobros(id) {
    limpiarCobro();
    ui.cobroId = id || null;
    var p = cobroActual();
    if (!p) { ui.cobroId = null; return; }
    ponerPropuesta(p);
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
      var p = cobroActual();
      if (!p) { sheets.cobro.close(); return; }
      var tarifa = +p.tarifa > 0 ? +p.tarifa : 0;
      var node;

      if ((node = e.target.closest("[data-ckey]"))) {
        var tecla = node.getAttribute("data-ckey");
        /* Con la cifra puesta de oficio, escribir empieza de cero: si no,
           teclear un 5 sobre «1.600» daría 16.005, que no es lo que nadie
           quiere. Borrar sí borra de la puesta, dígito a dígito, por si
           solo hay que quitarle un cero. */
        if (ui.cobroPuesto && tecla !== "del") ui.cobro = "";
        ui.cobroPuesto = false;
        ui.cobro = A.teclaImporte(digitos(), tecla);
        renderCobro();
        U.haptic("light");
        return;
      }

      /* Todavía no ha llegado: se pregunta cuándo volver a preguntar. */
      if (e.target.closest("#cobroLuego")) {
        ui.cobroAplazar = true;
        renderCobro(); U.haptic("light");
        return;
      }

      if ((node = e.target.closest("[data-aplazo]"))) {
        var dias = parseInt(node.getAttribute("data-aplazo"), 10) || 1;
        S.aplazarPendiente(p.id, dias);
        U.haptic("light");
        U.toast(dias === 1 ? "Te lo pregunto mañana"
                           : "Te lo pregunto en " + dias + " días", { icon: "clock" });
        limpiarCobro();
        seguirCobros();
        return;
      }

      var nodo = e.target.closest("[data-dciclo]");
      if (nodo) {
        var mes = nodo.getAttribute("data-dciclo");
        ui.cobroCiclo = mes === S.ciclo(p.date) ? "" : mes;
        renderCobro(); U.haptic("light");
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
        S.confirmarPendiente(p.id, importe, mesDelCobro(p).ciclo);
        U.haptic("success");
        U.toast("Apuntado " + money(importe), { icon: "check" });
        limpiarCobro();
        seguirCobros();
        return;
      }

      if (e.target.closest("#cobroNo")) {
        S.descartarPendiente(p.id);
        U.haptic("light");
        limpiarCobro();
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
        ui.cobro = A.teclaImporte(digitos(), e.key);
        refreshCobro();
      } else if (e.key === "," || e.key === ".") {
        ui.cobro = A.teclaImporte(digitos(), ",");
        refreshCobro();
      } else if (e.key === "Backspace") {
        ui.cobro = A.teclaImporte(digitos(), "del");
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
