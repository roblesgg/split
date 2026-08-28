/* ============================================================
   split — base de la interfaz

   El sitio común de todas las pantallas: el estado de navegación, las
   hojas y los ayudantes que usa más de un archivo. Se carga el primero y
   cuelga window.App; a partir de ahí cada pantalla se registra sola, así
   que añadir una no obliga a tocar el router ni el arranque.
   ============================================================ */

window.App = (function () {
  "use strict";

  var S = window.Store, U = window.UI, C = window.Charts, Up = window.Updater;
  var $ = U.$, $$ = U.$$, esc = U.esc, icon = U.icon;

  /* ---------- estado de la interfaz ---------- */

  var ui = {
    view: "inicio",
    cicloOffset: 0,          /* qué ciclo mira Análisis */
    anView: "ahorro",        /* qué muestra el gráfico de Historial */
    range: 12,               /* meses de histórico que se dibujan */
    movsKind: "all",
    movsQuery: "",
    movsAccount: null,       /* si se llega desde una cuenta, solo la suya */
    movsCat: null,           /* y si se llega desde una categoría, solo la suya */
    movsCicloOffset: 0,      /* y cuál mira Movimientos */
    draft: null,
    editingId: null,
    cuentaReturn: null,      /* a qué cuenta volver al salir de su edición */
    opcionesRec: false,      /* «Más opciones» del formulario de programado */
    catAbierta: null,        /* madre desplegada en el selector de categoría */
    detallesAbiertos: false, /* «Más detalles» de la hoja de apuntar */
    update: null,            /* { version, name, url } si hay una release nueva */

    /* Estado de las hojas. Antes eran variables sueltas del archivo
       gordo; aquí abajo se ven de una vez y son de todos. */
    form: null,             /* formulario abierto: { type, id, d } */
    ob: null,               /* cuestionario de bienvenida a medias */
    cuentaAbierta: null,    /* qué cuenta se está mirando por dentro */
    panelEditando: null,    /* de qué panel se están eligiendo los bloques */
    panelOrdenando: false,  /* el panel está en modo colocar bloques */
    pickPendiente: null,    /* quién espera una elección: { resolver } */
    cobro: "",              /* lo tecleado al confirmar un cobro, en céntimos */
    avisadoDeAlarmas: false /* el aviso de «las alarmas llegan tarde», una vez */
  };

  var sheets = {};
  /* ---------- helpers ---------- */

  function money(v) { return S.money(v); }
  function cicloVisible() { return S.addMonths(S.cicloActual(), -ui.cicloOffset); }
  function cicloMovs() { return S.addMonths(S.cicloActual(), -ui.movsCicloOffset); }
  function catOf(id) { return S.catById(id); }

  /* Emoji de la categoría sobre un fondo teñido con su color. Sustituye al
     icono SVG: el emoji lo elige el usuario y el color separa de un vistazo.
     El nombre siempre viaja al lado, así que el color nunca es el único
     canal que lleva el dato. */
  function catFace(cat, size, cls) {
    return '<span class="' + (cls ? cls + " " : "") + 'cat-face" ' +
           'style="--cat-color:' + S.catColorVar(cat) + ';font-size:' + (size || 18) + 'px" ' +
           'aria-hidden="true">' + esc(cat.emoji || "\uD83D\uDCE6") + '</span>';
  }
  function isDesktop() { return window.matchMedia("(min-width: 900px)").matches; }

  /* «cuentas» limita la serie a unas cuantas; null son todas. Lo usa el
     Resumen para que la rayita de debajo de cada cifra hable de lo mismo
     que la cifra: una línea de todas las cuentas bajo un número de una
     sola sería una mentira pequeña pero mentira. */
  function seriesEnding(endKey, n, cuentas) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var key = S.addMonths(endKey, -i);
      var mes = S.txDeCiclo(key);
      if (cuentas) {
        mes = mes.filter(function (t) {
          return cuentas.indexOf(t.accountId) >= 0 ||
                 (t.toAccountId && cuentas.indexOf(t.toAccountId) >= 0);
        });
      }
      var t = S.totals(mes);
      out.push({
        key: key,
        label: S.etiquetaCiclo(key, "short"),
        labelFull: S.etiquetaCiclo(key),
        income: t.income, expense: t.expense, net: t.net
      });
    }
    return out;
  }

  function deltaPct(now, before) {
    if (!before) return null;
    return ((now - before) / Math.abs(before)) * 100;
  }

  /* Se llama después de cada repintado, así que es el sitio natural para
     dejar también listos los campos recién creados: el teclado del móvil
     tiene que enseñar «Listo» en todos, no solo en los del HTML fijo. */
  function mountIcons(root) {
    $$("[data-icon]", root || document).forEach(function (n) {
      if (n.getAttribute("data-icon-done")) return;
      n.innerHTML = icon(n.getAttribute("data-icon"), +(n.getAttribute("data-icon-size") || 20));
      n.setAttribute("data-icon-done", "1");
    });
    U.tecladoComodo(root || document);
  }

  /* importe con céntimos en menor tamaño */
  function bigAmount(v) {
    var s = money(v);
    var i = s.lastIndexOf(",");
    if (i < 0) return esc(s);
    return esc(s.slice(0, i)) + '<span class="cents">' + esc(s.slice(i)) + "</span>";
  }

  function nombreCiclo(key) { return S.nombreCiclo(key); }

  /* Cómo llamar al periodo en los textos. Si el mes del usuario es el del
     calendario, «mes», que es como lo llama todo el mundo. Si lo ha
     movido al 25, «ciclo»: llamarle mes a algo que va del 25 al 24
     confunde más de lo que aclara. */
  function periodo() { return S.esMesNatural() ? "mes" : "ciclo"; }
  function periodos() { return S.esMesNatural() ? "meses" : "ciclos"; }
  function Periodo() { return S.esMesNatural() ? "Mes" : "Ciclo"; }

  /* ---------- tarjetas plegables ----------
     Qué está plegado se guarda aparte del estado de datos: es una
     preferencia de la pantalla, no algo que exportar ni migrar. */

  var FOLD_KEY = "split.folds";
  var folds = null;

  function foldState() {
    if (!folds) {
      try { folds = JSON.parse(localStorage.getItem(FOLD_KEY)) || {}; }
      catch (e) { folds = {}; }
    }
    return folds;
  }

  /* abiertas por defecto: plegar es una decisión del usuario */
  function isFolded(id) { return foldState()[id] === true; }

  function setFolded(id, plegada) {
    foldState()[id] = plegada;
    try { localStorage.setItem(FOLD_KEY, JSON.stringify(folds)); } catch (e) {}
  }

  /* `extra` es lo que va a la derecha del título (un enlace, por ejemplo);
     va fuera del botón, porque un botón dentro de otro no es válido. */
  function foldCard(id, titulo, sub, extra, cuerpo, flush) {
    var abierta = !isFolded(id);
    return '<section class="card' + (flush ? " card--flush" : "") + '">' +
        '<div class="card__head' + (flush ? " card__pad--tight" : "") + '" ' +
             'style="margin-bottom:' + (abierta && !flush ? "var(--sp-4)" : "0") + '">' +
          '<button type="button" class="fold-head" data-fold="' + esc(id) + '" ' +
                  'aria-expanded="' + abierta + '">' +
            '<span>' +
              '<span class="card__title">' + titulo + '</span>' +
              (sub ? '<span class="card__sub" style="display:block">' + sub + '</span>' : "") +
            '</span>' +
            '<span class="fold-head__chev" data-icon="chevDown" data-icon-size="15"></span>' +
          '</button>' +
          (extra || "") +
        '</div>' +
        '<div class="fold" data-open="' + abierta + '">' +
          '<div class="fold__inner">' + cuerpo + '</div>' +
        '</div>' +
      '</section>';
  }

  /* Los límites del mes ya calculados viven en la capa de datos
     (S.estadoDeLimites): aquí no queda nada que derivar. Lo que salía de
     este hueco era el presupuesto por porcentajes, que ya no existe. */

  /* Cada archivo apunta aquí su cableado al cargarse y el arranque lo
     engancha de una vez, en el orden en que están los <script>. */
  var wires = [];
  function wire(fn) { wires.push(fn); }
  function wireAll() { wires.forEach(function (fn) { fn(); }); }

  return {
    S: S, U: U, C: C, Up: Up,
    $: $, $$: $$, esc: esc, icon: icon,
    ui: ui, sheets: sheets,

    /* Registro de pantallas: nombre de vista -> función que la pinta. */
    screens: {},
    wire: wire, wireAll: wireAll,

    /* ayudantes que usa más de una pantalla */
    bigAmount: bigAmount, catFace: catFace,
    catOf: catOf, deltaPct: deltaPct, foldCard: foldCard,
    isDesktop: isDesktop, money: money, mountIcons: mountIcons,
    seriesEnding: seriesEnding, setFolded: setFolded,

    /* qué ciclo está mirando cada pantalla */
    cicloVisible: cicloVisible, cicloMovs: cicloMovs, nombreCiclo: nombreCiclo,
    periodo: periodo, periodos: periodos, Periodo: Periodo
  };
})();
