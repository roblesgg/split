/* ============================================================
   split — datos de ejemplo

   Trece meses de movimientos generados con semilla fija: la misma cuenta
   sale siempre igual, así que una captura de pantalla es reproducible.
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;
  var DEFAULT_CATEGORIES = D.DEFAULT_CATEGORIES;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function categories() { return D.categories.apply(null, arguments); }
  function dowMon() { return D.dowMon.apply(null, arguments); }
  function monthKey() { return D.monthKey.apply(null, arguments); }
  function parseYmd() { return D.parseYmd.apply(null, arguments); }
  function pendientes() { return D.pendientes.apply(null, arguments); }
  function ymd() { return D.ymd.apply(null, arguments); }

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
      var copia = { id: c.id, name: c.name, emoji: c.emoji, color: c.color, kind: c.kind };
      if (c.sistema) copia.sistema = true;
      return copia;
    });
  }

  function defaultState() {
    var today = ymd(new Date());
    return {
      version: 11,
      createdAt: today,
      categories: cloneCategories(),
      tags: [],

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
        { id: "banco",  name: "Cuenta corriente", type: "Banco",  slot: 1, color: 1,  icon: "wallet", opening: 640 },
        /* cuadra con lo acumulado en las metas de ahorro */
        { id: "ahorro", name: "Hucha",     type: "Ahorro",   slot: 3, color: 3,  icon: "piggy",  opening: 3370 },
        { id: "efvo",   name: "Efectivo",  type: "Efectivo", slot: 4, color: 15, icon: "cash",   opening: 60 }
      ],
      goals: [
        { id: "g1", name: "Colchón de emergencia", target: 6000, saved: 2340, monthly: 200 },
        { id: "g2", name: "Viaje",                 target: 1500, saved: 620,  monthly: 90 },
        { id: "g3", name: "Portátil nuevo",        target: 1800, saved: 410,  monthly: 75 }
      ],
      transactions: seedTransactions(today),

      /* Programados que esperan un visto bueno antes de apuntarse. */
      pendientes: []
    };
  }

  /* Estado con el que arranca una instalación nueva: una sola cuenta,
     sin dinero y sin nada que repartir todavía. El tutorial de
     bienvenida deja que el usuario le cambie el nombre a esa cuenta
     antes de meter sus ingresos de verdad en Ajustes. */
  function freshState() {
    var today = ymd(new Date());
    return {
      version: 11,
      createdAt: today,
      categories: cloneCategories(),
      tags: [],
      income: { mode: "auto", manual: 0, months: 3 },
      /* Vacío a propósito. Traer diez categorías presupuestadas que nadie
         ha elegido hace que la pantalla de Ajustes parezca de otro y que
         el Resumen enseñe barras de un plan que no es tuyo. Se empieza
         sin presupuesto y se añade lo que a cada uno le interese. */
      allocation: {},
      recurring: [],
      accounts: [
        { id: "banco", name: "Banco", type: "Banco", slot: 1, color: 1, icon: "wallet", opening: 0 }
      ],
      goals: [],
      transactions: [],
      pendientes: []
    };
  }


  /* --- lo que se lleva el espacio común --- */
  D.DEFAULT_ALLOCATION = DEFAULT_ALLOCATION;
  D.cloneCategories = cloneCategories;
  D.defaultState = defaultState;
  D.freshState = freshState;
})();
