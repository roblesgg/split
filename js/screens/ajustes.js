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
  function openForm() { return A.openForm.apply(null, arguments); }
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

  /* Repinta lo vivo de un límite —la barra y la línea de debajo— sin
     tocar el campo en euros: reescribirlo mientras se teclea movería el
     cursor a media cifra. */
  function refreshLimites() {
    var fila = $("#allocRows");
    if (!fila) return;
    S.estadoDeLimites().forEach(function (e) {
      var caja = $('[data-lim-eur="' + e.id + '"]');
      if (!caja) return;
      var raiz = caja.closest(".pres-fila");
      var fill = raiz && raiz.querySelector(".pres-fila__fill");
      var pie = raiz && raiz.querySelector(".pres-fila__pct");
      var num = raiz && raiz.querySelector(".pres-fila__num");
      var lim = S.limitePorId(e.id);
      if (fill) {
        fill.style.width = e.pct + "%";
        fill.style.background = e.nivel === "pasado" ? "var(--status-critical)"
                              : e.nivel === "cerca" ? "var(--status-warning)"
                              : "var(--cat-" + e.color + ")";
      }
      if (pie) pie.textContent = S.textoAmbitoCortoLimite(lim);
      if (num) {
        num.textContent = S.pct(e.pct);
        num.style.color = e.nivel === "pasado" ? "var(--bad-text)" : "";
      }
    });
  }

  function bindAjustes() {
    var root = $("#view-ajustes");

    root.addEventListener("input", function (e) {
      if (e.target.id === "incManual") {
        S.setIncome({ manual: e.target.value });
        refreshLimites();
      } else if (e.target.matches("[data-lim-eur]")) {
        S.updateLimite(e.target.getAttribute("data-lim-eur"), { importe: e.target.value });
        refreshLimites();
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

      /* Un límite nuevo, o abrir uno que ya está: el detalle —el nombre
         y a qué categorías mira— se edita en su hoja, que es donde cabe. */
      if (e.target.closest("#limNuevo")) {
        openForm("limite", null);
        U.haptic("light");
        return;
      }
      if ((node = e.target.closest("[data-lim-abrir]"))) {
        openForm("limite", node.getAttribute("data-lim-abrir"));
        U.haptic("light");
        return;
      }

      if (e.target.closest("#allocReset")) {
        if (!confirm("¿Quitar todos los límites? Los movimientos no se tocan.")) return;
        S.vaciarLimites();
        renderAjustes();
        U.toast("Límites vaciados", { icon: "check" });
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
        var text = String(reader.result);
        /* Se suelta el archivo elegido: si no, volver a elegir el mismo no
           dispara nada, y parecería que el botón no funciona. */
        e.target.value = "";

        /* Primero se mira qué trae, sin tocar nada, para poder decírselo. */
        var trae;
        try { trae = S.inspeccionarJson(text); }
        catch (err) { U.toast(err.message || "No he podido leer ese archivo", { icon: "warning", duration: 5000 }); return; }

        var tengo = S.resumenDeDatos();
        if (!confirm(
          "Este archivo trae " + cuantos(trae.movimientos, "movimiento") + " y " +
            cuantos(trae.cuentas, "cuenta") + ".\n" +
          "Ahora tienes " + cuantos(tengo.movimientos, "movimiento") + " y " +
            cuantos(tengo.cuentas, "cuenta") + ".\n\n" +
          "Si sigues, lo que tienes se SUSTITUYE por lo del archivo. " +
          "Te guardo una copia de lo de ahora, para que puedas volver atrás.\n\n" +
          "¿Importar?")) return;

        try {
          S.importJson(text);
          renderAll();
          U.toast("Datos importados", {
            icon: "check", duration: 12000, actionLabel: "Deshacer",
            onAction: function () { volverALoDeAntes(); }
          });
        } catch (err) {
          U.toast(err.message || "No he podido importar ese archivo", { icon: "warning", duration: 5000 });
        }
      };
      reader.readAsText(file);
    });
  }

  /* «1 movimiento», «2 movimientos»: la cifra dicha como se diría. */
  function cuantos(n, palabra) {
    return n + " " + palabra + (n === 1 ? "" : "s");
  }

  /* Vuelve a lo que había antes de importar, vaciar o cargar el ejemplo. */
  function volverALoDeAntes() {
    try {
      S.restaurarCopiaAntes();
      renderAll();
      U.toast("Vuelto a lo de antes", { icon: "check" });
    } catch (err) {
      U.toast(err.message || "No he podido volver atrás", { icon: "warning", duration: 5000 });
    }
  }

  /* Descarga un texto como archivo .json. */
  function descargar(nombre, texto) {
    var blob = new Blob([texto], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
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
      descargar("split-" + S.ymd(new Date()) + ".json", S.exportJson());
      U.toast("Archivo descargado", { icon: "check" });
      return;
    }

    if (action === "import") { $("#importFile").click(); return; }

    if (action === "antes") {
      var h = S.resumenDeDatos();
      if (!confirm("¿Volver a lo de antes?\n\nAhora tienes " + cuantos(h.movimientos, "movimiento") +
                   ". Lo de ahora se queda guardado: podrás volver a ello igual.")) return;
      volverALoDeAntes();
      return;
    }

    if (action === "rescate") {
      var raw = S.rescateJson();
      if (!raw) return;
      descargar("split-rescate-" + S.ymd(new Date()) + ".json", raw);
      U.toast("Archivo descargado", { icon: "check" });
      return;
    }

    /* Las dos que sustituyen todo guardan antes una copia. Si no cabe, no
       hacen nada: sustituir sin copia es justo lo que se evita. */
    if (action === "reset") {
      if (!confirm("¿Recargar los datos de ejemplo?\n\nLo que hayas registrado se aparta y puedes recuperarlo desde «Volver a lo de antes».")) return;
      if (!S.reset()) { U.toast("No hay sitio para guardar una copia. No he tocado nada.", { icon: "warning", duration: 5000 }); return; }
      renderAll();
      U.toast("Datos de ejemplo recargados", { icon: "check", duration: 12000, actionLabel: "Deshacer", onAction: volverALoDeAntes });
      return;
    }

    if (action === "clear") {
      if (!confirm("¿Vaciar todo?\n\nSe borran tus movimientos y metas. Lo de ahora se aparta y puedes recuperarlo desde «Volver a lo de antes».")) return;
      if (!S.clearAll()) { U.toast("No hay sitio para guardar una copia. No he tocado nada.", { icon: "warning", duration: 5000 }); return; }
      renderAll();
      U.toast("Todo vaciado", { icon: "check", duration: 12000, actionLabel: "Deshacer", onAction: volverALoDeAntes });
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
  A.refreshLimites = refreshLimites;
  A.settingRow = settingRow;
  A.themeLabel = themeLabel;
  A.themeShort = themeShort;
})();
