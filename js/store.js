/* ============================================================
   split — estado, persistencia y selectores
   Sin build: script clásico, expone window.Store
   ============================================================ */

(function () {
  "use strict";

  var KEY = "split.state.v1";
  var THEME_KEY = "split.theme";

  /* ---------- formato ---------- */

  var eur = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  var eur0 = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  var num2 = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function money(v) { return eur.format(v); }
  function moneyShort(v) {
    var a = Math.abs(v);
    if (a >= 10000) return eur0.format(v);
    return eur.format(v);
  }
  function signed(v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + eur.format(Math.abs(v)); }
  function pct(v, digits) {
    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits || 0
    }).format(v) + " %";
  }

  var MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun",
                      "jul", "ago", "sep", "oct", "nov", "dic"];
  var DOW_SHORT = ["L", "M", "X", "J", "V", "S", "D"];

  /* ---------- fechas (todo en local, sin UTC) ---------- */

  function ymd(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function parseYmd(s) {
    var p = String(s).split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function monthKey(s) { return String(s).slice(0, 7); }

  function monthLabel(key, style) {
    var p = key.split("-");
    var mi = +p[1] - 1;
    if (style === "short") return MONTHS_SHORT[mi];
    if (style === "shortYear") return MONTHS_SHORT[mi] + " " + p[0].slice(2);
    return MONTHS[mi] + " " + p[0];
  }

  function addMonths(key, delta) {
    var p = key.split("-");
    var d = new Date(+p[0], +p[1] - 1 + delta, 1);
    var m = d.getMonth() + 1;
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m;
  }

  function daysInMonth(key) {
    var p = key.split("-");
    return new Date(+p[0], +p[1], 0).getDate();
  }

  /* índice de día de semana con lunes = 0 */
  function dowMon(d) { return (d.getDay() + 6) % 7; }

  function relDayLabel(dateStr, today) {
    var d = parseYmd(dateStr);
    var t = today ? parseYmd(today) : new Date();
    t.setHours(0, 0, 0, 0);
    var diff = Math.round((t - d) / 86400000);
    if (diff === 0) return "Hoy";
    if (diff === 1) return "Ayer";
    if (diff > 1 && diff < 7) {
      var names = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
      return names[dowMon(d)].charAt(0).toUpperCase() + names[dowMon(d)].slice(1);
    }
    return d.getDate() + " " + MONTHS_SHORT[d.getMonth()] +
           (d.getFullYear() !== t.getFullYear() ? " " + d.getFullYear() : "");
  }

  /* ============================================================
     Catálogos
     ============================================================ */

  /* Las categorías son datos del usuario, no una lista cerrada: se crean,
     se renombran, se les cambia el emoji y el color, y se borran. Esto de
     abajo es solo con lo que arranca la app.

     `color` es un índice 1..16 en la paleta --cat-* de tokens.css. */
  var CAT_COLORS = 16;

  var DEFAULT_CATEGORIES = [
    { id: "comida",   name: "Comida",        emoji: "🍽️", color: 3,  kind: "out" },
    { id: "compras",  name: "Compras",       emoji: "🛍️", color: 11, kind: "out" },
    { id: "gasolina", name: "Gasolina",      emoji: "⛽", color: 13, kind: "out" },
    { id: "transp",   name: "Transporte",    emoji: "🚌", color: 1,  kind: "out" },
    { id: "hogar",    name: "Hogar",         emoji: "🏠", color: 5,  kind: "out" },
    { id: "ocio",     name: "Ocio",          emoji: "🎬", color: 9,  kind: "out" },
    { id: "salud",    name: "Salud",         emoji: "💊", color: 7,  kind: "out" },
    { id: "subs",     name: "Suscripciones", emoji: "🔁", color: 4,  kind: "out" },
    { id: "regalos",  name: "Regalos",       emoji: "🎁", color: 12, kind: "out" },
    { id: "otros",    name: "Otros",         emoji: "📦", color: 16, kind: "out" },
    /* El ingreso genérico va primero: no todo lo que entra es un sueldo. */
    { id: "ingreso",  name: "Ingreso",       emoji: "💰", color: 3,  kind: "in" },
    { id: "nomina",   name: "Sueldo",        emoji: "💼", color: 15, kind: "in" },
    { id: "extra",    name: "Extra",         emoji: "⏰", color: 6,  kind: "in" },
    { id: "regalo",   name: "Regalo",        emoji: "🎁", color: 10, kind: "in" }
  ];

  /* Cuando una categoría se borra pero algo todavía la nombra. No debería
     pasar (borrar está bloqueado si está en uso), pero un import a mano
     puede traer un id que no existe y la app no se puede caer por eso. */
  var CAT_FALLBACK = { id: "otros", name: "Sin categoría", emoji: "❓", color: 16, kind: "out" };

  /* Índice por id, rehecho solo cuando cambian las categorías: se consulta
     en bucles de render y reconstruirlo en cada lectura se nota. */
  var catIndex = null;

  function invalidateCats() { catIndex = null; }

  function catsById() {
    if (!catIndex) {
      catIndex = {};
      (state && state.categories ? state.categories : DEFAULT_CATEGORIES)
        .forEach(function (c) { catIndex[c.id] = c; });
    }
    return catIndex;
  }

  function catById(id) { return catsById()[id] || CAT_FALLBACK; }

  function categories() {
    return (state && state.categories) ? state.categories : DEFAULT_CATEGORIES;
  }

  function categoriesOf(kind) {
    return categories().filter(function (c) { return c.kind === kind; });
  }

  function catColorVar(cat) {
    var n = cat && cat.color;
    if (!(n >= 1 && n <= CAT_COLORS)) n = CAT_COLORS;
    return "var(--cat-" + n + ")";
  }

  /* ============================================================
     Datos de ejemplo — deterministas (PRNG con semilla)
     ============================================================ */

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var MERCHANTS = {
    comida: ["Mercadona", "Consum", "Panadería", "Frutería", "Bar Paco", "Telepizza", "Carrefour"],
    transp: ["Repsol", "Cepsa", "Parking centro", "Taller", "Bus", "Peaje"],
    ocio: ["Cine", "Cañas", "Escapada", "Rocódromo", "Concierto", "Padel"],
    hogar: ["Alquiler", "Luz", "Agua", "Internet", "Ferretería"],
    compras: ["Zara", "Decathlon", "Amazon", "MediaMarkt", "Zapatillas"],
    salud: ["Farmacia", "Dentista", "Óptica", "Gimnasio"],
    subs: ["Spotify", "Netflix", "iCloud", "Móvil", "GitHub"],
    otros: ["Varios", "Regalo", "Cajero"]
  };

  function seedTransactions(todayStr) {
    var rnd = mulberry32(20260807);
    var tx = [];
    var today = parseYmd(todayStr);
    var id = 1;

    function push(dateStr, kind, catId, amount, note, accId) {
      tx.push({
        id: "t" + (id++),
        date: dateStr,
        kind: kind,
        categoryId: catId,
        accountId: accId || "banco",
        amount: Math.round(amount * 100) / 100,
        note: note
      });
    }

    function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }

    /* 13 meses hacia atrás, terminando en el mes en curso */
    for (var back = 12; back >= 0; back--) {
      var anchor = new Date(today.getFullYear(), today.getMonth() - back, 1);
      var y = anchor.getFullYear(), m = anchor.getMonth();
      var dim = new Date(y, m + 1, 0).getDate();
      var lastDay = (back === 0) ? today.getDate() : dim;

      /* --- ingresos --- */
      /* nómina el día 30 (o último día hábil disponible) */
      if (lastDay >= Math.min(30, dim)) {
        push(ymd(new Date(y, m, Math.min(30, dim))), "in", "nomina", 1500, "Sueldo");
      }
      /* trabajo de fin de semana: se cobra a mes vencido, día 5 */
      if (lastDay >= 5) {
        push(ymd(new Date(y, m, 5)), "in", "extra", 300 + rnd() * 70, "Trabajo fin de semana");
      }

      /* --- gastos fijos --- */
      if (lastDay >= 3)  push(ymd(new Date(y, m, 3)),  "out", "hogar", 320, "Alquiler");
      if (lastDay >= 8)  push(ymd(new Date(y, m, 8)),  "out", "subs",  10.99, "Spotify");
      if (lastDay >= 8)  push(ymd(new Date(y, m, 8)),  "out", "subs",  13.99, "Netflix");
      if (lastDay >= 12) push(ymd(new Date(y, m, 12)), "out", "subs",  16.90, "Móvil");
      if (lastDay >= 15) push(ymd(new Date(y, m, 15)), "out", "hogar", 42 + rnd() * 28, "Luz");
      if (lastDay >= 20) push(ymd(new Date(y, m, 20)), "out", "salud", 29.90, "Gimnasio");

      /* --- gastos variables ---
         En el mes en curso solo han pasado `lastDay` días, así que el
         número de movimientos se escala a esa fracción. Sin esto el mes
         a medias sale con el gasto de un mes entero y la proyección
         se dispara. */
      var nVar = Math.round((16 + Math.floor(rnd() * 9)) * (lastDay / dim));
      for (var k = 0; k < nVar; k++) {
        var day = 1 + Math.floor(rnd() * lastDay);
        var dt = new Date(y, m, day);
        var weekend = dowMon(dt) >= 5;
        var roll = rnd();
        var cat, amt;

        if (roll < 0.38)      { cat = "comida";  amt = 6 + rnd() * 44; }
        else if (roll < 0.56) { cat = "ocio";    amt = weekend ? 14 + rnd() * 46 : 7 + rnd() * 22; }
        else if (roll < 0.72) { cat = "transp";  amt = 12 + rnd() * 42; }
        else if (roll < 0.86) { cat = "compras"; amt = 15 + rnd() * 80; }
        else if (roll < 0.94) { cat = "salud";   amt = 8 + rnd() * 30; }
        else                  { cat = "otros";   amt = 5 + rnd() * 35; }

        push(ymd(dt), "out", cat, amt, pick(MERCHANTS[cat]));
      }

      /* Nota: los traspasos entre cuentas propias no se modelan todavía.
         Un movimiento solo suma o resta, así que un traspaso saldría
         contado como gasto e inflaría las estadísticas del mes. Lo que
         ya hay ahorrado vive en el saldo inicial de la cuenta "Hucha". */
    }

    tx.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return tx;
  }

  /* Reparto por defecto: % del ingreso mensual planificado que va a cada
     partida. Lo que no se reparte es ahorro. Suma 75 → 25 % de ahorro. */
  var DEFAULT_ALLOCATION = {
    hogar: 22, comida: 16, ocio: 9, gasolina: 6, transp: 4,
    compras: 7, salud: 4, subs: 3, regalos: 2, otros: 2
  };

  function seedRecurring(thisMonth) {
    var mk = function (o) {
      return {
        id: "r" + o.n,
        kind: o.kind,
        amount: o.amount,
        categoryId: o.cat,
        accountId: o.acc || "banco",
        toAccountId: o.to || null,
        note: o.note,
        day: o.day,
        active: true,
        lastPosted: thisMonth
      };
    };
    return [
      mk({ n: 1, kind: "in",  amount: 1500,    cat: "nomina", note: "Sueldo", day: 30 }),
      mk({ n: 2, kind: "in",  amount: 320,     cat: "extra",  note: "Trabajo fin de semana", day: 5 }),
      mk({ n: 3, kind: "out", amount: 320,     cat: "hogar",  note: "Alquiler", day: 3 }),
      mk({ n: 4, kind: "out", amount: 10.99,   cat: "subs",   note: "Spotify", day: 8 }),
      mk({ n: 5, kind: "out", amount: 13.99,   cat: "subs",   note: "Netflix", day: 8 }),
      mk({ n: 6, kind: "out", amount: 16.90,   cat: "subs",   note: "Móvil", day: 12 }),
      mk({ n: 7, kind: "out", amount: 29.90,   cat: "salud",  note: "Gimnasio", day: 20 }),
      mk({ n: 8, kind: "transfer", amount: 200, cat: "otros", acc: "banco",
           to: "ahorro", note: "Ahorro del mes", day: 30 })
    ];
  }

  function cloneCategories() {
    return DEFAULT_CATEGORIES.map(function (c) {
      return { id: c.id, name: c.name, emoji: c.emoji, color: c.color, kind: c.kind };
    });
  }

  function defaultState() {
    var today = ymd(new Date());
    return {
      version: 5,
      createdAt: today,
      categories: cloneCategories(),

      /* Cuánto cuentas al mes para repartir.
         auto  = media real de tus últimos meses cerrados
         manual = la cifra que pongas tú */
      income: { mode: "auto", manual: 1800, months: 3 },

      allocation: Object.assign({}, DEFAULT_ALLOCATION),

      /* Pagos y cobros programados. `lastPosted` arranca en el mes en
         curso para que no se dupliquen con los movimientos de ejemplo
         que ya existen; a partir del mes siguiente se apuntan solos. */
      recurring: seedRecurring(monthKey(today)),
      accounts: [
        { id: "banco",  name: "Cuenta corriente", type: "Banco",    slot: 1, icon: "wallet", opening: 640 },
        /* cuadra con lo acumulado en las metas de ahorro */
        { id: "ahorro", name: "Hucha",            type: "Ahorro",   slot: 3, icon: "piggy",  opening: 3370 },
        { id: "efvo",   name: "Efectivo",         type: "Efectivo", slot: 4, icon: "cash",   opening: 60 }
      ],
      goals: [
        { id: "g1", name: "Colchón de emergencia", target: 6000, saved: 2340, monthly: 200 },
        { id: "g2", name: "Viaje",                 target: 1500, saved: 620,  monthly: 90 },
        { id: "g3", name: "Portátil nuevo",        target: 1800, saved: 410,  monthly: 75 }
      ],
      transactions: seedTransactions(today)
    };
  }

  /* Estado con el que arranca una instalación nueva: una sola cuenta,
     sin dinero y sin nada que repartir todavía. El tutorial de
     bienvenida deja que el usuario le cambie el nombre a esa cuenta
     antes de meter sus ingresos de verdad en Ajustes. */
  function freshState() {
    var today = ymd(new Date());
    return {
      version: 5,
      createdAt: today,
      categories: cloneCategories(),
      income: { mode: "auto", manual: 0, months: 3 },
      allocation: Object.assign({}, DEFAULT_ALLOCATION),
      recurring: [],
      accounts: [
        { id: "banco", name: "Banco", type: "Banco", slot: 1, icon: "wallet", opening: 0 }
      ],
      goals: [],
      transactions: []
    };
  }

  /* ============================================================
     Persistencia
     ============================================================ */

  var state = null;

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
          state = migrate(parsed);
          save();
          return state;
        }
      }
    } catch (e) { /* almacenamiento no disponible o corrupto: se usa el estado en blanco */ }
    state = freshState();
    save();
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { /* modo privado: la sesión sigue funcionando en memoria */ }
  }

  function reset() {
    state = defaultState();
    invalidateCats();
    save();
    return state;
  }

  function clearAll() {
    state = freshState();
    invalidateCats();
    save();
    return state;
  }

  /* ---------- mutaciones ---------- */

  function nextId() {
    return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function addTx(t) {
    var tx = {
      id: nextId(),
      createdAt: Date.now(),
      date: t.date,
      kind: t.kind,
      categoryId: t.categoryId,
      accountId: t.accountId || "banco",
      toAccountId: t.kind === "transfer" ? (t.toAccountId || null) : null,
      amount: Math.round(Math.abs(t.amount) * 100) / 100,
      note: (t.note || "").trim() ||
            (t.kind === "transfer" ? "Traspaso" : catById(t.categoryId).name)
    };
    state.transactions.push(tx);
    sortTx();
    save();
    return tx;
  }

  function updateTx(id, patch) {
    var t = state.transactions.find(function (x) { return x.id === id; });
    if (!t) return null;
    Object.keys(patch).forEach(function (k) { t[k] = patch[k]; });
    if (patch.amount != null) t.amount = Math.round(Math.abs(patch.amount) * 100) / 100;
    sortTx();
    save();
    return t;
  }

  function deleteTx(id) {
    var i = state.transactions.findIndex(function (x) { return x.id === id; });
    if (i < 0) return null;
    var removed = state.transactions.splice(i, 1)[0];
    save();
    return removed;
  }

  function restoreTx(t) {
    state.transactions.push(t);
    sortTx();
    save();
  }

  /* Más reciente primero. A igualdad de fecha manda lo añadido después,
     para que un movimiento recién guardado aparezca arriba de su día
     y no enterrado entre los que ya había. */
  function sortTx() {
    state.transactions.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  /* ============================================================
     Cuentas
     ============================================================ */

  function slugId(prefix, name) {
    var base = prefix + "-" + String(name).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 18);
    var id = base, n = 2;
    var taken = {};
    state.accounts.forEach(function (a) { taken[a.id] = 1; });
    state.goals.forEach(function (g) { taken[g.id] = 1; });
    (state.recurring || []).forEach(function (r) { taken[r.id] = 1; });
    (state.categories || []).forEach(function (c) { taken[c.id] = 1; });
    while (taken[id]) { id = base + "-" + (n++); }
    return id;
  }

  function addAccount(data) {
    var acc = {
      id: slugId("acc", data.name || "cuenta"),
      name: (data.name || "Cuenta").trim(),
      type: (data.type || "Banco").trim(),
      icon: data.icon || "wallet",
      slot: ((state.accounts.length) % 8) + 1,
      opening: Math.round((+data.opening || 0) * 100) / 100
    };
    state.accounts.push(acc);
    save();
    return acc;
  }

  function updateAccount(id, patch) {
    var a = state.accounts.find(function (x) { return x.id === id; });
    if (!a) return null;
    if (patch.name != null) a.name = String(patch.name).trim() || a.name;
    if (patch.type != null) a.type = String(patch.type).trim() || a.type;
    if (patch.icon != null) a.icon = patch.icon;
    if (patch.opening != null) a.opening = Math.round((+patch.opening || 0) * 100) / 100;
    save();
    return a;
  }

  /* No se borra una cuenta con movimientos: dejaría importes huérfanos
     y descuadraría el saldo total. Se avisa y se deja al usuario decidir. */
  function accountUsage(id) {
    var tx = state.transactions.filter(function (t) {
      return t.accountId === id || t.toAccountId === id;
    }).length;
    var rec = (state.recurring || []).filter(function (r) {
      return r.accountId === id || r.toAccountId === id;
    }).length;
    return { transactions: tx, recurring: rec };
  }

  function deleteAccount(id) {
    if (state.accounts.length <= 1) {
      return { ok: false, reason: "Tiene que quedar al menos una cuenta." };
    }
    var use = accountUsage(id);
    if (use.transactions || use.recurring) {
      return {
        ok: false,
        reason: "Esta cuenta tiene " + use.transactions + " movimiento" +
                (use.transactions === 1 ? "" : "s") +
                (use.recurring ? " y " + use.recurring + " programado" +
                  (use.recurring === 1 ? "" : "s") : "") +
                ". Muévelos o bórralos antes."
      };
    }
    state.accounts = state.accounts.filter(function (a) { return a.id !== id; });
    save();
    return { ok: true };
  }

  /* ============================================================
     Categorías
     ============================================================ */

  /* Un emoji puede ocupar varios code points (piel, ZWJ, variación), así
     que no vale con cortar a un carácter: se coge el primer grupo que
     Intl considere una unidad, y si no hay soporte, los 4 primeros. */
  function firstGrapheme(s) {
    var str = String(s == null ? "" : s).trim();
    if (!str) return "";
    try {
      if (typeof Intl !== "undefined" && Intl.Segmenter) {
        var seg = new Intl.Segmenter("es", { granularity: "grapheme" });
        var it = seg.segment(str)[Symbol.iterator]().next();
        return it.done ? "" : it.value.segment;
      }
    } catch (e) { /* motor viejo: se cae al recorte de abajo */ }
    return Array.from(str).slice(0, 4).join("");
  }

  function normalizeColor(v) {
    var n = parseInt(v, 10);
    return (n >= 1 && n <= CAT_COLORS) ? n : 16;
  }

  function addCategory(data) {
    var kind = data.kind === "in" ? "in" : "out";
    var c = {
      id: slugId("cat", data.name || "categoria"),
      name: (data.name || "Categoría").trim(),
      emoji: firstGrapheme(data.emoji) || "📦",
      color: normalizeColor(data.color),
      kind: kind
    };
    state.categories.push(c);
    /* una de gasto nace en el reparto al 0 %: no cambia los presupuestos
       de nadie hasta que se le asigne algo a mano */
    if (kind === "out" && state.allocation[c.id] == null) state.allocation[c.id] = 0;
    invalidateCats();
    save();
    return c;
  }

  function updateCategory(id, patch) {
    var c = state.categories.find(function (x) { return x.id === id; });
    if (!c) return null;
    if (patch.name != null) c.name = String(patch.name).trim() || c.name;
    if (patch.emoji != null) c.emoji = firstGrapheme(patch.emoji) || c.emoji;
    if (patch.color != null) c.color = normalizeColor(patch.color);
    invalidateCats();
    save();
    return c;
  }

  function categoryUsage(id) {
    var tx = state.transactions.filter(function (t) {
      return t.kind !== "transfer" && t.categoryId === id;
    }).length;
    var rec = (state.recurring || []).filter(function (r) {
      return r.kind !== "transfer" && r.categoryId === id;
    }).length;
    return { transactions: tx, recurring: rec };
  }

  /* Igual que con las cuentas: no se borra una categoría con movimientos,
     porque dejaría importes sin clasificar y descuadraría los totales por
     categoría. Se avisa de cuántos hay y decide el usuario. */
  function deleteCategory(id) {
    var c = state.categories.find(function (x) { return x.id === id; });
    if (!c) return { ok: false, reason: "Esa categoría ya no existe." };

    var quedan = state.categories.filter(function (x) {
      return x.kind === c.kind && x.id !== id;
    }).length;
    if (!quedan) {
      return {
        ok: false,
        reason: "Tiene que quedar al menos una categoría de " +
                (c.kind === "in" ? "ingreso" : "gasto") + "."
      };
    }

    var use = categoryUsage(id);
    if (use.transactions || use.recurring) {
      return {
        ok: false,
        reason: "Esta categoría tiene " + use.transactions + " movimiento" +
                (use.transactions === 1 ? "" : "s") +
                (use.recurring ? " y " + use.recurring + " programado" +
                  (use.recurring === 1 ? "" : "s") : "") +
                ". Cámbialos de categoría o bórralos antes."
      };
    }

    state.categories = state.categories.filter(function (x) { return x.id !== id; });
    delete state.allocation[id];
    invalidateCats();
    save();
    return { ok: true };
  }

  /* ============================================================
     Metas de ahorro
     ============================================================ */

  function addGoal(data) {
    var g = {
      id: slugId("goal", data.name || "meta"),
      name: (data.name || "Meta").trim(),
      target: Math.max(0, Math.round((+data.target || 0) * 100) / 100),
      saved: Math.max(0, Math.round((+data.saved || 0) * 100) / 100),
      monthly: Math.max(0, Math.round((+data.monthly || 0) * 100) / 100)
    };
    state.goals.push(g);
    save();
    return g;
  }

  function updateGoal(id, patch) {
    var g = state.goals.find(function (x) { return x.id === id; });
    if (!g) return null;
    if (patch.name != null) g.name = String(patch.name).trim() || g.name;
    ["target", "saved", "monthly"].forEach(function (k) {
      if (patch[k] != null) g[k] = Math.max(0, Math.round((+patch[k] || 0) * 100) / 100);
    });
    save();
    return g;
  }

  function deleteGoal(id) {
    state.goals = state.goals.filter(function (g) { return g.id !== id; });
    save();
  }

  /* ============================================================
     Pagos y cobros programados
     ============================================================ */

  function addRecurring(data) {
    var r = {
      id: slugId("rec", data.note || "programado"),
      kind: data.kind === "in" ? "in" : data.kind === "transfer" ? "transfer" : "out",
      amount: Math.max(0, Math.round((+data.amount || 0) * 100) / 100),
      categoryId: data.categoryId || "otros",
      accountId: data.accountId || state.accounts[0].id,
      toAccountId: data.kind === "transfer" ? (data.toAccountId || null) : null,
      note: (data.note || "").trim() || "Programado",
      day: Math.min(28, Math.max(1, parseInt(data.day, 10) || 1)),
      active: data.active !== false,
      /* arranca en el mes anterior para que el del mes en curso se
         apunte en cuanto llegue su día */
      lastPosted: addMonths(currentMonthKey(), -1)
    };
    state.recurring.push(r);
    save();
    return r;
  }

  function updateRecurring(id, patch) {
    var r = state.recurring.find(function (x) { return x.id === id; });
    if (!r) return null;
    if (patch.note != null) r.note = String(patch.note).trim() || r.note;
    if (patch.kind != null) {
      r.kind = patch.kind;
      if (r.kind !== "transfer") r.toAccountId = null;
    }
    if (patch.amount != null) r.amount = Math.max(0, Math.round((+patch.amount || 0) * 100) / 100);
    if (patch.categoryId != null) r.categoryId = patch.categoryId;
    if (patch.accountId != null) r.accountId = patch.accountId;
    if (patch.toAccountId !== undefined) r.toAccountId = patch.toAccountId;
    if (patch.day != null) r.day = Math.min(28, Math.max(1, parseInt(patch.day, 10) || 1));
    if (patch.active != null) r.active = !!patch.active;
    save();
    return r;
  }

  function deleteRecurring(id) {
    state.recurring = state.recurring.filter(function (r) { return r.id !== id; });
    save();
  }

  function toggleRecurring(id) {
    var r = state.recurring.find(function (x) { return x.id === id; });
    if (!r) return null;
    r.active = !r.active;
    save();
    return r;
  }

  function dateOfMonth(monthKeyStr, day) {
    var p = monthKeyStr.split("-");
    return new Date(+p[0], +p[1] - 1, Math.min(day, daysInMonth(monthKeyStr)));
  }

  /* Apunta los programados que ya han vencido, mes a mes desde el último
     apuntado hasta hoy. Se llama al arrancar la app. */
  function runRecurring() {
    if (!Array.isArray(state.recurring)) state.recurring = [];
    var today = new Date();
    today.setHours(23, 59, 59, 999);
    var cur = currentMonthKey();
    var posted = 0;

    state.recurring.forEach(function (r) {
      if (!r.active) return;
      var m = r.lastPosted ? addMonths(r.lastPosted, 1) : cur;
      var guard = 0;
      while (m <= cur && guard++ < 120) {
        var date = dateOfMonth(m, r.day);
        if (date > today) break;
        state.transactions.push({
          id: nextId(),
          createdAt: Date.now(),
          date: ymd(date),
          kind: r.kind,
          categoryId: r.categoryId,
          accountId: r.accountId,
          toAccountId: r.kind === "transfer" ? r.toAccountId : null,
          amount: r.amount,
          note: r.note,
          fromRecurring: r.id
        });
        r.lastPosted = m;
        posted++;
        m = addMonths(m, 1);
      }
    });

    if (posted) { sortTx(); save(); }
    return posted;
  }

  /* próxima fecha en que se apuntará */
  function nextDue(r) {
    var cur = currentMonthKey();
    var m = r.lastPosted ? addMonths(r.lastPosted, 1) : cur;
    if (m < cur) m = cur;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var d = dateOfMonth(m, r.day);
    if (d < today) d = dateOfMonth(addMonths(m, 1), r.day);
    return d;
  }

  function upcomingRecurring(limit) {
    return (state.recurring || [])
      .filter(function (r) { return r.active; })
      .map(function (r) { return { r: r, due: nextDue(r) }; })
      .sort(function (a, b) { return a.due - b.due; })
      .slice(0, limit || 4);
  }

  /* cuánto compromete al mes lo que está programado */
  function recurringMonthly() {
    var out = 0, inc = 0, moved = 0;
    (state.recurring || []).forEach(function (r) {
      if (!r.active) return;
      if (r.kind === "out") out += r.amount;
      else if (r.kind === "in") inc += r.amount;
      else moved += r.amount;
    });
    return {
      expense: Math.round(out * 100) / 100,
      income: Math.round(inc * 100) / 100,
      transfer: Math.round(moved * 100) / 100
    };
  }

  /* ---------- ingresos y reparto ---------- */

  /* Media de lo que ha entrado de verdad en los últimos meses cerrados.
     Se excluye el mes en curso porque va a medias y tiraría la media
     hacia abajo. Un mes con paga extra o con más horas sube la media
     solo, sin tener que declarar nada. */
  function averageIncome(months) {
    var n = Math.max(1, months || 3);
    var cur = currentMonthKey();
    var suma = 0, contados = 0;
    for (var i = 1; i <= n; i++) {
      var key = addMonths(cur, -i);
      var t = totals(txOfMonth(key));
      /* un mes sin ningún ingreso no cuenta: normalmente es que aún no
         usabas la app, y meterlo como cero hundiría la media */
      if (t.income > 0) { suma += t.income; contados++; }
    }
    if (!contados) return 0;
    return Math.round((suma / contados) * 100) / 100;
  }

  /* Cuánto hay para repartir este mes. */
  function plannedIncome() {
    var i = state.income || { mode: "auto", manual: 0, months: 3 };
    if (i.mode === "manual") return Math.max(0, +i.manual || 0);
    var media = averageIncome(i.months);
    /* sin historial todavía, cae a la cifra manual para no dejar los
       presupuestos a cero el primer mes */
    return media > 0 ? media : Math.max(0, +i.manual || 0);
  }

  function setIncome(patch) {
    state.income = Object.assign({}, state.income, patch);
    if (state.income.mode !== "manual") state.income.mode = "auto";
    state.income.manual = Math.max(0, +state.income.manual || 0);
    state.income.months = Math.min(12, Math.max(1, parseInt(state.income.months, 10) || 3));
    save();
  }

  function allocationSum() {
    return Object.keys(state.allocation).reduce(function (s, k) {
      return s + (state.allocation[k] || 0);
    }, 0);
  }

  /* lo que no se reparte entre categorías es ahorro */
  function savingsPct() {
    return Math.max(0, 100 - allocationSum());
  }

  function setAllocation(catId, pct) {
    state.allocation[catId] = Math.max(0, Math.min(100, Math.round(pct)));
    save();
  }

  function resetAllocation() {
    state.allocation = Object.assign({}, DEFAULT_ALLOCATION);
    save();
  }

  /* presupuesto en euros derivado del porcentaje */
  function budgetFor(catId) {
    var pct = (state.allocation || {})[catId] || 0;
    return Math.round((pct / 100) * plannedIncome());
  }

  function budgetTotal() {
    return Object.keys(state.allocation).reduce(function (s, k) {
      return s + budgetFor(k);
    }, 0);
  }

  function addGoalSaving(goalId, amount) {
    var g = state.goals.find(function (x) { return x.id === goalId; });
    if (!g) return null;
    g.saved = Math.max(0, Math.round((g.saved + amount) * 100) / 100);
    save();
    return g;
  }

  /* ============================================================
     Selectores derivados
     ============================================================ */

  function currentMonthKey() { return monthKey(ymd(new Date())); }

  function txOfMonth(key) {
    return state.transactions.filter(function (t) { return monthKey(t.date) === key; });
  }

  /* Un traspaso mueve dinero entre cuentas propias: no es ingreso ni
     gasto, así que no entra en ningún total ni en las estadísticas. */
  function totals(list) {
    var inc = 0, out = 0;
    list.forEach(function (t) {
      if (t.kind === "transfer") return;
      if (t.kind === "in") inc += t.amount; else out += t.amount;
    });
    return {
      income: Math.round(inc * 100) / 100,
      expense: Math.round(out * 100) / 100,
      net: Math.round((inc - out) * 100) / 100
    };
  }

  /* saldo total = aperturas + todos los movimientos */
  function balance() {
    var b = state.accounts.reduce(function (s, a) { return s + a.opening; }, 0);
    state.transactions.forEach(function (t) {
      if (t.kind === "transfer") return;   /* neto cero */
      b += t.kind === "in" ? t.amount : -t.amount;
    });
    return Math.round(b * 100) / 100;
  }

  function accountBalance(accId) {
    var acc = state.accounts.find(function (a) { return a.id === accId; });
    var b = acc ? acc.opening : 0;
    state.transactions.forEach(function (t) {
      if (t.kind === "transfer") {
        if (t.accountId === accId) b -= t.amount;      /* sale de aquí */
        if (t.toAccountId === accId) b += t.amount;    /* entra aquí */
        return;
      }
      if (t.accountId !== accId) return;
      b += t.kind === "in" ? t.amount : -t.amount;
    });
    return Math.round(b * 100) / 100;
  }

  /* gasto por categoría en un mes, ordenado de mayor a menor */
  function byCategory(key, kind) {
    var want = kind || "out";
    var sums = {};
    txOfMonth(key).forEach(function (t) {
      if (t.kind !== want) return;
      sums[t.categoryId] = (sums[t.categoryId] || 0) + t.amount;
    });
    return Object.keys(sums).map(function (id) {
      var c = catById(id);
      return {
        id: id,
        name: c.name,
        emoji: c.emoji,
        color: c.color,
        value: Math.round(sums[id] * 100) / 100
      };
    }).sort(function (a, b) { return b.value - a.value; });
  }

  /* serie mensual de los últimos n meses */
  function monthlySeries(n) {
    var out = [];
    var cur = currentMonthKey();
    for (var i = n - 1; i >= 0; i--) {
      var key = addMonths(cur, -i);
      var t = totals(txOfMonth(key));
      out.push({
        key: key,
        label: monthLabel(key, "short"),
        labelFull: monthLabel(key),
        income: t.income,
        expense: t.expense,
        net: t.net
      });
    }
    return out;
  }

  /* gasto diario del mes, para el heatmap */
  function dailySpend(key) {
    var dim = daysInMonth(key);
    var days = [];
    for (var d = 1; d <= dim; d++) days.push(0);
    txOfMonth(key).forEach(function (t) {
      if (t.kind !== "out") return;
      days[parseYmd(t.date).getDate() - 1] += t.amount;
    });
    return days.map(function (v, i) {
      var p = key.split("-");
      var date = new Date(+p[0], +p[1] - 1, i + 1);
      return {
        day: i + 1,
        date: ymd(date),
        dow: dowMon(date),
        value: Math.round(v * 100) / 100
      };
    });
  }

  /* tasa de ahorro = neto / ingresos */
  function savingsRate(key) {
    var t = totals(txOfMonth(key));
    if (t.income <= 0) return 0;
    return (t.net / t.income) * 100;
  }

  /* comercios más frecuentes por importe */
  function topMerchants(key, limit) {
    var sums = {};
    txOfMonth(key).forEach(function (t) {
      if (t.kind !== "out") return;
      var k = t.note || "Sin concepto";
      if (!sums[k]) sums[k] = { name: k, value: 0, count: 0, categoryId: t.categoryId };
      sums[k].value += t.amount;
      sums[k].count++;
    });
    return Object.keys(sums).map(function (k) {
      var s = sums[k];
      s.value = Math.round(s.value * 100) / 100;
      return s;
    }).sort(function (a, b) { return b.value - a.value; }).slice(0, limit || 5);
  }

  /* media de los meses completos anteriores (excluye el mes en curso) */
  function averageExpense(months) {
    var s = monthlySeries((months || 6) + 1);
    s.pop();
    if (!s.length) return 0;
    var sum = s.reduce(function (a, m) { return a + m.expense; }, 0);
    return Math.round((sum / s.length) * 100) / 100;
  }

  /* Proyección del cierre del mes en curso.
     Extrapolar en línea recta engaña: los gastos fijos (alquiler, cuotas)
     caen a principio de mes, así que a día 7 el ritmo aparente es enorme
     y multiplicarlo por 31 da cifras absurdas.
     En su lugar se mide la *forma* real del gasto: qué fracción del total
     mensual llevabas gastada a esta misma altura del mes en los meses
     anteriores. Si a día 7 sueles llevar el 45 %, lo gastado hasta hoy
     se divide entre 0,45. Así los fijos ya pagados no se duplican. */
  function expenseShapeFraction(key, dayOfMonth, lookback) {
    var fracs = [];
    for (var i = 1; i <= (lookback || 6); i++) {
      var list = txOfMonth(addMonths(key, -i)).filter(function (t) {
        return t.kind === "out";
      });
      if (!list.length) continue;
      var total = 0, upto = 0;
      list.forEach(function (t) {
        total += t.amount;
        if (parseYmd(t.date).getDate() <= dayOfMonth) upto += t.amount;
      });
      if (total > 0) fracs.push(upto / total);
    }
    if (!fracs.length) return null;
    return fracs.reduce(function (a, b) { return a + b; }, 0) / fracs.length;
  }

  function projectedExpense(key) {
    var dim = daysInMonth(key);
    var spent = totals(txOfMonth(key)).expense;
    if (key !== currentMonthKey()) return spent;      /* mes cerrado: es el dato */

    var elapsed = new Date().getDate();
    if (elapsed <= 0) return 0;
    if (elapsed >= dim) return spent;

    var f = expenseShapeFraction(key, elapsed, 6);
    /* sin historial suficiente se cae al reparto lineal */
    if (f == null || f < 0.05) return Math.round((spent / elapsed) * dim * 100) / 100;
    return Math.round((spent / f) * 100) / 100;
  }

  /* ---------- tema ---------- */

  function getTheme() {
    try { return localStorage.getItem(THEME_KEY) || "auto"; } catch (e) { return "auto"; }
  }

  function setTheme(t) {
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    applyTheme(t);
  }

  function applyTheme(t) {
    var root = document.documentElement;
    if (t === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", t);
  }

  /* ---------- exportar / importar ---------- */

  function exportJson() {
    return JSON.stringify(state, null, 2);
  }

  function importJson(text) {
    var parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.transactions)) {
      throw new Error("El archivo no tiene el formato de split.");
    }
    state = migrate(parsed);
    invalidateCats();
    sortTx();
    save();
    return state;
  }

  /* ============================================================
     API pública
     ============================================================ */

  window.Store = {
    /* estado */
    get state() { return state; },
    load: load, save: save, reset: reset, clearAll: clearAll,
    hasSavedState: hasSavedState,

    /* categorías: ya no son una lista fija, viven en el estado */
    get CATEGORIES() { return categories(); },
    catById: catById,
    categoriesOf: categoriesOf,
    catColorVar: catColorVar,
    CAT_COLORS: CAT_COLORS,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
    addCategory: addCategory, updateCategory: updateCategory,
    deleteCategory: deleteCategory, categoryUsage: categoryUsage,
    MONTHS: MONTHS,
    MONTHS_SHORT: MONTHS_SHORT,
    DOW_SHORT: DOW_SHORT,

    /* mutaciones */
    addTx: addTx, updateTx: updateTx, deleteTx: deleteTx, restoreTx: restoreTx,
    addGoalSaving: addGoalSaving,

    /* cuentas */
    addAccount: addAccount, updateAccount: updateAccount,
    deleteAccount: deleteAccount, accountUsage: accountUsage,

    /* metas */
    addGoal: addGoal, updateGoal: updateGoal, deleteGoal: deleteGoal,

    /* programados */
    addRecurring: addRecurring, updateRecurring: updateRecurring,
    deleteRecurring: deleteRecurring, toggleRecurring: toggleRecurring,
    runRecurring: runRecurring, nextDue: nextDue,
    upcomingRecurring: upcomingRecurring, recurringMonthly: recurringMonthly,

    /* ingresos y reparto */
    plannedIncome: plannedIncome, setIncome: setIncome,
    averageIncome: averageIncome,
    allocationSum: allocationSum, savingsPct: savingsPct,
    setAllocation: setAllocation, resetAllocation: resetAllocation,
    budgetFor: budgetFor, budgetTotal: budgetTotal,
    DEFAULT_ALLOCATION: DEFAULT_ALLOCATION,

    /* selectores */
    currentMonthKey: currentMonthKey,
    txOfMonth: txOfMonth,
    totals: totals,
    balance: balance,
    accountBalance: accountBalance,
    byCategory: byCategory,
    monthlySeries: monthlySeries,
    dailySpend: dailySpend,
    savingsRate: savingsRate,
    topMerchants: topMerchants,
    averageExpense: averageExpense,
    projectedExpense: projectedExpense,
    expenseShapeFraction: expenseShapeFraction,

    /* fechas y formato */
    ymd: ymd, parseYmd: parseYmd, monthKey: monthKey, monthLabel: monthLabel,
    addMonths: addMonths, daysInMonth: daysInMonth, dowMon: dowMon,
    relDayLabel: relDayLabel,
    money: money, moneyShort: moneyShort, signed: signed, pct: pct, num2: num2,

    /* tema */
    getTheme: getTheme, setTheme: setTheme, applyTheme: applyTheme,

    /* datos */
    exportJson: exportJson, importJson: importJson
  };
})();
