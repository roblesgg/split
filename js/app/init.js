/* ============================================================
   split — arranque

   Se carga el último. Monta las hojas, engancha el cableado que cada
   archivo ha ido registrando y pinta la primera pantalla.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, Up = A.Up, $ = A.$, $$ = A.$$, icon = A.icon, ui = A.ui, sheets = A.sheets;
  var TITLES = A.TITLES;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function abrirCobros() { return A.abrirCobros.apply(null, arguments); }
  function atras() { return A.atras.apply(null, arguments); }
  function goTo() { return A.goTo.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function renderAll() { return A.renderAll.apply(null, arguments); }
  function renderInicio() { return A.renderInicio.apply(null, arguments); }
  function setTopbar() { return A.setTopbar.apply(null, arguments); }
  function startOnboarding() { return A.startOnboarding.apply(null, arguments); }
  function updateThemeIcon() { return A.updateThemeIcon.apply(null, arguments); }

  /* ============================================================
     Arranque
     ============================================================ */

  function init() {
    var firstRun = !S.hasSavedState();
    S.load();
    S.applyTheme(S.getTheme());
    S.applyEmojiSet(S.getEmojiSet());

    /* apunta lo programado que haya vencido desde la última visita */
    var posted = S.runRecurring();

    /* y rellena los apartados de los ciclos que hayan pasado */
    S.rellenarApartados();

    /* Las alarmas del sistema no sobreviven a un reinicio del teléfono,
       así que se vuelven a poner en cada arranque. */
    if (window.Avisos && window.Avisos.hay()) window.Avisos.sincronizar(S);

    sheets.add = new U.Sheet($("#sheetAdd"), $("#scrim"));
    sheets.detail = new U.Sheet($("#sheetDetail"), $("#scrim"));
    sheets.form = new U.Sheet($("#sheetForm"), $("#scrim"));
    sheets.cobro = new U.Sheet($("#sheetCobro"), $("#scrim"));
    sheets.cuenta = new U.Sheet($("#sheetCuenta"), $("#scrim"));
    sheets.pick = new U.Sheet($("#sheetPick"), $("#scrim"));


    mountIcons(document);
    U.vigilarTeclado();
    updateThemeIcon();
    A.wireAll();

    var start = location.hash.slice(1);
    if (TITLES[start] && start !== "inicio") {
      goTo(start, true);
    } else {
      setTopbar("inicio");
      renderInicio();
    }

    window.addEventListener("hashchange", function () {
      goTo(location.hash.slice(1) || "inicio", true);
    });

    if (posted) {
      setTimeout(function () {
        U.toast("Se han apuntado " + posted + " movimiento" + (posted === 1 ? "" : "s") +
                " programado" + (posted === 1 ? "" : "s"), { icon: "calendar", duration: 4500 });
      }, 600);
    }

    /* Adjuntos que ya no cuelgan de ningún movimiento (se borró el
       movimiento, o se quitó la imagen y se guardó): ocuparían sitio para
       siempre, así que se barren al arrancar. */
    if (window.Attach && window.Attach.supported()) {
      var vivos = [];
      S.state.transactions.forEach(function (t) {
        if (Array.isArray(t.attachments)) vivos = vivos.concat(t.attachments);
      });
      window.Attach.sweep(vivos);
    }

    /* El tutorial manda: la primera vez el aviso de actualización espera a
       la siguiente apertura en vez de pisarlo. */
    asegurarHuecoInferior();

    if (firstRun) setTimeout(startOnboarding, 500);
    else { checkForUpdate(); setTimeout(abrirCobros, 700); }
  }

  /* Dentro de la app, el hueco de la barra de navegación lo manda la capa
     Android en --safe-b-native, con la medida real de ESE móvil. Si por lo
     que sea no llegara, se reserva un mínimo prudente para que la barra de
     pestañas no acabe debajo del gesto. El valor nativo manda siempre: esto
     solo rellena el hueco si sigue vacío. */
  function asegurarHuecoInferior() {
    if (!window.Capacitor) return;
    setTimeout(function () {
      var raiz = document.documentElement;
      if (!raiz.style.getPropertyValue("--safe-b-native")) {
        raiz.style.setProperty("--safe-b-native", "24px");
      }
    }, 1500);
  }

  /* Baja la actualización sin salir de la app cuando se puede, y si no,
     tira del navegador como se hacía antes. */
  function descargarActualizacion() {
    var boton = $("#updateNow");
    var barra = $("#updateBar");

    if (!Up.hayDescargaNativa()) {
      Up.open(ui.update.url);
      U.toast("Descargando la actualización…", { icon: "download", duration: 4500 });
      return;
    }

    if (boton) { boton.disabled = true; boton.innerHTML = icon("download", 16) + "Descargando…"; }
    if (barra) barra.hidden = false;

    Up.descargarEInstalar(ui.update.url, function (ev) {
      var pct = (ev && ev.pct) || 0;
      var relleno = $("#updateBarFill");
      if (relleno) relleno.style.width = Math.max(2, pct) + "%";
      if (boton && ev && ev.fase === "descargando") {
        boton.innerHTML = icon("download", 16) + "Descargando… " + pct + " %";
      }
    }).then(function (res) {
      if (res === "instalando") {
        if (boton) boton.innerHTML = icon("check", 16) + "Abriendo el instalador…";
        return;
      }

      /* cualquier otro final deja el botón como estaba */
      if (boton) { boton.disabled = false; boton.innerHTML = icon("download", 16) + "Actualizar"; }
      if (barra) barra.hidden = true;

      if (res === "sin-permiso") {
        U.toast("Android necesita tu permiso para instalar. Te llevo a los ajustes.",
                { icon: "warning", duration: 5500 });
        Up.pedirPermisoInstalar();
      } else if (res === "sin-plugin") {
        Up.open(ui.update.url);
      } else {
        U.toast("No se ha podido descargar. Prueba con el enlace de abajo.",
                { icon: "warning", duration: 5000 });
      }
    });
  }

  /* Comprobación de fondo: no bloquea el arranque y, si no hay conexión,
     no se nota. */
  function checkForUpdate() {
    if (!Up) return;
    Up.check(false).then(function (res) {
      if (res.status !== "update" || Up.isDismissed(res.version)) return;
      ui.update = res;
      renderAll();
    });
  }


  /* En el escritorio no hay botón físico, pero Escape es lo mismo y así se
     puede probar el recorrido sin un móvil delante. Las hojas ya se cierran
     ellas con Escape cuando tienen el foco; esto cubre el resto. */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (U.hayHojaAbierta()) return;   /* de eso se encarga la propia hoja */
    if (atras()) e.preventDefault();
  });

  /* --- lo que usan otros archivos --- */
  A.descargarActualizacion = descargarActualizacion;


  /* Lo último de lo último: con el DOM en pie, arrancar. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
