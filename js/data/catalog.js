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
    { id: "regalo",   name: "Regalo",        emoji: "🎁", color: 10, kind: "in" },

    /* Las dos del corregir saldo. No son un gasto ni un ingreso de verdad:
       son la diferencia entre lo que la app creía y lo que hay. Van en su
       propia categoría para que se vea cuánto se escapa sin apuntar, en
       vez de disfrazarse de «Otros». */
    { id: "ajuste",   name: "Ajuste de saldo", emoji: "⚖️", color: 8, kind: "out", sistema: true },
    { id: "ajusteIn", name: "Ajuste de saldo", emoji: "⚖️", color: 8, kind: "in",  sistema: true }
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
  D.catById = catById;
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
