/* ============================================================
   split — hoja: guardar y borrar del formulario

   Lo que pasa al pulsar el botón. Está aparte de form.js porque
   son dos cosas distintas: una abre y pinta, la otra escribe.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, $ = A.$, ui = A.ui, sheets = A.sheets;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function abrirCobros() { return A.abrirCobros.apply(null, arguments); }
  function hayPendientes() { return A.hayPendientes.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function renderAddSheet() { return A.renderAddSheet.apply(null, arguments); }
  function renderAll() { return A.renderAll.apply(null, arguments); }
  function sincronizarAvisos() { return A.sincronizarAvisos.apply(null, arguments); }

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

    if (t === "aportar") {
      var cuanto = parseFloat(d.importe);
      if (!(cuanto > 0)) {
        U.toast("Pon cuánto", { icon: "warning" }); return;
      }
      S.aportar(d.apartadoId, d.dir === "sacar" ? -cuanto : cuanto);
      U.toast(d.dir === "sacar"
        ? "Devuelto a la cuenta, " + money(cuanto)
        : "Apartado, " + money(cuanto), { icon: "check" });
    }

    if (t === "apartado") {
      if (!String(d.name).trim()) {
        U.toast("Ponle un nombre al apartado", { icon: "warning" }); return;
      }
      if (id) {
        S.updateApartado(id, d);
        U.toast("Apartado actualizado", { icon: "check" });
      } else {
        /* Si no se dice cuánto metes ahora, entra lo del ciclo: un sobre
           recién hecho y vacío no se entendería. */
        if (d.inicial === "" || d.inicial == null) d.inicial = d.porCiclo;
        S.addApartado(d);
        U.toast("Apartado creado", { icon: "check" });
      }
    }

    if (t === "apartado") {
      var resAp = S.deleteApartado(id);
      U.toast(resAp.sueltos
        ? "Apartado borrado · " + resAp.sueltos +
          (resAp.sueltos === 1 ? " gasto vuelve" : " gastos vuelven") + " al límite de la cuenta"
        : "Apartado borrado", { icon: "check", duration: resAp.sueltos ? 5000 : 3000 });
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

  /* --- lo que usan otros archivos --- */
  A.deleteForm = deleteForm;
  A.saveForm = saveForm;
})();
