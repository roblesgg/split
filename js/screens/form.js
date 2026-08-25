/* ============================================================
   split — hoja: formulario de cuentas, metas y programados
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, C = A.C, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, ui = A.ui, sheets = A.sheets;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function abrirCobros() { return A.abrirCobros.apply(null, arguments); }
  function accountSelect() { return A.accountSelect.apply(null, arguments); }
  function catOf() { return A.catOf.apply(null, arguments); }
  function hayPendientes() { return A.hayPendientes.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function pickField() { return A.pickField.apply(null, arguments); }
  function renderAddSheet() { return A.renderAddSheet.apply(null, arguments); }
  function renderAll() { return A.renderAll.apply(null, arguments); }
  function renderCuenta() { return A.renderCuenta.apply(null, arguments); }
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

  function renderForm() {
    var body = $("#sheetFormBody");
    var t = ui.form.type, d = ui.form.d;
    var html = "";

    if (t === "category") {
      var colores = [];
      for (var ci = 1; ci <= S.CAT_COLORS; ci++) colores.push(ci);

      /* Una que ya tiene hijas no puede meterse dentro de nadie. */
      var tieneHijas = ui.form.id && S.hijasDe(ui.form.id).length > 0;
      var madresPosibles = tieneHijas ? [] : S.categoriasMadre(d.kind)
        .filter(function (c) { return c.id !== ui.form.id && !c.sistema; });

      html =
        (ui.form.id
          ? ""
          : '<div class="segmented" id="fSeg" role="tablist">' +
              '<span class="segmented__thumb" id="fThumb" aria-hidden="true"></span>' +
              '<button type="button" class="segmented__btn" role="tab" data-fkind="out" ' +
                      'aria-selected="' + (d.kind === "out") + '">Gasto</button>' +
              '<button type="button" class="segmented__btn" role="tab" data-fkind="in" ' +
                      'aria-selected="' + (d.kind === "in") + '">Ingreso</button>' +
            '</div>') +

        '<div class="field">' +
          '<span class="field__label">Así se verá</span>' +
          '<div class="cat-preview">' +
            '<span class="cat-preview__face cat-face" id="fPreview" ' +
                  'style="--cat-color:var(--cat-' + d.color + ')" aria-hidden="true">' +
              esc(d.emoji) + '</span>' +
            '<span class="cat-preview__name" id="fPreviewName">' +
              esc(d.name || "Sin nombre") + '</span>' +
          '</div>' +
        '</div>' +

        '<div class="field">' +
          '<label class="field__label" for="fName">Nombre</label>' +
          '<input type="text" class="field__input" id="fName" data-f="Name" maxlength="24" ' +
                 'placeholder="Gasolina" value="' + esc(d.name) + '">' +
        '</div>' +

        /* Meterla dentro de otra. Solo se ofrecen las de primer nivel del
           mismo tipo, y solo si esta no tiene ya hijas: un nivel y no más,
           que dos ya obligan a pensar dónde va cada cosa. */
        (madresPosibles.length
          ? '<div class="field">' +
              '<span class="field__label">Dentro de</span>' +
              pickField("fMadre", d.parentId || "",
                        d.parentId ? catOf(d.parentId).name : "Nada, va suelta") +
              '<p class="field__hint">' +
                (d.parentId
                  ? "En los gráficos sumará dentro de «" +
                    esc(catOf(d.parentId).name) + "», pero en la lista de " +
                    "movimientos se distingue."
                  : "Puedes meterla dentro de otra, por ejemplo «Deuda coche» " +
                    "dentro de «Deudas».") +
              '</p>' +
            '</div>'
          : "") +

        '<div class="field">' +
          '<label class="field__label" for="fEmoji">Emoji</label>' +
          '<input type="text" class="field__input" id="fEmoji" data-f="Emoji" ' +
                 'maxlength="8" autocomplete="off" value="' + esc(d.emoji) + '">' +
          '<div class="emoji-grid">' +
            EMOJI_SUGERIDOS.map(function (e) {
              return '<button type="button" class="emoji-pick" data-pemoji="' + esc(e) + '" ' +
                       'aria-pressed="' + (e === d.emoji) + '">' + esc(e) + '</button>';
            }).join("") +
          '</div>' +
          '<p class="field__hint">Escribe el que quieras o elige uno de arriba.</p>' +
        '</div>' +

        '<div class="field">' +
          '<span class="field__label">Color</span>' +
          '<div class="swatch-grid">' +
            colores.map(function (n) {
              return '<button type="button" class="swatch" data-pcolor="' + n + '" ' +
                       'style="background:var(--cat-' + n + ')" ' +
                       'aria-pressed="' + (n === d.color) + '" ' +
                       'aria-label="Color ' + n + '"></button>';
            }).join("") +
          '</div>' +
        '</div>';
    }

    if (t === "account") {
      html =
        '<div class="field">' +
          '<label class="field__label" for="fName">Nombre</label>' +
          '<input type="text" class="field__input" id="fName" data-f="Name" maxlength="28" ' +
                 'placeholder="Cuenta corriente" value="' + esc(d.name) + '">' +
        '</div>' +
        '<div class="field__row" style="margin-top:var(--sp-5)">' +
          '<div>' +
            '<span class="field__label">Tipo</span>' +
            pickField("fType", d.type, d.type) +
          '</div>' +
          numField("fOpening", "Saldo inicial", d.opening, 10) +
        '</div>' +
        '<div class="field">' +
          '<span class="field__label">Icono</span>' +
          '<div class="cat-grid">' +
            ["wallet", "piggy", "cash", "target"].map(function (ic) {
              return '<button type="button" class="cat-pick" data-picon="' + ic + '" ' +
                       'aria-pressed="' + (d.icon === ic) + '">' +
                  '<span class="cat-pick__icon" data-icon="' + ic + '" data-icon-size="18"></span>' +
                '</button>';
            }).join("") +
          '</div>' +
        '</div>' +

        '<div class="field">' +
          '<span class="field__label">Color de la tarjeta</span>' +
          '<div class="card-preview" id="fCardPreview" ' +
               'style="--acc-color:var(--cat-' + d.color + ')">' +
            '<span class="card-preview__name" id="fCardName">' +
              esc(d.name || "Tu cuenta") + '</span>' +
            '<span class="card-preview__mark" aria-hidden="true">' +
              '<span></span><span></span></span>' +
          '</div>' +
          '<div class="swatch-grid" style="margin-top:var(--sp-3)">' +
            (function () {
              var out = [];
              for (var n = 1; n <= S.CAT_COLORS; n++) {
                out.push('<button type="button" class="swatch" data-pcolor="' + n + '" ' +
                           'style="background:var(--cat-' + n + ')" ' +
                           'aria-pressed="' + (n === d.color) + '" ' +
                           'aria-label="Color ' + n + '"></button>');
              }
              return out.join("");
            })() +
          '</div>' +
        '</div>';
    }

    if (t === "goal") {
      html =
        '<div class="field">' +
          '<label class="field__label" for="fName">Nombre</label>' +
          '<input type="text" class="field__input" id="fName" data-f="Name" maxlength="32" ' +
                 'placeholder="Colchón de emergencia" value="' + esc(d.name) + '">' +
        '</div>' +
        '<div class="field__row" style="margin-top:var(--sp-5)">' +
          numField("fTarget", "Objetivo", d.target, 50) +
          numField("fSaved", "Ya ahorrado", d.saved, 10) +
        '</div>' +
        '<div class="field">' +
          numField("fMonthly", "Aportación mensual", d.monthly, 10) +
          ''+
        '</div>';
    }

    if (t === "resumen") {
      var todas = d.cuentas.length === S.state.accounts.length;

      html =
        '<div class="field">' +
          '<span class="field__label">De cuándo</span>' +
          '<div class="chips">' +
            [["mes", "Este mes"], ["ano", "Este año"],
             ["dias", "Últimos días"], ["todo", "Desde el principio"]].map(function (o) {
              return '<button type="button" class="chip" data-fperiodo="' + o[0] + '" ' +
                       'aria-pressed="' + (d.periodo === o[0]) + '">' + o[1] + '</button>';
            }).join("") +
          '</div>' +
        '</div>' +

        (d.periodo === "dias"
          ? '<div class="field">' +
              numField("fDias", "Cuántos días", d.dias, 1, "días") +
              '<p class="field__hint">Por ejemplo 7 para la semana, o 90 para el ' +
                'trimestre.</p>' +
            '</div>'
          : "") +

        '<div class="field" style="margin-top:var(--sp-6)">' +
          '<div class="card__head" style="margin-bottom:var(--sp-3)">' +
            '<span class="field__label" style="margin:0">De qué cuentas</span>' +
            '<button type="button" class="card__link" id="fTodasCuentas">' +
              (todas ? "Ninguna" : "Todas") + '</button>' +
          '</div>' +
          S.state.accounts.map(function (a) {
            var puesta = d.cuentas.indexOf(a.id) >= 0;
            return '<button type="button" class="pick" data-fcuenta="' + esc(a.id) + '" ' +
                     'aria-pressed="' + puesta + '">' +
                '<span class="pick__punto" style="background:' +
                  S.catColorVar(a) + '"></span>' +
                '<span class="pick__texto">' +
                  '<span class="pick__nombre">' + esc(a.name) + '</span>' +
                  '<span class="pick__sub">' + esc(a.type) + '</span>' +
                '</span>' +
                (puesta
                  ? '<span class="pick__tick" data-icon="check" data-icon-size="16"></span>'
                  : '') +
              '</button>';
          }).join("") +
          (d.cuentas.length
            ? ""
            : '<p class="field__hint">' + icon("warning", 12) +
              ' Marca al menos una, o no habrá nada que contar.</p>') +
        '</div>';
    }

    if (t === "saldo") {
      var cuentaS = S.state.accounts.find(function (x) { return x.id === d.accountId; });
      var actual = cuentaS ? S.accountBalance(d.accountId) : 0;
      var puesto = parseFloat(d.real);
      var dif = isFinite(puesto) ? Math.round((puesto - actual) * 100) / 100 : 0;

      html =
        '<div style="text-align:center;padding:var(--sp-2) 0 var(--sp-5)">' +
          '<p class="card__title">' + esc(cuentaS ? cuentaS.name : "") + '</p>' +
          '<p class="card__sub" style="margin-top:2px">La app dice que tienes ' +
            esc(money(actual)) + '</p>' +
        '</div>' +

        '<div class="field">' +
          '<label class="field__label" for="fReal">¿Cuánto tienes de verdad?</label>' +
          '<div class="input-affix">' +
            '<input type="number" class="field__input field__input--big" id="fReal" ' +
                   'data-f="Real" step="0.01" inputmode="decimal" value="' +
                   esc(d.real) + '">' +
            '<span class="input-affix__suffix">€</span>' +
          '</div>' +
        '</div>' +

        /* Lo que se va a apuntar, dicho antes de tocar nada. Que nadie se
           encuentre un movimiento que no esperaba. */
        '<div class="ajuste" id="fAjuste" data-dif="' +
              (dif > 0 ? "in" : dif < 0 ? "out" : "cero") + '">' +
          (Math.abs(dif) < 0.005
            ? '<span class="ajuste__txt">Ya cuadra: no hay nada que apuntar.</span>'
            : '<span class="ajuste__txt">Se apuntará ' +
                (dif > 0 ? "un ingreso" : "un gasto") + ' de</span>' +
              '<span class="ajuste__eur">' + esc(money(Math.abs(dif))) + '</span>') +
        '</div>' +

        '<p class="field__hint">Queda como un movimiento normal, con la fecha de ' +
          'hoy y la categoría «Ajuste de saldo». Se puede borrar o editar después ' +
          'como cualquier otro.</p>';
    }

    if (t === "recurring") {
      var cats = S.CATEGORIES.filter(function (c) {
        return c.kind === (d.kind === "in" ? "in" : "out");
      });
      var mismaCuenta = d.kind === "transfer" && d.accountId === d.toAccountId;
      var esSem = d.freq === "semanal";
      var modoImporte = d.kind === "in" ? (d.modo || "fijo") : "fijo";
      /* Un traspaso necesita sus dos cuentas sí o sí, así que ahí las
         opciones se abren de entrada. */
      var opcionesAbiertas = ui.opcionesRec || d.kind === "transfer";
      var cuotasHechas = ui.form.id
        ? ((S.state.recurring.find(function (x) { return x.id === ui.form.id; }) || {}).pagadas || 0)
        : 0;

      html =
        '<div class="segmented" id="fSeg" role="tablist">' +
          '<span class="segmented__thumb" id="fThumb" aria-hidden="true"></span>' +
          '<button type="button" class="segmented__btn" role="tab" data-fkind="out" ' +
                  'aria-selected="' + (d.kind === "out") + '">Pago</button>' +
          '<button type="button" class="segmented__btn" role="tab" data-fkind="in" ' +
                  'aria-selected="' + (d.kind === "in") + '">Cobro</button>' +
          '<button type="button" class="segmented__btn" role="tab" data-fkind="transfer" ' +
                  'aria-selected="' + (d.kind === "transfer") + '">Ahorro</button>' +
        '</div>' +

        '<div class="field">' +
          '<label class="field__label" for="fName">Concepto</label>' +
          '<input type="text" class="field__input" id="fName" data-f="Name" maxlength="32" ' +
                 'placeholder="' + (d.kind === "in" ? "Nómina" :
                   d.kind === "transfer" ? "Ahorro del mes" : "Alquiler") + '" ' +
                 'value="' + esc(d.note) + '">' +
        '</div>' +

        /* Un trabajo por horas no tiene un importe: tiene una tarifa. Y
           hay quien ni eso sabe hasta que cobra. Tres formas de decirlo,
           y solo se enseña el campo de la que se elija. */
        (d.kind === "in"
          ? '<div class="field" style="margin-top:var(--sp-5)">' +
              '<span class="field__label">Cuánto cobras</span>' +
              '<div class="segmented" id="fModoSeg" role="tablist">' +
                '<span class="segmented__thumb" id="fModoThumb" aria-hidden="true"></span>' +
                '<button type="button" class="segmented__btn" role="tab" data-fmodo="fijo" ' +
                        'aria-selected="' + (modoImporte === "fijo") + '">Siempre igual</button>' +
                '<button type="button" class="segmented__btn" role="tab" data-fmodo="hora" ' +
                        'aria-selected="' + (modoImporte === "hora") + '">Por horas</button>' +
                '<button type="button" class="segmented__btn" role="tab" data-fmodo="varia" ' +
                        'aria-selected="' + (modoImporte === "varia") + '">Varía</button>' +
              '</div>' +
            '</div>'
          : "") +

        (modoImporte === "hora"
          ? '<div class="field" style="margin-top:var(--sp-5)">' +
              numField("fTarifa", "Lo que cobras por hora", d.tarifa, 0.5) +
              '<p class="field__hint">Cada vez que toque, la app te pregunta ' +
                'cuántas horas has echado y hace la cuenta.</p>' +
            '</div>'

          : modoImporte === "varia"
            ? '<div class="field" style="margin-top:var(--sp-5)">' +
                numField("fAmount", "Más o menos (opcional)", d.amount, 5) +
                '<p class="field__hint">Solo para hacerse una idea del mes. ' +
                  'Cada vez que toque se te preguntará la cifra de verdad, y ' +
                  'puedes dejar esto vacío.</p>' +
              '</div>'

            : '<div class="field" style="margin-top:var(--sp-5)">' +
                numField("fAmount", "Importe", d.amount, 5) +
              '</div>') +

        /* Con qué ritmo se repite. Dos opciones y ya: nadie quiere una
           pantalla de reglas de calendario para apuntar el alquiler. */
        '<div class="field" style="margin-top:var(--sp-5)">' +
          '<span class="field__label">Cada cuánto</span>' +
          '<div class="segmented" id="fFreqSeg" role="tablist">' +
            '<span class="segmented__thumb" id="fFreqThumb" aria-hidden="true"></span>' +
            '<button type="button" class="segmented__btn" role="tab" data-ffreq="mensual" ' +
                    'aria-selected="' + !esSem + '">Al mes</button>' +
            '<button type="button" class="segmented__btn" role="tab" data-ffreq="semanal" ' +
                    'aria-selected="' + esSem + '">A la semana</button>' +
          '</div>' +
        '</div>' +

        /* Y qué día. Los siete días caben en una fila a lo ancho de la
           hoja; metidos en media columna se partían en dos. */
        (esSem
          ? '<div class="field" style="margin-top:var(--sp-5)">' +
              '<span class="field__label">Qué día</span>' +
              '<div class="chips chips--dias" role="group" aria-label="Días de la semana">' +
                DIAS_LARGO.map(function (nombre, i) {
                  return '<button type="button" class="chip chip--dia" data-fweekday="' + i + '" ' +
                         'aria-pressed="' + (d.weekdays.indexOf(i) >= 0) + '" ' +
                         'aria-label="' + esc(nombre) + '">' +
                         esc(S.DOW_SHORT[i]) + '</button>';
                }).join("") +
              '</div>' +
              '<p class="field__hint">Puedes marcar varios.</p>' +
            '</div>'
          : '<div class="field" style="margin-top:var(--sp-5)">' +
              '<label class="field__label" for="fDay">Día del mes</label>' +
              '<input type="number" class="field__input" id="fDay" data-f="Day" min="1" max="28" ' +
                     'step="1" inputmode="numeric" value="' + esc(d.day) + '">' +
            '</div>') +

        /* Las catorce pagas son cosa de las nóminas de aquí: dos extras,
           en junio y en diciembre. Solo tiene sentido en cobros mensuales. */
        (d.kind === "in" && !esSem
          ? '<div class="field" style="margin-top:var(--sp-5)">' +
              '<span class="field__label">Pagas al año</span>' +
              '<div class="segmented" id="fPagasSeg" role="tablist">' +
                '<span class="segmented__thumb" id="fPagasThumb" aria-hidden="true"></span>' +
                '<button type="button" class="segmented__btn" role="tab" data-fpagas="12" ' +
                        'aria-selected="' + (+d.pagas !== 14) + '">12</button>' +
                '<button type="button" class="segmented__btn" role="tab" data-fpagas="14" ' +
                        'aria-selected="' + (+d.pagas === 14) + '">14</button>' +
              '</div>' +
            '</div>'
          : "") +

        /* El sueldo casi nunca cae clavado: horas de más, un mes con
           menos días trabajados... Con esto la app pregunta en vez de
           apuntar una cifra que luego hay que corregir a mano. */
        /* Con «Por horas» o «Varía» ya se pregunta siempre: ofrecer el
           interruptor sería ofrecer algo que no se puede apagar. */
        (modoImporte === "fijo"
          ? switchRow("fConfirmar", "Preguntarme el importe",
              d.kind === "in"
                ? "Antes de apuntarlo te enseña la cifra por si cobras algo más o menos"
                : "Antes de apuntarlo te deja ajustar la cifra",
              d.confirmar)
          : '<p class="field__hint" style="margin-top:var(--sp-4)">' +
              icon("check", 12) + ' Se te preguntará cada vez, que para eso ' +
              'no hay una cifra fija.</p>') +

        /* Hora, aviso, cuenta y categoría van recogidos. Con nueve
           controles delante, crear una nómina normal daba pereza; lo de
           arriba —concepto, importe, cada cuánto y qué día— es lo que casi
           siempre basta. */
        '<div class="field" style="margin-top:var(--sp-4)">' +
          '<button type="button" class="fold-head fold-head--suelto" id="fOpciones" ' +
                  'aria-expanded="' + opcionesAbiertas + '">' +
            '<span class="card__title">Más opciones</span>' +
            '<span class="fold-head__chev" data-icon="chevDown" data-icon-size="15"></span>' +
          '</button>' +
          '<div class="fold" data-open="' + opcionesAbiertas + '">' +
            '<div class="fold__inner">' +

              /* A qué hora. Un aviso a las nueve de la mañana de algo que
                 se cobra al salir del turno no sirve de nada. */
              '<div class="field__row">' +
                '<div>' +
                  '<label class="field__label" for="fHora">A qué hora</label>' +
                  '<input type="time" class="field__input" id="fHora" data-f="Hora" ' +
                         'value="' + esc(d.hora || "09:00") + '">' +
                '</div>' +
                '<div></div>' +
              '</div>' +

              switchRow("fAvisar", "Avisarme en el móvil",
                "Una notificación el día que toque, a esa hora",
                d.avisar) +

              /* Un préstamo tiene final. Sin esto había que acordarse de
                 apagarlo a mano el mes que se termina de pagar. */
              (d.kind === "out"
                ? '<div class="field" style="margin-top:var(--sp-5)">' +
                    numField("fCuotas", "Cuántas veces en total", d.cuotas, 1, "veces") +
                    '<p class="field__hint">' +
                      (parseFloat(d.cuotas) > 0
                        ? (ui.form.id && cuotasHechas
                            ? "Llevas " + cuotasHechas + " de " + parseInt(d.cuotas, 10) +
                              ". Cuando se paguen todas se apagará solo."
                            : "Se apagará solo cuando se hayan pagado las " +
                              parseInt(d.cuotas, 10) + ".")
                        : "Déjalo vacío si no se acaba nunca, como el alquiler. " +
                          "Ponlo si es un préstamo: 12, 24, las que sean.") +
                    '</p>' +
                  '</div>'
                : "") +

              (d.kind === "transfer"
                ? '<div class="field__row" style="margin-top:var(--sp-5)">' +
                    '<div>' +
                      '<span class="field__label">Desde</span>' +
                      accountSelect("fAccount", d.accountId) +
                    '</div>' +
                    '<div>' +
                      '<span class="field__label">Hacia</span>' +
                      accountSelect("fToAccount", d.toAccountId) +
                    '</div>' +
                  '</div>'
                : '<div class="field__row" style="margin-top:var(--sp-5)">' +
                    '<div>' +
                      '<span class="field__label">Categoría</span>' +
                      pickField("fCat", d.categoryId, catOf(d.categoryId).name) +
                    '</div>' +
                    '<div>' +
                      '<span class="field__label">Cuenta</span>' +
                      accountSelect("fAccount", d.accountId) +
                    '</div>' +
                  '</div>') +
            '</div>' +
          '</div>' +
        '</div>' +

        '<p class="field__hint">' +
          (mismaCuenta
            ? icon("warning", 12) + " Elige dos cuentas distintas."
            : esSem
              ? listaDias(d.weekdays) + "."
              : (d.kind === "in" && +d.pagas === 14
                  ? "Cada mes, con paga extra en junio y en diciembre. Máximo día 28."
                  : "Cada mes. Máximo día 28.")) +
        '</p>';
    }

    var bloqueado = t === "recurring" && d.kind === "transfer" &&
                    d.accountId === d.toAccountId;

    body.innerHTML = html +
      '<div class="field" style="margin-top:var(--sp-6)">' +
        '<button type="button" class="btn btn--primary" id="fSave"' +
          (bloqueado ? " disabled" : "") + '>' +
          icon("check", 17) +
          (t === "saldo" ? "Corregir"
           : t === "resumen" ? "Aplicar"
           : ui.form.id ? "Guardar cambios" : "Crear") + '</button>' +
      '</div>' +
      (ui.form.id && t !== "saldo" && t !== "resumen"
        ? '<div class="field">' +
            '<button type="button" class="btn btn--danger" id="fDelete" style="width:100%">' +
              icon("trash", 16) + 'Eliminar</button>' +
          '</div>'
        : "");

    mountIcons(body);
    requestAnimationFrame(function () {
      var seg = $("#fSeg", body);
      if (seg) U.slideIndicator(seg, $("#fThumb", body),
        $('[data-fkind="' + d.kind + '"]', seg));

      var segF = $("#fFreqSeg", body);
      if (segF) U.slideIndicator(segF, $("#fFreqThumb", body),
        $('[data-ffreq="' + (d.freq === "semanal" ? "semanal" : "mensual") + '"]', segF));

      var segM = $("#fModoSeg", body);
      if (segM) U.slideIndicator(segM, $("#fModoThumb", body),
        $('[data-fmodo="' + modoImporte + '"]', segM));

      var segP = $("#fPagasSeg", body);
      if (segP) U.slideIndicator(segP, $("#fPagasThumb", body),
        $('[data-fpagas="' + (+d.pagas === 14 ? 14 : 12) + '"]', segP));
    });
  }

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
  A.numField = numField;
  A.openForm = openForm;
  A.renderForm = renderForm;
  A.ritmoDe = ritmoDe;
  A.switchRow = switchRow;

  A.wire(wire);
})();
