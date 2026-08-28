/* ============================================================
   split — el panel de cada cuenta

   Lo que hay que asegurar: que cada cuenta tiene los suyos sin pisarse
   con las demás, que mover y quitar hacen lo que dicen, y que un panel
   sin tocar sale con los de fábrica — que es lo que hace que actualizar
   no le cambie el Resumen a nadie.

   Y que la cuenta con la que se abre el Resumen se recuerda, que es lo
   que evita tener que buscarla cada mañana.
   ============================================================ */

var t = require("./ayuda");

var win = t.cargar(["js/data/paneles.js"],
  { Datos: { state: null, save: function () {} } });
var D = win.Datos;

function limpio() {
  D.state = { paneles: {} };
}

function conCuentas() {
  D.state = {
    paneles: {},
    panelActivo: null,
    accounts: [{ id: "cartera" }, { id: "banco" }]
  };
}

module.exports = function () {

  t.grupo("De fábrica");

  limpio();
  t.es("todo tu dinero trae los suyos",
       D.panelDe(null), D.PANEL_POR_DEFECTO_TODAS);
  t.es("los límites del mes vienen puestos en los dos",
       [D.PANEL_POR_DEFECTO_TODAS.indexOf("limites") >= 0,
        D.PANEL_POR_DEFECTO_CUENTA.indexOf("limites") >= 0], [true, true]);
  t.es("y lo que es de una cuenta, solo en una cuenta",
       [D.PANEL_POR_DEFECTO_CUENTA.indexOf("apartados") >= 0,
        D.PANEL_POR_DEFECTO_TODAS.indexOf("apartados") >= 0], [true, false]);
  t.es("y una cuenta, otros: el objetivo y los apartados son suyos",
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

  t.grupo("Con qué cuenta se abre el Resumen");

  conCuentas();
  t.es("sin nada elegido, con la primera", D.cuentaDelPanel(), "cartera");

  D.setCuentaDelPanel("banco");
  t.es("la que se deja puesta es la que sale", D.cuentaDelPanel(), "banco");
  t.es("y queda en el estado, que es lo que se guarda",
       D.state.panelActivo, "banco");

  /* Lo que de verdad se pide: cerrar y volver a abrir no la pierde. */
  var guardado = JSON.parse(JSON.stringify(D.state));
  D.state = guardado;
  t.es("al volver a cargar sigue siendo la misma", D.cuentaDelPanel(), "banco");

  /* Una cuenta que ya no está no puede dejar el Resumen en blanco. */
  D.state.accounts = [{ id: "cartera" }];
  t.es("si la guardada ya no existe, se cae a la primera",
       D.cuentaDelPanel(), "cartera");
  t.es("y no se reescribe el estado por leerlo",
       D.state.panelActivo, "banco");

  D.state.accounts = [];
  t.es("sin ninguna cuenta no hay cuenta que valga",
       D.cuentaDelPanel(), null);
  t.es("y entonces el panel es el de todas",
       D.panelDe(D.cuentaDelPanel()), D.PANEL_POR_DEFECTO_TODAS);

  conCuentas();
  D.setCuentaDelPanel(null);
  t.es("poner ninguna vuelve a la primera", D.cuentaDelPanel(), "cartera");

  t.grupo("Una cuenta que se borra");

  limpio();
  D.setPanel("cartera", ["kpis"]);
  D.setPanel("banco", ["calor"]);
  D.olvidarPanel("cartera");
  t.es("se lleva su panel", Object.keys(D.state.paneles), ["banco"]);
  t.es("y no toca el de la otra", D.panelDe("banco"), ["calor"]);

  conCuentas();
  D.setCuentaDelPanel("banco");
  D.olvidarPanel("banco");
  D.state.accounts = [{ id: "cartera" }];
  t.es("y si era la que se estaba mirando, se olvida también",
       [D.state.panelActivo, D.cuentaDelPanel()], [null, "cartera"]);

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
