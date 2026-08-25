/* ============================================================
   split — hoja: añadir y editar un movimiento
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, ui = A.ui, sheets = A.sheets;
  var DIAS_LARGO = A.DIAS_LARGO;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function catFace() { return A.catFace.apply(null, arguments); }
  function catOf() { return A.catOf.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function openForm() { return A.openForm.apply(null, arguments); }
  function pickField() { return A.pickField.apply(null, arguments); }
  function renderAjustes() { return A.renderAjustes.apply(null, arguments); }
  function renderAll() { return A.renderAll.apply(null, arguments); }
  function renderForm() { return A.renderForm.apply(null, arguments); }
  function sincronizarAvisos() { return A.sincronizarAvisos.apply(null, arguments); }
  function switchRow() { return A.switchRow.apply(null, arguments); }

  /* ============================================================
     Sheet · añadir / editar movimiento
     ============================================================ */

  /* `opts.accountId` deja la cuenta ya elegida: se usa al apuntar desde
     dentro de una cuenta, donde dar por hecho la primera sería absurdo. */
  function openAdd(kind, txId, opts) {
    var t = txId ? S.state.transactions.find(function (x) { return x.id === txId; }) : null;
    ui.editingId = txId || null;
    /* Cada vez que se abre, los detalles vuelven a estar recogidos: el
       plegable se abre solo si el movimiento ya trae algo dentro. */
    ui.detallesAbiertos = false;
    ui.catAbierta = null;
    var accs = S.state.accounts;
    ui.draft = t
      ? { kind: t.kind, amount: String(Math.round(t.amount * 100)), categoryId: t.categoryId,
          accountId: t.accountId, toAccountId: t.toAccountId || null,
          note: t.note, memo: t.memo || "", date: t.date, time: t.time || "",
          tags: Array.isArray(t.tags) ? t.tags.slice() : [],
          attachments: Array.isArray(t.attachments) ? t.attachments.slice() : [] }
      : { kind: kind || "out", amount: "", categoryId: kind === "in" ? "nomina" : "comida",
          accountId: (opts && opts.accountId) || accs[0].id,
          toAccountId: null,
          note: "", memo: "", date: S.ymd(new Date()), time: nowHHMM(),
          tags: [], attachments: [],
          /* reparto de un ingreso entre varias cuentas: apagado por
             defecto, y `trozos` guarda cuánto va a cada una */
          reparto: false, trozos: {},
          /* que el movimiento se repita a partir de ahora */
          repetir: false, repFreq: "mensual" };

    /* en un traspaso el destino tiene que ser otra cuenta */
    if (!t) {
      ui.draft.toAccountId = (accs.find(function (x) {
        return x.id !== ui.draft.accountId;
      }) || accs[0]).id;
    }

    /* los adjuntos viven en IndexedDB: se piden aparte y se pintan cuando
       llegan, sin bloquear la apertura del sheet */
    ui.draftAttachments = [];
    if (window.Attach && ui.draft.attachments.length) {
      window.Attach.getMany(ui.draft.attachments).then(function (list) {
        if (!sheets.add.open) return;
        ui.draftAttachments = list;
        refreshAttachments();
      });
    }

    $("#sheetAddTitle").textContent = txId ? "Editar movimiento" : "Nuevo movimiento";
    renderAddSheet();
    sheets.add.show();
  }

  /* Chips de etiqueta: las que ya existen se marcan, y el + abre un campo
     para escribir una nueva. Son transversales a la categoría, así que un
     movimiento puede llevar varias o ninguna. */
  function tagsFieldHtml(d) {
    var todas = S.state.tags || [];
    return '<div class="field">' +
        '<span class="field__label">Etiquetas</span>' +
        '<div class="chips" id="addTags">' +
          todas.map(function (tg) {
            var on = d.tags.indexOf(tg.id) >= 0;
            return '<button type="button" class="chip" data-tag="' + esc(tg.id) + '" ' +
                     'aria-pressed="' + on + '">' + esc(tg.name) + '</button>';
          }).join("") +
          '<button type="button" class="chip chip--add" id="addTagNew">' +
            icon("plus", 13) + 'Nueva' +
          '</button>' +
        '</div>' +
        (todas.length ? "" :
          '<p class="field__hint">Por ejemplo «Vacaciones» o «Coche»: valen para ' +
          'agrupar gastos de categorías distintas.</p>') +
      '</div>';
  }

  /* Los adjuntos no caben en localStorage, así que van en IndexedDB. Si el
     navegador no la deja usar (modo privado, políticas), no se ofrece el
     campo en vez de fallar al guardar. */
  function attachFieldHtml() {
    if (!window.Attach || !window.Attach.supported()) return "";
    return '<div class="field">' +
        '<span class="field__label">Adjuntos</span>' +
        '<div class="attach" id="addAttach"></div>' +
        '<input type="file" id="attachFile" accept="image/*" class="visually-hidden">' +
      '</div>';
  }

  function refreshAttachments() {
    var box = $("#addAttach");
    if (!box) return;
    var list = ui.draftAttachments || [];
    box.innerHTML =
      list.map(function (a) {
        return '<div class="attach__item">' +
            '<img class="attach__img" src="' + esc(a.dataUrl) + '" alt="' + esc(a.name) + '">' +
            '<button type="button" class="attach__del" data-attach-del="' + esc(a.id) + '" ' +
                    'aria-label="Quitar adjunto">' + icon("close", 12) + '</button>' +
          '</div>';
      }).join("") +
      '<button type="button" class="attach__add" id="attachAdd" aria-label="Añadir adjunto">' +
        icon("plus", 18) +
      '</button>';
    mountIcons(box);
  }

  /* «Que se repita»: apagado no ocupa casi nada, y encendido enseña solo
     cada cuánto y qué día. Todo lo demás —categoría, cuenta, importe— ya
     lo tiene el movimiento que se está apuntando. */
  function repetirHtml(d) {
    var fecha = S.parseYmd(d.date);
    var diaMes = Math.min(28, fecha.getDate());
    var diaSem = (fecha.getDay() + 6) % 7;

    if (!d.repetir) {
      return switchRow("addRepetir", "Que se repita",
        "Y lo apunto yo solo cada vez que toque", false);
    }

    return switchRow("addRepetir", "Que se repita",
        "Y lo apunto yo solo cada vez que toque", true) +

      '<div class="field" style="margin-top:var(--sp-3)">' +
        '<div class="segmented" id="addRepSeg" role="tablist">' +
          '<span class="segmented__thumb" id="addRepThumb" aria-hidden="true"></span>' +
          '<button type="button" class="segmented__btn" role="tab" data-repfreq="mensual" ' +
                  'aria-selected="' + (d.repFreq !== "semanal") + '">Cada mes</button>' +
          '<button type="button" class="segmented__btn" role="tab" data-repfreq="semanal" ' +
                  'aria-selected="' + (d.repFreq === "semanal") + '">Cada semana</button>' +
        '</div>' +
        '<p class="field__hint">' +
          (d.repFreq === "semanal"
            ? "Todos los " + DIAS_LARGO[diaSem].toLowerCase() + ", como hoy."
            : "El día " + diaMes + " de cada mes, como hoy.") +
          ' Luego se puede afinar en Mi dinero.</p>' +
      '</div>';
  }

  /* Lo que no hace falta ver para apuntar un gasto normal. Se abre solo
     cuando el movimiento ya trae algo dentro: si estás editando una cena
     con foto y notas y no las vieras, pensarías que se han perdido. */
  function detallesHtml(d) {
    var traeAlgo = !!(String(d.note).trim() || String(d.memo).trim() ||
                      (d.tags && d.tags.length) ||
                      (ui.draftAttachments && ui.draftAttachments.length) ||
                      /* en un traspaso las dos cuentas están aquí dentro y
                         son imprescindibles: no se puede empezar cerrado */
                      d.kind === "transfer");
    var abierto = ui.detallesAbiertos || traeAlgo;

    return '<div class="field" style="margin-top:var(--sp-4)">' +
        '<button type="button" class="fold-head fold-head--suelto" id="addDetalles" ' +
                'aria-expanded="' + abierto + '">' +
          '<span class="card__title">Más detalles</span>' +
          '<span class="fold-head__chev" data-icon="chevDown" data-icon-size="15"></span>' +
        '</button>' +

        '<div class="fold" data-open="' + abierto + '">' +
          '<div class="fold__inner">' +

            '<div class="field">' +
              '<label class="field__label" for="addNote">Título</label>' +
              '<input type="text" class="field__input" id="addNote" maxlength="40" ' +
                     'placeholder="' + esc(catOf(d.categoryId).name) + '" ' +
                     'value="' + esc(d.note) + '">' +
            '</div>' +

            (d.kind === "transfer"
              ? '<div class="field__row">' +
                  '<div>' +
                    '<span class="field__label">Desde</span>' +
                    accountSelect("addAccount", d.accountId) +
                  '</div>' +
                  '<div>' +
                    '<span class="field__label">Hacia</span>' +
                    accountSelect("addToAccount", d.toAccountId) +
                  '</div>' +
                '</div>'
              : "") +

            '<div class="field__row">' +
              '<div>' +
                '<label class="field__label" for="addDate">Fecha</label>' +
                '<input type="date" class="field__input" id="addDate" value="' +
                       esc(d.date) + '" max="' + esc(S.ymd(new Date())) + '">' +
              '</div>' +
              '<div>' +
                '<label class="field__label" for="addTime">Hora</label>' +
                '<input type="time" class="field__input" id="addTime" value="' +
                       esc(d.time) + '">' +
              '</div>' +
            '</div>' +

            tagsFieldHtml(d) +

            '<div class="field">' +
              '<label class="field__label" for="addMemo">Notas</label>' +
              '<textarea class="field__input field__input--area" id="addMemo" rows="3" ' +
                        'maxlength="500" placeholder="Lo que quieras recordar de este ' +
                        'movimiento">' + esc(d.memo) + '</textarea>' +
            '</div>' +

            attachFieldHtml() +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function nowHHMM() {
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function accountSelect(id, selected) {
    var a = S.state.accounts.find(function (x) { return x.id === selected; })
            || S.state.accounts[0];
    return pickField(id, a ? a.id : "", a ? a.name : "—");
  }

  /* Las opciones de cada desplegable, en un sitio: así el campo y la hoja
     que abre no se pueden desincronizar. */
  function opcionesDe(id) {
    if (id === "addAccount" || id === "addToAccount" ||
        id === "fAccount" || id === "fToAccount") {
      return {
        titulo: (id === "addToAccount" || id === "fToAccount") ? "¿Hacia dónde?" : "¿Qué cuenta?",
        lista: S.state.accounts.map(function (a) {
          return { value: a.id, label: a.name, sub: a.type, color: a.color || 1 };
        })
      };
    }
    if (id === "fCat") {
      var kind = ui.form.d.kind === "in" ? "in" : "out";
      return {
        titulo: "¿Qué categoría?",
        lista: S.CATEGORIES.filter(function (c) { return c.kind === kind; })
          .map(function (c) {
            return { value: c.id, label: c.name, emoji: c.emoji, color: c.color };
          })
      };
    }
    if (id === "fMadre") {
      var lista = [{ value: "", label: "Nada, va suelta" }];
      S.categoriasMadre(ui.form.d.kind).forEach(function (c) {
        if (c.id === ui.form.id || c.sistema) return;
        lista.push({ value: c.id, label: c.name, emoji: c.emoji, color: c.color });
      });
      return { titulo: "¿Dentro de cuál?", lista: lista };
    }
    if (id === "fType") {
      return {
        titulo: "¿Qué tipo de cuenta?",
        lista: ["Banco", "Ahorro", "Efectivo", "Tarjeta"].map(function (x) {
          return { value: x, label: x };
        })
      };
    }
    if (id === "incMonths") {
      return {
        titulo: "¿Cuántos meses promedia?",
        lista: [3, 6, 12].map(function (n) {
          return { value: n, label: n + " meses" };
        })
      };
    }
    return null;
  }

  /* Qué hacer con lo elegido. Cada campo sabe lo suyo. */
  function aplicarPick(id, valor) {
    if (id === "addAccount") {
      ui.draft.accountId = valor;
      renderAddSheet();
    } else if (id === "addToAccount") {
      ui.draft.toAccountId = valor;
      renderAddSheet();
    } else if (id === "fAccount") {
      ui.form.d.accountId = valor; renderForm();
    } else if (id === "fToAccount") {
      ui.form.d.toAccountId = valor; renderForm();
    } else if (id === "fCat") {
      ui.form.d.categoryId = valor; renderForm();
    } else if (id === "fMadre") {
      ui.form.d.parentId = valor;
      /* hereda el color de la madre, como hace el store al guardar */
      if (valor) ui.form.d.color = catOf(valor).color;
      renderForm();
    } else if (id === "fType") {
      ui.form.d.type = valor; renderForm();
    } else if (id === "incMonths") {
      S.setIncome({ months: +valor }); renderAjustes();
    }
  }

  function draftValue() {
    return ui.draft.amount ? parseInt(ui.draft.amount, 10) / 100 : 0;
  }

  function renderAddSheet() {
    var d = ui.draft;
    var body = $("#sheetAddBody");
    /* En la cuadrícula solo van las de primer nivel. Las que estén dentro
       de otra salen en una fila aparte al tocar su madre, y así no se
       mezclan doce categorías con sus veinte hijas. */
    var cats = S.categoriasMadre(d.kind);
    var elegida = catOf(d.categoryId);
    /* si lo elegido es una hija, su madre aparece abierta */
    var abierta = elegida && elegida.parentId ? elegida.parentId : ui.catAbierta;
    var hijas = abierta ? S.hijasDe(abierta) : [];
    var v = draftValue();

    body.innerHTML =
      '<div class="segmented" id="addSeg" role="tablist">' +
        '<span class="segmented__thumb" id="addThumb" aria-hidden="true"></span>' +
        '<button type="button" class="segmented__btn" role="tab" data-dkind="out" ' +
                'aria-selected="' + (d.kind === "out") + '">Gasto</button>' +
        '<button type="button" class="segmented__btn" role="tab" data-dkind="in" ' +
                'aria-selected="' + (d.kind === "in") + '">Ingreso</button>' +
        '<button type="button" class="segmented__btn" role="tab" data-dkind="transfer" ' +
                'aria-selected="' + (d.kind === "transfer") + '">Traspaso</button>' +
      '</div>' +

      '<div class="amount-display' + (v === 0 ? " is-zero" : "") + '" id="amountDisplay" ' +
           'data-kind="' + d.kind + '" aria-live="polite">' +
        '<span class="amount-display__sign">' +
          (d.kind === "in" ? "+" : d.kind === "transfer" ? "" : "−") + '</span>' +
        '<span id="amountText">' + esc(S.num2.format(v)) + '</span>' +
        '<span class="amount-display__cur">€</span>' +
      '</div>' +

      '<div class="keypad" id="keypad">' +
        [1,2,3,4,5,6,7,8,9].map(function (n) {
          return '<button type="button" class="key" data-key="' + n + '">' + n + '</button>';
        }).join("") +
        '<button type="button" class="key" data-key="00">00</button>' +
        '<button type="button" class="key" data-key="0">0</button>' +
        '<button type="button" class="key" data-key="del" aria-label="Borrar">' +
          icon("backspace", 18) + '</button>' +
      '</div>' +

      (d.kind === "transfer"
        ? '<div class="field__row">' +
            '<div>' +
              '<label class="field__label" for="addAccount">Desde</label>' +
              accountSelect("addAccount", d.accountId) +
            '</div>' +
            '<div>' +
              '<label class="field__label" for="addToAccount">Hacia</label>' +
              accountSelect("addToAccount", d.toAccountId) +
            '</div>' +
          '</div>' +
          (d.accountId === d.toAccountId
            ? '<p class="field__hint">' + icon("warning", 12) +
              ' Elige dos cuentas distintas.</p>'
            : '' +
              '')
        : '<div class="field">' +
            '<span class="field__label">Categoría</span>' +
            '<div class="cat-grid">' +
              cats.map(function (c) {
                var conHijas = S.hijasDe(c.id).length > 0;
                return '<button type="button" class="cat-pick" data-cat="' + c.id + '" ' +
                         'aria-pressed="' + (c.id === d.categoryId) + '"' +
                         (conHijas ? ' data-con-hijas="1"' : '') + '>' +
                    catFace(c, 26, "cat-pick__icon") +
                    '<span class="cat-pick__name">' + esc(c.name) + '</span>' +
                  '</button>';
              }).join("") +
              '<button type="button" class="cat-pick cat-pick--add" ' +
                      'data-cat-new="' + d.kind + '">' +
                '<span class="cat-pick__icon">' + icon("plus", 18) + '</span>' +
                '<span class="cat-pick__name">Nueva</span>' +
              '</button>' +
            '</div>' +

            /* Las de dentro, cuando hay una madre abierta. Se puede quedar
               en la madre sin más: elegir «Deudas» a secas es válido. */
            (abierta
              ? '<div class="chips" style="margin-top:var(--sp-3)">' +
                  hijas.map(function (h) {
                    return '<button type="button" class="chip" data-cat="' + h.id + '" ' +
                             'aria-pressed="' + (h.id === d.categoryId) + '">' +
                           esc(h.emoji || "") + ' ' + esc(h.name) + '</button>';
                  }).join("") +
                  '<button type="button" class="chip chip--add" ' +
                          'data-cat-new-hija="' + esc(abierta) + '">' +
                    icon("plus", 12) + 'Nueva dentro' +
                  '</button>' +
                '</div>'
              : "") +

            '<p class="field__hint">Mantén pulsada una categoría para editarla.</p>' +
          '</div>') +

      /* Solo en un traspaso hacen falta las dos cuentas delante. */
      (d.kind === "transfer"
        ? ""
        : d.reparto
          ? repartoHtml(d, v)
          : '<div class="field" style="margin-top:var(--sp-4)">' +
              '<span class="field__label">Cuenta</span>' +
              accountSelect("addAccount", d.accountId) +
            '</div>') +

      /* Solo tiene sentido en un ingreso nuevo y con más de una cuenta:
         editar uno ya guardado es editar ese, no repartir de nuevo. */
      (d.kind === "in" && !ui.editingId && S.state.accounts.length > 1
        ? '<button type="button" class="btn btn--ghost" id="addReparto" ' +
                  'style="width:100%;margin-top:var(--sp-3)">' +
            icon(d.reparto ? "close" : "swap", 15) +
            (d.reparto ? "Ingresar todo en una cuenta" : "Repartir entre varias cuentas") +
          '</button>'
        : "") +

      /* Programar desde aquí. Antes había que apuntar el traspaso y luego
         irse a otra pantalla a crear el programado con los mismos datos.
         Repetir un pago, un cobro o un traspaso es lo mismo, así que se
         ofrece igual en los tres. */
      (ui.editingId ? "" : repetirHtml(d)) +

      /* Y el resto, cerrado. Apuntar un café son dos toques: importe y
         categoría. Tener delante título, fecha, hora, etiquetas, notas y
         adjuntos convertía eso en un formulario que hay que atravesar con
         la vista cada vez.

         No se pierde nada: lo que no se rellena tiene un valor sensato
         —el título es el nombre de la categoría, la fecha hoy, la hora
         ahora—. Y si el movimiento que se edita ya trae detalles, se abre
         solo, que si no parecería que se han borrado. */
      detallesHtml(d) +

      '<div class="field" style="margin-top:var(--sp-5)">' +
        '<button type="button" class="btn btn--primary" id="addSave"' +
          ((v <= 0 || (d.kind === "transfer" && d.accountId === d.toAccountId))
            ? " disabled" : "") + '>' +
          icon("check", 17) + (ui.editingId ? "Guardar cambios" : "Guardar movimiento") +
        '</button>' +
      '</div>' +

      (ui.editingId
        ? '<div class="field">' +
            '<button type="button" class="btn btn--danger" id="addDelete" style="width:100%">' +
              icon("trash", 16) + 'Eliminar movimiento</button>' +
          '</div>'
        : "");

    mountIcons(body);
    refreshAttachments();
    requestAnimationFrame(function () {
      var seg = $("#addSeg", body);
      if (seg) U.slideIndicator(seg, $("#addThumb", body), $('[data-dkind="' + d.kind + '"]', seg));

      var segR = $("#addRepSeg", body);
      if (segR) U.slideIndicator(segR, $("#addRepThumb", body),
        $('[data-repfreq="' + (d.repFreq === "semanal" ? "semanal" : "mensual") + '"]', segR));
    });
  }

  /* ---------- repartir un ingreso entre cuentas ----------
     Se cobra una cantidad y no toda va al mismo sitio: una parte a la
     cuenta del día a día y otra a la hucha. Antes había que apuntar el
     ingreso entero y luego un traspaso a mano.

     No se inventa nada nuevo en los datos: se guarda un ingreso por
     cuenta. Cada uno es un movimiento normal, se edita y se borra por
     separado, y los saldos salen solos. */

  function sumaTrozos(d) {
    return S.state.accounts.reduce(function (t, a) {
      var v = parseFloat(d.trozos[a.id]);
      return t + (isFinite(v) && v > 0 ? v : 0);
    }, 0);
  }

  function restoPorRepartir(d, total) {
    return Math.round((total - sumaTrozos(d)) * 100) / 100;
  }

  function repartoHtml(d, total) {
    var resto = restoPorRepartir(d, total);

    return '<div class="field" style="margin-top:var(--sp-4)">' +
        '<div class="card__head" style="margin-bottom:var(--sp-3)">' +
          '<span class="field__label" style="margin:0">Cuánto va a cada cuenta</span>' +
          '<button type="button" class="card__link" id="addRepartoIgual">A partes iguales</button>' +
        '</div>' +

        S.state.accounts.map(function (a) {
          var val = d.trozos[a.id];
          return '<div class="reparto-fila">' +
              '<span class="reparto-fila__punto" ' +
                    'style="background:' + S.catColorVar(a) + '"></span>' +
              '<span class="reparto-fila__nombre">' + esc(a.name) + '</span>' +
              '<span class="input-affix reparto-fila__campo">' +
                '<input type="number" class="field__input" data-trozo="' + esc(a.id) + '" ' +
                       'min="0" step="0.01" inputmode="decimal" placeholder="0" ' +
                       'value="' + esc(val == null ? "" : val) + '">' +
                '<span class="input-affix__suffix">€</span>' +
              '</span>' +
            '</div>';
        }).join("") +

        '<div class="ajuste" id="addResto" data-dif="' +
              (Math.abs(resto) < 0.005 ? "cero" : resto > 0 ? "out" : "in") + '">' +
          textoResto(resto) +
        '</div>' +
      '</div>';
  }

  function textoResto(resto) {
    if (Math.abs(resto) < 0.005) {
      return '<span class="ajuste__txt">Repartido del todo.</span>';
    }
    if (resto > 0) {
      return '<span class="ajuste__txt">Queda por repartir</span>' +
             '<span class="ajuste__eur">' + esc(money(resto)) + '</span>';
    }
    return '<span class="ajuste__txt">Te has pasado</span>' +
           '<span class="ajuste__eur">' + esc(money(-resto)) + '</span>';
  }

  /* Se recalcula sin repintar: repintar dejaría el campo sin foco. */
  function refreshResto() {
    var caja = $("#addResto");
    if (!caja) return;
    var resto = restoPorRepartir(ui.draft, draftValue());
    caja.setAttribute("data-dif",
      Math.abs(resto) < 0.005 ? "cero" : resto > 0 ? "out" : "in");
    caja.innerHTML = textoResto(resto);
    refreshAmount();
  }

  function repartirIgual() {
    var cuentas = S.state.accounts;
    var total = draftValue();
    var trozo = Math.floor((total / cuentas.length) * 100) / 100;
    var acumulado = 0;

    cuentas.forEach(function (a, i) {
      /* el último se lleva lo que sobre del redondeo, para que la suma
         cuadre al céntimo */
      var v = i === cuentas.length - 1
        ? Math.round((total - acumulado) * 100) / 100
        : trozo;
      acumulado += v;
      ui.draft.trozos[a.id] = v;
    });

    renderAddSheet();
  }

  function refreshAmount() {
    var v = draftValue();
    var disp = $("#amountDisplay"), txt = $("#amountText"), save = $("#addSave");
    if (!disp || !txt) return;
    txt.textContent = S.num2.format(v);
    disp.classList.toggle("is-zero", v === 0);
    if (save) {
      var d = ui.draft;
      var repartoMal = d.reparto &&
        Math.abs(restoPorRepartir(d, v)) >= 0.005;
      save.disabled = v <= 0 ||
        (d.kind === "transfer" && d.accountId === d.toAccountId) ||
        repartoMal;
    }
  }

  function saveDraft() {
    var d = ui.draft, v = draftValue();
    if (v <= 0) return;

    /* Repartido: un ingreso por cuenta, todos con el mismo título, fecha
       y categoría. Los adjuntos van solo en el primero: duplicar la foto
       de una nómina en cada trozo ocuparía sitio para nada. */
    if (d.reparto && !ui.editingId) {
      var resto = restoPorRepartir(d, v);
      if (Math.abs(resto) >= 0.005) {
        U.toast(resto > 0
          ? "Todavía quedan " + money(resto) + " por repartir"
          : "Te has pasado en " + money(-resto), { icon: "warning" });
        return;
      }

      var adjuntos = (ui.draftAttachments || []).map(function (a) { return a.id; });
      var puestos = 0;
      S.state.accounts.forEach(function (a) {
        var trozo = parseFloat(d.trozos[a.id]);
        if (!(trozo > 0)) return;
        S.addTx({
          kind: "in", amount: trozo, categoryId: d.categoryId,
          accountId: a.id, toAccountId: null,
          note: d.note, memo: d.memo, date: d.date, time: d.time,
          tags: d.tags,
          attachments: puestos === 0 ? adjuntos : []
        });
        puestos++;
      });

      U.toast("Ingreso de " + money(v) + " repartido en " + puestos +
              (puestos === 1 ? " cuenta" : " cuentas"), { icon: "check" });
      U.haptic("success");
      sheets.add.close();
      renderAll();
      return;
    }

    var payload = {
      kind: d.kind, amount: v, categoryId: d.categoryId,
      accountId: d.accountId, toAccountId: d.toAccountId,
      note: d.note, memo: d.memo, date: d.date, time: d.time,
      tags: d.tags,
      attachments: (ui.draftAttachments || []).map(function (a) { return a.id; })
    };
    if (ui.editingId) {
      S.updateTx(ui.editingId, payload);
      U.toast("Movimiento actualizado", { icon: "check" });
    } else {
      S.addTx(payload);

      var queEs = d.kind === "in" ? "Ingreso" : d.kind === "transfer" ? "Traspaso" : "Gasto";

      if (d.repetir) {
        programarDesde(d, v);
        U.toast(queEs + " de " + money(v) + " guardado, y se repetirá",
                { icon: "repeat", duration: 4500 });
      } else {
        U.toast(queEs + " de " + money(v) + " guardado", { icon: "check" });
      }
    }
    U.haptic("success");
    sheets.add.close();
    renderAll();
  }

  /* Crea el programado a partir del movimiento que se acaba de apuntar.
     Se marca como ya hecho en este periodo: si no, al recargar la app
     volvería a apuntar el de hoy y saldría dos veces. */
  function programarDesde(d, importe) {
    var fecha = S.parseYmd(d.date);
    var semanal = d.repFreq === "semanal";

    S.addRecurring({
      kind: d.kind,
      note: String(d.note).trim() || catOf(d.categoryId).name,
      amount: importe,
      categoryId: d.kind === "transfer" ? "otros" : d.categoryId,
      accountId: d.accountId,
      toAccountId: d.kind === "transfer" ? d.toAccountId : null,
      freq: semanal ? "semanal" : "mensual",
      weekdays: [(fecha.getDay() + 6) % 7],
      day: Math.min(28, fecha.getDate()),
      hora: d.time || "09:00",
      yaHecho: !semanal,
      desde: d.date
    });

    sincronizarAvisos();
  }

  /* ============================================================
     Cableado
     ============================================================ */

  function wire() {
    /* --- sheet de añadir --- */
    var addBody = $("#sheetAddBody");

    /* Mantener pulsada cualquiera de las tres cifras del Resumen abre sus
       ajustes. El botón de debajo hace lo mismo y es lo que la gente va a
       encontrar; la pulsación larga es para quien ya lo sabe. */
    U.longPress($("#scrollArea"), "#kpiRow .stat", function () {
      openForm("resumen");
    });

    /* Mantener pulsada una categoría la abre para editar, en vez de
       seleccionarla. El clic que viene detrás se traga solo. */
    U.longPress(addBody, "[data-cat]", function (node) {
      ui.catReturnToAdd = true;
      sheets.add.close();
      openForm("category", node.getAttribute("data-cat"));
    });

    addBody.addEventListener("click", function (e) {
      var node;
      if ((node = e.target.closest("[data-key]"))) {
        var k = node.getAttribute("data-key");
        if (k === "del") ui.draft.amount = ui.draft.amount.slice(0, -1);
        else if (ui.draft.amount.length < 9)
          ui.draft.amount = (ui.draft.amount + k).replace(/^0+(?=\d)/, "");
        refreshAmount(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-dkind]"))) {
        ui.draft.kind = node.getAttribute("data-dkind");
        if (ui.draft.kind === "in") ui.draft.categoryId = "nomina";
        else if (ui.draft.kind === "out") ui.draft.categoryId = "comida";
        else ui.draft.categoryId = "otros";
        renderAddSheet(); U.haptic("light"); return;
      }
      if (e.target.closest("#addRepetir")) {
        ui.draft.repetir = !ui.draft.repetir;
        renderAddSheet(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-repfreq]"))) {
        ui.draft.repFreq = node.getAttribute("data-repfreq");
        renderAddSheet(); U.haptic("light"); return;
      }
      if (e.target.closest("#addDetalles")) {
        ui.detallesAbiertos = !ui.detallesAbiertos;
        renderAddSheet(); U.haptic("light"); return;
      }
      if (e.target.closest("#addReparto")) {
        ui.draft.reparto = !ui.draft.reparto;
        /* al encender, el importe entero va a la cuenta que estaba
           elegida: repartir desde cero obligaría a teclear dos veces */
        if (ui.draft.reparto) {
          ui.draft.trozos = {};
          ui.draft.trozos[ui.draft.accountId] = draftValue();
        }
        renderAddSheet(); U.haptic("light"); return;
      }
      if (e.target.closest("#addRepartoIgual")) {
        repartirIgual(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-cat-new]"))) {
        /* el borrador (importe incluido) sobrevive en ui.draft, así que al
           volver del formulario se sigue donde se estaba */
        ui.catReturnToAdd = true;
        sheets.add.close();
        openForm("category", null, { kind: node.getAttribute("data-cat-new") });
        return;
      }
      if ((node = e.target.closest("[data-cat-new-hija]"))) {
        ui.catReturnToAdd = true;
        var madre = node.getAttribute("data-cat-new-hija");
        sheets.add.close();
        openForm("category", null, { kind: ui.draft.kind, parentId: madre });
        return;
      }
      if ((node = e.target.closest("[data-cat]"))) {
        var elegido = node.getAttribute("data-cat");
        ui.draft.categoryId = elegido;

        /* Tocar una que tiene otras dentro la elige Y las enseña: quedarse
           en la madre es una respuesta válida, y afinar es un toque más. */
        if (node.hasAttribute("data-con-hijas")) {
          ui.catAbierta = ui.catAbierta === elegido ? null : elegido;
          renderAddSheet(); U.haptic("light");
          return;
        }

        $$("[data-cat]", addBody).forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === node));
        });
        var note = $("#addNote");
        if (note) note.placeholder = catOf(ui.draft.categoryId).name;
        U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-tag]"))) {
        var tid = node.getAttribute("data-tag");
        var pos = ui.draft.tags.indexOf(tid);
        if (pos >= 0) ui.draft.tags.splice(pos, 1); else ui.draft.tags.push(tid);
        node.setAttribute("aria-pressed", String(pos < 0));
        U.haptic("light");
        return;
      }
      if (e.target.closest("#addTagNew")) {
        var nombre = prompt("Nombre de la etiqueta");
        if (nombre == null) return;
        var tag = S.addTag(nombre);
        if (!tag) { U.toast("Ponle un nombre", { icon: "warning" }); return; }
        if (ui.draft.tags.indexOf(tag.id) < 0) ui.draft.tags.push(tag.id);
        renderAddSheet();
        refreshAttachments();
        U.haptic("light");
        return;
      }
      if (e.target.closest("#attachAdd")) { $("#attachFile").click(); return; }
      if ((node = e.target.closest("[data-attach-del]"))) {
        var aid = node.getAttribute("data-attach-del");
        ui.draftAttachments = (ui.draftAttachments || [])
          .filter(function (a) { return a.id !== aid; });
        /* del disco se va al guardar (o en la limpieza del arranque): si
           el usuario cierra sin guardar, el adjunto original sigue ahí */
        refreshAttachments();
        U.haptic("light");
        return;
      }
      if (e.target.closest("#addSave")) { saveDraft(); return; }
      if (e.target.closest("#addDelete")) {
        if (!confirm("¿Eliminar este movimiento?")) return;
        var removed = S.deleteTx(ui.editingId);
        sheets.add.close(); renderAll();
        U.toast("Movimiento eliminado", {
          icon: "trash", actionLabel: "Deshacer", duration: 5000,
          onAction: function () { S.restoreTx(removed); renderAll(); }
        });
      }
    });

    addBody.addEventListener("input", function (e) {
      if (e.target.id === "addNote") ui.draft.note = e.target.value;
      if (e.target.id === "addMemo") ui.draft.memo = e.target.value;
      if (e.target.hasAttribute("data-trozo")) {
        ui.draft.trozos[e.target.getAttribute("data-trozo")] = e.target.value;
        refreshResto();
      }
    });

    addBody.addEventListener("change", function (e) {
      if (e.target.id === "addDate") ui.draft.date = e.target.value;
      if (e.target.id === "addTime") ui.draft.time = e.target.value;
    });

    /* elegir imagen: se reduce y se guarda en IndexedDB antes de pintarla */
    addBody.addEventListener("change", function (e) {
      if (e.target.id !== "attachFile") return;
      var file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      U.toast("Procesando la imagen…", { icon: "upload" });
      window.Attach.put(file).then(function (rec) {
        ui.draftAttachments = (ui.draftAttachments || []).concat([rec]);
        refreshAttachments();
        U.haptic("success");
      }, function (err) {
        U.toast(err && err.message ? err.message : "No se ha podido adjuntar",
                { icon: "warning", duration: 4500 });
      });
    });

    document.addEventListener("keydown", function (e) {
      if (!sheets.add || !sheets.add.open) return;
      if (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (/^[0-9]$/.test(e.key)) {
        if (ui.draft.amount.length < 9)
          ui.draft.amount = (ui.draft.amount + e.key).replace(/^0+(?=\d)/, "");
        refreshAmount();
      } else if (e.key === "Backspace") {
        ui.draft.amount = ui.draft.amount.slice(0, -1); refreshAmount();
      } else if (e.key === "Enter") { saveDraft(); }
    });

  }


  /* --- lo que usan otros archivos --- */
  A.accountSelect = accountSelect;
  A.aplicarPick = aplicarPick;
  A.opcionesDe = opcionesDe;
  A.openAdd = openAdd;
  A.renderAddSheet = renderAddSheet;

  A.wire(wire);
})();
