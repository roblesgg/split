/* ============================================================
   split — hoja: elegir de una lista

   La hoja y, con ella, las opciones de todos los desplegables de la app y
   qué hacer con lo elegido. Juntas para que el campo y la hoja que abre no
   se puedan desincronizar.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, $ = A.$, $$ = A.$$, esc = A.esc, ui = A.ui, sheets = A.sheets;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function catOf() { return A.catOf.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function renderAddSheet() { return A.renderAddSheet.apply(null, arguments); }
  function renderAjustes() { return A.renderAjustes.apply(null, arguments); }
  function renderForm() { return A.renderForm.apply(null, arguments); }

  /* ============================================================
     Elegir de una lista

     Los <select> abren el menú del sistema: una lista gris, con su propia
     tipografía y sus propias esquinas, que no se parece a nada de lo que
     hay alrededor. En una pantalla cuidada canta más que cualquier otra
     cosa.

     Esto es lo mismo pero en una hoja de la app: cada opción una fila
     tocable, con su emoji o su color si lo tiene, y la elegida marcada.
     De paso se toca mejor con el pulgar que una lista de sistema.
     ============================================================ */

  /* Quién está esperando una elección vive en ui.pickPendiente. */

  /* opciones: [{ value, label, sub, emoji, color }] */
  function pick(titulo, opciones, valor) {
    return new Promise(function (resolver) {
      ui.pickPendiente = { resolver: resolver };

      $("#sheetPickTitle").textContent = titulo;
      $("#sheetPickBody").innerHTML = opciones.map(function (o) {
        var elegida = String(o.value) === String(valor);
        return '<button type="button" class="pick" data-pick="' + esc(o.value) + '" ' +
                 'aria-pressed="' + elegida + '">' +
            (o.emoji
              ? '<span class="pick__cara cat-face"' +
                  (o.color ? ' style="--cat-color:var(--cat-' + o.color + ')"' : '') +
                  '>' + esc(o.emoji) + '</span>'
              : o.color
                ? '<span class="pick__punto" style="background:var(--cat-' +
                    o.color + ')"></span>'
                : '') +
            '<span class="pick__texto">' +
              '<span class="pick__nombre">' + esc(o.label) + '</span>' +
              (o.sub ? '<span class="pick__sub">' + esc(o.sub) + '</span>' : "") +
              /* algunas opciones se ven mejor que se explican */
              (o.muestra
                ? '<span class="emoji-muestra" data-set="' + esc(o.muestra) + '">' +
                    "🍽️🏠☕🚗💰" + '</span>'
                : "") +
            '</span>' +
            (elegida
              ? '<span class="pick__tick" data-icon="check" data-icon-size="16"></span>'
              : '') +
          '</button>';
      }).join("");

      mountIcons($("#sheetPickBody"));
      sheets.pick.show();
    });
  }

  function abrirPick(id, valorActual) {
    var cfg = opcionesDe(id);
    if (!cfg) return;
    pick(cfg.titulo, cfg.lista, valorActual).then(function (v) {
      if (v == null) return;
      aplicarPick(id, v);
    });
  }

  /* Un campo que parece un desplegable pero abre la hoja de arriba. */
  function pickField(id, valor, texto) {
    return '<button type="button" class="field__input field__select" ' +
             'id="' + id + '" data-pick-open="' + esc(id) + '" ' +
             'data-value="' + esc(valor) + '">' +
        '<span class="field__select-txt">' + esc(texto) + '</span>' +
        '<span class="field__select-chev" data-icon="chevDown" data-icon-size="15"></span>' +
      '</button>';
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
    if (id === "cicloDia") {
      var dias = [];
      for (var d = 1; d <= S.CICLO_DIA_MAX; d++) {
        dias.push({
          value: d,
          label: d === 1 ? "Día 1 · como el calendario" : "Día " + d
        });
      }
      /* El tope es 28 por lo mismo que en los programados: un mes que
         empezara el 31 no existiría en febrero. */
      return { titulo: "¿Qué día empieza tu mes?", lista: dias };
    }
    if (id === "incMonths") {
      var palabra = S.esMesNatural() ? "meses" : "ciclos";
      return {
        titulo: "¿Cuántos " + palabra + " promedia?",
        lista: [3, 6, 12].map(function (n) {
          return { value: n, label: n + " " + palabra };
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
      /* hereda la cara de la madre, como hace el store al guardar */
      if (valor) {
        ui.form.d.color = catOf(valor).color;
        ui.form.d.emoji = catOf(valor).emoji;
      }
      renderForm();
    } else if (id === "fType") {
      ui.form.d.type = valor; renderForm();
    } else if (id === "incMonths") {
      S.setIncome({ months: +valor }); renderAjustes();
    } else if (id === "cicloDia") {
      S.setDiaDeCorte(+valor);
      renderAjustes();
      U.toast(S.esMesNatural()
        ? "Tu mes vuelve a ser el del calendario"
        : "Tu mes empieza el día " + S.diaDeCorte(), { icon: "check" });
    }
  }
  /* ============================================================
     Cableado
     ============================================================ */

  function wire() {
    /* Los desplegables propios salen en las vistas y también dentro de
       varias hojas, así que se escuchan una sola vez en el documento en
       vez de repetir el mismo enganche en cada sitio. */
    document.addEventListener("click", function (e) {
      var node = e.target.closest("[data-pick-open]");
      if (!node) return;
      abrirPick(node.getAttribute("data-pick-open"), node.getAttribute("data-value"));
    });
    /* Cerrar sin elegir resuelve a null: quien la abrió deja las cosas
       como estaban en vez de quedarse esperando para siempre. */
    sheets.pick.onClose = function () {
      if (!ui.pickPendiente) return;
      var r = ui.pickPendiente.resolver;
      ui.pickPendiente = null;
      r(null);
    };

    $("#sheetPickBody").addEventListener("click", function (e) {
      var node = e.target.closest("[data-pick]");
      if (!node || !ui.pickPendiente) return;
      var r = ui.pickPendiente.resolver;
      ui.pickPendiente = null;
      sheets.pick.close();
      U.haptic("light");
      r(node.getAttribute("data-pick"));
    });
  }


  /* --- lo que usan otros archivos --- */
  A.pick = pick;
  A.pickField = pickField;

  A.wire(wire);
})();
