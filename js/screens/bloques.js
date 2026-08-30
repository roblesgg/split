/* ============================================================
   split — los bloques del Resumen

   El Resumen no es una lista fija de tarjetas: es un panel de bloques, y
   cada cuenta tiene los suyos y en el orden que quieras. Aquí está el
   catálogo: qué bloques existen, cómo se llaman y qué pintan.

   Todos reciben el mismo contexto y ninguno sabe nada de los demás:

     ctx.accId    la cuenta que estás mirando, o null si es «todo»
     ctx.key      el ciclo en curso
     ctx.cuenta   la ficha de la cuenta, o null

   Añadir un bloque nuevo es escribir una función aquí y meter su nombre
   en la lista. No hay que tocar el Resumen ni la pantalla de
   personalizar: las dos leen de este catálogo.

   `soloTodas` y `soloCuenta` marcan los que no tienen sentido en el otro
   lado: los límites del mes son de todo tu dinero, y los apartados y el
   objetivo de gasto son de una cuenta concreta. Un bloque que no
   corresponde ni se ofrece ni se pinta.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, C = A.C, esc = A.esc, icon = A.icon, ui = A.ui;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function catFace() { return A.catFace.apply(null, arguments); }
  function catOf() { return A.catOf.apply(null, arguments); }
  function emptyHtml() { return A.emptyHtml.apply(null, arguments); }
  function foldCard() { return A.foldCard.apply(null, arguments); }
  function money() { return A.money.apply(null, arguments); }
  function nombreCiclo() { return A.nombreCiclo.apply(null, arguments); }
  function txRowHtml() { return A.txRowHtml.apply(null, arguments); }

  /* ---------- piezas que usan varios bloques ---------- */

  /* La tarjeta de UN límite, en grande. La cifra que manda es lo que te
     QUEDA, no lo que llevas: «me quedan 170 €» es la frase con la que
     uno decide si sale a cenar. Debajo, la barra con una marca de dónde
     está hoy dentro del mes, que es la otra mitad de la historia —
     gastar el 70 % el día 3 no es lo mismo que el día 28— y el ritmo que
     te queda por día.

     El color nunca va solo: el estado se dice con palabras y, cuando hay
     algo que avisar, con su icono delante. */
  function limiteCardHtml(b) {
    var over = b.nivel === "pasado";
    var near = b.nivel === "cerca";
    var fill = over ? "var(--status-critical)"
             : near ? "var(--status-warning)"
             : "var(--cat-" + b.color + ")";

    return '<section class="card limcard" data-limcard="' + esc(b.id) + '">' +
        '<button type="button" class="limcard__head" data-form="limite" ' +
                'data-form-id="' + esc(b.id) + '" aria-label="Editar ' + esc(b.name) + '">' +
          '<span class="limcard__cara cat-face" ' +
                'style="--cat-color:var(--cat-' + b.color + ')">' +
            esc(b.emoji || "🎯") + '</span>' +
          '<span class="limcard__titulos">' +
            '<span class="limcard__nombre">' + esc(b.name) + '</span>' +
            '<span class="limcard__sub">' + esc(S.textoAmbitoCortoLimite(b)) + '</span>' +
          '</span>' +
          '<span class="limcard__chev" data-icon="chevron" data-icon-size="16"></span>' +
        '</button>' +

        '<p class="limcard__cifra">' +
          '<span class="limcard__grande">' + esc(S.money(Math.abs(b.queda))) + '</span>' +
          '<span class="limcard__de">' +
            (over ? " de más sobre " : " restante de ") + esc(S.money(b.limite)) + '</span>' +
        '</p>' +

        '<div class="limcard__barra">' +
          '<div class="limcard__track">' +
            '<div class="limcard__fill" style="width:' + Math.min(100, b.ratio * 100).toFixed(1) +
              '%;background:' + fill + '"></div>' +
            /* Dónde estaría el gasto si lo repartieras por igual: si la
               barra de color va por delante de esta marca, vas rápido. */
            '<span class="limcard__hoy" style="left:' + b.pctTiempo + '%">' +
              '<span class="limcard__hoy-txt">Hoy</span>' +
            '</span>' +
          '</div>' +
        '</div>' +

        '<p class="limcard__pie" data-nivel="' + esc(b.nivel) + '">' +
          (over
            ? icon("warning", 12) + " Te has pasado " + esc(S.money(-b.queda))
            : near
              ? icon("warning", 12) + " Al límite: " + esc(S.money(b.porDia)) +
                " al día para " + diasTxt(b.diasQuedan)
              : "Puedes gastar " + esc(S.money(b.porDia)) + " al día para " +
                diasTxt(b.diasQuedan)) +
        '</p>' +
      '</section>';
  }

  /* Crear un límite sin salir de donde estás. La hoja es la misma que en
     Ajustes: un solo formulario para una sola cosa. */
  function nuevoLimiteBtn() {
    return '<button type="button" class="panel-add panel-add--dentro" data-form="limite">' +
        icon("plus", 15) + 'Nuevo límite</button>';
  }

  /* «26 días más» / «un día más», que es como se dice. */
  function diasTxt(n) {
    var d = Math.max(0, n) + 1;   /* hoy cuenta */
    return d === 1 ? "hoy" : d + " días más";
  }

  function deltaPct(ahora, antes) {
    if (!antes) return null;
    return ((ahora - antes) / Math.abs(antes)) * 100;
  }

  function statTile(label, value, delta, polarity, sparkVals) {
    var dir = "flat", arrow = "", txt = "—";
    if (delta != null && isFinite(delta)) {
      var up = delta > 0.5, down = delta < -0.5;
      if (up || down) {
        arrow = up ? "trendUp" : "trendDown";
        dir = (polarity === "up-good" ? up : down) ? "good" : "bad";
        txt = (up ? "+" : "−") + Math.abs(Math.round(delta)) + " %";
      } else { txt = "sin cambios"; }
    }
    return '' +
      '<div class="stat">' +
        '<p class="stat__label">' + esc(label) + '</p>' +
        '<p class="stat__value">' + esc(S.moneyShort(value)) + '</p>' +
        '<p class="stat__delta" data-dir="' + dir + '">' +
          (arrow ? icon(arrow, 12) : "") + '<span>' + esc(txt) + '</span>' +
        '</p>' +
        '<div class="stat__spark" data-spark="' + esc(JSON.stringify(sparkVals)) + '"></div>' +
      '</div>';
  }

  /* Una barra por límite. Le llega el estado ya calculado, así que aquí
     solo se decide cómo se pinta. */
  function meterHtml(b, i) {
    var over = b.nivel === "pasado";
    var near = b.nivel === "cerca";
    /* el relleno lleva la severidad; el color del límite cuando va bien */
    var fill = over ? "var(--status-critical)"
             : near ? "var(--status-warning)"
             : "var(--cat-" + b.color + ")";
    return '' +
      '<div class="meter">' +
        '<div class="meter__head">' +
          '<span class="meter__dot" style="background:' + fill + '"></span>' +
          '<span class="meter__label">' + esc(b.emoji || "") + ' ' + esc(b.name) + '</span>' +
          '<span class="meter__value">' + esc(S.moneyShort(b.gastado)) + ' / ' +
            esc(S.moneyShort(b.limite)) + '</span>' +
        '</div>' +
        '<div class="meter__track">' +
          '<div class="meter__fill" style="width:' + Math.min(100, b.ratio * 100).toFixed(1) + '%;' +
            'background:' + fill + ';--delay:' + (i * 55 + 90) + 'ms"></div>' +
        '</div>' +
        /* El porcentaje manda y los euros van detrás: lo que se quiere
           saber de un vistazo es cuánto margen queda, no la resta. Y el
           color de estado nunca va solo: siempre con icono y texto. */
        (over
          ? '<p class="meter__foot">' + icon("warning", 11) + ' Te has pasado un ' +
            esc(S.pct(Math.round((b.ratio - 1) * 100))) + ' · ' +
            esc(S.moneyShort(b.gastado - b.limite)) + ' de más</p>'
          : '<p class="meter__foot">' +
            (near ? icon("warning", 11) + ' Al límite: te queda ' : 'Te queda ') +
            'el ' + esc(S.pct(Math.max(0, Math.round((1 - b.ratio) * 100)))) + ' · ' +
            esc(S.moneyShort(b.queda)) + '</p>') +
      '</div>';
  }

  /* La cabecera de un bloque que no es plegable. */
  function cabecera(titulo, sub, extra) {
    return '<div class="card__head" style="margin-bottom:var(--sp-3)">' +
        '<div>' +
          '<h2 class="card__title">' + esc(titulo) + '</h2>' +
          (sub ? '<p class="card__sub">' + esc(sub) + '</p>' : "") +
        '</div>' +
        (extra || "") +
      '</div>';
  }

  /* ============================================================
     El catálogo
     ============================================================ */

  var BLOQUES = {};

  function bloque(id, def) { def.id = id; BLOQUES[id] = def; }

  /* --- acciones rápidas --- */
  bloque("acciones", {
    nombre: "Botones rápidos",
    sub: "Apuntar un gasto o un ingreso, y el atajo a Análisis",
    render: function (ctx) {
      /* Con una cuenta abierta, lo que apuntes va a esa cuenta: es lo
         que espera cualquiera que esté mirándola. */
      var attr = ctx.accId ? ' data-quick-cuenta="' + esc(ctx.accId) + '"' : "";
      return '<div class="actions">' +
          '<button type="button" class="btn btn--primary" data-quick="gasto"' + attr + '>' +
            icon("minus", 18) + 'Nuevo gasto</button>' +
          '<button type="button" class="action-circle" data-quick="ingreso"' + attr + ' ' +
                  'aria-label="Registrar un ingreso" data-icon="plus" data-icon-size="19"></button>' +
          '<button type="button" class="action-circle" data-goto="analisis" ' +
                  'aria-label="Ir a Análisis" data-icon="chart" data-icon-size="18"></button>' +
        '</div>';
    }
  });

  /* --- las tres cifras --- */
  bloque("kpis", {
    nombre: "Ingresos, gastos y ahorro",
    sub: "Las tres cifras del periodo, con su tendencia",
    render: function (ctx) {
      var serie = S.serieDeCiclos(12, ctx.accId);
      var res = S.totalesResumen(ctx.accId);
      var cfg = S.resumenCfg();
      /* La comparación con el periodo anterior solo tiene sentido si se
         mira el mes: en «este año» o «desde el principio» un porcentaje
         ahí no significaría nada. */
      var comparable = cfg.periodo === "mes";
      var ant = serie[serie.length - 2] || { income: 0, expense: 0, net: 0 };
      var d = function (a, b) { return comparable ? deltaPct(a, b) : null; };

      return '<div class="kpi-row" id="kpiRow">' +
          statTile("Ingresos", res.income, d(res.income, ant.income), "up-good",
                   serie.map(function (m) { return m.income; })) +
          statTile("Gastos", res.expense, d(res.expense, ant.expense), "up-bad",
                   serie.map(function (m) { return m.expense; })) +
          statTile("Ahorro", res.net, d(res.net, ant.net), "up-good",
                   serie.map(function (m) { return m.net; })) +
        '</div>' +
        '<button type="button" class="kpi-filtro" id="kpiFiltro">' +
          esc(S.etiquetaResumen()) +
          '<span data-icon="chevDown" data-icon-size="13"></span>' +
        '</button>';
    }
  });

  /* --- los límites del mes --- */
  bloque("limites", {
    nombre: "Límites del mes",
    sub: "Una barra por límite, con lo que llevas gastado",
    render: function (ctx) {
      var rows = S.estadoDeLimites(ctx.key)
        .sort(function (a, b) { return b.ratio - a.ratio; });
      /* Sin ninguno el módulo no desaparece: es justo desde donde se
         crea el primero, y esconderlo dejaría al que lo puso mirando un
         hueco sin saber qué hacer. */
      if (!rows.length) {
        return foldCard("presupuesto",
          "Límites de " + esc(nombreCiclo(ctx.key)),
          "Todavía no tienes ninguno",
          "",
          '<p class="field__hint">Un límite es un tope con nombre: cuánto y ' +
            'sobre qué gastos. No bloquea nada, avisa.</p>' + nuevoLimiteBtn());
      }
      var res = S.resumenDeLimites(ctx.key);
      /* Un límite mira categorías, no cuentas, así que sus cifras son las
         de todo tu dinero aunque estés mirando una cuenta. Se dice, en
         vez de esconder el bloque: media verdad en una cifra es peor que
         no enseñarla. */
      return foldCard("presupuesto",
        "Límites de " + esc(nombreCiclo(ctx.key)),
        (ctx.accId ? "De todas tus cuentas · " : "") +
          esc(res.cuantos === 1 ? "1 límite" : res.cuantos + " límites") +
          (res.sinTope > 0
            ? " · " + esc(S.moneyShort(res.sinTope)) + " fuera de todos"
            : ""),
        '<button type="button" class="card__link" data-goto="ajustes">Editar</button>',
        rows.map(meterHtml).join("") + nuevoLimiteBtn());
    }
  });

  /* --- UN límite, en grande ---
     Se puede poner varias veces, una por límite: el módulo lleva dentro
     de qué límite habla. Es lo que se pide cuando tienes cinco y solo
     dos te importan a diario. */
  bloque("limite", {
    nombre: "Un límite del mes",
    sub: "El que elijas, en grande y con el ritmo que te queda por día",
    /* Cada opción es un módulo distinto: «limite:lim-gasolina». */
    opciones: function () {
      return S.limites().map(function (l) {
        return { id: "limite:" + l.id,
                 nombre: (l.emoji ? l.emoji + " " : "") + l.name,
                 sub: S.textoAmbitoCortoLimite(l) };
      });
    },
    nombreDe: function (arg) {
      var l = arg && S.limitePorId(arg);
      return l ? (l.emoji ? l.emoji + " " : "") + l.name : "Un límite del mes";
    },
    render: function (ctx) {
      /* Un límite borrado se lleva su módulo: devolver "" hace que ni se
         le haga hueco, igual que cualquier bloque sin nada que enseñar. */
      var est = ctx.arg ? S.estadoDeLimite(ctx.arg, ctx.key) : null;
      if (!est) return "";
      return limiteCardHtml(est);
    }
  });

  /* --- el límite que va más apurado --- */
  bloque("apurado", {
    nombre: "El límite más apurado",
    sub: "Solo cabe uno, y el que interesa es el que está por reventar",
    render: function (ctx) {
      /* Sumar todos los topes no valdría: dos límites pueden solaparse y
         la suma daría de más. El que va más lleno sí es cierto siempre. */
      var peor = S.limiteMasApurado(ctx.key);
      if (!peor) return "";
      return '<button type="button" class="limit" data-goto="ajustes">' +
          '<span class="limit__ring" data-limit-ring="' +
            Math.min(1, peor.ratio) + '"></span>' +
          '<span class="limit__body">' +
            '<span class="limit__label">' + esc(peor.emoji) + ' ' + esc(peor.name) + '</span>' +
            '<span class="limit__value">' + esc(S.moneyShort(peor.gastado)) + ' de ' +
              esc(S.moneyShort(peor.limite)) + '</span>' +
          '</span>' +
          '<span class="limit__chev" data-icon="chevron" data-icon-size="18"></span>' +
        '</button>';
    }
  });

  /* --- el objetivo de gasto de la cuenta --- */
  bloque("objetivo", {
    nombre: "Objetivo de gasto",
    sub: "El tope de esta cuenta, con lo que te queda",
    soloCuenta: true,
    render: function (ctx) {
      var e = S.estadoDeObjetivo(ctx.accId, ctx.key);
      if (!e) return "";
      return '<section class="card">' +
          cabecera("Tu objetivo de gasto", nombreCiclo(ctx.key),
            '<button type="button" class="card__link" data-form="account" ' +
              'data-form-id="' + esc(ctx.accId) + '">Cambiar</button>') +
          A.limiteHtml(e, ctx.cuenta) +
        '</section>';
    }
  });

  /* --- los apartados de la cuenta --- */
  bloque("apartados", {
    nombre: "Apartados",
    sub: "El dinero que tienes reservado dentro de esta cuenta",
    soloCuenta: true,
    render: function (ctx) {
      var aps = S.apartadosDe(ctx.accId);
      if (!aps.length) return "";
      var reservado = S.reservadoDe(ctx.accId);
      return '<section class="card">' +
          cabecera("Apartados",
            S.moneyShort(reservado) + " reservados",
            '<button type="button" class="card__link" data-cuenta="' +
              esc(ctx.accId) + '">Gestionar</button>') +
          aps.map(function (ap) {
            var e = S.estadoDeApartado(ap.id);
            var fill = e.nivel === "pasado" ? "var(--status-critical)"
                     : e.nivel === "cerca" ? "var(--status-warning)"
                     : "var(--cat-" + ap.color + ")";
            return '<div class="meter">' +
                '<div class="meter__head">' +
                  '<span class="meter__dot" style="background:' + fill + '"></span>' +
                  '<span class="meter__label">' + esc(ap.emoji) + ' ' + esc(ap.name) + '</span>' +
                  '<span class="meter__value">' + esc(S.moneyShort(e.saldo)) + '</span>' +
                '</div>' +
                '<div class="meter__track">' +
                  '<div class="meter__fill" style="width:' + e.pct + '%;background:' +
                    fill + '"></div>' +
                '</div>' +
              '</div>';
          }).join("") +
        '</section>';
    }
  });

  /* --- en qué se va el mes --- */
  bloque("categorias", {
    nombre: "En qué se te va",
    sub: "Las cuatro categorías en las que más gastas",
    render: function (ctx) {
      var todas = S.byCategory(ctx.key, "out", false, ctx.accId);
      var top = todas.slice(0, 4);
      if (!top.length) return "";
      return '<section>' +
          cabecera("En qué se te va",
            nombreCiclo(ctx.key) +
              (todas.length > top.length ? " · " + todas.length + " categorías" : ""),
            '<button type="button" class="card__link" data-goto="analisis">' +
              'Ver el detalle</button>') +
          '<div class="tiles">' +
            top.map(function (c) {
              return '<button type="button" class="tile" data-cat-movs="' + esc(c.id) + '">' +
                  catFace(c, 24, "tile__icon") +
                  '<span>' +
                    '<span class="tile__name">' + esc(c.name) + '</span>' +
                    '<span class="tile__value">' + esc(S.moneyShort(c.value)) + '</span>' +
                  '</span>' +
                '</button>';
            }).join("") +
          '</div>' +
        '</section>';
    }
  });

  /* --- el anillo de gasto por categoría --- */
  bloque("anillo", {
    nombre: "Gasto por categoría",
    sub: "El anillo con el reparto del gasto, de un vistazo",
    render: function (ctx) {
      var cats = S.byCategory(ctx.key, "out", false, ctx.accId);
      if (!cats.length) return "";
      return '<section class="card">' +
          cabecera("Gasto por categoría", nombreCiclo(ctx.key)) +
          '<div class="chart-box" data-donut="' +
            esc(JSON.stringify(cats.slice(0, 8))) + '"></div>' +
        '</section>';
    }
  });

  /* --- ingresos contra gastos, mes a mes --- */
  bloque("evolucion", {
    nombre: "Mes a mes",
    sub: "Ingresos contra gastos de los últimos seis ciclos",
    render: function (ctx) {
      var serie = S.serieDeCiclos(6, ctx.accId);
      var hay = serie.some(function (m) { return m.income > 0 || m.expense > 0; });
      if (!hay) return "";
      return '<section class="card">' +
          cabecera("Mes a mes", "Ingresos contra gastos") +
          '<div class="chart-box" data-columnas="' +
            esc(JSON.stringify(serie)) + '"></div>' +
        '</section>';
    }
  });

  /* --- el mapa de calor del gasto diario --- */
  bloque("calor", {
    nombre: "Día a día",
    sub: "Un cuadradito por día: cuanto más oscuro, más gastaste",
    render: function (ctx) {
      var dias = S.dailySpend(ctx.key, ctx.accId);
      if (!dias.some(function (d) { return d.value > 0; })) return "";
      return '<section class="card">' +
          cabecera("Día a día", nombreCiclo(ctx.key)) +
          '<div class="chart-box" data-calor="' +
            esc(JSON.stringify(dias)) + '"></div>' +
        '</section>';
    }
  });

  /* --- dónde más gastas --- */
  bloque("comercios", {
    nombre: "Dónde más gastas",
    sub: "Los conceptos que más se repiten y lo que suman",
    render: function (ctx) {
      var top = S.topMerchants(ctx.key, 5, ctx.accId);
      if (!top.length) return "";
      return foldCard("comercios", "Dónde más gastas",
        nombreCiclo(ctx.key), "",
        '<div class="rows">' +
          top.map(function (m) {
            return '<div class="account" style="width:100%">' +
                catFace(catOf(m.categoryId), 21, "account__badge") +
                '<span class="account__body">' +
                  '<span class="account__name">' + esc(m.name) + '</span>' +
                  '<span class="account__type">' +
                    (m.count === 1 ? "1 vez" : m.count + " veces") + '</span>' +
                '</span>' +
                '<span class="account__amount">' + esc(S.moneyShort(m.value)) + '</span>' +
              '</div>';
          }).join("") +
        '</div>', true);
    }
  });

  /* --- últimos movimientos --- */
  bloque("recientes", {
    nombre: "Últimos movimientos",
    sub: "Lo último que has apuntado",
    render: function (ctx) {
      var tx = ctx.accId
        ? S.state.transactions.filter(function (t) {
            return t.accountId === ctx.accId || t.toAccountId === ctx.accId;
          })
        : S.state.transactions;
      var recent = tx.slice(0, 6);
      return foldCard("recientes", "Últimos movimientos", "",
        '<button type="button" class="card__link" data-goto="movs">Ver todo</button>',
        (recent.length
          ? '<div class="rows">' + recent.map(txRowHtml).join("") + '</div>'
          : emptyHtml("list", "Sin movimientos",
              "Pulsa «Nuevo gasto» para registrar el primero.")), true);
    }
  });

  /* --- lo que viene --- */
  bloque("proximos", {
    nombre: "Lo que viene",
    sub: "Los próximos pagos y cobros programados",
    render: function (ctx) {
      var upcoming = S.upcomingRecurring(20).filter(function (u) {
        if (!ctx.accId) return true;
        return u.r.accountId === ctx.accId || u.r.toAccountId === ctx.accId;
      }).slice(0, 4);
      if (!upcoming.length) return "";
      return foldCard("proximos", "Lo que viene", "",
        '<button type="button" class="card__link" data-goto="ahorro">Gestionar</button>',
        upcoming.map(function (u) {
          var r = u.r;
          var sign = r.kind === "in" ? "+" : r.kind === "transfer" ? "" : "−";
          return '<button type="button" class="account" data-form="recurring" ' +
                  'data-form-id="' + esc(r.id) + '" style="width:100%;text-align:left">' +
              (r.kind === "transfer"
                ? '<span class="account__badge" data-icon="swap" data-icon-size="17"></span>'
                : catFace(catOf(r.categoryId), 21, "account__badge")) +
              '<span class="account__body">' +
                '<span class="account__name">' + esc(r.note) + '</span>' +
                '<span class="account__type">' +
                  esc(u.due.toLocaleDateString("es-ES",
                      { weekday: "short", day: "numeric", month: "short" })) +
                '</span>' +
              '</span>' +
              '<span class="account__amount"' +
                (r.kind === "in" ? ' style="color:var(--money-in)"' : '') + '>' +
                sign + esc(S.moneyShort(r.amount)) + '</span>' +
            '</button>';
        }).join(""), true);
    }
  });

  /* ---------- lo que necesitan el Resumen y la personalización ---------- */

  /* Los que se pueden poner en este panel, en el orden del catálogo. */
  function disponibles(accId) {
    return Object.keys(BLOQUES).filter(function (id) {
      var b = BLOQUES[id];
      if (accId && b.soloTodas) return false;
      if (!accId && b.soloCuenta) return false;
      return true;
    });
  }

  /* Lo que se le ofrece a quien va a añadir un módulo: los del catálogo,
     con los parametrizados ya desplegados en uno por opción, y sin los
     que ya están puestos. Lo devuelve la capa de pantallas y no la hoja
     porque quien sabe desplegarlos es el catálogo. */
  function ofrecibles(accId, puestos) {
    var ya = puestos || [];
    var out = [];
    disponibles(accId).forEach(function (id) {
      var b = BLOQUES[id];
      if (b.opciones) {
        b.opciones().forEach(function (o) {
          if (ya.indexOf(o.id) < 0) out.push(o);
        });
      } else if (ya.indexOf(id) < 0) {
        out.push({ id: id, nombre: b.nombre, sub: b.sub });
      }
    });
    return out;
  }

  /* Un módulo puede llevar un argumento detrás de dos puntos —
     «limite:lim-gasolina»— y entonces se puede poner varias veces, una
     por argumento. Todo lo que mira ids pasa por aquí. */
  function base(id) { return String(id || "").split(":")[0]; }
  function arg(id) {
    var i = String(id || "").indexOf(":");
    return i < 0 ? null : String(id).slice(i + 1);
  }

  function definicion(id) { return BLOQUES[base(id)] || null; }

  /* Cómo se llama ESTE módulo: el de un límite lleva el nombre del
     límite, que es lo que lo distingue de los otros tres iguales. */
  function nombreDe(id) {
    var b = BLOQUES[base(id)];
    if (!b) return id;
    return b.nombreDe ? b.nombreDe(arg(id)) : b.nombre;
  }

  /* Pinta un bloque. Devuelve "" si no existe —un panel guardado puede
     nombrar uno que ya se quitó del código— o si no tiene nada que
     enseñar, y entonces ni se le hace hueco. */
  function pintar(id, ctx) {
    var b = BLOQUES[base(id)];
    if (!b) return "";
    if (ctx.accId && b.soloTodas) return "";
    if (!ctx.accId && b.soloCuenta) return "";
    /* El contexto es el mismo para todos más el argumento, que solo
       miran los que lo llevan. */
    var c = { accId: ctx.accId, key: ctx.key, cuenta: ctx.cuenta, arg: arg(id) };
    return b.render(c) || "";
  }

  /* --- lo que usan otros archivos --- */
  A.bloqueDefinicion = definicion;
  A.bloqueNombre = nombreDe;
  A.bloquesOfrecibles = ofrecibles;
  A.limiteCardHtml = limiteCardHtml;
  A.bloquesDisponibles = disponibles;
  A.pintarBloque = pintar;
  A.meterHtml = meterHtml;
})();
