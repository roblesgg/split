/* ============================================================
   split — hoja: formulario de cuentas, metas y programados

   Abrir, guardar, borrar y el cableado. Lo que pinta está al lado, en
   form-render.js.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, C = A.C, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, ui = A.ui, sheets = A.sheets;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function abrirCobros() { return A.abrirCobros.apply(null, arguments); }
  function hayPendientes() { return A.hayPendientes.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function deleteForm() { return A.deleteForm.apply(null, arguments); }
  function renderAddSheet() { return A.renderAddSheet.apply(null, arguments); }
  function renderAll() { return A.renderAll.apply(null, arguments); }
  function renderCuenta() { return A.renderCuenta.apply(null, arguments); }
  function renderForm() { return A.renderForm.apply(null, arguments); }
  function saveForm() { return A.saveForm.apply(null, arguments); }
  function sincronizarAvisos() { return A.sincronizarAvisos.apply(null, arguments); }

  /* ============================================================
     Sheet de formulario: cuentas, metas y programados
     ============================================================ */

  /* El formulario trabaja siempre sobre un borrador en memoria. Leer los
     valores del DOM al guardar fallaba al repintar (por ejemplo al
     cambiar el tipo de un programado, que cambia qué campos existen). */
  /* El formulario abierto vive en ui.form: { type, id, d }. */

  function openForm(type, id, opts) {
    var it = id ? findFor(type, id) : null;
    var accs = S.state.accounts;
    var d;

    if (type === "resumen") {
      var cfg = S.resumenCfg();
      /* Las cuentas ya no se eligen aquí: las elige el carrusel del
         Resumen, que es donde se ve cuál estás mirando. */
      d = { periodo: cfg.periodo, dias: cfg.dias };
    } else if (type === "saldo") {
      /* No se edita nada de la cuenta: solo se dice cuánto hay de verdad
         y la app apunta la diferencia. */
      var cuenta = S.state.accounts.find(function (x) { return x.id === id; });
      d = { accountId: id, real: cuenta ? S.accountBalance(id) : 0 };
    } else if (type === "category") {
      d = it
        ? { name: it.name, emoji: it.emoji, color: it.color, kind: it.kind,
            parentId: it.parentId || "" }
        : (function () {
            /* al crear desde dentro de una madre, ya viene puesta, y con
               ella la cara: una hija lleva la de su madre */
            var madreId = (opts && opts.parentId) || "";
            var madre = madreId && S.catById(madreId);
            return { name: "",
                     emoji: madre ? madre.emoji : "🏷️",
                     color: madre ? madre.color : 1,
                     kind: (opts && opts.kind === "in") ? "in" : "out",
                     parentId: madreId };
          })();
    } else if (type === "account") {
      d = it
        ? { name: it.name, type: it.type, opening: it.opening,
            icon: it.icon || "wallet", color: it.color || 1,
            /* vacío, no cero: el campo en blanco es «sin límite» */
            limite: it.limite != null ? it.limite : "" }
        : { name: "", type: "Banco", opening: 0, icon: "wallet",
            color: ((S.state.accounts.length * 5) % S.CAT_COLORS) + 1, limite: "" };
    } else if (type === "aportar") {
      /* Mover dinero entre la cuenta y uno de sus apartados. No es un
         movimiento: nada sale de la cuenta, solo cambia lo reservado. */
      var apAp = S.apartadoById(id);
      d = { apartadoId: id, dir: "meter", importe: "",
            name: apAp ? apAp.name : "" };
    } else if (type === "apartado") {
      d = it
        ? { name: it.name, emoji: it.emoji, color: it.color,
            accountId: it.accountId, porCiclo: it.porCiclo || "",
            categoryIds: (it.categoryIds || []).slice() }
        : { name: "", emoji: "📦",
            color: ((S.APARTADOS.length * 5) % S.CAT_COLORS) + 1,
            /* siempre nace dentro de una cuenta: se llega desde ella */
            accountId: (opts && opts.accountId) || accs[0].id,
            porCiclo: "", inicial: "", categoryIds: [] };
    } else if (type === "limite") {
      d = it
        ? { name: it.name, emoji: it.emoji, color: it.color, importe: it.importe,
            ambito: it.ambito, categoryIds: (it.categoryIds || []).slice() }
        : { name: "", emoji: "🎯",
            color: ((S.limites().length * 5) % S.CAT_COLORS) + 1,
            importe: "", ambito: "todas", categoryIds: [] };
    } else if (type === "goal") {
      d = it ? { name: it.name, target: it.target, saved: it.saved, monthly: it.monthly }
             : { name: "", target: "", saved: 0, monthly: "" };
    } else {
      d = it
        ? { kind: it.kind, note: it.note, amount: it.amount, day: it.day,
            freq: it.freq, cada: S.cadaDe(it),
            weekdays: S.diasDe(it),
            pagas: +it.pagas === 14 ? 14 : 12,
            confirmar: !!it.confirmar,
            importeAbierto: !!it.importeAbierto,
            /* El modo se guarda tal cual y no se deduce de la tarifa: al
               elegir «Por horas» la tarifa todavía está vacía, y deducirlo
               dejaba el formulario en el modo anterior. */
            modo: it.tarifa > 0 ? "hora" : it.importeAbierto ? "varia" : "fijo",
            tarifa: it.tarifa == null ? "" : it.tarifa,
            hora: it.hora || "09:00",
            avisar: !!it.avisar,
            cuotas: it.cuotas == null ? "" : it.cuotas,
            categoryId: it.categoryId, accountId: it.accountId,
            toAccountId: it.toAccountId || (accs[1] || accs[0]).id }
        : { kind: "out", note: "", amount: "", day: 1,
            freq: "mensual", weekdays: [0], pagas: 12, confirmar: false,
            importeAbierto: false, modo: "fijo", tarifa: "",
            hora: "09:00", avisar: false, cuotas: "",
            categoryId: "hogar",
            accountId: accs[0].id, toAccountId: (accs[1] || accs[0]).id };
      if (!it) { d.freq = "mensual"; d.cada = 1; }
    }

    ui.form = { type: type, id: id || null, d: d, abierto: null };
    ui.opcionesRec = false;

    tituloForm();

    renderForm();
    sheets.form.show();
  }

  /* El título de la hoja. Se vuelve a poner al repintar porque una
     categoría cambia de nombre a mitad de formulario: en cuanto la metes
     dentro de otra deja de ser una categoría y pasa a ser una
     subcategoría, y el título tiene que decirlo. */
  function tituloForm() {
    var type = ui.form.type, id = ui.form.id, d = ui.form.d;
    var titulo = {
      account: id ? "Editar cuenta" : "Nueva cuenta",
      goal: id ? "Editar meta" : "Nueva meta",
      recurring: id ? "Editar programado" : "Nuevo programado",
      saldo: "Corregir el saldo",
      resumen: "Qué cuentan estas cifras",
      category: id ? "Editar categoría" : "Nueva categoría",
      apartado: id ? "Editar apartado" : "Nuevo apartado",
      limite: id ? "Editar límite" : "Nuevo límite",
      aportar: "Apartar o devolver"
    }[type] || "Editar";

    if (type === "category" && d && d.parentId) {
      titulo = id ? "Editar subcategoría" : "Crear subcategoría";
    }
    $("#sheetFormTitle").textContent = titulo;
  }

  function findFor(type, id) {
    if (type === "saldo" || type === "resumen") return null;   /* no editan una ficha */
    if (type === "category") return S.state.categories.find(function (x) { return x.id === id; });
    if (type === "account") return S.state.accounts.find(function (x) { return x.id === id; });
    if (type === "aportar") return null;   /* no edita una ficha */
    if (type === "apartado") return S.apartadoById(id);
    if (type === "limite") return S.limitePorId(id);
    if (type === "goal") return S.state.goals.find(function (x) { return x.id === id; });
    return (S.state.recurring || []).find(function (x) { return x.id === id; });
  }

  function numField(id, label, value, step, suffix) {
    return '<div>' +
        '<label class="field__label" for="' + id + '">' + esc(label) + '</label>' +
        '<div class="input-affix">' +
          '<input type="number" class="field__input" id="' + id + '" data-f="' +
            id.slice(1) + '" min="0" step="' + step + '" inputmode="decimal" value="' +
            esc(value === "" || value == null ? "" : value) + '">' +
          '<span class="input-affix__suffix">' + (suffix || "€") + '</span>' +
        '</div>' +
      '</div>';
  }

  var DIAS_LARGO = ["Lunes", "Martes", "Miércoles", "Jueves",
                    "Viernes", "Sábado", "Domingo"];

  /* «Cada lunes», «Lunes y jueves», «Lunes, miércoles y viernes». Con los
     siete puestos no se enumeran: se dice que es todos los días. */
  function listaDias(dias) {
    if (dias.length === 7) return "Todos los días";
    var nombres = dias.map(function (i) { return DIAS_LARGO[i].toLowerCase(); });
    if (nombres.length === 1) {
      return "Cada " + nombres[0];
    }
    var ultimo = nombres.pop();
    var txt = nombres.join(", ") + " y " + ultimo;
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }

  /* Cómo se lee el ritmo de un programado en una línea. */
  function ritmoDe(r) {
    var cada = S.cadaDe(r);

    if (S.esDiario(r)) {
      return cada === 1 ? "Todos los días" : "Cada " + cada + " días";
    }
    if (S.esSemanal(r)) {
      var dias = listaDias(S.diasDe(r));
      return cada === 1 ? dias : dias + " · cada " + cada + " semanas";
    }

    /* Mensual. Cada 12 se dice «al año», que es como se llama. */
    var cuando = cada === 12 ? "Cada año el " + r.day
               : cada === 1 ? "Cada día " + r.day
               : "Cada " + cada + " meses, el " + r.day;

    if (r.kind === "in" && cada === 1 && +r.pagas === 14) {
      return "14 pagas, día " + r.day;
    }
    var quedan = S.cuotasQueQuedan(r);
    if (quedan != null) {
      return cuando + " · " +
             (quedan === 0 ? "pagado del todo"
                           : "quedan " + quedan + (quedan === 1 ? " cuota" : " cuotas"));
    }
    return cuando;
  }

  /* Un interruptor de sí/no con su explicación debajo. Es un botón, no un
     checkbox: así se puede tocar en cualquier parte de la fila, que en el
     móvil es la diferencia entre acertar y no. */
  function switchRow(id, label, hint, on) {
    return '<div class="field" style="margin-top:var(--sp-5)">' +
        '<button type="button" class="switch-row" id="' + id + '" ' +
                'role="switch" aria-checked="' + (!!on) + '">' +
          '<span class="switch-row__text">' +
            '<span class="switch-row__label">' + esc(label) + '</span>' +
            (hint ? '<span class="switch-row__hint">' + esc(hint) + '</span>' : "") +
          '</span>' +
          '<span class="switch" aria-hidden="true"><span class="switch__dot"></span></span>' +
        '</button>' +
      '</div>';
  }

  /* Un puñado de emojis a mano para escritorio, donde no hay teclado de
     emoji. En el móvil el campo de texto abre el del sistema y hay todos. */
  var EMOJI_SUGERIDOS = [
    "🍽️", "🛒", "☕", "🍺", "⛽", "🚗", "🚌", "✈️",
    "🏠", "💡", "📶", "🛍️", "👕", "🎬", "🎮", "🎁",
    "💊", "🏥", "🏋️", "📚", "🐶", "🧾", "🔧", "💼",
    "💰", "🏦", "📈", "🎓", "✂️", "🧼", "🍼", "🏷️"
  ];

  /* La vista previa se actualiza sola al teclear o al tocar un color, sin
     repintar el formulario: hacerlo dejaría el campo de texto sin foco.
     Vive en form-ident, que es de quien es el trozo. */
  function refreshCatPreview() { return A.refreshIdent(); }

  function refreshAjuste() {
    var caja = $("#fAjuste");
    if (!caja) return;
    var actual = S.accountBalance(ui.form.d.accountId);
    var puesto = parseFloat(ui.form.d.real);
    var dif = isFinite(puesto) ? Math.round((puesto - actual) * 100) / 100 : 0;

    caja.setAttribute("data-dif", dif > 0 ? "in" : dif < 0 ? "out" : "cero");
    caja.innerHTML = Math.abs(dif) < 0.005
      ? '<span class="ajuste__txt">Ya cuadra: no hay nada que apuntar.</span>'
      : '<span class="ajuste__txt">Se apuntará ' +
          (dif > 0 ? "un ingreso" : "un gasto") + ' de</span>' +
        '<span class="ajuste__eur">' + esc(money(Math.abs(dif))) + '</span>';
  }

  /* vista previa de la tarjeta en el formulario de cuenta */
  function refreshCardPreview() {
    var box = $("#fCardPreview");
    if (!box) return;
    box.style.setProperty("--acc-color", "var(--cat-" + ui.form.d.color + ")");
    var nombre = $("#fCardName");
    if (nombre) nombre.textContent = String(ui.form.d.name || "").trim() || "Tu cuenta";
  }

  /* Repinta solo la línea que resume el límite. Marcar una categoría no
     puede repintar la hoja entera: la rejilla se movería bajo el dedo. */
  function refreshLimiteResumen() {
    if (ui.form.type !== "limite") return;
    var p = $("#fLimResumen");
    if (p) p.textContent = A.resumenLimite(ui.form.d);
  }

  function wire() {
    /* --- sheet de formulario (cuentas, metas, programados) --- */
    var formBody = $("#sheetFormBody");

    var FIELD_MAP = {
      Name: function (v) { ui.form.d[ui.form.type === "recurring" ? "note" : "name"] = v; },
      Emoji: function (v) { ui.form.d.emoji = v; },
      Type: function (v) { ui.form.d.type = v; },
      Opening: function (v) { ui.form.d.opening = v; },
      Limite: function (v) { ui.form.d.limite = v; },
      PorCiclo: function (v) { ui.form.d.porCiclo = v; },
      Importe: function (v) { ui.form.d.importe = v; },
      Inicial: function (v) { ui.form.d.inicial = v; },
      Target: function (v) { ui.form.d.target = v; },
      Saved: function (v) { ui.form.d.saved = v; },
      Monthly: function (v) { ui.form.d.monthly = v; },
      Amount: function (v) { ui.form.d.amount = v; },
      Real: function (v) { ui.form.d.real = v; },
      Tarifa: function (v) { ui.form.d.tarifa = v; },
      Hora: function (v) { ui.form.d.hora = v; },
      Cuotas: function (v) { ui.form.d.cuotas = v; },
      Dias: function (v) { ui.form.d.dias = v; },
      Day: function (v) { ui.form.d.day = v; },
      Cada: function (v) { ui.form.d.cada = v; },
      Cat: function (v) { ui.form.d.categoryId = v; }
    };

    function readField(el) {
      var key = el.getAttribute("data-f");
      if (key && FIELD_MAP[key]) { FIELD_MAP[key](el.value); return true; }
      return false;
    }

    formBody.addEventListener("input", function (e) {
      if (!readField(e.target)) return;
      /* la vista previa la comparten la categoría, el apartado y el
         límite: los tres tienen cara, nombre y color */
      refreshCatPreview();
      if (ui.form.type === "account") refreshCardPreview();
      /* el aviso de «se apuntará X» se recalcula mientras se teclea, sin
         repintar: repintar dejaría el campo sin foco a media cifra */
      if (ui.form.type === "saldo") refreshAjuste();
      if (ui.form.type === "limite") refreshLimiteResumen();
    });

    formBody.addEventListener("change", function (e) { readField(e.target); });

    formBody.addEventListener("click", function (e) {
      var node;
      if ((node = e.target.closest("[data-fkind]"))) {
        ui.form.d.kind = node.getAttribute("data-fkind");
        if (ui.form.type !== "category") {
          /* la categoría por defecto cambia con el tipo */
          if (ui.form.d.kind === "in") ui.form.d.categoryId = "nomina";
          else if (ui.form.d.kind === "out") ui.form.d.categoryId = "hogar";
        }
        renderForm();
        U.haptic("light");
        return;
      }
      /* Las de dentro, desde la ficha de su madre. Lo que se lleve
         escrito de la madre se guarda antes de saltar: si no, cambiarle
         el nombre y tocar «Nueva subcategoría» se comería el cambio sin
         decir nada. */
      if (e.target.closest("#fNuevaSub")) {
        var madreId = ui.form.id;
        guardarCallado();
        openForm("category", null, { kind: ui.form.d.kind, parentId: madreId });
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("[data-subcat]"))) {
        var hijaId = node.getAttribute("data-subcat");
        guardarCallado();
        openForm("category", hijaId);
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("[data-fperiodo]"))) {
        ui.form.d.periodo = node.getAttribute("data-fperiodo");
        renderForm(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-fmodo]"))) {
        ui.form.d.modo = node.getAttribute("data-fmodo");
        if (ui.form.d.modo !== "hora") ui.form.d.tarifa = "";
        ui.form.d.importeAbierto = ui.form.d.modo !== "fijo";
        if (ui.form.d.importeAbierto) ui.form.d.confirmar = true;
        renderForm();
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("[data-fpagas]"))) {
        ui.form.d.pagas = +node.getAttribute("data-fpagas");
        renderForm();
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("[data-fweekday]"))) {
        var dia = +node.getAttribute("data-fweekday");
        var i = ui.form.d.weekdays.indexOf(dia);
        if (i >= 0) {
          /* tiene que quedar al menos uno: un semanal sin días no toca nunca */
          if (ui.form.d.weekdays.length > 1) ui.form.d.weekdays.splice(i, 1);
        } else {
          ui.form.d.weekdays.push(dia);
        }
        ui.form.d.weekdays.sort(function (a, b) { return a - b; });
        renderForm();
        U.haptic("light");
        return;
      }
      if (e.target.closest("#fOpciones")) {
        ui.opcionesRec = !ui.opcionesRec;
        renderForm(); U.haptic("light"); return;
      }
      if (e.target.closest("#fAvisar")) {
        var sw = e.target.closest("#fAvisar");
        ui.form.d.avisar = sw.getAttribute("aria-checked") !== "true";
        sw.setAttribute("aria-checked", String(ui.form.d.avisar));
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("#fConfirmar"))) {
        ui.form.d.confirmar = node.getAttribute("aria-checked") !== "true";
        node.setAttribute("aria-checked", String(ui.form.d.confirmar));
        U.haptic("light");
        return;
      }
      /* La cara y el color abren su cajón, y solo uno a la vez: con los
         dos abiertos la hoja crece por los dos lados y hay que hacer
         scroll para ver lo que estás cambiando. */
      if ((node = e.target.closest("[data-ident]"))) {
        var cual = node.getAttribute("data-ident");
        ui.form.abierto = ui.form.abierto === cual ? null : cual;
        renderForm();
        if (ui.form.abierto === "emoji") {
          var libre = $("#fEmoji", formBody);
          if (libre) libre.focus();
        }
        U.haptic("light");
        return;
      }

      if ((node = e.target.closest("[data-pemoji]"))) {
        ui.form.d.emoji = node.getAttribute("data-pemoji");
        var inp = $("#fEmoji", formBody);
        if (inp) inp.value = ui.form.d.emoji;
        $$("[data-pemoji]", formBody).forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === node));
        });
        refreshCatPreview();
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("[data-pcolor]"))) {
        ui.form.d.color = +node.getAttribute("data-pcolor");
        $$("[data-pcolor]", formBody).forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === node));
        });
        refreshCatPreview();
        refreshCardPreview();
        U.haptic("light");
        return;
      }
      /* Las categorías que se descuentan solas del apartado. Se marcan y
         desmarcan sin repintar: el formulario es largo y repintarlo te
         mandaría al principio en cada toque. */
      /* «Año» no es un ritmo aparte en los datos: es mensual cada 12. Un
         concepto menos que mantener, y la palabra que la gente usa. */
      if ((node = e.target.closest("[data-fritmo]"))) {
        var ritmo = node.getAttribute("data-fritmo");
        ui.form.d.freq = ritmo === "anual" ? "mensual" : ritmo;
        ui.form.d.cada = ritmo === "anual" ? 12 : 1;
        renderForm();
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("[data-fdir]"))) {
        ui.form.d.dir = node.getAttribute("data-fdir");
        renderForm();
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("[data-pcat]"))) {
        var cid = node.getAttribute("data-pcat");
        var lista = ui.form.d.categoryIds || (ui.form.d.categoryIds = []);
        var i = lista.indexOf(cid);
        if (i >= 0) lista.splice(i, 1); else lista.push(cid);
        /* Marcar una madre arrastra a sus hijas, así que la rejilla
           entera cambia de aspecto: hay que repintarla. En los apartados
           no hay madres que arrastren y basta con la chapa. */
        if (ui.form.type === "limite") renderForm();
        else node.setAttribute("aria-pressed", String(i < 0));
        U.haptic("light");
        return;
      }

      if ((node = e.target.closest("[data-flamb]"))) {
        ui.form.d.ambito = node.getAttribute("data-flamb");
        /* la rejilla de categorías aparece o desaparece: hay que repintar */
        renderForm();
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("[data-picon]"))) {
        ui.form.d.icon = node.getAttribute("data-picon");
        $$("[data-picon]", formBody).forEach(function (b) {
          b.setAttribute("aria-selected", String(b === node));
          b.setAttribute("aria-pressed", String(b === node));
        });
        U.haptic("light");
        return;
      }
      if (e.target.closest("#fSave")) { saveForm(); return; }
      if (e.target.closest("#fDelete")) { deleteForm(); return; }
    });

    /* Al formulario de categoría se llega a veces desde un movimiento a
       medio escribir. Salir de ahí de cualquier manera —la X, el botón
       atrás, arrastrando la hoja hacia abajo, tocando fuera— tiene que
       devolverte al movimiento con lo que llevabas tecleado, no dejarte
       en blanco. Guardar y borrar bajan la bandera antes de cerrar, así
       que esto solo salta cuando de verdad se ha abandonado. */
    sheets.form.onClose = function () {
      if (ui.catReturnToAdd) {
        ui.catReturnToAdd = false;
        renderAddSheet();
        sheets.add.show();
        return;
      }

      /* Lo mismo al editar una cuenta desde dentro de la cuenta: se
         vuelve a ella con los cambios ya puestos. Si se acaba de
         borrar, no hay a dónde volver. */
      if (ui.cuentaReturn) {
        var id = ui.cuentaReturn;
        ui.cuentaReturn = null;
        if (!S.state.accounts.some(function (a) { return a.id === id; })) return;
        ui.cuentaAbierta = id;
        renderCuenta();
        sheets.cuenta.show();
      }
    };
  }


  /* Guarda lo que se lleve escrito de la categoría que se está editando,
     sin avisos ni cerrar la hoja: se usa al saltar a una de dentro, que
     es moverse entre fichas y no un «guardar» del usuario. Sin esto,
     cambiarle el nombre a la madre y tocar «Nueva subcategoría» se
     comería el cambio sin decir nada. */
  function guardarCallado() {
    if (ui.form.type !== "category" || !ui.form.id) return;
    if (!String(ui.form.d.name || "").trim()) return;
    S.updateCategory(ui.form.id, ui.form.d);
  }

  /* --- lo que usan otros archivos --- */
  A.DIAS_LARGO = DIAS_LARGO;
  A.EMOJI_SUGERIDOS = EMOJI_SUGERIDOS;
  A.listaDias = listaDias;
  A.numField = numField;
  A.openForm = openForm;
  A.tituloForm = tituloForm;
  A.ritmoDe = ritmoDe;
  A.switchRow = switchRow;

  A.wire(wire);
})();
