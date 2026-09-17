/* ============================================================
   split — catálogo de categorías

   Las que trae la app de fábrica, los dieciséis colores y las búsquedas
   por id, incluida la jerarquía de madres e hijas.
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;

  /* ============================================================
     Catálogos
     ============================================================ */

  /* Las categorías son datos del usuario, no una lista cerrada: se crean,
     se renombran, se les cambia el emoji y el color, y se borran. Esto de
     abajo es solo con lo que arranca la app.

     `color` es un índice 1..16 en la paleta --cat-* de tokens.css. */
  var CAT_COLORS = 16;

  var DEFAULT_CATEGORIES = [
    { id: "comida",   name: "Comida",        icon: "utensils",  emoji: "🍽️", color: 3,  kind: "out" },
    { id: "compras",  name: "Compras",       icon: "bag",       emoji: "🛍️", color: 11, kind: "out" },
    { id: "gasolina", name: "Gasolina",      icon: "fuel",      emoji: "⛽", color: 13, kind: "out" },
    { id: "transp",   name: "Transporte",    icon: "car",       emoji: "🚌", color: 1,  kind: "out" },
    { id: "hogar",    name: "Hogar",         icon: "home",      emoji: "🏠", color: 5,  kind: "out" },
    { id: "ocio",     name: "Ocio",          icon: "film",      emoji: "🎬", color: 9,  kind: "out" },
    { id: "salud",    name: "Salud",         icon: "heart",     emoji: "💊", color: 7,  kind: "out" },
    { id: "subs",     name: "Suscripciones", icon: "repeat",    emoji: "🔁", color: 4,  kind: "out" },
    { id: "regalos",  name: "Regalos",       icon: "gift",      emoji: "🎁", color: 12, kind: "out" },
    { id: "otros",    name: "Otros",         icon: "box",       emoji: "📦", color: 16, kind: "out" },
    { id: "ingreso",  name: "Ingreso",       icon: "cash",      emoji: "💰", color: 3,  kind: "in" },
    { id: "nomina",   name: "Sueldo",        icon: "briefcase", emoji: "💼", color: 15, kind: "in" },
    { id: "extra",    name: "Extra",         icon: "clock",     emoji: "⏰", color: 6,  kind: "in" },
    { id: "regalo",   name: "Regalo",        icon: "gift",      emoji: "🎁", color: 10, kind: "in" },
    { id: "ajuste",   name: "Ajuste de saldo", icon: "scale", emoji: "⚖️", color: 8, kind: "out", sistema: true },
    { id: "ajusteIn", name: "Ajuste de saldo", icon: "scale", emoji: "⚖️", color: 8, kind: "in",  sistema: true }
  ];

  var CAT_FALLBACK = { id: "otros", name: "Sin categoría", icon: "box", emoji: "❓", color: 16, kind: "out" };

  /* Iconos por id si una categoría antigua no trae `icon`. */
  var ICON_POR_ID = {
    comida: "utensils", compras: "bag", gasolina: "fuel", transp: "car",
    hogar: "home", ocio: "film", salud: "heart", subs: "repeat",
    regalos: "gift", otros: "box", ingreso: "cash", nomina: "briefcase",
    extra: "clock", regalo: "gift", ajuste: "scale", ajusteIn: "scale"
  };

  var ICONOS_CAT = [
    "utensils", "bag", "fuel", "car", "home", "film", "heart", "repeat",
    "gift", "box", "cash", "briefcase", "clock", "wallet", "piggy", "target",
    "cart", "sparkle", "calendar", "sliders", "scale", "send"
  ];

  function catIcon(cat) {
    if (!cat) return "box";
    if (cat.icon) return cat.icon;
    return ICON_POR_ID[cat.id] || "box";
  }

  /* Índice por id, rehecho solo cuando cambian las categorías: se consulta
     en bucles de render y reconstruirlo en cada lectura se nota. */
  var catIndex = null;

  function invalidateCats() { catIndex = null; }

  function catsById() {
    if (!catIndex) {
      catIndex = {};
      (D.state && D.state.categories ? D.state.categories : DEFAULT_CATEGORIES)
        .forEach(function (c) { catIndex[c.id] = c; });
    }
    return catIndex;
  }

  function catById(id) { return catsById()[id] || CAT_FALLBACK; }

  /* Como catById pero sin red: devuelve null si no existe. La jerarquía la
     necesita así, porque el respaldo tiene id «otros» y kind «out», y con
     él las comprobaciones de madre válida darían que sí a cualquier cosa. */
  function catExacta(id) {
    var c = catsById()[id];
    return c || null;
  }

  function categories() {
    return (D.state && D.state.categories) ? D.state.categories : DEFAULT_CATEGORIES;
  }

  function categoriesOf(kind) {
    return categories().filter(function (c) { return c.kind === kind; });
  }

  /* ---------- categorías dentro de categorías ----------
     Un solo nivel: «Deudas» puede tener dentro «Deuda casa» y «Deuda
     coche», pero una hija no puede tener nietas. Dos niveles ya obligan a
     pensar dónde va cada cosa, y eso es justo lo que se quería evitar. */

  function esHija(c) { return !!(c && c.parentId); }

  function hijasDe(id) {
    return categories().filter(function (c) { return c.parentId === id; });
  }

  /* Las de primer nivel de un tipo: las que salen en el selector. */
  function categoriasMadre(kind) {
    return categoriesOf(kind).filter(function (c) { return !c.parentId; });
  }

  /* Para sumar: el gasto de «Deuda coche» cuenta como «Deudas». */
  function raizDe(catId) {
    var c = catExacta(catId);
    if (c && c.parentId) {
      var m = catExacta(c.parentId);
      if (m) return m;
    }
    return c;
  }

  /* Nombre completo, para cuando hace falta saber de cuál se habla. */
  function nombreLargo(catId) {
    var c = catExacta(catId);
    if (!c) return "";
    if (!c.parentId) return c.name;
    var m = catExacta(c.parentId);
    return m ? m.name + " · " + c.name : c.name;
  }

  function catColorVar(cat) {
    var n = cat && cat.color;
    if (!(n >= 1 && n <= CAT_COLORS)) n = CAT_COLORS;
    return "var(--cat-" + n + ")";
  }


  /* --- lo que se lleva el espacio común --- */
  D.CAT_COLORS = CAT_COLORS;
  D.DEFAULT_CATEGORIES = DEFAULT_CATEGORIES;
  D.ICONOS_CAT = ICONOS_CAT;
  D.catById = catById;
  D.catIcon = catIcon;
  D.catColorVar = catColorVar;
  D.catExacta = catExacta;
  D.categoriasMadre = categoriasMadre;
  D.categories = categories;
  D.categoriesOf = categoriesOf;
  D.esHija = esHija;
  D.hijasDe = hijasDe;
  D.invalidateCats = invalidateCats;
  D.nombreLargo = nombreLargo;
  D.raizDe = raizDe;
})();
