/* ============================================================
   split — cascarón: router, barra y navegación

   Lo que rodea a las pantallas y no es ninguna de ellas: a qué vista se
   va, qué pone la barra de arriba, el botón atrás y el tema.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, C = A.C, Up = A.Up, $ = A.$, $$ = A.$$, icon = A.icon, ui = A.ui;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function abrirCobros() { return A.abrirCobros.apply(null, arguments); }
  function descargarActualizacion() { return A.descargarActualizacion.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function onboardBack() { return A.onboardBack.apply(null, arguments); }
  function openAdd() { return A.openAdd.apply(null, arguments); }
  function openCuenta() { return A.openCuenta.apply(null, arguments); }
  function openDetail() { return A.openDetail.apply(null, arguments); }
  function openForm() { return A.openForm.apply(null, arguments); }
  function renderAnalisis() { return A.renderAnalisis.apply(null, arguments); }
  function renderMovs() { return A.renderMovs.apply(null, arguments); }
  function setFolded() { return A.setFolded.apply(null, arguments); }
  function sincronizarAvisos() { return A.sincronizarAvisos.apply(null, arguments); }
  function skipOnboarding() { return A.skipOnboarding.apply(null, arguments); }
  function themeLabel() { return A.themeLabel.apply(null, arguments); }
  function themeShort() { return A.themeShort.apply(null, arguments); }

  /* ============================================================
     Navegación
     ============================================================ */

  var TITLES = {
    /* en Resumen la línea superior lleva la fecha: repetir "Resumen"
       encima del título no aporta nada */
    inicio:   { eyebrow: null, title: "Resumen" },
    movs:     { eyebrow: "Histórico", title: "Movimientos" },
    analisis: { eyebrow: "Datos", title: "Análisis" },
    /* «Planes» no decía qué había dentro y las cuentas estaban escondidas
       ahí. Se llama por lo que la gente viene a buscar. */
    ahorro:   { eyebrow: "Cuentas y metas", title: "Mi dinero" },
    ajustes:  { eyebrow: "Configuración", title: "Ajustes" }
  };

  /* Dónde se quedó cada pantalla. Bajar media lista de movimientos, mirar
     una cosa en Análisis y volver para encontrarte otra vez arriba del todo
     es de las cosas que más cansan de una app. Tocar la pestaña de la
     pantalla en la que ya estás sigue llevando arriba, que es el atajo que
     todo el mundo conoce. */
  var desplazamiento = {};

  function goTo(view, skipHash) {
    if (!TITLES[view]) view = "inicio";

    var area = $("#scrollArea");

    if (ui.view === view) {
      desplazamiento[view] = 0;
      area.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    desplazamiento[ui.view] = area.scrollTop;

    ui.view = view;
    if (!skipHash && location.hash.slice(1) !== view) location.hash = view;

    $$(".view").forEach(function (v) {
      v.setAttribute("data-active", String(v.id === "view-" + view));
    });
    $$("[data-view]").forEach(function (b) {
      b.setAttribute("aria-selected", String(b.getAttribute("data-view") === view));
    });

    setTopbar(view);

    U.haptic("light");
    renderView(view);

    /* después de pintar, que si no la altura todavía es la de antes y el
       navegador recorta la posición */
    var y = desplazamiento[view] || 0;
    requestAnimationFrame(function () { area.scrollTop = y; });
  }

  function setTopbar(view) {
    var t = TITLES[view] || TITLES.inicio;
    $("#topbarEyebrow").textContent = t.eyebrow || todayLabel();
    $("#topbarTitle").textContent = t.title;
  }

  function todayLabel() {
    var s = new Date().toLocaleDateString("es-ES", {
      weekday: "long", day: "numeric", month: "long"
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* Cada pantalla se apunta en A.screens al cargarse, así que añadir una
     no obliga a tocar esto. */
  function renderView(view) {
    var render = A.screens[view];
    if (render) render();
  }

  function renderAll() { renderView(ui.view); }

  function cycleTheme() {
    var order = ["auto", "light", "dark"];
    var next = order[(order.indexOf(S.getTheme()) + 1) % order.length];
    S.setTheme(next);
    updateThemeIcon();
    renderAll();
    U.toast("Tema: " + themeShort(next).toLowerCase(), { icon: next === "dark" ? "moon" : "sun" });
  }

  function updateThemeIcon() {
    var t = S.getTheme();
    var effectiveDark = t === "dark" || (t === "auto" && window.matchMedia &&
                        window.matchMedia("(prefers-color-scheme: dark)").matches);
    var btn = $("#themeBtn");
    btn.innerHTML = icon(effectiveDark ? "moon" : "sun", 18);
    btn.setAttribute("aria-label", "Tema: " + themeLabel(t) + ". Pulsa para cambiar");
  }
  /* ============================================================
     Botón atrás

     En Android el botón de atrás es el gesto de «déjame salir de aquí».
     Sin esto, el WebView lo interpretaba como el atrás de un navegador:
     con una hoja abierta te sacaba de la pantalla en la que estabas y la
     hoja se quedaba puesta.

     El orden es el que espera cualquiera: primero se cierra lo que está
     encima, después se vuelve al Resumen, y solo cuando no queda nada que
     cerrar se sale de la app. Devuelve true si ha hecho algo; si devuelve
     false, la capa Android cierra la aplicación.
     ============================================================ */

  function atras() {
    /* La guía está por encima de todo. Dentro de ella, atrás es el paso
       anterior —que es lo que espera cualquiera en un cuestionario— y
       solo cierra cuando ya no queda paso al que volver. */
    if ($("#onboard").getAttribute("data-open") === "true") {
      if (ui.ob && ui.ob.step > 0) onboardBack(); else skipOnboarding();
      return true;
    }

    /* La hoja de encima, no todas: del detalle se salta a editar, y
       atrás tiene que devolverte al detalle. */
    if (U.cerrarHojaDeArriba()) return true;

    /* Desde cualquier pantalla, atrás lleva al Resumen. Desde el Resumen
       ya no hay a dónde volver. */
    if (ui.view !== "inicio") { goTo("inicio"); return true; }

    return false;
  }

  /* ============================================================
     Cableado
     ============================================================ */

  function wire() {
    $$("[data-view]").forEach(function (b) {
      b.addEventListener("click", function () { goTo(b.getAttribute("data-view")); });
    });

    $$("[data-add]").forEach(function (b) {
      b.addEventListener("click", function () { openAdd("out"); });
    });

    $("#settingsBtn").addEventListener("click", function () { goTo("ajustes"); });
    $("#themeBtn").addEventListener("click", cycleTheme);

    var scroll = $("#scrollArea");
    scroll.addEventListener("scroll", function () {
      $("#topbar").setAttribute("data-stuck", String(scroll.scrollTop > 4));
    }, { passive: true });

    scroll.addEventListener("click", function (e) {
      var node;
      if ((node = e.target.closest("[data-tx]"))) { openDetail(node.getAttribute("data-tx")); return; }
      if ((node = e.target.closest("[data-goto]"))) { goTo(node.getAttribute("data-goto")); return; }

      if ((node = e.target.closest("[data-cuenta]"))) {
        openCuenta(node.getAttribute("data-cuenta"));
        return;
      }
      if ((node = e.target.closest("[data-form]"))) {
        openForm(node.getAttribute("data-form"), node.getAttribute("data-form-id"));
        return;
      }
      if (e.target.closest("#kpiFiltro")) { openForm("resumen"); return; }
      if (e.target.closest("#colaAbrir")) { abrirCobros(); return; }
      if ((node = e.target.closest("[data-rec-toggle]"))) {
        var r = S.toggleRecurring(node.getAttribute("data-rec-toggle"));
        S.runRecurring();
        sincronizarAvisos();
        renderAll(); U.haptic("light");
        U.toast(r && r.active ? "Programado reanudado" : "Programado en pausa",
                { icon: r && r.active ? "play" : "pause" });
        return;
      }
      if ((node = e.target.closest("[data-quick]"))) {
        var q = node.getAttribute("data-quick");
        openAdd(q === "ingreso" ? "in" : q === "traspaso" ? "transfer" : "out");
        return;
      }
      if ((node = e.target.closest("[data-kind]"))) {
        ui.movsKind = node.getAttribute("data-kind");
        renderMovs(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-range]"))) {
        ui.range = +node.getAttribute("data-range");
        renderAnalisis(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-anview]"))) {
        ui.anView = node.getAttribute("data-anview");
        renderAnalisis(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-ciclo]"))) {
        ui.movsCicloOffset = Math.max(0, ui.movsCicloOffset - (+node.getAttribute("data-ciclo")));
        renderMovs(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-aciclo]"))) {
        ui.cicloOffset = Math.max(0, ui.cicloOffset - (+node.getAttribute("data-aciclo")));
        renderAnalisis(); U.haptic("light"); return;
      }
      if ((node = e.target.closest("[data-fold]"))) {
        var fid = node.getAttribute("data-fold");
        var abierta = node.getAttribute("aria-expanded") === "true";
        var caja = node.closest(".card__head").parentNode.querySelector(".fold");
        node.setAttribute("aria-expanded", String(!abierta));
        if (caja) caja.setAttribute("data-open", String(!abierta));
        /* la cabecera se pega al cuerpo al plegarse */
        var cab = node.closest(".card__head");
        if (cab && !cab.classList.contains("card__pad--tight")) {
          cab.style.marginBottom = abierta ? "0" : "var(--sp-4)";
        }
        setFolded(fid, abierta);
        U.haptic("light");
        return;
      }
      /* tocar una categoría del Resumen abre sus movimientos, con la
         chapa puesta para que se vea por qué se está viendo solo eso */
      if ((node = e.target.closest("[data-cat-movs]"))) {
        ui.movsCat = node.getAttribute("data-cat-movs");
        ui.movsAccount = null;
        ui.movsKind = "all";
        ui.movsQuery = "";
        ui.movsCicloOffset = ui.cicloOffset;
        goTo("movs");
        U.haptic("light");
        return;
      }
      if (e.target.closest("#movsClear")) { ui.movsQuery = ""; renderMovs(); return; }
      if (e.target.closest("#movsAccClear")) {
        ui.movsAccount = null; renderMovs(); U.haptic("light"); return;
      }
      if (e.target.closest("#movsCatClear")) {
        ui.movsCat = null; renderMovs(); U.haptic("light"); return;
      }

      if (e.target.closest("#updateNow")) { descargarActualizacion(); return; }
      if (e.target.closest("#updateLater")) {
        Up.dismiss(ui.update.version);
        ui.update = null;
        renderAll(); U.haptic("light");
        return;
      }

      if ((node = e.target.closest("[data-goal-add]"))) {
        var gid = node.getAttribute("data-goal-add");
        var raw = prompt("¿Cuánto quieres aportar a esta meta? (€)", "50");
        if (raw == null) return;
        var amount = parseFloat(String(raw).replace(",", "."));
        if (!isFinite(amount) || amount <= 0) {
          U.toast("Introduce un importe válido", { icon: "warning" }); return;
        }
        S.addGoalSaving(gid, amount);
        renderAhorro(); U.haptic("success");
        U.toast("Has aportado " + money(amount), { icon: "check" });
      }
    });

    var searchTimer = null;
    scroll.addEventListener("input", function (e) {
      if (e.target.id !== "movsSearch") return;
      var value = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        ui.movsQuery = value;
        renderMovs();
        var input = $("#movsSearch");
        if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      }, 240);
    });

    /* los SVG se miden en píxeles: repintar la vista al cambiar el tamaño */
    var lastW = window.innerWidth;
    C.onResize(function () {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      renderAll();
    });

    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () {
        if (S.getTheme() !== "auto") return;
        updateThemeIcon(); renderAll();
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }


  /* --- lo que usan otros archivos --- */
  A.TITLES = TITLES;

  /* El botón atrás de Android entra por aquí: la capa nativa llama a
     window.App.atras() y solo se traga el botón si devuelve true. */
  A.atras = atras;
  A.cycleTheme = cycleTheme;
  A.goTo = goTo;
  A.renderAll = renderAll;
  A.setTopbar = setTopbar;
  A.updateThemeIcon = updateThemeIcon;

  A.wire(wire);
})();
