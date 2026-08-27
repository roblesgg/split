/* ============================================================
   split — cuestionario de bienvenida
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, C = A.C, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, ui = A.ui;
  var DIAS_LARGO = A.DIAS_LARGO;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function goTo() { return A.goTo.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function numField() { return A.numField.apply(null, arguments); }
  function renderAll() { return A.renderAll.apply(null, arguments); }
  function sincronizarAvisos() { return A.sincronizarAvisos.apply(null, arguments); }

  /* ---------- tutorial de bienvenida ---------- */

  /* El cuestionario a medias vive en ui.ob. */

  /* La bienvenida no es un folleto de cinco pantallas que nadie lee: son
     tres preguntas. Primero se dice dónde acaban los datos, que es lo que
     de verdad importa saber antes de escribir cuánto ganas. Luego dónde
     tienes el dinero, y luego de dónde te entra.

     La cuarta va después de los trabajos a propósito: para casi todo el
     mundo el mes empieza el día que cobra, así que en cuanto se sabe
     cuándo cobra ya se puede proponer la respuesta en vez de preguntar
     a secas.

     Lo que no se pregunta aquí —categorías, presupuesto, reparto— se pone
     sobre la marcha. Preguntarlo todo el primer día es la forma más rápida
     de que alguien cierre la app y no vuelva. */
  var ONBOARD_STEPS = ["privacidad", "cuentas", "trabajos", "ciclo", "listo"];
  /* ============================================================
     Cuestionario de bienvenida

     Nada se guarda hasta el último botón. Mientras tanto todo vive en
     `ui.ob`, así que se puede ir y volver entre pasos sin dejar cuentas a
     medias en el estado, y «Saltar» de verdad no toca nada.
     ============================================================ */

  var TRABAJO_NUEVO = {
    nombre: "", modo: "fijo", importe: "", tarifa: "",
    freq: "mensual", pagas: 12, day: 1, weekday: 0, cuenta: 0
  };

  function startOnboarding() {
    ui.ob = {
      step: 0,
      /* las cuentas que ya existan se pueden renombrar y ajustar, no
         borrar: una cuenta con movimientos detrás no se quita desde una
         pantalla de bienvenida */
      cuentas: S.state.accounts.map(function (a) {
        return { id: a.id, name: a.name, opening: a.opening };
      }),
      trabajos: [],
      nuevo: null,
      /* null = todavía sin tocar, así que manda el día de cobro. En
         cuanto se pulsa una opción pasa a ser un número y ya no se
         mueve aunque se vuelva atrás a cambiar el trabajo. */
      corte: null,
      corteOtro: false
    };
    if (!ui.ob.cuentas.length) ui.ob.cuentas.push({ id: null, name: "", opening: "" });
    renderOnboardStep();
    $("#onboard").setAttribute("data-open", "true");
    $("#onboard").setAttribute("aria-hidden", "false");
    U.haptic("light");
  }

  /* Cómo se lee un trabajo ya añadido, en una línea. */
  function resumenTrabajo(t) {
    var cada = t.freq === "semanal"
      ? "cada " + DIAS_LARGO[t.weekday].toLowerCase()
      : "el " + t.day + " de cada mes" + (t.pagas === 14 ? ", con dos pagas extra" : "");
    if (t.modo === "hora") return money(+t.tarifa || 0) + " la hora · " + cada;
    if (t.modo === "varia") return "importe variable · " + cada;
    return money(+t.importe || 0) + " · " + cada;
  }

  function pasoPrivacidad() {
    return [
      ["lock", "No sale de este móvil",
       "Todo lo que escribas se guarda aquí dentro. No hay cuenta que crear, " +
       "no hay nube y no se manda nada a ningún sitio."],
      '<ul class="ob-lista">' +
        [["user", "Sin registro", "Ni correo ni contraseña. Abres y ya está."],
         ["lock", "Sin internet", "La app funciona entera en avión."],
         ["download", "La copia la tienes tú",
          "En Ajustes puedes exportar un archivo y guardarlo donde quieras."]]
          .map(function (l) {
            return '<li class="ob-lista__item">' +
                '<span class="ob-lista__icono" data-icon="' + l[0] + '" ' +
                  'data-icon-size="15"></span>' +
                '<span><b>' + esc(l[1]) + '</b><br>' + esc(l[2]) + '</span>' +
              '</li>';
          }).join("") +
      '</ul>'
    ];
  }

  function pasoCuentas() {
    var filas = ui.ob.cuentas.map(function (c, i) {
      return '<div class="ob-fila">' +
          '<input type="text" class="field__input" data-obc-nombre="' + i + '" ' +
                 'maxlength="28" placeholder="Banco" value="' + esc(c.name) + '">' +
          '<div class="input-affix ob-fila__dinero">' +
            '<input type="number" class="field__input" data-obc-saldo="' + i + '" ' +
                   'inputmode="decimal" step="0.01" placeholder="0" value="' +
                   esc(c.opening === "" || c.opening == null ? "" : c.opening) + '">' +
            '<span class="input-affix__suffix">€</span>' +
          '</div>' +
          (c.id
            ? '<span class="ob-fila__hueco"></span>'
            : '<button type="button" class="ob-fila__x" data-obc-quitar="' + i + '" ' +
                'aria-label="Quitar esta cuenta">' + icon("close", 14) + '</button>') +
        '</div>';
    }).join("");

    return [
      ["wallet", "¿Dónde tienes el dinero?",
       "Una por cada sitio: el banco, la cartera, la hucha. Pon lo que hay " +
       "ahora mismo en cada una; si no lo sabes, déjalo en blanco y lo " +
       "corriges cuando quieras."],
      '<div class="ob-filas">' + filas + '</div>' +
      '<button type="button" class="ob-add" data-obc-add>' +
        icon("plus", 15) + 'Añadir otra cuenta</button>'
    ];
  }

  function pasoTrabajos() {
    var puestos = ui.ob.trabajos.map(function (t, i) {
      return '<div class="ob-item">' +
          '<span class="ob-item__icono" data-icon="briefcase" data-icon-size="15"></span>' +
          '<span class="ob-item__texto">' +
            '<span class="ob-item__nombre">' + esc(t.nombre) + '</span>' +
            '<span class="ob-item__sub">' + esc(resumenTrabajo(t)) + '</span>' +
          '</span>' +
          '<button type="button" class="ob-fila__x" data-obt-quitar="' + i + '" ' +
            'aria-label="Quitar este trabajo">' + icon("close", 14) + '</button>' +
        '</div>';
    }).join("");

    return [
      ["briefcase", "¿De dónde te entra?",
       "Añade tus trabajos, los que sean. Da igual si cobras siempre lo " +
       "mismo, si te pagan por horas o si cambia cada mes: hay un hueco " +
       "para cada caso. Y si prefieres no poner nada ahora, sigue adelante."],
      puestos +
      (ui.ob.nuevo ? formTrabajo(ui.ob.nuevo)
                : '<button type="button" class="ob-add" data-obt-add>' +
                    icon("plus", 15) + 'Añadir un trabajo</button>')
    ];
  }

  /* El mini-formulario de un trabajo. Solo enseña lo que hace falta según
     cómo se cobre: quien cobra por horas no tiene por qué ver una casilla
     de importe fijo que va a dejar vacía. */
  function formTrabajo(t) {
    var chips = function (attr, opciones, valor) {
      return '<div class="chips">' + opciones.map(function (o) {
        return '<button type="button" class="chip" data-' + attr + '="' + o[0] + '" ' +
                 'aria-pressed="' + (String(valor) === String(o[0])) + '">' +
                 esc(o[1]) + '</button>';
      }).join("") + '</div>';
    };

    return '<div class="ob-form">' +
        '<div class="field">' +
          '<label class="field__label" for="obtNombre">Cómo se llama</label>' +
          '<input type="text" class="field__input" id="obtNombre" data-obt-nombre ' +
                 'maxlength="28" placeholder="Mi trabajo" value="' + esc(t.nombre) + '">' +
        '</div>' +

        '<div class="field">' +
          '<span class="field__label">Cómo cobras</span>' +
          chips("obt-modo", [["fijo", "Siempre igual"], ["hora", "Por horas"],
                             ["varia", "Cambia"]], t.modo) +
        '</div>' +

        (t.modo === "fijo"
          ? '<div class="field">' +
              numField("obtImporte", "Cuánto cobras", t.importe, 0.01) +
            '</div>'
          : t.modo === "hora"
          ? '<div class="field">' +
              numField("obtTarifa", "Cuánto te pagan la hora", t.tarifa, 0.01) +
              '<p class="field__hint">El día que toque te preguntará cuántas horas ' +
                'has echado y hará la cuenta.</p>' +
            '</div>'
          : '<p class="field__hint">' + icon("bell", 12) +
            ' El día que toque te avisará y te preguntará cuánto ha sido.</p>') +

        '<div class="field">' +
          '<span class="field__label">Cada cuánto</span>' +
          chips("obt-freq", [["mensual", "Al mes"], ["semanal", "Cada semana"]], t.freq) +
        '</div>' +

        (t.freq === "semanal"
          ? '<div class="field">' +
              '<span class="field__label">Qué día</span>' +
              chips("obt-dow", DIAS_LARGO.map(function (d, i) {
                return [i, d.slice(0, 3)];
              }), t.weekday) +
            '</div>'
          : '<div class="field">' +
              '<label class="field__label" for="obtDay">Qué día del mes</label>' +
              '<input type="number" class="field__input" id="obtDay" min="1" max="28" ' +
                     'step="1" inputmode="numeric" value="' + esc(t.day) + '">' +
              '<div style="margin-top:var(--sp-4)">' +
                chips("obt-pagas", [[12, "12 pagas"], [14, "14 pagas"]], t.pagas) +
              '</div>' +
            '</div>') +

        (ui.ob.cuentas.length > 1
          ? '<div class="field">' +
              '<span class="field__label">A qué cuenta llega</span>' +
              chips("obt-cuenta", ui.ob.cuentas.map(function (c, i) {
                return [i, c.name || "Cuenta " + (i + 1)];
              }), t.cuenta) +
            '</div>'
          : "") +

        '<button type="button" class="btn btn--primary" data-obt-guardar ' +
          'style="width:100%;margin-top:var(--sp-4)">' +
          icon("check", 16) + 'Añadir este trabajo</button>' +
      '</div>';
  }

  /* ---------- cuándo empieza el mes ---------- */

  /* El día en que cobra, si es que lo ha dicho: un trabajo mensual con su
     día. Es la respuesta buena para la mayoría, así que se propone. El 1
     no cuenta como propuesta porque ya es la otra opción. */
  function diaDeCobro() {
    var t = ui.ob.trabajos.find(function (x) {
      return x.freq === "mensual" && +x.day > 1 && +x.day <= S.CICLO_DIA_MAX;
    });
    return t ? +t.day : 0;
  }

  /* Lo que se guardará si pulsa «Listo» tal y como está la pantalla. */
  function corteElegido() {
    if (ui.ob.corte != null) return ui.ob.corte;
    return diaDeCobro() || 1;
  }

  function opcion(cual, activa, titulo, sub) {
    return '<button type="button" class="ob-opcion" data-obci="' + cual + '" ' +
        'aria-pressed="' + activa + '">' +
        '<span class="ob-opcion__marca" aria-hidden="true"></span>' +
        '<span class="ob-opcion__texto">' +
          '<span class="ob-opcion__titulo">' + esc(titulo) + '</span>' +
          '<span class="ob-opcion__sub">' + esc(sub) + '</span>' +
        '</span>' +
      '</button>';
  }

  function pasoCiclo() {
    var cobro = diaDeCobro();
    var dia = corteElegido();
    var otro = ui.ob.corteOtro;

    var opciones =
      opcion("1", !otro && dia === 1, "El 1 de cada mes",
             "Como el calendario de toda la vida") +
      (cobro
        ? opcion("cobro", !otro && dia === cobro, "El día " + cobro,
                 "El día que cobras")
        : "") +
      opcion("otro", otro, "Otro día", "Lo eliges tú, del 1 al " + S.CICLO_DIA_MAX);

    return [
      ["calendar", "¿Cuándo empieza tu mes?",
       "Si cobras el 25, tu mes de verdad va del 25 al 24. Elige ese día y " +
       "todo lo que cuenta la app —lo gastado, el presupuesto y lo que te " +
       "queda— se reinicia contigo."],
      '<div class="ob-opciones">' + opciones + '</div>' +
      (otro
        ? '<div class="field" style="margin-top:var(--sp-4)">' +
            '<label class="field__label" for="obciDia">Qué día</label>' +
            '<input type="number" class="field__input" id="obciDia" min="1" ' +
                   'max="' + S.CICLO_DIA_MAX + '" step="1" inputmode="numeric" ' +
                   'value="' + esc(dia) + '">' +
            '<p class="field__hint">Hasta el ' + S.CICLO_DIA_MAX + ', para que el ' +
              'mes empiece igual también en febrero.</p>' +
          '</div>'
        : '<p class="field__hint" style="margin-top:var(--sp-4)">' +
          'Se puede cambiar cuando quieras en Ajustes.</p>')
    ];
  }

  function pasoListo() {
    var nCuentas = ui.ob.cuentas.filter(function (c) {
      return (c.name || "").trim() || c.id;
    }).length;
    var nTrabajos = ui.ob.trabajos.length;
    var cuenta = nCuentas === 1 ? "una cuenta" : nCuentas + " cuentas";
    var trab = nTrabajos === 0 ? "ningún trabajo todavía"
             : nTrabajos === 1 ? "un trabajo" : nTrabajos + " trabajos";
    var dia = corteElegido();
    var mes = dia === 1 ? "el mes del calendario"
                        : "el mes empezando el " + dia;

    return [
      ["check", "Ya está",
       "Vas a empezar con " + cuenta + ", " + trab + " y " + mes + ". Lo demás " +
       "se pone sobre la marcha, y todo se puede cambiar luego."],
      '<ul class="ob-lista">' +
        [["plus", "Apuntar un gasto",
          "El botón grande de abajo. Es lo que más vas a usar."],
         ["sliders", "Categorías y presupuesto",
          "En Ajustes, cuando te apetezca. Nada viene puesto de fábrica."],
         ["repeat", "Recibos y préstamos",
          "En Mi dinero → Programados se apuntan solos cada mes."]]
          .map(function (l) {
            return '<li class="ob-lista__item">' +
                '<span class="ob-lista__icono" data-icon="' + l[0] + '" ' +
                  'data-icon-size="15"></span>' +
                '<span><b>' + esc(l[1]) + '</b><br>' + esc(l[2]) + '</span>' +
              '</li>';
          }).join("") +
      '</ul>'
    ];
  }

  function renderOnboardStep() {
    var paso = ONBOARD_STEPS[ui.ob.step];
    var partes = paso === "privacidad" ? pasoPrivacidad()
               : paso === "cuentas" ? pasoCuentas()
               : paso === "trabajos" ? pasoTrabajos()
               : paso === "ciclo" ? pasoCiclo()
               : pasoListo();

    $("#onboardIcon").innerHTML = icon(partes[0][0], 28);
    $("#onboardTitle").textContent = partes[0][1];
    $("#onboardText").textContent = partes[0][2];
    $("#onboardExtra").innerHTML = partes[1] || "";

    $("#onboardDots").innerHTML = ONBOARD_STEPS.map(function (_, i) {
      return '<span class="onboard__dot" data-active="' + (i === ui.ob.step) + '"></span>';
    }).join("");

    $("#onboardBack").setAttribute("data-hidden", String(ui.ob.step === 0));
    $("#onboardNext").textContent = ui.ob.step === 0 ? "Empezar"
      : ui.ob.step === ONBOARD_STEPS.length - 1 ? "Listo" : "Siguiente";

    mountIcons($("#onboard"));
  }

  function onboardNext() {
    if (ui.ob.step === ONBOARD_STEPS.length - 1) { finishOnboarding(); return; }
    /* un trabajo a medio escribir al pasar de paso se guarda solo: haber
       rellenado el formulario y que se pierda por no tocar «Añadir» es de
       las cosas que más rabia dan */
    if (ONBOARD_STEPS[ui.ob.step] === "trabajos" && ui.ob.nuevo) guardarTrabajo(true);
    ui.ob.step++;
    renderOnboardStep();
    U.haptic("light");
  }

  function onboardBack() {
    if (ui.ob.step === 0) return;
    ui.ob.step--;
    renderOnboardStep();
    U.haptic("light");
  }

  function closeOnboarding() {
    $("#onboard").setAttribute("data-open", "false");
    $("#onboard").setAttribute("aria-hidden", "true");
  }

  function guardarTrabajo(callado) {
    var t = ui.ob.nuevo;
    if (!t) return false;
    var nombre = (t.nombre || "").trim();
    var tieneImporte = t.modo === "fijo" ? +t.importe > 0
                     : t.modo === "hora" ? +t.tarifa > 0
                     : true;

    /* al pasar de paso, un formulario que ni se ha empezado se tira sin
       decir nada; si se ha tocado el botón, se explica qué falta */
    if (!nombre && !t.importe && !t.tarifa) { ui.ob.nuevo = null; return true; }
    if (!nombre) {
      if (!callado) U.toast("Ponle un nombre al trabajo", { icon: "warning" });
      return false;
    }
    if (!tieneImporte) {
      if (!callado) {
        U.toast(t.modo === "hora" ? "Falta cuánto te pagan la hora"
                                  : "Falta cuánto cobras", { icon: "warning" });
      }
      return false;
    }

    ui.ob.trabajos.push(Object.assign({}, t, { nombre: nombre }));
    ui.ob.nuevo = null;
    return true;
  }

  /* Aquí es donde por fin se escribe algo. Hasta este botón, nada. */
  function finishOnboarding() {
    /* 1. el día de corte, antes que nada: manda sobre todo lo que se
       pinta después, así que si se pusiera al final la primera pantalla
       saldría contada con el mes del calendario y cambiaría sola. */
    S.setDiaDeCorte(corteElegido());

    /* 2. cuentas: las que ya existían se actualizan, las nuevas se crean */
    var ids = ui.ob.cuentas.map(function (c) {
      var name = (c.name || "").trim();
      var opening = +c.opening || 0;
      if (c.id) {
        S.updateAccount(c.id, name ? { name: name, opening: opening }
                                   : { opening: opening });
        return c.id;
      }
      if (!name) return null;
      return S.addAccount({ name: name, opening: opening }).id;
    });
    var porDefecto = ids.find(function (x) { return x; }) || S.state.accounts[0].id;

    /* 3. trabajos: un ingreso programado por cada uno */
    ui.ob.trabajos.forEach(function (t) {
      var abierto = t.modo !== "fijo";
      S.addRecurring({
        kind: "in",
        note: t.nombre,
        amount: t.modo === "fijo" ? +t.importe || 0 : 0,
        categoryId: "nomina",
        accountId: ids[t.cuenta] || porDefecto,
        freq: t.freq,
        day: t.day,
        weekdays: [t.weekday],
        pagas: t.freq === "mensual" ? t.pagas : 12,
        importeAbierto: abierto,
        tarifa: t.modo === "hora" ? +t.tarifa || 0 : null,
        /* sin importe cerrado no se puede apuntar solo: hay que preguntar,
           y para preguntar hay que avisar */
        confirmar: abierto,
        avisar: abierto,
        hora: "09:00",
        yaHecho: true
      });
    });

    var creados = ui.ob.trabajos.length;
    closeOnboarding();
    renderAll();
    if (creados) sincronizarAvisos();
    goTo("inicio");
    U.toast(creados ? "Todo listo. Apunta tu primer gasto con el +"
                    : "Todo listo. Empieza cuando quieras",
            { icon: "check", duration: 4500 });
  }

  function skipOnboarding() {
    closeOnboarding();
  }

  /* ============================================================
     Cableado
     ============================================================ */

  function wire() {
    /* --- cuestionario de bienvenida --- */
    var onboard = $("#onboard");
    $("#onboardNext").addEventListener("click", onboardNext);
    $("#onboardBack").addEventListener("click", onboardBack);
    $("#onboardSkip").addEventListener("click", skipOnboarding);

    /* Lo que se escribe solo actualiza el modelo: repintar en cada tecla
       le quitaría el foco al campo a media palabra. Repinta lo que cambia
       de forma —las chapas y los botones—, que va abajo.

       Los dos manejadores viven en el diálogo, que solo se abre después de
       startOnboarding(), así que `ui.ob` debería estar siempre puesto. Se
       comprueba igual: un evento que llegara con el cuestionario cerrado
       —un autocompletar del navegador, el foco perdido dentro— reventaría
       la app entera y no hay nada que ganar arriesgándose. */
    onboard.addEventListener("input", function (e) {
      if (!ui.ob) return;
      var n = e.target, i;
      if ((i = n.getAttribute("data-obc-nombre")) != null) {
        ui.ob.cuentas[+i].name = n.value; return;
      }
      if ((i = n.getAttribute("data-obc-saldo")) != null) {
        ui.ob.cuentas[+i].opening = n.value; return;
      }
      if (n.id === "obciDia") {
        /* se admite el campo a medias mientras teclea; el guardado lo
           acota igual, pero así no se le corrige el número bajo el dedo */
        ui.ob.corte = Math.min(S.CICLO_DIA_MAX, Math.max(1, parseInt(n.value, 10) || 1));
        return;
      }
      if (!ui.ob.nuevo) return;
      if (n.hasAttribute("data-obt-nombre")) { ui.ob.nuevo.nombre = n.value; return; }
      if (n.id === "obtImporte") { ui.ob.nuevo.importe = n.value; return; }
      if (n.id === "obtTarifa") { ui.ob.nuevo.tarifa = n.value; return; }
      if (n.id === "obtDay") { ui.ob.nuevo.day = n.value; }
    });

    onboard.addEventListener("click", function (e) {
      if (!ui.ob) return;
      var n;

      if ((n = e.target.closest("[data-obc-quitar]"))) {
        ui.ob.cuentas.splice(+n.getAttribute("data-obc-quitar"), 1);
        if (!ui.ob.cuentas.length) ui.ob.cuentas.push({ id: null, name: "", opening: "" });
        renderOnboardStep(); U.haptic("light"); return;
      }
      if (e.target.closest("[data-obc-add]")) {
        ui.ob.cuentas.push({ id: null, name: "", opening: "" });
        renderOnboardStep();
        var ultimo = $$("[data-obc-nombre]", onboard).pop();
        if (ultimo) ultimo.focus();
        U.haptic("light"); return;
      }

      if ((n = e.target.closest("[data-obci]"))) {
        var cual = n.getAttribute("data-obci");
        ui.ob.corteOtro = cual === "otro";
        if (cual === "1") ui.ob.corte = 1;
        else if (cual === "cobro") ui.ob.corte = diaDeCobro();
        else ui.ob.corte = corteElegido();
        renderOnboardStep();
        if (ui.ob.corteOtro) { var num = $("#obciDia", onboard); if (num) num.focus(); }
        U.haptic("light"); return;
      }

      if (e.target.closest("[data-obt-add]")) {
        ui.ob.nuevo = Object.assign({}, TRABAJO_NUEVO);
        renderOnboardStep();
        var campo = $("#obtNombre", onboard);
        if (campo) campo.focus();
        U.haptic("light"); return;
      }
      if ((n = e.target.closest("[data-obt-quitar]"))) {
        ui.ob.trabajos.splice(+n.getAttribute("data-obt-quitar"), 1);
        renderOnboardStep(); U.haptic("light"); return;
      }
      if (e.target.closest("[data-obt-guardar]")) {
        if (guardarTrabajo(false)) { renderOnboardStep(); U.haptic("light"); }
        return;
      }

      if (!ui.ob.nuevo) return;
      if ((n = e.target.closest("[data-obt-modo]"))) {
        ui.ob.nuevo.modo = n.getAttribute("data-obt-modo");
      } else if ((n = e.target.closest("[data-obt-freq]"))) {
        ui.ob.nuevo.freq = n.getAttribute("data-obt-freq");
      } else if ((n = e.target.closest("[data-obt-dow]"))) {
        ui.ob.nuevo.weekday = +n.getAttribute("data-obt-dow");
      } else if ((n = e.target.closest("[data-obt-pagas]"))) {
        ui.ob.nuevo.pagas = +n.getAttribute("data-obt-pagas");
      } else if ((n = e.target.closest("[data-obt-cuenta]"))) {
        ui.ob.nuevo.cuenta = +n.getAttribute("data-obt-cuenta");
      } else { return; }
      renderOnboardStep(); U.haptic("light");
    });

    onboard.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { skipOnboarding(); return; }
      if (e.key === "Enter" && e.target.tagName === "INPUT") {
        e.preventDefault();
        e.target.blur();
      }
    });
  }


  /* --- lo que usan otros archivos --- */
  A.onboardBack = onboardBack;
  A.skipOnboarding = skipOnboarding;
  A.startOnboarding = startOnboarding;

  A.wire(wire);
})();
