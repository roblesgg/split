/* ============================================================
   split — las de dentro: una subcategoría lleva la cara de su madre

   Lo que hay que asegurar: que crear una dentro de otra le pone el icono
   y el color de la madre, que cambiarle la cara a la madre se la cambia
   a todas las de dentro, y que meter una categoría suelta dentro de otra
   la adopta. Nada de esto puede tocar a una que va suelta.

   Es cosa de datos y no de pantalla a propósito: el formulario ya no
   enseña la rejilla de emojis cuando hay madre, pero la regla tiene que
   valer también para lo que llegue por otro camino —un import, una
   pantalla nueva— sin que haya que acordarse de repetirla.
   ============================================================ */

var t = require("./ayuda");

var win = t.cargar(
  ["js/data/catalog.js", "js/data/accounts.js", "js/data/categories.js"],
  { Datos: { state: null, save: function () {} } });
var D = win.Datos;

function limpio() {
  D.state = {
    categories: [
      { id: "comida", name: "Comida",  emoji: "🍽️", color: 1, kind: "out" },
      { id: "ocio",   name: "Ocio",    emoji: "🎬", color: 5, kind: "out" },
      { id: "nomina", name: "Nómina",  emoji: "💼", color: 9, kind: "in" }
    ],
    transactions: [],
    recurring: [],
    limites: []
  };
  D.invalidateCats();
}

function cara(id) {
  var c = D.state.categories.find(function (x) { return x.id === id; });
  return c ? [c.emoji, c.color] : null;
}

module.exports = function () {

  t.grupo("Crear una dentro de otra");

  limpio();
  var alm = D.addCategory({ name: "Almuerzos trabajo", emoji: "🥪", color: 12,
                            kind: "out", parentId: "comida" });
  t.es("se queda con el icono de su madre", cara(alm.id), ["🍽️", 1]);
  t.es("y con su nombre, que es lo suyo", alm.name, "Almuerzos trabajo");
  t.es("la madre no se entera", cara("comida"), ["🍽️", 1]);

  /* Sin madre manda lo que le pongas: la herencia es solo de las de dentro. */
  var suelta = D.addCategory({ name: "Perro", emoji: "🐶", color: 7, kind: "out" });
  t.es("una suelta se queda con lo que elijas", cara(suelta.id), ["🐶", 7]);

  t.grupo("Cambiarle la cara a la madre");

  limpio();
  var a = D.addCategory({ name: "Almuerzos", kind: "out", parentId: "comida" });
  var b = D.addCategory({ name: "Cenas", kind: "out", parentId: "comida" });
  var fuera = D.addCategory({ name: "Cine", kind: "out", parentId: "ocio" });

  D.updateCategory("comida", { emoji: "🍕" });
  t.es("se la cambia a todas las de dentro",
       [cara(a.id), cara(b.id)], [["🍕", 1], ["🍕", 1]]);
  t.es("y no toca a las de otra madre", cara(fuera.id), ["🎬", 5]);

  D.updateCategory("comida", { color: 4 });
  t.es("el color sigue viajando igual",
       [cara(a.id), cara(b.id)], [["🍕", 4], ["🍕", 4]]);

  D.updateCategory("comida", { name: "Comer" });
  t.es("renombrar la madre no le cambia la cara a nadie",
       [cara("comida"), cara(a.id)], [["🍕", 4], ["🍕", 4]]);
  t.es("ni el nombre de las de dentro",
       D.state.categories.find(function (x) { return x.id === a.id; }).name,
       "Almuerzos");

  t.grupo("Meter una suelta dentro de otra");

  limpio();
  var perro = D.addCategory({ name: "Perro", emoji: "🐶", color: 7, kind: "out" });
  D.updateCategory(perro.id, { parentId: "comida" });
  t.es("adopta la cara de su nueva madre", cara(perro.id), ["🍽️", 1]);

  /* Y sacarla no le devuelve la suya: la que tiene puesta es la que se
     queda. Recuperar la vieja obligaría a guardar una cara «de antes»
     que nadie ha pedido, y al sacarla se puede elegir otra. */
  D.updateCategory(perro.id, { parentId: "" });
  t.es("sacarla la deja con la que tenía", cara(perro.id), ["🍽️", 1]);
  t.es("y ya puede elegir la suya",
       (D.updateCategory(perro.id, { emoji: "🐶", color: 7 }), cara(perro.id)),
       ["🐶", 7]);

  t.grupo("Las reglas de siempre siguen valiendo");

  limpio();
  var hija = D.addCategory({ name: "Almuerzos", kind: "out", parentId: "comida" });
  var nieta = D.addCategory({ name: "Martes", kind: "out", parentId: hija.id });
  t.es("no hay tercer nivel: la nieta nace suelta", nieta.parentId, null);
  t.es("y entonces se queda con su propia cara",
       cara(nieta.id), ["📦", 16]);

  var mezcla = D.addCategory({ name: "Extra", kind: "in", parentId: "comida" });
  t.es("un ingreso no cabe dentro de un gasto", mezcla.parentId, null);
};
