/* ============================================================
   split — espacio común de la capa de datos

   Los archivos de js/core y js/data cuelgan aquí lo suyo y se leen entre
   ellos por D.<nombre>. La API que ve el resto de la app es window.Store,
   que se monta al final en js/store.js.
   ============================================================ */

window.Datos = (function () {
  "use strict";

  return {
    /* El estado entero de la app. load() lo rellena; hasta entonces, null. */
    state: null,

    KEY: "split.state.v1",
    THEME_KEY: "split.theme",
    EMOJI_KEY: "split.emoji"
  };
})();
