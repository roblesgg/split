/* ============================================================
   split — estado, arranque y migraciones

   Con qué arranca una instalación nueva, cómo se guarda y cómo se sube
   un estado viejo a la versión de hoy sin perder nada.
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;
  var DEFAULT_ALLOCATION = D.DEFAULT_ALLOCATION, DEFAULT_CATEGORIES = D.DEFAULT_CATEGORIES, eur = D.eur, KEY = D.KEY;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function cloneCategories() { return D.cloneCategories.apply(null, arguments); }
  function defaultState() { return D.defaultState.apply(null, arguments); }
  function freshState() { return D.freshState.apply(null, arguments); }
  function invalidateCats() { return D.invalidateCats.apply(null, arguments); }

  /* ============================================================
     Persistencia
     ============================================================ */

  /* El estado entero vive en D.state: es de todos los archivos de datos
     y load() es quien lo rellena. */

  /* Sube un estado guardado al esquema actual sin perder nada.
     v1 tenía `budgets` en euros y no conocía los ingresos; se traduce a
     porcentajes sobre el ingreso previsto para no romper sus cifras. */
  function migrate(s) {
    if (!s.version || s.version < 2) {
      var def = defaultState();
      s.income = s.income || def.income;

      if (s.budgets && !s.allocation) {
        var base = (s.income.nomina * s.income.pagas) / 12 + s.income.extra;
        s.allocation = {};
        Object.keys(DEFAULT_ALLOCATION).forEach(function (id) {
          var eur = s.budgets[id];
          s.allocation[id] = base > 0 && eur != null
            ? Math.round((eur / base) * 100)
            : DEFAULT_ALLOCATION[id];
        });
        delete s.budgets;
      }
      if (!s.allocation) s.allocation = Object.assign({}, DEFAULT_ALLOCATION);

      /* las cuentas de v1 no traían icono */
      (s.accounts || []).forEach(function (a) {
        if (!a.icon) a.icon = a.id === "ahorro" ? "piggy" : a.id === "efvo" ? "cash" : "wallet";
      });

      s.version = 2;
    }

    if (s.version < 4 && s.income && s.income.nomina != null) {
      /* Traduce el modelo viejo a una cifra fija equivalente. Se queda en
         manual para no cambiarle los presupuestos a nadie por sorpresa;
         desde Ajustes puede pasar a automático cuando quiera. */
      var pagas = s.income.pagas === 14 ? 14 : 12;
      var equivalente = Math.round(
        ((s.income.nomina || 0) * pagas / 12 + (s.income.extra || 0)) * 100) / 100;
      s.income = { mode: "manual", manual: equivalente, months: 3 };
    }

    if (s.version < 3) {
      /* v3 añade traspasos y programados. Nada que reescribir en los
         movimientos antiguos: los que no tienen `toAccountId` siguen
         siendo ingresos o gastos normales. */
      if (!Array.isArray(s.recurring)) s.recurring = [];
      s.version = 3;
    }

    if (s.version < 4) {
      if (!s.income || !s.income.mode) s.income = { mode: "auto", manual: 1800, months: 3 };
      s.version = 4;
    }

    if (s.version < 5) {
      /* v5 saca las categorías del código y las mete en el estado, con
         emoji y color propios. Los ids no cambian: los movimientos, los
         programados y el reparto los referencian. */
      if (!Array.isArray(s.categories)) {
        /* Los slots viejos apuntaban a --series-1..8; estas son sus
           posiciones en la paleta nueva, para que nadie vea cambiar de
           color una categoría que ya tenía. */
        var SLOT_TO_COLOR = { 1: 1, 2: 13, 3: 3, 4: 5, 5: 11, 6: 15, 7: 9, 8: 7 };
        var LEGACY_EMOJI = {
          comida: "🍽️", transp: "🚌", ocio: "🎬", hogar: "🏠", compras: "🛍️",
          salud: "💊", subs: "🔁", otros: "📦",
          ingreso: "💰", nomina: "💼", extra: "⏰", regalo: "🎁"
        };
        var LEGACY = [
          ["comida", "Comida", "out", 1], ["transp", "Transporte", "out", 2],
          ["ocio", "Ocio", "out", 3], ["hogar", "Hogar", "out", 4],
          ["compras", "Compras", "out", 5], ["salud", "Salud", "out", 6],
          ["subs", "Suscripciones", "out", 7], ["otros", "Otros", "out", 8],
          ["ingreso", "Ingreso", "in", 1], ["nomina", "Sueldo", "in", 7],
          ["extra", "Extra", "in", 3], ["regalo", "Regalo", "in", 5]
        ];
        s.categories = LEGACY.map(function (l) {
          return {
            id: l[0], name: l[1], kind: l[2],
            emoji: LEGACY_EMOJI[l[0]] || "📦",
            color: SLOT_TO_COLOR[l[3]] || 16
          };
        });
      }

      /* Las básicas que aún no tenga se añaden; las suyas no se tocan. */
      var tieneId = {};
      s.categories.forEach(function (c) { tieneId[c.id] = true; });
      DEFAULT_CATEGORIES.forEach(function (d) {
        if (!tieneId[d.id]) {
          s.categories.push({ id: d.id, name: d.name, emoji: d.emoji, color: d.color, kind: d.kind });
        }
      });

      /* Toda categoría de gasto necesita su entrada en el reparto. Las
         recién añadidas entran al 0 % para no mover los presupuestos. */
      if (!s.allocation) s.allocation = {};
      s.categories.forEach(function (c) {
        if (c.kind === "out" && s.allocation[c.id] == null) s.allocation[c.id] = 0;
      });

      s.version = 5;
    }

    if (s.version < 6) {
      /* v6 añade hora, notas largas, etiquetas y adjuntos al movimiento.
         Nada que reescribir: lo que no los tenga se comporta como antes,
         sin hora y sin nada colgando. */
      if (!Array.isArray(s.tags)) s.tags = [];
      s.version = 6;
    }

    if (s.version < 7) {
      /* v7 pinta las tarjetas de cuenta con un color propio en vez del
         degradado del tema, que en oscuro salía blanco. Se hereda del slot
         viejo para que nadie vea cambiar de color su cuenta. */
      var SLOT_A_COLOR = { 1: 1, 2: 13, 3: 3, 4: 5, 5: 11, 6: 15, 7: 9, 8: 7 };
      (s.accounts || []).forEach(function (a, i) {
        if (a.color == null) a.color = SLOT_A_COLOR[a.slot] || (((i * 5) % 16) + 1);
      });
      s.version = 7;
    }

    if (s.version < 8) {
      /* v8 abre los programados a otras frecuencias y a preguntar el
         importe antes de apuntarlo. Lo que ya existe se queda como
         estaba: mensual, doce pagas y sin preguntar nada. */
      if (!Array.isArray(s.pendientes)) s.pendientes = [];
      (s.recurring || []).forEach(function (r) {
        if (!r.freq) r.freq = "mensual";
        if (r.kind === "in" && r.pagas == null) r.pagas = 12;
        if (r.confirmar == null) r.confirmar = false;
      });
      s.version = 8;
    }

    if (s.version < 9) {
      /* v9 trae el corregir saldo, con sus dos categorías. Se añaden solo
         si no existen ya: alguien pudo crearse una con ese id a mano. */
      if (!Array.isArray(s.categories)) s.categories = cloneCategories();
      var yaHay = {};
      s.categories.forEach(function (c) { yaHay[c.id] = true; });
      DEFAULT_CATEGORIES.forEach(function (d) {
        if (d.id !== "ajuste" && d.id !== "ajusteIn") return;
        if (yaHay[d.id]) return;
        s.categories.push({ id: d.id, name: d.name, emoji: d.emoji,
                            color: d.color, kind: d.kind, sistema: true });
      });

      /* Fuera del reparto a propósito: un ajuste no se presupuesta, y una
         instalación nueva tampoco le pone entrada. */
      if (s.allocation) delete s.allocation.ajuste;

      s.version = 9;
    }

    if (s.version < 10) {
      /* v10: un programado puede tener varios días de la semana, hora de
         aviso, importe abierto y tarifa por hora. Lo que ya existe se
         queda exactamente igual: un solo día, sin avisos y con su
         importe fijo. */
      (s.recurring || []).forEach(function (r) {
        if (!Array.isArray(r.weekdays)) {
          r.weekdays = [Math.min(6, Math.max(0, parseInt(r.weekday, 10) || 0))];
        }
        delete r.weekday;
        if (r.hora == null) r.hora = "09:00";
        if (r.avisar == null) r.avisar = false;
        if (r.importeAbierto == null) r.importeAbierto = false;
        if (r.tarifa === undefined) r.tarifa = null;
      });
      s.version = 10;
    }

    if (s.version < 11) {
      /* v11: préstamos con un número de cuotas. Lo que ya existe no las
         tiene, así que sigue siendo indefinido, que es lo que era. */
      (s.recurring || []).forEach(function (r) {
        if (r.cuotas === undefined) r.cuotas = null;
        if (r.pagadas === undefined) r.pagadas = 0;
      });
      s.version = 11;
    }

    /* Red de seguridad, al margen de la versión: casi todo el código tira
       de las categorías por defecto cuando la lista no está, pero crear
       una necesita el array de verdad. Un estado importado a mano, o
       guardado a medias, se quedaba sin él y reventaba al añadir. */
    if (!Array.isArray(s.categories)) s.categories = DEFAULT_CATEGORIES.slice();

    invalidateCats();
    return s;
  }

  /* Antes de cargar, dice si ya había algo guardado. Sirve para saber si
     es la primera vez que se abre la app, y por tanto si toca enseñar el
     tutorial de bienvenida. Se consulta siempre antes de `load()`, que
     guarda un estado nuevo en cuanto se llama. */
  function hasSavedState() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.transactions)) {
          D.state = migrate(parsed);
          save();
          return D.state;
        }
      }
    } catch (e) { /* almacenamiento no disponible o corrupto: se usa el estado en blanco */ }
    D.state = freshState();
    save();
    return D.state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(D.state)); }
    catch (e) { /* modo privado: la sesión sigue funcionando en memoria */ }
  }

  function reset() {
    D.state = defaultState();
    invalidateCats();
    save();
    return D.state;
  }

  function clearAll() {
    D.state = freshState();
    invalidateCats();
    save();
    return D.state;
  }


  /* --- lo que se lleva el espacio común --- */
  D.clearAll = clearAll;
  D.hasSavedState = hasSavedState;
  D.load = load;
  D.migrate = migrate;
  D.reset = reset;
  D.save = save;
})();
