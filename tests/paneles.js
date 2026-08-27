/* ============================================================
   split — el panel de cada cuenta

   Lo que hay que asegurar: que cada cuenta tiene los suyos sin pisarse
   con las demás, que mover y quitar hacen lo que dicen, y que un panel
   sin tocar sale con los de fábrica — que es lo que hace que actualizar
   no le cambie el Resumen a nadie.
   ============================================================ */

var t = require("./ayuda");

var win = t.cargar(["js/data/paneles.js"],
  { Datos: { state: null, save: function () {} } });
var D = win.Datos;

function limpio() {
  D.state = { paneles: {} };
}

module.exports = function () {

  t.grupo("De fábrica");

  limpio();
  t.es("todo tu dinero trae los suyos",
       D.panelDe(null), D.PANEL_POR_DEFECTO_TODAS);
  t.es("y los de todas incluyen los límites del mes",
       D.PANEL_POR_DEFECTO_TODAS.indexOf("limites") >= 0, true);
  t.es("que en una cuenta no aparecen",
       D.PANEL_POR_DEFECTO_CUENTA.indexOf("limites") >= 0, false);
  t.es("y una cuenta, otros: los límites del mes no son de una cuenta",
       D.panelDe("cartera"), D.PANEL_POR_DEFECTO_CUENTA);
  t.es("sin tocar, no hay nada guardado", D.state.paneles, {});
  t.es("y se sabe que está sin tocar", D.panelTocado("cartera"), false);

  t.grupo("Cada cuenta, la suya");

  limpio();
  D.setPanel("cartera", ["kpis", "objetivo"]);
  t.es("la que se toca cambia", D.panelDe("cartera"), ["kpis", "objetivo"]);
  t.es("las demás siguen de fábrica",
       D.panelDe("banco"), D.PANEL_POR_DEFECTO_CUENTA);
  t.es("y todo tu dinero también", D.panelDe(null), D.PANEL_POR_DEFECTO_TODAS);
  t.es("ahora sí está tocada", D.panelTocado("cartera"), true);

  /* «Todo tu dinero» es un panel más, con su clave. */
  D.setPanel(null, ["kpis"]);
  t.es("todo tu dinero se guarda con su clave",
       Object.keys(D.state.paneles).sort(), ["cartera", "todas"]);
  t.es("y se lee igual", D.panelDe(null), ["kpis"]);

  t.grupo("Poner y quitar");

  limpio();
  D.setPanel("cartera", ["kpis", "recientes"]);

  D.ponerBloque("cartera", "calor");
  t.es("lo nuevo va al final", D.panelDe("cartera"), ["kpis", "recientes", "calor"]);

  D.ponerBloque("cartera", "kpis");
  t.es("poner uno que ya está no lo duplica",
       D.panelDe("cartera"), ["kpis", "recientes", "calor"]);

  D.quitarBloque("cartera", "recientes");
  t.es("quitar se lleva solo ese", D.panelDe("cartera"), ["kpis", "calor"]);

  D.quitarBloque("cartera", "noexiste");
  t.es("quitar uno que no está no rompe nada", D.panelDe("cartera"), ["kpis", "calor"]);

  D.setPanel("cartera", []);
  t.es("se puede dejar vacío, y vacío se queda", D.panelDe("cartera"), []);

  t.grupo("Mover");

  limpio();
  D.setPanel("cartera", ["a", "b", "c"]);

  t.es("bajar el primero", (D.moverBloque("cartera", "a", 1), D.panelDe("cartera")),
       ["b", "a", "c"]);
  t.es("subirlo otra vez", (D.moverBloque("cartera", "a", -1), D.panelDe("cartera")),
       ["a", "b", "c"]);

  t.es("el primero no sube más", D.moverBloque("cartera", "a", -1), false);
  t.es("y no se ha movido nada", D.panelDe("cartera"), ["a", "b", "c"]);
  t.es("el último no baja más", D.moverBloque("cartera", "c", 1), false);
  t.es("uno que no está tampoco se mueve", D.moverBloque("cartera", "z", 1), false);

  t.es("mover no pierde ninguno",
       (D.moverBloque("cartera", "c", -1), D.panelDe("cartera").slice().sort()),
       ["a", "b", "c"]);

  t.grupo("Volver a como estaba");

  limpio();
  D.setPanel("cartera", ["kpis"]);
  D.resetPanel("cartera");
  t.es("vuelve a los de fábrica", D.panelDe("cartera"), D.PANEL_POR_DEFECTO_CUENTA);
  t.es("y deja de estar tocada", D.panelTocado("cartera"), false);

  t.grupo("Una cuenta que se borra");

  limpio();
  D.setPanel("cartera", ["kpis"]);
  D.setPanel("banco", ["calor"]);
  D.olvidarPanel("cartera");
  t.es("se lleva su panel", Object.keys(D.state.paneles), ["banco"]);
  t.es("y no toca el de la otra", D.panelDe("banco"), ["calor"]);

  /* Con null no se puede borrar el de «todo tu dinero» por accidente:
     esa clave no es de ninguna cuenta. */
  D.setPanel(null, ["kpis"]);
  D.olvidarPanel(null);
  t.es("borrar «ninguna cuenta» no se lleva el de todo tu dinero",
       D.panelDe(null), ["kpis"]);

  t.grupo("Un panel guardado que nombra algo que ya no existe");

  /* Quitar un bloque del código no puede dejar el panel de nadie roto:
     el que pinta ignora los que no conoce, y aquí solo se comprueba que
     el modelo los deja pasar tal cual. */
  limpio();
  D.setPanel("cartera", ["kpis", "bloqueQueSeFue", "recientes"]);
  t.es("se guarda tal cual y ya lo filtrará quien pinta",
       D.panelDe("cartera"), ["kpis", "bloqueQueSeFue", "recientes"]);
};
