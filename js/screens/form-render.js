/* ============================================================
   split — hoja: pintar el formulario

   Solo dibuja. Los campos que salen dependen de qué se esté creando, y
   eso es lo bastante largo como para no compartir archivo con la lógica.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, ui = A.ui;
  var DIAS_LARGO = A.DIAS_LARGO, EMOJI_SUGERIDOS = A.EMOJI_SUGERIDOS;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function accountSelect() { return A.accountSelect.apply(null, arguments); }
  function catOf() { return A.catOf.apply(null, arguments); }
  function listaDias() { return A.listaDias.apply(null, arguments); }
  function bigAmount() { return A.bigAmount.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function mountIcons() { return A.mountIcons.apply(null, arguments); }
  function numField() { return A.numField.apply(null, arguments); }
  function pickField() { return A.pickField.apply(null, arguments); }
  function htmlApartado() { return A.htmlApartado.apply(null, arguments); }
  function htmlLimite() { return A.htmlLimite.apply(null, arguments); }
  function identHtml() { return A.identHtml.apply(null, arguments); }
  function periodo() { return A.periodo.apply(null, arguments); }
  function switchRow() { return A.switchRow.apply(null, arguments); }

  function renderForm() {
    var body = $("#sheetFormBody");
    var t = ui.form.type, d = ui.form.d;
    var html = "";

    /* El título se vuelve a poner aquí: meter una categoría dentro de
       otra la convierte en subcategoría sin cerrar la hoja. */
    A.tituloForm();

    if (t === "aportar" || t === "apartado") html = htmlApartado(t, d);
    if (t === "limite") html = htmlLimite(t, d);

    if (t === "category") {
      /* Una que ya tiene hijas no puede meterse dentro de nadie. */
      var tieneHijas = ui.form.id && S.hijasDe(ui.form.id).length > 0;
      var madresPosibles = tieneHijas ? [] : S.categoriasMadre(d.kind)
        .filter(function (c) { return c.id !== ui.form.id && !c.sistema; });

      html =
        (ui.form.id
          ? ""
          : '<div class="segmented" id="fSeg" role="tablist">' +
              '<span class="segmented__thumb" id="fThumb" aria-hidden="true"></span>' +
              '<button type="button" class="segmented__btn" role="tab" data-fkind="out" ' +
                      'aria-selected="' + (d.kind === "out") + '">Gasto</button>' +
              '<button type="button" class="segmented__btn" role="tab" data-fkind="in" ' +
                      'aria-selected="' + (d.kind === "in") + '">Ingreso</button>' +
            '</div>') +

        identHtml(d, {
          placeholder: "Gasolina",
          heredadoDe: d.parentId && catOf(d.parentId) ? catOf(d.parentId).name : null
        }) +

        /* Meterla dentro de otra. Solo se ofrecen las de primer nivel del
           mismo tipo, y solo si esta no tiene ya hijas: un nivel y no más,
           que dos ya obligan a pensar dónde va cada cosa. */
        (madresPosibles.length
          ? '<div class="field">' +
              '<span class="field__label">Dentro de</span>' +
              pickField("fMadre", d.parentId || "",
                        d.parentId ? catOf(d.parentId).name : "Nada, va suelta") +
              '<p class="field__hint">' +
                (d.parentId
                  ? "En los gráficos sumará dentro de «" +
                    esc(catOf(d.parentId).name) + "», pero en la lista de " +
                    "movimientos se distingue."
                  : "Puedes meterla dentro de otra, por ejemplo «Deuda coche» " +
                    "dentro de «Deudas».") +
              '</p>' +
            '</div>'
          : "") +

        "";
    }

    if (t === "account") {
      html =
        '<div class="field">' +
          '<label class="field__label" for="fName">Nombre</label>' +
          '<input type="text" class="field__input" id="fName" data-f="Name" maxlength="28" ' +
                 'placeholder="Cuenta corriente" value="' + esc(d.name) + '">' +
        '</div>' +
        '<div class="field__row" style="margin-top:var(--sp-5)">' +
          '<div>' +
            '<span class="field__label">Tipo</span>' +
            pickField("fType", d.type, d.type) +
          '</div>' +
          numField("fOpening", "Saldo inicial", d.opening, 10) +
        '</div>' +
        /* El objetivo de gasto va justo debajo del saldo porque es la otra
           cifra que define la cuenta: cuánto hay y cuánto puedes gastar. */
        '<div class="field">' +
          numField("fLimite", "Objetivo de gasto por " + periodo(), d.limite, 10) +
          '<p class="field__hint">' +
            (parseFloat(d.limite) > 0
              ? 'Se vacía solo cuando empieza el ' + esc(periodo()) + ' siguiente. ' +
                'La app avisa cuando te acercas, pero no te bloquea.'
              : 'Déjalo vacío si no quieres ponerte un tope en esta cuenta.') +
          '</p>' +
        '</div>' +

        '<div class="field">' +
          '<span class="field__label">Icono</span>' +
          '<div class="cat-grid">' +
            ["wallet", "piggy", "cash", "target"].map(function (ic) {
              return '<button type="button" class="cat-pick" data-picon="' + ic + '" ' +
                       'aria-pressed="' + (d.icon === ic) + '">' +
                  '<span class="cat-pick__icon" data-icon="' + ic + '" data-icon-size="18"></span>' +
                '</button>';
            }).join("") +
          '</div>' +
        '</div>' +

        '<div class="field">' +
          '<span class="field__label">Color de la tarjeta</span>' +
          '<div class="card-preview" id="fCardPreview" ' +
               'style="--acc-color:var(--cat-' + d.color + ')">' +
            '<span class="card-preview__name" id="fCardName">' +
              esc(d.name || "Tu cuenta") + '</span>' +
            '<span class="card-preview__mark" aria-hidden="true">' +
              '<span></span><span></span></span>' +
          '</div>' +
          '<div class="swatch-grid" style="margin-top:var(--sp-3)">' +
            (function () {
              var out = [];
              for (var n = 1; n <= S.CAT_COLORS; n++) {
                out.push('<button type="button" class="swatch" data-pcolor="' + n + '" ' +
                           'style="background:var(--cat-' + n + ')" ' +
                           'aria-pressed="' + (n === d.color) + '" ' +
                           'aria-label="Color ' + n + '"></button>');
              }
              return out.join("");
            })() +
          '</div>' +
        '</div>';
    }

    if (t === "goal") {
      html =
        '<div class="field">' +
          '<label class="field__label" for="fName">Nombre</label>' +
          '<input type="text" class="field__input" id="fName" data-f="Name" maxlength="32" ' +
                 'placeholder="Colchón de emergencia" value="' + esc(d.name) + '">' +
        '</div>' +
        '<div class="field__row" style="margin-top:var(--sp-5)">' +
          numField("fTarget", "Objetivo", d.target, 50) +
          numField("fSaved", "Ya ahorrado", d.saved, 10) +
        '</div>' +
        '<div class="field">' +
          numField("fMonthly", "Aportación mensual", d.monthly, 10) +
          ''+
        '</div>';
    }

    if (t === "resumen") {
      /* Solo el periodo. La cuenta la elige el carrusel del Resumen, que
         es donde se ve cuál estás mirando: tenerlo en dos sitios era la
         forma segura de que un día no cuadraran. */
      html =
        '<div class="field">' +
          '<span class="field__label">De cuándo</span>' +
          '<div class="chips">' +
            [["mes", "Este mes"], ["ano", "Este año"],
             ["dias", "Últimos días"], ["todo", "Desde el principio"]].map(function (o) {
              return '<button type="button" class="chip" data-fperiodo="' + o[0] + '" ' +
                       'aria-pressed="' + (d.periodo === o[0]) + '">' + o[1] + '</button>';
            }).join("") +
          '</div>' +
        '</div>' +

        (d.periodo === "dias"
          ? '<div class="field">' +
              numField("fDias", "Cuántos días", d.dias, 1, "días") +
              '<p class="field__hint">Por ejemplo 7 para la semana, o 90 para el ' +
                'trimestre.</p>' +
            '</div>'
          : "") +

        '<p class="field__hint">Vale para las tres cifras de la cuenta que estés ' +
          'mirando. Para cambiar de cuenta, desliza las tarjetas de arriba.</p>';
    }

    if (t === "saldo") {
      var cuentaS = S.state.accounts.find(function (x) { return x.id === d.accountId; });
      var actual = cuentaS ? S.accountBalance(d.accountId) : 0;
      var puesto = parseFloat(d.real);
      var dif = isFinite(puesto) ? Math.round((puesto - actual) * 100) / 100 : 0;

      html =
        '<div style="text-align:center;padding:var(--sp-2) 0 var(--sp-5)">' +
          '<p class="card__title">' + esc(cuentaS ? cuentaS.name : "") + '</p>' +
          '<p class="card__sub" style="margin-top:2px">La app dice que tienes ' +
            esc(money(actual)) + '</p>' +
        '</div>' +

        '<div class="field">' +
          '<label class="field__label" for="fReal">¿Cuánto tienes de verdad?</label>' +
          '<div class="input-affix">' +
            '<input type="number" class="field__input field__input--big" id="fReal" ' +
                   'data-f="Real" step="0.01" inputmode="decimal" value="' +
                   esc(d.real) + '">' +
            '<span class="input-affix__suffix">€</span>' +
          '</div>' +
        '</div>' +

        /* Lo que se va a apuntar, dicho antes de tocar nada. Que nadie se
           encuentre un movimiento que no esperaba. */
        '<div class="ajuste" id="fAjuste" data-dif="' +
              (dif > 0 ? "in" : dif < 0 ? "out" : "cero") + '">' +
          (Math.abs(dif) < 0.005
            ? '<span class="ajuste__txt">Ya cuadra: no hay nada que apuntar.</span>'
            : '<span class="ajuste__txt">Se apuntará ' +
                (dif > 0 ? "un ingreso" : "un gasto") + ' de</span>' +
              '<span class="ajuste__eur">' + esc(money(Math.abs(dif))) + '</span>') +
        '</div>' +

        '<p class="field__hint">Queda como un movimiento normal, con la fecha de ' +
          'hoy y la categoría «Ajuste de saldo». Se puede borrar o editar después ' +
          'como cualquier otro.</p>';
    }

    if (t === "recurring") {
      var cats = S.CATEGORIES.filter(function (c) {
        return c.kind === (d.kind === "in" ? "in" : "out");
      });
      var mismaCuenta = d.kind === "transfer" && d.accountId === d.toAccountId;
      var esSem = d.freq === "semanal";
      /* Lo que enseña la interfaz. «anual» no existe en los datos: es
         mensual cada 12. */
      var ritmo = d.freq === "mensual" && +d.cada === 12 ? "anual" : d.freq;
      var modoImporte = d.kind === "in" ? (d.modo || "fijo") : "fijo";
      /* Un traspaso necesita sus dos cuentas sí o sí, así que ahí las
         opciones se abren de entrada. */
      var opcionesAbiertas = ui.opcionesRec || d.kind === "transfer";
      var cuotasHechas = ui.form.id
        ? ((S.state.recurring.find(function (x) { return x.id === ui.form.id; }) || {}).pagadas || 0)
        : 0;

      html =
        '<div class="segmented" id="fSeg" role="tablist">' +
          '<span class="segmented__thumb" id="fThumb" aria-hidden="true"></span>' +
          '<button type="button" class="segmented__btn" role="tab" data-fkind="out" ' +
                  'aria-selected="' + (d.kind === "out") + '">Pago</button>' +
          '<button type="button" class="segmented__btn" role="tab" data-fkind="in" ' +
                  'aria-selected="' + (d.kind === "in") + '">Cobro</button>' +
          '<button type="button" class="segmented__btn" role="tab" data-fkind="transfer" ' +
                  'aria-selected="' + (d.kind === "transfer") + '">Ahorro</button>' +
        '</div>' +

        '<div class="field">' +
          '<label class="field__label" for="fName">Concepto</label>' +
          '<input type="text" class="field__input" id="fName" data-f="Name" maxlength="32" ' +
                 'placeholder="' + (d.kind === "in" ? "Nómina" :
                   d.kind === "transfer" ? "Ahorro del mes" : "Alquiler") + '" ' +
                 'value="' + esc(d.note) + '">' +
        '</div>' +

        /* Un trabajo por horas no tiene un importe: tiene una tarifa. Y
           hay quien ni eso sabe hasta que cobra. Tres formas de decirlo,
           y solo se enseña el campo de la que se elija. */
        (d.kind === "in"
          ? '<div class="field" style="margin-top:var(--sp-5)">' +
              '<span class="field__label">Cuánto cobras</span>' +
              '<div class="segmented" id="fModoSeg" role="tablist">' +
                '<span class="segmented__thumb" id="fModoThumb" aria-hidden="true"></span>' +
                '<button type="button" class="segmented__btn" role="tab" data-fmodo="fijo" ' +
                        'aria-selected="' + (modoImporte === "fijo") + '">Siempre igual</button>' +
                '<button type="button" class="segmented__btn" role="tab" data-fmodo="hora" ' +
                        'aria-selected="' + (modoImporte === "hora") + '">Por horas</button>' +
                '<button type="button" class="segmented__btn" role="tab" data-fmodo="varia" ' +
                        'aria-selected="' + (modoImporte === "varia") + '">Varía</button>' +
              '</div>' +
            '</div>'
          : "") +

        (modoImporte === "hora"
          ? '<div class="field" style="margin-top:var(--sp-5)">' +
              numField("fTarifa", "Lo que cobras por hora", d.tarifa, 0.5) +
              '<p class="field__hint">Cada vez que toque, la app te pregunta ' +
                'cuántas horas has echado y hace la cuenta.</p>' +
            '</div>'

          : modoImporte === "varia"
            ? '<div class="field" style="margin-top:var(--sp-5)">' +
                numField("fAmount", "Más o menos (opcional)", d.amount, 5) +
                '<p class="field__hint">Solo para hacerse una idea del mes. ' +
                  'Cada vez que toque se te preguntará la cifra de verdad, y ' +
                  'puedes dejar esto vacío.</p>' +
              '</div>'

            : '<div class="field" style="margin-top:var(--sp-5)">' +
                numField("fAmount", "Importe", d.amount, 5) +
              '</div>') +

        /* Cuatro palabras, que es como se habla. «Año» no es un ritmo
           aparte en los datos: es mensual cada 12. */
        '<div class="field" style="margin-top:var(--sp-5)">' +
          '<span class="field__label">Cada cuánto</span>' +
          '<div class="segmented" id="fFreqSeg" role="tablist">' +
            '<span class="segmented__thumb" id="fFreqThumb" aria-hidden="true"></span>' +
            [["diario", "Día"], ["semanal", "Semana"],
             ["mensual", "Mes"], ["anual", "Año"]].map(function (par) {
              return '<button type="button" class="segmented__btn" role="tab" ' +
                       'data-fritmo="' + par[0] + '" ' +
                       'aria-selected="' + (ritmo === par[0]) + '">' + par[1] + '</button>';
            }).join("") +
          '</div>' +
        '</div>' +

        /* Cada cuántos. En «año» no se pregunta: un año es un año, y
           «cada 2 años» es lo bastante raro como para no ocupar sitio. */
        (ritmo === "anual"
          ? ""
          : '<div class="field" style="margin-top:var(--sp-5)">' +
              numField("fCada",
                       ritmo === "diario" ? "Cada cuántos días"
                       : ritmo === "semanal" ? "Cada cuántas semanas"
                       : "Cada cuántos meses",
                       d.cada, 1, ritmo === "diario" ? "días"
                                  : ritmo === "semanal" ? "sem." : "meses") +
              (+d.cada > 1
                ? '<p class="field__hint">Se cuenta desde ahora: el primero ' +
                  'será dentro de ' + esc(d.cada) + ' ' +
                  esc(ritmo === "diario" ? "días" : ritmo === "semanal" ? "semanas" : "meses") +
                  '.</p>'
                : "") +
            '</div>') +

        /* Y qué día. Los siete días caben en una fila a lo ancho de la
           hoja; metidos en media columna se partían en dos. */
        (ritmo === "diario"
          ? ""
          : esSem
            ? '<div class="field" style="margin-top:var(--sp-5)">' +
                '<span class="field__label">Qué día</span>' +
                '<div class="chips chips--dias" role="group" aria-label="Días de la semana">' +
                  DIAS_LARGO.map(function (nombre, i) {
                    return '<button type="button" class="chip chip--dia" data-fweekday="' + i + '" ' +
                           'aria-pressed="' + (d.weekdays.indexOf(i) >= 0) + '" ' +
                           'aria-label="' + esc(nombre) + '">' +
                           esc(S.DOW_SHORT[i]) + '</button>';
                  }).join("") +
                '</div>' +
                '<p class="field__hint">Puedes marcar varios.</p>' +
              '</div>'
            : '<div class="field" style="margin-top:var(--sp-5)">' +
                '<label class="field__label" for="fDay">Día del mes</label>' +
                '<input type="number" class="field__input" id="fDay" data-f="Day" min="1" max="31" ' +
                       'step="1" inputmode="numeric" value="' + esc(d.day) + '">' +
                (+d.day > 28
                  ? '<p class="field__hint">Los meses que no tengan el ' + esc(d.day) +
                    ' caerá en su último día.</p>'
                  : "") +
              '</div>') +

        /* Las catorce pagas son cosa de las nóminas de aquí: dos extras,
           en junio y en diciembre. Solo tiene sentido en cobros mensuales. */
        (d.kind === "in" && ritmo === "mensual" && +d.cada === 1
          ? '<div class="field" style="margin-top:var(--sp-5)">' +
              '<span class="field__label">Pagas al año</span>' +
              '<div class="segmented" id="fPagasSeg" role="tablist">' +
                '<span class="segmented__thumb" id="fPagasThumb" aria-hidden="true"></span>' +
                '<button type="button" class="segmented__btn" role="tab" data-fpagas="12" ' +
                        'aria-selected="' + (+d.pagas !== 14) + '">12</button>' +
                '<button type="button" class="segmented__btn" role="tab" data-fpagas="14" ' +
                        'aria-selected="' + (+d.pagas === 14) + '">14</button>' +
              '</div>' +
            '</div>'
          : "") +

        /* El sueldo casi nunca cae clavado: horas de más, un mes con
           menos días trabajados... Con esto la app pregunta en vez de
           apuntar una cifra que luego hay que corregir a mano. */
        /* Con «Por horas» o «Varía» ya se pregunta siempre: ofrecer el
           interruptor sería ofrecer algo que no se puede apagar. */
        (modoImporte === "fijo"
          ? switchRow("fConfirmar", "Preguntarme el importe",
              d.kind === "in"
                ? "Antes de apuntarlo te enseña la cifra por si cobras algo más o menos"
                : "Antes de apuntarlo te deja ajustar la cifra",
              d.confirmar)
          : '<p class="field__hint" style="margin-top:var(--sp-4)">' +
              icon("check", 12) + ' Se te preguntará cada vez, que para eso ' +
              'no hay una cifra fija.</p>') +

        /* Hora, aviso, cuenta y categoría van recogidos. Con nueve
           controles delante, crear una nómina normal daba pereza; lo de
           arriba —concepto, importe, cada cuánto y qué día— es lo que casi
           siempre basta. */
        '<div class="field" style="margin-top:var(--sp-4)">' +
          '<button type="button" class="fold-head fold-head--suelto" id="fOpciones" ' +
                  'aria-expanded="' + opcionesAbiertas + '">' +
            '<span class="card__title">Más opciones</span>' +
            '<span class="fold-head__chev" data-icon="chevDown" data-icon-size="15"></span>' +
          '</button>' +
          '<div class="fold" data-open="' + opcionesAbiertas + '">' +
            '<div class="fold__inner">' +

              /* A qué hora. Un aviso a las nueve de la mañana de algo que
                 se cobra al salir del turno no sirve de nada. */
              '<div class="field__row">' +
                '<div>' +
                  '<label class="field__label" for="fHora">A qué hora</label>' +
                  '<input type="time" class="field__input" id="fHora" data-f="Hora" ' +
                         'value="' + esc(d.hora || "09:00") + '">' +
                '</div>' +
                '<div></div>' +
              '</div>' +

              switchRow("fAvisar", "Avisarme en el móvil",
                "Una notificación el día que toque, a esa hora",
                d.avisar) +

              /* Un préstamo tiene final. Sin esto había que acordarse de
                 apagarlo a mano el mes que se termina de pagar. */
              (d.kind === "out"
                ? '<div class="field" style="margin-top:var(--sp-5)">' +
                    numField("fCuotas", "Cuántas veces en total", d.cuotas, 1, "veces") +
                    '<p class="field__hint">' +
                      (parseFloat(d.cuotas) > 0
                        ? (ui.form.id && cuotasHechas
                            ? "Llevas " + cuotasHechas + " de " + parseInt(d.cuotas, 10) +
                              ". Cuando se paguen todas se apagará solo."
                            : "Se apagará solo cuando se hayan pagado las " +
                              parseInt(d.cuotas, 10) + ".")
                        : "Déjalo vacío si no se acaba nunca, como el alquiler. " +
                          "Ponlo si es un préstamo: 12, 24, las que sean.") +
                    '</p>' +
                  '</div>'
                : "") +

              (d.kind === "transfer"
                ? '<div class="field__row" style="margin-top:var(--sp-5)">' +
                    '<div>' +
                      '<span class="field__label">Desde</span>' +
                      accountSelect("fAccount", d.accountId) +
                    '</div>' +
                    '<div>' +
                      '<span class="field__label">Hacia</span>' +
                      accountSelect("fToAccount", d.toAccountId) +
                    '</div>' +
                  '</div>'
                : '<div class="field__row" style="margin-top:var(--sp-5)">' +
                    '<div>' +
                      '<span class="field__label">Categoría</span>' +
                      pickField("fCat", d.categoryId, catOf(d.categoryId).name) +
                    '</div>' +
                    '<div>' +
                      '<span class="field__label">Cuenta</span>' +
                      accountSelect("fAccount", d.accountId) +
                    '</div>' +
                  '</div>') +
            '</div>' +
          '</div>' +
        '</div>' +

        '<p class="field__hint">' +
          (mismaCuenta
            ? icon("warning", 12) + " Elige dos cuentas distintas."
            : esSem
              ? listaDias(d.weekdays) + "."
              : (d.kind === "in" && +d.pagas === 14
                  ? "Cada mes, con paga extra en junio y en diciembre. Máximo día 28."
                  : "Cada mes. Máximo día 28.")) +
        '</p>';
    }

    var bloqueado = t === "recurring" && d.kind === "transfer" &&
                    d.accountId === d.toAccountId;

    body.innerHTML = html +
      '<div class="field" style="margin-top:var(--sp-6)">' +
        '<button type="button" class="btn btn--primary" id="fSave"' +
          (bloqueado ? " disabled" : "") + '>' +
          icon("check", 17) +
          (t === "saldo" ? "Corregir"
           : t === "resumen" ? "Aplicar"
           : ui.form.id ? "Guardar cambios" : "Crear") + '</button>' +
      '</div>' +
      (ui.form.id && t !== "saldo" && t !== "resumen"
        ? '<div class="field">' +
            '<button type="button" class="btn btn--danger" id="fDelete" style="width:100%">' +
              icon("trash", 16) + 'Eliminar</button>' +
          '</div>'
        : "");

    mountIcons(body);
    requestAnimationFrame(function () {
      var seg = $("#fSeg", body);
      if (seg) U.slideIndicator(seg, $("#fThumb", body),
        $('[data-fkind="' + d.kind + '"]', seg));

      var segF = $("#fFreqSeg", body);
      if (segF) U.slideIndicator(segF, $("#fFreqThumb", body),
        $('[data-fritmo="' +
          (d.freq === "mensual" && +d.cada === 12 ? "anual" : d.freq) + '"]', segF));

      var segM = $("#fModoSeg", body);
      if (segM) U.slideIndicator(segM, $("#fModoThumb", body),
        $('[data-fmodo="' + modoImporte + '"]', segM));

      var segP = $("#fPagasSeg", body);
      if (segP) U.slideIndicator(segP, $("#fPagasThumb", body),
        $('[data-fpagas="' + (+d.pagas === 14 ? 14 : 12) + '"]', segP));
    });
  }


  /* --- lo que usan otros archivos --- */
  A.renderForm = renderForm;

})();
