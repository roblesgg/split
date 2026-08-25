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
  function renderAddSheet() { return A.renderAddSheet.apply(null, arguments); }
  function renderAll() { return A.renderAll.apply(null, arguments); }
  function renderCuenta() { return A.renderCuenta.apply(null, arguments); }
  function renderForm() { return A.renderForm.apply(null, arguments); }
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
      d = {
        periodo: cfg.periodo,
        dias: cfg.dias,
        /* null en el estado significa «todas»; aquí se materializa la
           lista para poder ir marcando y desmarcando */
        cuentas: cfg.cuentas ? cfg.cuentas.slice()
                             : S.state.accounts.map(function (a) { return a.id; })
      };
    } else if (type === "saldo") {
      /* No se edita nada de la cuenta: solo se dice cuánto hay de verdad
         y la app apunta la diferencia. */
      var cuenta = S.state.accounts.find(function (x) { return x.id === id; });
      d = { accountId: id, real: cuenta ? S.accountBalance(id) : 0 };
    } else if (type === "category") {
      d = it
        ? { name: it.name, emoji: it.emoji, color: it.color, kind: it.kind,
            parentId: it.parentId || "" }
        : { name: "", emoji: "🏷️", color: 1,
            kind: (opts && opts.kind === "in") ? "in" : "out",
            /* al crear desde dentro de una madre, ya viene puesta */
            parentId: (opts && opts.parentId) || "" };
    } else if (type === "account") {
      d = it
        ? { name: it.name, type: it.type, opening: it.opening,
            icon: it.icon || "wallet", color: it.color || 1 }
        : { name: "", type: "Banco", opening: 0, icon: "wallet",
            color: ((S.state.accounts.length * 5) % S.CAT_COLORS) + 1 };
    } else if (type === "goal") {
      d = it ? { name: it.name, target: it.target, saved: it.saved, monthly: it.monthly }
             : { name: "", target: "", saved: 0, monthly: "" };
    } else {
      d = it
        ? { kind: it.kind, note: it.note, amount: it.amount, day: it.day,
            freq: it.freq === "semanal" ? "semanal" : "mensual",
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
    }

    ui.form = { type: type, id: id || null, d: d };
    ui.opcionesRec = false;

    $("#sheetFormTitle").textContent = {
      account: id ? "Editar cuenta" : "Nueva cuenta",
      goal: id ? "Editar meta" : "Nueva meta",
      recurring: id ? "Editar programado" : "Nuevo programado",
      saldo: "Corregir el saldo",
      resumen: "Qué cuentan estas cifras",
      category: id ? "Editar categoría" : "Nueva categoría"
    }[type] || "Editar";

    renderForm();
    sheets.form.show();
  }

  function findFor(type, id) {
    if (type === "saldo" || type === "resumen") return null;   /* no editan una ficha */
    if (type === "category") return S.state.categories.find(function (x) { return x.id === id; });
    if (type === "account") return S.state.accounts.find(function (x) { return x.id === id; });
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
    if (r.freq === "semanal") return listaDias(S.diasDe(r));
    if (r.kind === "in" && +r.pagas === 14) return "14 pagas, día " + r.day;
    var quedan = S.cuotasQueQuedan(r);
    if (quedan != null) {
      return "Día " + r.day + " · " +
             (quedan === 0 ? "pagado del todo"
                           : "quedan " + quedan + (quedan === 1 ? " cuota" : " cuotas"));
    }
    return "Cada día " + r.day;
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
     repintar el formulario: hacerlo dejaría el campo de texto sin foco. */
  function refreshCatPreview() {
    var face = $("#fPreview");
    if (!face) return;
    face.textContent = ui.form.d.emoji || "📦";
    face.style.setProperty("--cat-color", "var(--cat-" + ui.form.d.color + ")");
    var nameEl = $("#fPreviewName");
    if (nameEl) nameEl.textContent = String(ui.form.d.name || "").trim() || "Sin nombre";
  }

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

  function saveForm() {
    var t = ui.form.type, id = ui.form.id, d = ui.form.d;

    if (t === "category") {
      if (!String(d.name).trim()) {
        U.toast("Ponle un nombre a la categoría", { icon: "warning" }); return;
      }
      var cat = id ? S.updateCategory(id, d) : S.addCategory(d);
      U.toast(id ? "Categoría actualizada" : "Categoría creada", { icon: "check" });

      /* si se vino desde el selector del movimiento, se vuelve allí con el
         importe que se llevaba tecleado; si además era nueva, ya elegida */
      if (ui.catReturnToAdd) {
        ui.catReturnToAdd = false;
        if (!id) ui.draft.categoryId = cat.id;
        sheets.form.close();
        renderAddSheet();
        sheets.add.show();
        return;
      }
    }

    if (t === "resumen") {
      if (!d.cuentas.length) {
        U.toast("Marca al menos una cuenta", { icon: "warning" }); return;
      }
      S.setResumen({
        periodo: d.periodo,
        dias: parseInt(d.dias, 10) || 30,
        /* todas marcadas se guarda como «todas», no como la lista: así
           una cuenta nueva entra sola en vez de quedarse fuera */
        cuentas: d.cuentas.length === S.state.accounts.length ? null : d.cuentas
      });
      U.toast("Hecho", { icon: "check" });
    }

    if (t === "saldo") {
      var puestoS = parseFloat(d.real);
      if (!isFinite(puestoS)) {
        U.toast("Pon cuánto tienes de verdad", { icon: "warning" }); return;
      }
      var res = S.corregirSaldo(d.accountId, puestoS);
      if (!res) { U.toast("Esa cuenta ya no existe", { icon: "warning" }); return; }
      U.toast(res.dif === 0
        ? "Ya cuadraba: no se ha apuntado nada"
        : "Saldo corregido, " + (res.dif > 0 ? "+" : "−") + money(Math.abs(res.dif)),
        { icon: "check" });
    }

    if (t === "account") {
      if (!String(d.name).trim()) {
        U.toast("Ponle un nombre a la cuenta", { icon: "warning" }); return;
      }
      if (id) S.updateAccount(id, d); else S.addAccount(d);
      U.toast(id ? "Cuenta actualizada" : "Cuenta creada", { icon: "check" });
    }

    if (t === "goal") {
      if (!String(d.name).trim()) {
        U.toast("Ponle un nombre a la meta", { icon: "warning" }); return;
      }
      if (!(parseFloat(d.target) > 0)) {
        U.toast("El objetivo tiene que ser mayor que cero", { icon: "warning" }); return;
      }
      if (id) S.updateGoal(id, d); else S.addGoal(d);
      U.toast(id ? "Meta actualizada" : "Meta creada", { icon: "check" });
    }

    if (t === "recurring") {
      if (!String(d.note).trim()) {
        U.toast("Ponle un concepto", { icon: "warning" }); return;
      }
      var modoG = d.kind === "in" ? (d.modo || "fijo") : "fijo";
      if (modoG === "hora") {
        if (!(parseFloat(d.tarifa) > 0)) {
          U.toast("Pon lo que cobras por hora", { icon: "warning" }); return;
        }
      } else if (modoG === "varia") {
        /* el importe es opcional: se preguntará cada vez */
      } else if (!(parseFloat(d.amount) > 0)) {
        U.toast("El importe tiene que ser mayor que cero", { icon: "warning" }); return;
      }
      var data = {
        kind: d.kind, note: d.note, amount: d.amount, day: d.day,
        freq: d.freq === "semanal" ? "semanal" : "mensual",
        weekdays: d.weekdays,
        /* Un gasto no tiene modos: siempre lleva su importe. */
        importeAbierto: d.kind === "in" && d.modo !== "fijo",
        tarifa: (d.kind === "in" && d.modo === "hora" && parseFloat(d.tarifa) > 0)
          ? parseFloat(d.tarifa) : null,
        hora: d.hora,
        avisar: !!d.avisar,
        cuotas: (d.kind === "out" && parseFloat(d.cuotas) > 0)
          ? parseInt(d.cuotas, 10) : null,
        /* las catorce pagas solo existen en un cobro mensual */
        pagas: (d.kind === "in" && d.freq !== "semanal" && +d.pagas === 14) ? 14 : 12,
        confirmar: !!d.confirmar,
        accountId: d.accountId,
        toAccountId: d.kind === "transfer" ? d.toAccountId : null,
        categoryId: d.kind === "transfer" ? "otros" : d.categoryId
      };
      if (id) S.updateRecurring(id, data); else S.addRecurring(data);
      U.toast(id ? "Programado actualizado" : "Programado creado", { icon: "check" });
    }

    sheets.form.close();
    S.runRecurring();
    sincronizarAvisos();
    renderAll();

    /* Si el programado que se acaba de guardar ya tocaba y pide que le
       pregunten el importe, se pregunta ahora y no en la próxima apertura. */
    if (t === "recurring" && hayPendientes()) setTimeout(abrirCobros, 380);
  }

  function deleteForm() {
    var t = ui.form.type, id = ui.form.id;

    if (t === "category") {
      var resCat = S.deleteCategory(id);
      if (!resCat.ok) { U.toast(resCat.reason, { icon: "warning", duration: 5500 }); return; }
      U.toast("Categoría eliminada", { icon: "check" });

      if (ui.catReturnToAdd) {
        ui.catReturnToAdd = false;
        /* el borrador apuntaba a la que acaba de desaparecer */
        if (ui.draft && ui.draft.categoryId === id) {
          var quedan = S.categoriesOf(ui.draft.kind === "in" ? "in" : "out");
          ui.draft.categoryId = quedan.length ? quedan[0].id : "otros";
        }
        sheets.form.close();
        renderAddSheet();
        sheets.add.show();
        return;
      }
    }

    if (t === "account") {
      var res = S.deleteAccount(id);
      if (!res.ok) { U.toast(res.reason, { icon: "warning", duration: 5500 }); return; }
      U.toast("Cuenta eliminada", { icon: "check" });
    }
    if (t === "goal") {
      if (!confirm("¿Eliminar esta meta?")) return;
      S.deleteGoal(id);
      U.toast("Meta eliminada", { icon: "check" });
    }
    if (t === "recurring") {
      if (!confirm("¿Eliminar este programado? Los movimientos ya apuntados se quedan.")) return;
      S.deleteRecurring(id);
      sincronizarAvisos();
      U.toast("Programado eliminado", { icon: "check" });
    }

    sheets.form.close();
    renderAll();
  }

  /* ============================================================
     Cableado
     ============================================================ */

  function wire() {
    /* --- sheet de formulario (cuentas, metas, programados) --- */
    var formBody = $("#sheetFormBody");

    var FIELD_MAP = {
      Name: function (v) { ui.form.d[ui.form.type === "recurring" ? "note" : "name"] = v; },
      Emoji: function (v) { ui.form.d.emoji = v; },
      Type: function (v) { ui.form.d.type = v; },
      Opening: function (v) { ui.form.d.opening = v; },
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
      Cat: function (v) { ui.form.d.categoryId = v; }
    };

    function readField(el) {
      var key = el.getAttribute("data-f");
      if (key && FIELD_MAP[key]) { FIELD_MAP[key](el.value); return true; }
      return false;
    }

    formBody.addEventListener("input", function (e) {
      if (!readField(e.target)) return;
      if (ui.form.type === "category") refreshCatPreview();
      if (ui.form.type === "account") refreshCardPreview();
      /* el aviso de «se apuntará X» se recalcula mientras se teclea, sin
         repintar: repintar dejaría el campo sin foco a media cifra */
      if (ui.form.type === "saldo") refreshAjuste();
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
      if ((node = e.target.closest("[data-fperiodo]"))) {
        ui.form.d.periodo = node.getAttribute("data-fperiodo");
        renderForm(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-fcuenta]"))) {
        var idC = node.getAttribute("data-fcuenta");
        var iC = ui.form.d.cuentas.indexOf(idC);
        if (iC >= 0) ui.form.d.cuentas.splice(iC, 1); else ui.form.d.cuentas.push(idC);
        renderForm(); U.haptic("light"); return;
      }
      if (e.target.closest("#fTodasCuentas")) {
        ui.form.d.cuentas = ui.form.d.cuentas.length === S.state.accounts.length
          ? []
          : S.state.accounts.map(function (a) { return a.id; });
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
      if ((node = e.target.closest("[data-ffreq]"))) {
        ui.form.d.freq = node.getAttribute("data-ffreq");
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


  /* --- lo que usan otros archivos --- */
  A.DIAS_LARGO = DIAS_LARGO;
  A.EMOJI_SUGERIDOS = EMOJI_SUGERIDOS;
  A.listaDias = listaDias;
  A.numField = numField;
  A.openForm = openForm;
  A.ritmoDe = ritmoDe;
  A.switchRow = switchRow;

  A.wire(wire);
})();
