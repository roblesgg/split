/* ============================================================
   split — hoja: añadir y editar un movimiento

   Abrir, las opciones de cada campo, guardar y el cableado. Lo que pinta
   está al lado, en add-render.js.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, ui = A.ui, sheets = A.sheets;
  var DIAS_LARGO = A.DIAS_LARGO;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function accountSelect() { return A.accountSelect.apply(null, arguments); }
  function catOf() { return A.catOf.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function openForm() { return A.openForm.apply(null, arguments); }
  function refreshAmount() { return A.refreshAmount.apply(null, arguments); }
  function refreshResto() { return A.refreshResto.apply(null, arguments); }
  function renderAddSheet() { return A.renderAddSheet.apply(null, arguments); }
  function renderAll() { return A.renderAll.apply(null, arguments); }
  function repartirIgual() { return A.repartirIgual.apply(null, arguments); }
  function restoPorRepartir() { return A.restoPorRepartir.apply(null, arguments); }
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

  function draftValue() {
    return ui.draft.amount ? parseInt(ui.draft.amount, 10) / 100 : 0;
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
  A.detallesHtml = detallesHtml;
  A.draftValue = draftValue;
  A.openAdd = openAdd;
  A.refreshAttachments = refreshAttachments;
  A.repetirHtml = repetirHtml;

  A.wire(wire);
})();
