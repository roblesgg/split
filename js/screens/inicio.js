/* ============================================================
   split — pantalla: Resumen

   El Resumen es un panel: arriba el carrusel de tarjetas y debajo los
   bloques de la que esté centrada. Todas las tarjetas son cuentas: la de
   «todo tu dinero» se fue porque abría siempre ahí y había que deslizar
   hasta la de verdad cada mañana. La cuenta que dejes puesta se guarda,
   así que la app abre donde la dejaste.

   Qué bloques existen y qué pintan vive en bloques.js; qué bloques tiene
   cada cuenta y en qué orden, en data/paneles.js. Aquí solo se elige la
   cuenta, se monta el contexto y se pinta la lista.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, C = A.C, Up = A.Up, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, ui = A.ui;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function bigAmount() { return A.bigAmount.apply(null, arguments); }
  function limiteEnTarjeta() { return A.limiteEnTarjeta.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function pintarBloque() { return A.pintarBloque.apply(null, arguments); }

  /* Cuál es la tarjeta centrada no vive en la sesión sino en el estado,
     porque se recuerda de una vez para otra. Sale null solo mientras no
     haya ninguna cuenta, que es lo que ve quien las borra todas. */

  function cuentaActiva() { return S.cuentaDelPanel(); }

  /* ---------- el carrusel ---------- */

  function tarjetaCuenta(a, curKey, activa) {
    var obj = S.estadoDeObjetivo(a.id, curKey);
    return '<button type="button" class="paycard" data-panel="' + esc(a.id) + '" ' +
             'data-activa="' + activa + '" aria-pressed="' + activa + '" ' +
             'style="--acc-color:' + S.catColorVar(a) + '">' +
        '<div class="paycard__top">' +
          '<span class="paycard__dots"><i></i><i></i><i></i><i></i>' + esc(a.name) + '</span>' +
          '<span class="paycard__type">' + esc(a.type) + '</span>' +
        '</div>' +
        '<div>' +
          '<p class="paycard__label">Saldo</p>' +
          '<p class="paycard__value">' + bigAmount(S.accountBalance(a.id)) + '</p>' +
        '</div>' +
        /* si la cuenta tiene objetivo de gasto, la barra sustituye al pie
           de texto: es lo que se quiere mirar de un vistazo */
        (obj ? limiteEnTarjeta(obj) : "") +
        '<div class="paycard__foot">' +
          /* La que manda sobre el panel lo dice con todas las letras: el
             tamaño y el brillo ya la separan, pero eso solo se ve si
             tienes otra al lado con la que compararla. */
          (activa
            ? '<span class="paycard__viendo">' + icon("check", 13) + 'Viendo</span>'
            : '<span class="paycard__label">' + esc(a.type) + '</span>') +
          '<span class="paycard__mark" aria-hidden="true"><span></span><span></span></span>' +
        '</div>' +
      '</button>';
  }

  function carrusel(curKey, activa) {
    var accounts = S.state.accounts;
    var pos = accounts.findIndex(function (x) { return x.id === activa; });
    return '<div class="cards">' +
        '<div class="cards__track" id="cardsTrack">' +
          accounts.map(function (a) {
            return tarjetaCuenta(a, curKey, activa === a.id);
          }).join("") +

          /* La última es la de crear otra. Antes había que saber que las
             cuentas se administran en otra pantalla, y no había forma de
             adivinarlo: aquí se ve deslizando, que es lo que uno hace
             con unas tarjetas. */
          '<button type="button" class="paycard paycard--nueva" data-form="account">' +
            '<span class="paycard__plus" data-icon="plus" data-icon-size="22"></span>' +
            '<span class="paycard__nueva-txt">Añadir cuenta</span>' +
            /* Corto a propósito: en dos renglones estiraba a todas las
               tarjetas del carril, que van a la altura de la más alta. */
            '<span class="paycard__nueva-sub">Banco, hucha, efectivo…</span>' +
          '</button>' +
        '</div>' +
        /* Un punto por tarjeta, contando la de añadir: si no, deslizar
           hasta el final apagaba todos los puntos y parecía roto. */
        '<div class="cards__dots" id="cardsDots" aria-hidden="true">' +
          accounts.concat([null]).map(function (a, i) {
            return '<span class="cards__dot" data-on="' + (i === pos) + '"></span>';
          }).join("") +
        '</div>' +
      '</div>';
  }

  /* ---------- los avisos, que van siempre arriba ---------- */

  function avisoCola() {
    var cola = S.pendientes();
    if (!cola.length) return "";
    return '<section class="update-card">' +
        '<span class="update-card__icon" data-icon="calendar" data-icon-size="19"></span>' +
        '<div class="update-card__body">' +
          '<p class="update-card__title">' +
            (cola.length === 1 ? "Tienes 1 movimiento por confirmar"
                               : "Tienes " + cola.length + " movimientos por confirmar") + '</p>' +
          '<p class="update-card__text">' + esc(cola[0].note) +
            (cola.length > 1
              ? " y " + (cola.length - 1) + " más. Dinos el importe y se apuntan."
              : ". Dinos el importe y se apunta.") + '</p>' +
          '<div class="update-card__actions">' +
            '<button type="button" class="btn btn--primary" id="colaAbrir">' +
              icon("check", 16) + 'Confirmar</button>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function avisoUpdate() {
    if (!ui.update) return "";
    return '<section class="update-card">' +
        '<span class="update-card__icon" data-icon="download" data-icon-size="19"></span>' +
        '<div class="update-card__body">' +
          '<p class="update-card__title">Hay una actualización</p>' +
          '<p class="update-card__text">' +
            'split ' + esc(ui.update.version) + ' ya está disponible. ' +
            'Tú tienes la ' + esc(Up.VERSION) + '.' +
          '</p>' +
          '<div class="update-card__actions">' +
            '<button type="button" class="btn btn--primary" id="updateNow">' +
              icon("download", 16) + 'Actualizar</button>' +
            '<button type="button" class="update-card__later" id="updateLater">Ahora no</button>' +
          '</div>' +
          '<div class="update-bar" id="updateBar" hidden>' +
            '<span class="update-bar__fill" id="updateBarFill"></span>' +
          '</div>' +
          /* Enlace de verdad, no un botón: si el WebView se atragantara
             con la descarga del botón, tocar un <a> siempre acaba en el
             navegador del sistema. */
          '<a class="update-card__link" href="' + esc(ui.update.page || ui.update.url) +
             '" target="_blank" rel="noopener">¿No se descarga? Ábrela en el navegador</a>' +
        '</div>' +
      '</section>';
  }

  /* ============================================================
     Pintar
     ============================================================ */

  function renderInicio() {
    var root = $("#view-inicio");
    var curKey = S.cicloActual();
    var accId = cuentaActiva();

    var ctx = {
      accId: accId,
      key: curKey,
      cuenta: accId
        ? S.state.accounts.find(function (a) { return a.id === accId; })
        : null
    };

    /* Los bloques que no tienen nada que enseñar devuelven cadena vacía
       y entonces ni se les hace hueco: un panel con seis huecos vacíos
       da la impresión de que la app está rota. */
    var bloques = S.panelDe(accId).map(function (id) {
      return { id: id, html: pintarBloque(id, ctx) };
    }).filter(function (b) { return b.html; });

    var editando = !!ui.panelOrdenando;

    /* En modo colocar se pintan TODOS los del panel, aunque no tengan
       nada que enseñar: si no, no habría forma de moverlos ni de
       quitarlos, y desaparecerían de la lista sin explicación. */
    var lista = editando
      ? S.panelDe(accId).map(function (id) {
          return { id: id, html: pintarBloque(id, ctx), vacio: !pintarBloque(id, ctx) };
        }).filter(function (b) { return A.bloqueDefinicion(b.id); })
      : bloques;

    root.innerHTML =
      '<div class="dash dash--panel"' + (editando ? ' data-ordenando="true"' : "") + '>' +
        '<div class="dash__col stagger">' +
          (avisoCola() ? '<div style="--i:0">' + avisoCola() + '</div>' : "") +
          (avisoUpdate() ? '<div style="--i:0">' + avisoUpdate() + '</div>' : "") +
          '<div style="--i:0">' + carrusel(curKey, accId) + '</div>' +
          (editando ? barraDeOrden(accId, ctx) : "") +
          '<div id="panelLista" class="panel-lista">' +
            lista.map(function (b, i) {
              return '<div style="--i:' + Math.min(6, i + 1) + '" ' +
                       'class="panel-bloque" data-bloque="' + esc(b.id) + '">' +
                  (editando ? asaDeBloque(b) : "") +
                  '<div class="panel-bloque__cuerpo">' + (b.html || vacioHtml(b.id)) + '</div>' +
                '</div>';
            }).join("") +
          '</div>' +
          (editando
            ? ""
            : '<div style="--i:7">' +
                '<button type="button" class="panel-editar" id="panelEditar">' +
                  icon("sliders", 15) +
                  (accId ? 'Personalizar el panel de ' + esc(ctx.cuenta.name)
                         : 'Personalizar este panel') +
                '</button>' +
              '</div>') +
        '</div>' +
      '</div>';

    mountIcons(root);
    if (!editando) pintarGraficos(root);
    centrarCarrusel(root, accId);
    if (editando) A.arrastrarBloques($("#panelLista", root), accId);
  }

  /* La barra de arriba del modo colocar: qué se está haciendo y cómo
     salir. Va pegada al panel y no en una hoja aparte porque lo que se
     está tocando es el panel. */
  function barraDeOrden(accId, ctx) {
    /* Dos filas y no una: con el texto y los dos botones en línea, en un
       móvil el «Colocando…» se partía en una palabra por renglón. */
    return '<div class="panel-barra" style="--i:0">' +
        '<span class="panel-barra__texto">' +
          '<span class="panel-barra__titulo">Colocando ' +
            (accId ? esc(ctx.cuenta.name) : 'el Resumen') + '</span>' +
          '<span class="panel-barra__sub">Arrastra por el asa, o usa las flechas</span>' +
        '</span>' +
        '<span class="panel-barra__acciones">' +
          '<button type="button" class="btn btn--ghost" id="panelAnadir">' +
            icon("plus", 15) + 'Añadir</button>' +
          '<button type="button" class="btn btn--primary" id="panelListo">' +
            icon("check", 15) + 'Listo</button>' +
        '</span>' +
      '</div>';
  }

  /* El asa de un bloque mientras se coloca. Es lo único por lo que se
     arrastra: si se pudiera arrastrar por el cuerpo, no se podría hacer
     scroll dentro del panel. */
  function asaDeBloque(b) {
    var def = A.bloqueDefinicion(b.id);
    return '<div class="panel-asa">' +
        '<span class="panel-asa__grip" data-arrastrar="' + esc(b.id) + '" ' +
              'role="button" tabindex="0" aria-label="Mover ' + esc(def.nombre) + '">' +
          '<span></span><span></span><span></span>' +
        '</span>' +
        '<span class="panel-asa__nombre">' + esc(def.nombre) + '</span>' +
        '<button type="button" class="icon-btn" data-subir="' + esc(b.id) + '" ' +
                'aria-label="Subir" data-icon="chevUp" data-icon-size="14"></button>' +
        '<button type="button" class="icon-btn" data-bajar="' + esc(b.id) + '" ' +
                'aria-label="Bajar" data-icon="chevDown" data-icon-size="14"></button>' +
        '<button type="button" class="icon-btn panel-asa__quitar" data-quitar="' + esc(b.id) + '" ' +
                'aria-label="Quitar" data-icon="close" data-icon-size="14"></button>' +
      '</div>';
  }

  /* Un bloque que ahora mismo no tiene nada que enseñar. Solo se ve
     colocando: fuera de ahí no ocupa hueco. */
  function vacioHtml(id) {
    var def = A.bloqueDefinicion(id);
    return '<p class="panel-vacio">' + esc(def.sub) + '. Ahora mismo no tiene ' +
      'nada que enseñar, así que fuera de aquí no ocupa sitio.</p>';
  }

  /* Los gráficos se montan después de escribir el HTML: el motor mide el
     hueco que le toca, y para medirlo tiene que estar ya en la página. */
  function pintarGraficos(root) {
    $$("[data-spark]", root).forEach(function (node) {
      C.sparkline(node, JSON.parse(node.getAttribute("data-spark")), { height: 24 });
    });
    $$("[data-donut]", root).forEach(function (node) {
      C.donut(node, JSON.parse(node.getAttribute("data-donut")), {
        format: S.moneyShort, label: "Gastado", size: 180,
        ariaLabel: "Reparto del gasto por categoría"
      });
    });
    $$("[data-columnas]", root).forEach(function (node) {
      C.divergingColumns(node, {
        data: JSON.parse(node.getAttribute("data-columnas")).map(function (m) {
          return { label: m.label, labelFull: m.labelFull, value: m.net };
        }),
        format: S.signed, height: 140,
        ariaLabel: "Ahorro neto por mes"
      });
    });
    $$("[data-calor]", root).forEach(function (node) {
      C.heatmap(node, JSON.parse(node.getAttribute("data-calor")), { format: S.money });
    });

    var anillo = $("[data-limit-ring]", root);
    if (anillo) {
      C.progressRing(anillo, parseFloat(anillo.getAttribute("data-limit-ring")), {
        size: 46, stroke: 4, color: "#fff", track: "rgba(255,255,255,0.28)"
      });
    }
  }

  /* El carrusel se deja donde estaba: repintar y que se fuera al
     principio haría imposible cambiar nada sin perder de vista la cuenta
     que estás mirando. */
  function centrarCarrusel(root, accId) {
    var track = $("#cardsTrack", root);
    if (!track) return;
    var i = Math.max(0, S.state.accounts.findIndex(function (a) { return a.id === accId; }));
    var card = track.children[i];
    if (card) track.scrollLeft = card.offsetLeft - track.offsetLeft;

    /* Deslizar cambia la cuenta del panel. Se espera a que pare: repintar
       en cada píxel de scroll dejaría el móvil de rodillas. */
    var t = null;
    track.addEventListener("scroll", function () {
      var dots = $$("#cardsDots .cards__dot", root);
      var n = Math.round(track.scrollLeft / (track.scrollWidth / (track.children.length)));
      dots.forEach(function (d, di) { d.setAttribute("data-on", String(di === n)); });

      clearTimeout(t);
      t = setTimeout(function () {
        var hijo = track.children[n];
        if (!hijo || !hijo.hasAttribute("data-panel")) return;
        var id = hijo.getAttribute("data-panel");
        if (id === S.cuentaDelPanel()) return;
        /* Se guarda al parar, no en cada píxel: es una escritura por
           gesto, y así la app vuelve a abrir donde la dejaste. */
        S.setCuentaDelPanel(id);
        renderInicio();
      }, 180);
    }, { passive: true });
  }


  /* --- lo que usan otros archivos --- */
  A.renderInicio = renderInicio;

  A.screens["inicio"] = renderInicio;
})();
