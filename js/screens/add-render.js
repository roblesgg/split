/* ============================================================
   split — hoja: pintar el añadir

   El teclado, el importe grande y el reparto de un ingreso entre
   partidas.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, ui = A.ui;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function accountSelect() { return A.accountSelect.apply(null, arguments); }
  function catFace() { return A.catFace.apply(null, arguments); }
  function catOf() { return A.catOf.apply(null, arguments); }
  function detallesHtml() { return A.detallesHtml.apply(null, arguments); }
  function draftValue() { return A.draftValue.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function refreshAttachments() { return A.refreshAttachments.apply(null, arguments); }
  function repetirHtml() { return A.repetirHtml.apply(null, arguments); }

  /* Si el gasto va a salir de un apartado, se dice antes de guardarlo y
     se puede quitar de un toque. Enterarse después de que un gasto no
     contaba donde creías es la clase de sorpresa que hace desconfiar.

     Va en su propia caja porque elegir categoría no repinta la hoja
     —hacerlo te movería el teclado debajo del dedo—, así que este trozo
     se refresca solo. */
  function apartadoHtml(d) {
    return '<div id="addApartadoBox">' + apartadoInner(d) + '</div>';
  }

  function apartadoInner(d) {
    if (d.kind !== "out") return "";

    var fuera = d.apartadoId === "";
    var ap = d.apartadoId
      ? S.apartadoById(d.apartadoId)
      : S.apartadoParaGasto(d.accountId, d.categoryId);
    if (!ap) return "";

    var e = S.estadoDeApartado(ap.id);
    return '<div class="field" style="margin-top:var(--sp-4)">' +
        '<button type="button" class="switch-row" id="addApartado" ' +
                'role="switch" aria-checked="' + (!fuera) + '">' +
          '<span class="cat-face apartado__face" ' +
                'style="--cat-color:var(--cat-' + ap.color + ')" aria-hidden="true">' +
            esc(ap.emoji) + '</span>' +
          '<span class="switch-row__text">' +
            '<span class="switch-row__label">Sale de ' + esc(ap.name) + '</span>' +
            '<span class="switch-row__hint">' +
              (fuera
                ? "Ahora no: este gasto contará en el límite de la cuenta."
                : "Quedan " + esc(S.moneyShort(e.saldo)) +
                  ", y no contará en el límite de la cuenta.") +
            '</span>' +
          '</span>' +
          '<span class="switch" aria-hidden="true"><span class="switch__dot"></span></span>' +
        '</button>' +
      '</div>';
  }

  function refreshApartado() {
    var box = $("#addApartadoBox");
    if (!box) return;
    box.innerHTML = apartadoInner(ui.draft);
    mountIcons(box);
  }

  /* La rejilla de categorías, con las de dentro abriéndose EN SU FILA.
     Antes el cajón iba al final de la rejilla: con doce categorías se
     abría fuera de la pantalla y parecía que tocar no hacía nada.

     El truco es de rejilla: se mete un bloque a todo el ancho justo
     detrás de la última categoría de la fila que se ha tocado, así que
     empuja hacia abajo solo lo que hay de esa fila para adelante. La
     flechita apunta a la columna que tocaste, que es lo que ata una
     cosa con la otra sin tener que explicarlo. */
  var COLS = 3;

  function cajonHijas(d, abierta, hijas, col) {
    var madre = catOf(abierta);
    if (!madre) return "";
    /* el centro de la columna tocada, en tanto por ciento del ancho */
    var flecha = ((col + 0.5) / COLS) * 100;

    return '<div class="cat-sub" style="--flecha:' + flecha.toFixed(2) + '%">' +
        '<p class="cat-sub__titulo">' +
          esc(madre.emoji || "") + ' Dentro de ' + esc(madre.name) +
        '</p>' +
        '<div class="chips">' +
          hijas.map(function (h, i) {
            return '<button type="button" class="chip" data-cat="' + esc(h.id) + '" ' +
                     'style="--i:' + i + '" ' +
                     'aria-pressed="' + (h.id === d.categoryId) + '">' +
                   esc(h.emoji || "") + ' ' + esc(h.name) + '</button>';
          }).join("") +
          '<button type="button" class="chip chip--add" ' +
                  'style="--i:' + hijas.length + '" ' +
                  'data-cat-new-hija="' + esc(abierta) + '">' +
            icon("plus", 12) + 'Crear subcategoría' +
          '</button>' +
        '</div>' +
        '<p class="cat-sub__pie">' +
          (hijas.length
            ? 'O déjalo en ' + esc(madre.name) + ' a secas.'
            : 'Aquí dentro no hay nada todavía. Lo que crees seguirá ' +
              'sumando en ' + esc(madre.name) + '.') +
        '</p>' +
      '</div>';
  }

  function rejillaCategorias(d, cats, abierta, hijas, elegida) {
    /* La de «Nueva» es una más para la cuenta de filas: si no, el cajón
       se colaría delante de ella cuando la madre tocada es la última. */
    var total = cats.length + 1;
    var iAbierta = abierta
      ? cats.findIndex(function (c) { return c.id === abierta; })
      : -1;
    /* Tras cuál de las casillas hay que meter el cajón: la última de su
       misma fila, o la última de todas si esa fila está a medias. */
    var trasIndice = iAbierta < 0 ? -1
      : Math.min(total - 1, Math.floor(iAbierta / COLS) * COLS + (COLS - 1));

    var casillas = cats.map(function (c) {
      /* Marcada si es la elegida, y también si lo elegido es una hija
         suya: si no, al afinar dentro de Comida la rejilla se quedaba
         entera sin marcar y parecía que no habías elegido nada. */
      var dentro = elegida && elegida.parentId === c.id;
      return '<button type="button" class="cat-pick" data-cat="' + esc(c.id) + '" ' +
               'aria-pressed="' + (c.id === d.categoryId) + '"' +
               (c.id === abierta ? ' data-abierta="1"' : '') +
               (dentro ? ' data-dentro="1"' : '') + '>' +
          catFace(c, 26, "cat-pick__icon") +
          '<span class="cat-pick__name">' + esc(c.name) + '</span>' +
        '</button>';
    });

    casillas.push(
      '<button type="button" class="cat-pick cat-pick--add" ' +
              'data-cat-new="' + esc(d.kind) + '">' +
        '<span class="cat-pick__icon">' + icon("plus", 18) + '</span>' +
        '<span class="cat-pick__name">Nueva</span>' +
      '</button>');

    if (trasIndice >= 0) {
      casillas.splice(trasIndice + 1, 0,
        cajonHijas(d, abierta, hijas, iAbierta % COLS));
    }

    return '<div class="cat-grid">' + casillas.join("") + '</div>' +
      '<p class="field__hint">Mantén pulsada una categoría para editarla.</p>';
  }

  function renderAddSheet() {
    var d = ui.draft;
    var body = $("#sheetAddBody");
    /* En la cuadrícula solo van las de primer nivel. Las que estén dentro
       de otra salen en una fila aparte al tocar su madre, y así no se
       mezclan doce categorías con sus veinte hijas. */
    var cats = S.categoriasMadre(d.kind);
    var elegida = catOf(d.categoryId);
    /* si lo elegido es una hija, su madre aparece abierta */
    var abierta = elegida && elegida.parentId ? elegida.parentId : ui.catAbierta;
    var hijas = abierta ? S.hijasDe(abierta) : [];
    var v = draftValue();

    body.innerHTML =
      '<div class="segmented" id="addSeg" role="tablist">' +
        '<span class="segmented__thumb" id="addThumb" aria-hidden="true"></span>' +
        '<button type="button" class="segmented__btn" role="tab" data-dkind="out" ' +
                'aria-selected="' + (d.kind === "out") + '">Gasto</button>' +
        '<button type="button" class="segmented__btn" role="tab" data-dkind="in" ' +
                'aria-selected="' + (d.kind === "in") + '">Ingreso</button>' +
        '<button type="button" class="segmented__btn" role="tab" data-dkind="transfer" ' +
                'aria-selected="' + (d.kind === "transfer") + '">Traspaso</button>' +
      '</div>' +

      '<div class="amount-display' + (d.amount ? "" : " is-zero") + '" id="amountDisplay" ' +
           'data-kind="' + d.kind + '" aria-live="polite">' +
        '<span class="amount-display__sign">' +
          (d.kind === "in" ? "+" : d.kind === "transfer" ? "" : "−") + '</span>' +
        '<span id="amountText">' + esc(A.textoImporte(d.amount)) + '</span>' +
        '<span class="amount-display__cur">€</span>' +
      '</div>' +

      '<div class="keypad" id="keypad">' +
        [1,2,3,4,5,6,7,8,9].map(function (n) {
          return '<button type="button" class="key" data-key="' + n + '">' + n + '</button>';
        }).join("") +
        /* La coma donde antes estaba el «00». Los importes se teclean
           enteros y los decimales solo salen si los pides, así que el
           «00» dejó de tener sentido y la coma pasó a hacer falta. */
        '<button type="button" class="key key--coma" data-key="," aria-label="Coma decimal">,</button>' +
        '<button type="button" class="key" data-key="0">0</button>' +
        '<button type="button" class="key" data-key="del" aria-label="Borrar">' +
          icon("backspace", 18) + '</button>' +
      '</div>' +

      (d.kind === "transfer"
        ? '<div class="field__row">' +
            '<div>' +
              '<label class="field__label" for="addAccount">Desde</label>' +
              accountSelect("addAccount", d.accountId) +
            '</div>' +
            '<div>' +
              '<label class="field__label" for="addToAccount">Hacia</label>' +
              accountSelect("addToAccount", d.toAccountId) +
            '</div>' +
          '</div>' +
          (d.accountId === d.toAccountId
            ? '<p class="field__hint">' + icon("warning", 12) +
              ' Elige dos cuentas distintas.</p>'
            : '' +
              '')
        : '<div class="field">' +
            '<span class="field__label">Categoría</span>' +
            rejillaCategorias(d, cats, abierta, hijas, elegida) +
          '</div>') +

      /* Solo en un traspaso hacen falta las dos cuentas delante. */
      (d.kind === "transfer"
        ? ""
        : d.reparto
          ? repartoHtml(d, v)
          : '<div class="field" style="margin-top:var(--sp-4)">' +
              '<span class="field__label">Cuenta</span>' +
              accountSelect("addAccount", d.accountId) +
            '</div>') +

      apartadoHtml(d) +

      /* Solo tiene sentido en un ingreso nuevo y con más de una cuenta:
         editar uno ya guardado es editar ese, no repartir de nuevo. */
      (d.kind === "in" && !ui.editingId && S.state.accounts.length > 1
        ? '<button type="button" class="btn btn--ghost" id="addReparto" ' +
                  'style="width:100%;margin-top:var(--sp-3)">' +
            icon(d.reparto ? "close" : "swap", 15) +
            (d.reparto ? "Ingresar todo en una cuenta" : "Repartir entre varias cuentas") +
          '</button>'
        : "") +

      /* Programar desde aquí. Antes había que apuntar el traspaso y luego
         irse a otra pantalla a crear el programado con los mismos datos.
         Repetir un pago, un cobro o un traspaso es lo mismo, así que se
         ofrece igual en los tres. */
      (ui.editingId ? "" : repetirHtml(d)) +

      /* Y el resto, cerrado. Apuntar un café son dos toques: importe y
         categoría. Tener delante título, fecha, hora, etiquetas, notas y
         adjuntos convertía eso en un formulario que hay que atravesar con
         la vista cada vez.

         No se pierde nada: lo que no se rellena tiene un valor sensato
         —el título es el nombre de la categoría, la fecha hoy, la hora
         ahora—. Y si el movimiento que se edita ya trae detalles, se abre
         solo, que si no parecería que se han borrado. */
      detallesHtml(d) +

      '<div class="field" style="margin-top:var(--sp-5)">' +
        '<button type="button" class="btn btn--primary" id="addSave"' +
          ((v <= 0 || (d.kind === "transfer" && d.accountId === d.toAccountId))
            ? " disabled" : "") + '>' +
          icon("check", 17) + (ui.editingId ? "Guardar cambios" : "Guardar movimiento") +
        '</button>' +
      '</div>' +

      (ui.editingId
        ? '<div class="field">' +
            '<button type="button" class="btn btn--danger" id="addDelete" style="width:100%">' +
              icon("trash", 16) + 'Eliminar movimiento</button>' +
          '</div>'
        : "");

    mountIcons(body);
    refreshAttachments();
    requestAnimationFrame(function () {
      var seg = $("#addSeg", body);
      if (seg) U.slideIndicator(seg, $("#addThumb", body), $('[data-dkind="' + d.kind + '"]', seg));

      var segR = $("#addRepSeg", body);
      if (segR) U.slideIndicator(segR, $("#addRepThumb", body),
        $('[data-repfreq="' + (d.repFreq === "semanal" ? "semanal" : "mensual") + '"]', segR));
    });
  }

  /* ---------- repartir un ingreso entre cuentas ----------
     Se cobra una cantidad y no toda va al mismo sitio: una parte a la
     cuenta del día a día y otra a la hucha. Antes había que apuntar el
     ingreso entero y luego un traspaso a mano.

     No se inventa nada nuevo en los datos: se guarda un ingreso por
     cuenta. Cada uno es un movimiento normal, se edita y se borra por
     separado, y los saldos salen solos. */

  function sumaTrozos(d) {
    return S.state.accounts.reduce(function (t, a) {
      var v = parseFloat(d.trozos[a.id]);
      return t + (isFinite(v) && v > 0 ? v : 0);
    }, 0);
  }

  function restoPorRepartir(d, total) {
    return Math.round((total - sumaTrozos(d)) * 100) / 100;
  }

  function repartoHtml(d, total) {
    var resto = restoPorRepartir(d, total);

    return '<div class="field" style="margin-top:var(--sp-4)">' +
        '<div class="card__head" style="margin-bottom:var(--sp-3)">' +
          '<span class="field__label" style="margin:0">Cuánto va a cada cuenta</span>' +
          '<button type="button" class="card__link" id="addRepartoIgual">A partes iguales</button>' +
        '</div>' +

        S.state.accounts.map(function (a) {
          var val = d.trozos[a.id];
          return '<div class="reparto-fila">' +
              '<span class="reparto-fila__punto" ' +
                    'style="background:' + S.catColorVar(a) + '"></span>' +
              '<span class="reparto-fila__nombre">' + esc(a.name) + '</span>' +
              '<span class="input-affix reparto-fila__campo">' +
                '<input type="number" class="field__input" data-trozo="' + esc(a.id) + '" ' +
                       'min="0" step="0.01" inputmode="decimal" placeholder="0" ' +
                       'value="' + esc(val == null ? "" : val) + '">' +
                '<span class="input-affix__suffix">€</span>' +
              '</span>' +
            '</div>';
        }).join("") +

        '<div class="ajuste" id="addResto" data-dif="' +
              (Math.abs(resto) < 0.005 ? "cero" : resto > 0 ? "out" : "in") + '">' +
          textoResto(resto) +
        '</div>' +
      '</div>';
  }

  function textoResto(resto) {
    if (Math.abs(resto) < 0.005) {
      return '<span class="ajuste__txt">Repartido del todo.</span>';
    }
    if (resto > 0) {
      return '<span class="ajuste__txt">Queda por repartir</span>' +
             '<span class="ajuste__eur">' + esc(money(resto)) + '</span>';
    }
    return '<span class="ajuste__txt">Te has pasado</span>' +
           '<span class="ajuste__eur">' + esc(money(-resto)) + '</span>';
  }

  /* Se recalcula sin repintar: repintar dejaría el campo sin foco. */
  function refreshResto() {
    var caja = $("#addResto");
    if (!caja) return;
    var resto = restoPorRepartir(ui.draft, draftValue());
    caja.setAttribute("data-dif",
      Math.abs(resto) < 0.005 ? "cero" : resto > 0 ? "out" : "in");
    caja.innerHTML = textoResto(resto);
    refreshAmount();
  }

  function repartirIgual() {
    var cuentas = S.state.accounts;
    var total = draftValue();
    var trozo = Math.floor((total / cuentas.length) * 100) / 100;
    var acumulado = 0;

    cuentas.forEach(function (a, i) {
      /* el último se lleva lo que sobre del redondeo, para que la suma
         cuadre al céntimo */
      var v = i === cuentas.length - 1
        ? Math.round((total - acumulado) * 100) / 100
        : trozo;
      acumulado += v;
      ui.draft.trozos[a.id] = v;
    });

    renderAddSheet();
  }

  function refreshAmount() {
    var v = draftValue();
    var disp = $("#amountDisplay"), txt = $("#amountText"), save = $("#addSave");
    if (!disp || !txt) return;
    txt.textContent = A.textoImporte(ui.draft.amount);
    /* Apagado mientras no hayas escrito nada, no mientras valga cero:
       «0,» es un cero que está a medio teclear. */
    disp.classList.toggle("is-zero", !ui.draft.amount);
    if (save) {
      var d = ui.draft;
      var repartoMal = d.reparto &&
        Math.abs(restoPorRepartir(d, v)) >= 0.005;
      save.disabled = v <= 0 ||
        (d.kind === "transfer" && d.accountId === d.toAccountId) ||
        repartoMal;
    }
  }


  /* --- lo que usan otros archivos --- */
  A.refreshAmount = refreshAmount;
  A.refreshResto = refreshResto;
  A.refreshApartado = refreshApartado;
  A.renderAddSheet = renderAddSheet;
  A.repartirIgual = repartirIgual;
  A.restoPorRepartir = restoPorRepartir;

})();
