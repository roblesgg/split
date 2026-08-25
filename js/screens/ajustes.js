/* ============================================================
   split — pantalla: Ajustes

   Qué hace cada fila, el editor del reparto y el cableado. Lo que pinta
   está al lado, en ajustes-render.js.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, Up = A.Up, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, ui = A.ui;
  var DIAS_LARGO = A.DIAS_LARGO;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function cycleTheme() { return A.cycleTheme.apply(null, arguments); }
  function pick() { return A.pick.apply(null, arguments); }
  function renderAll() { return A.renderAll.apply(null, arguments); }
  function startOnboarding() { return A.startOnboarding.apply(null, arguments); }
  function renderAjustes() { return A.renderAjustes.apply(null, arguments); }

  function themeLabel(t) {
    return t === "dark" ? "Oscuro" : t === "light" ? "Claro" : "Automático, como el sistema";
  }
  function themeShort(t) {
    return t === "dark" ? "Oscuro" : t === "light" ? "Claro" : "Automático";
  }

  /* Los emojis de Apple, Samsung y Xiaomi son fuentes propietarias: no se
     pueden meter dentro de la app. Quien los quiera los tiene ya con
     «Sistema», que es justo lo que le pinta su móvil. Lo que se puede
     traer son los dos de licencia abierta. */
  var EMOJI_NOMBRE = {
    sistema: "Los de tu móvil",
    noto: "Noto, los de Google",
    twemoji: "Twemoji, planos"
  };
  var EMOJI_CORTO = { sistema: "Tu móvil", noto: "Noto", twemoji: "Twemoji" };

  function emojiHint(v) { return EMOJI_NOMBRE[v] || EMOJI_NOMBRE.sistema; }
  function emojiCorto(v) { return EMOJI_CORTO[v] || EMOJI_CORTO.sistema; }

  function settingRow(ic, label, hint, action, value) {
    return '<button type="button" class="setting" data-setting="' + action + '">' +
        '<span class="setting__icon" data-icon="' + ic + '" data-icon-size="15"></span>' +
        '<span class="setting__body">' +
          '<span class="setting__label">' + esc(label) + '</span>' +
          '<span class="setting__hint">' + esc(hint) + '</span>' +
        '</span>' +
        (value ? '<span class="setting__value">' + esc(value) + '</span>' : "") +
        '<span class="setting__chev" data-icon="chevron" data-icon-size="14"></span>' +
      '</button>';
  }

  /* repinta solo las partes vivas del reparto, sin perder el foco del slider */
  function refreshAllocation() {
    var planned = S.plannedIncome();
    var sum = S.allocationSum();
    var savings = S.savingsPct();
    var bar = $("#allocBar");
    var total = $("#allocTotal");
    var summary = $("#allocSummary");
    if (!bar) return;

    var segs = S.budgetedCategories()
      .map(function (c) {
        return { pct: S.state.allocation[c.id] || 0, color: c.color, name: c.name };
      })
      .filter(function (r) { return r.pct > 0; })
      .sort(function (a, b) { return b.pct - a.pct; });

    bar.innerHTML = segs.map(function (r) {
      return '<span class="alloc-bar__seg" style="flex:' + r.pct + ';background:' +
             S.catColorVar(r) + '" title="' + esc(r.name) + ' · ' + r.pct + ' %"></span>';
    }).join("") + (savings > 0
      ? '<span class="alloc-bar__seg alloc-bar__seg--rest" style="flex:' + savings +
        '" title="Ahorro · ' + savings + ' %"></span>'
      : "");

    var state = sum > 100 ? "over" : sum === 100 ? "ok" : "under";
    total.setAttribute("data-state", state);
    total.textContent = sum + " % repartido";

    summary.innerHTML = sum > 100
      ? "Te has pasado " + (sum - 100) + " puntos. Baja alguna partida."
      : "Quedan <strong>" + savings + " %</strong> para ahorro, " +
        esc(S.moneyShort(Math.round(planned * savings / 100))) + " al mes.";

    /* El campo en euros NO se reescribe mientras se teclea: hacerlo
       movería el cursor a media cifra. Solo se refresca el porcentaje. */
    $$("[data-alloc-pct]").forEach(function (n) {
      n.textContent = (S.state.allocation[n.getAttribute("data-alloc-pct")] || 0) +
                      " % de lo que entra";
    });
  }

  function bindAjustes() {
    var root = $("#view-ajustes");

    root.addEventListener("input", function (e) {
      if (e.target.id === "incManual") {
        S.setIncome({ manual: e.target.value });
        refreshAllocation();
      } else if (e.target.matches("[data-alloc-eur]")) {
        S.setAllocationEuros(e.target.getAttribute("data-alloc-eur"), e.target.value);
        refreshAllocation();
      }
    });

    root.addEventListener("click", function (e) {
      var node;

      if ((node = e.target.closest("[data-incmode]"))) {
        S.setIncome({ mode: node.getAttribute("data-incmode") });
        renderAjustes();
        U.haptic("light");
        return;
      }

      /* Añadir una categoría al presupuesto: entra con un décimo de lo
         que cobras, una cifra redonda de la que partir en vez de un cero
         que no dice nada. */
      if ((node = e.target.closest("[data-alloc-add]"))) {
        S.setAllocation(node.getAttribute("data-alloc-add"), 10);
        renderAjustes();
        U.haptic("light");
        return;
      }

      if ((node = e.target.closest("[data-alloc-quitar]"))) {
        S.removeAllocation(node.getAttribute("data-alloc-quitar"));
        renderAjustes();
        U.haptic("light");
        return;
      }

      if (e.target.closest("#allocReset")) {
        if (!confirm("¿Quitar todo el presupuesto? Los movimientos no se tocan.")) return;
        S.resetAllocation();
        renderAjustes();
        U.toast("Presupuesto vaciado", { icon: "check" });
      }
    });

    $$("[data-setting]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { handleSetting(btn.getAttribute("data-setting")); });
    });

    $("#importFile").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          S.importJson(String(reader.result));
          renderAll();
          U.toast("Datos importados", { icon: "check" });
        } catch (err) {
          U.toast("No he podido leer ese archivo", { icon: "warning" });
        }
      };
      reader.readAsText(file);
    });
  }

  function handleSetting(action) {
    if (action === "theme") { cycleTheme(); return; }

    /* La guía se puede repetir cuando se quiera: no borra nada, arranca
       con las cuentas que ya hay y solo añade lo que se escriba. */
    if (action === "guia") { startOnboarding(); return; }

    if (action === "emojis") {
      pick("Juego de emojis", [
        { value: "sistema", label: EMOJI_NOMBRE.sistema,
          sub: "Los que te pinta tu teléfono", muestra: "sistema" },
        { value: "noto", label: EMOJI_NOMBRE.noto,
          sub: "Los de un Android sin capa encima", muestra: "noto" },
        { value: "twemoji", label: EMOJI_NOMBRE.twemoji,
          sub: "Sin sombras ni brillos, como el resto de la app",
          muestra: "twemoji" }
      ], S.getEmojiSet()).then(function (v) {
        if (v == null) return;
        S.setEmojiSet(v);
        renderAll();
        U.toast("Emojis: " + emojiCorto(v).toLowerCase(), { icon: "sparkle" });
      });
      return;
    }

    if (action === "export") {
      var blob = new Blob([S.exportJson()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "split-" + S.ymd(new Date()) + ".json";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      U.toast("Archivo descargado", { icon: "check" });
      return;
    }

    if (action === "import") { $("#importFile").click(); return; }

    if (action === "reset") {
      if (!confirm("¿Recargar los datos de ejemplo? Se perderá lo que hayas registrado.")) return;
      S.reset(); renderAll(); U.toast("Datos de ejemplo recargados", { icon: "check" });
      return;
    }

    if (action === "clear") {
      if (!confirm("¿Borrar todos tus movimientos y metas? No se puede deshacer.")) return;
      S.clearAll(); renderAll(); U.toast("Todo vaciado", { icon: "check" });
      return;
    }

    if (action === "update") {
      U.toast("Buscando actualizaciones…", { icon: "repeat" });
      /* manual: se salta el límite de una comprobación cada 6 h, y aquí sí
         se avisa aunque esa versión se hubiera descartado con «Ahora no» */
      Up.check(true).then(function (res) {
        if (res.status === "update") {
          ui.update = res;
          renderAll();
          U.toast("split " + res.version + " disponible", { icon: "download", duration: 4500 });
        } else if (res.status === "offline") {
          /* Se dice QUÉ ha fallado y qué hacer. «¿Tienes conexión?» cuando
             la tienes es de las cosas que dejan a uno sin saber por dónde
             seguir. */
          var m = {
            limite: "GitHub ha cortado por muchas consultas seguidas. " +
                    "Prueba dentro de un rato.",
            tardanza: "GitHub ha tardado demasiado. Prueba otra vez.",
            red: "No se ha podido llegar a GitHub. ¿Tienes conexión?",
            http: res.motivo + ".",
            respuesta: "GitHub ha contestado algo raro. Prueba otra vez.",
            navegador: "Aquí no se puede comprobar."
          }[res.clase] || "No se ha podido comprobar.";

          U.toast(m + " Puedes bajarla a mano desde el enlace de abajo.",
                  { icon: "warning", duration: 7000 });
        } else {
          U.toast("Ya tienes la última versión", { icon: "check" });
        }
      });
    }
  }

  /* --- lo que usan otros archivos --- */
  A.bindAjustes = bindAjustes;
  A.emojiCorto = emojiCorto;
  A.emojiHint = emojiHint;
  A.handleSetting = handleSetting;
  A.refreshAllocation = refreshAllocation;
  A.settingRow = settingRow;
  A.themeLabel = themeLabel;
  A.themeShort = themeShort;
})();
