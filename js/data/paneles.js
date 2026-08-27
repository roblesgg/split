/* ============================================================
   split — el panel de cada cuenta

   El Resumen deja de ser una lista fija: es un panel de bloques, y cada
   cuenta tiene los suyos y en el orden que quieras. La primera tarjeta
   del carrusel —«Todo tu dinero»— también es un panel, con la clave
   TODAS: así el mecanismo es uno solo y no hay un caso especial.

   Aquí no se sabe qué bloques existen ni qué pintan: eso vive en la capa
   de pantallas, que es la que los registra. Esto guarda una lista de
   nombres y su orden, y nada más. Un bloque que ya no exista se ignora
   al pintar, así que quitar uno del código nunca deja un panel roto.
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;

  function save() { return D.save.apply(null, arguments); }

  var TODAS = "todas";

  /* Con qué nace un panel que nadie ha tocado. Dos juegos, porque no
     tiene sentido lo mismo mirando todo tu dinero que mirando una
     cuenta: los límites del mes son de todas, y los apartados y el
     objetivo de gasto son de una. */
  var POR_DEFECTO_TODAS = [
    "acciones", "kpis", "limites", "categorias", "recientes", "proximos"
  ];
  var POR_DEFECTO_CUENTA = [
    "acciones", "kpis", "objetivo", "apartados", "categorias", "recientes"
  ];

  function paneles() {
    if (!D.state.paneles || typeof D.state.paneles !== "object") D.state.paneles = {};
    return D.state.paneles;
  }

  function clave(accId) { return accId || TODAS; }

  /* Los bloques de un panel. Sin tocar, los de fábrica. */
  function panelDe(accId) {
    var p = paneles()[clave(accId)];
    if (Array.isArray(p)) return p.slice();
    return (accId ? POR_DEFECTO_CUENTA : POR_DEFECTO_TODAS).slice();
  }

  /* Si está tocado o sigue de fábrica. Sirve para poder ofrecer un
     «volver a como estaba» solo cuando significa algo. */
  function panelTocado(accId) {
    return Array.isArray(paneles()[clave(accId)]);
  }

  function setPanel(accId, ids) {
    paneles()[clave(accId)] = (ids || []).slice();
    save();
  }

  function resetPanel(accId) {
    delete paneles()[clave(accId)];
    save();
  }

  /* Añadir y quitar sueltos, que es lo que hace la pantalla. */
  function ponerBloque(accId, id) {
    var lista = panelDe(accId);
    if (lista.indexOf(id) < 0) lista.push(id);
    setPanel(accId, lista);
  }

  function quitarBloque(accId, id) {
    setPanel(accId, panelDe(accId).filter(function (x) { return x !== id; }));
  }

  /* Mover uno arriba o abajo. Se hace con botones y no arrastrando: un
     arrastre dentro de una lista que ya scrollea es de las cosas que más
     se pelean en un móvil, y con flechas se puede además usar sin ver. */
  function moverBloque(accId, id, dir) {
    var lista = panelDe(accId);
    var i = lista.indexOf(id);
    var j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= lista.length) return false;
    lista.splice(j, 0, lista.splice(i, 1)[0]);
    setPanel(accId, lista);
    return true;
  }

  /* Una cuenta que se borra se lleva su panel: si no, el hueco se
     quedaría ahí para siempre engordando el estado. */
  function olvidarPanel(accId) {
    if (!accId) return;
    delete paneles()[accId];
  }

  /* --- lo que se lleva el espacio común --- */
  D.PANEL_TODAS = TODAS;
  D.PANEL_POR_DEFECTO_TODAS = POR_DEFECTO_TODAS;
  D.PANEL_POR_DEFECTO_CUENTA = POR_DEFECTO_CUENTA;
  D.moverBloque = moverBloque;
  D.olvidarPanel = olvidarPanel;
  D.panelDe = panelDe;
  D.panelTocado = panelTocado;
  D.ponerBloque = ponerBloque;
  D.quitarBloque = quitarBloque;
  D.resetPanel = resetPanel;
  D.setPanel = setPanel;
})();
