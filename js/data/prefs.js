/* ============================================================
   split — tema, emojis y exportar/importar
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;
  var THEME_KEY = D.THEME_KEY, EMOJI_KEY = D.EMOJI_KEY;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function invalidateCats() { return D.invalidateCats.apply(null, arguments); }
  function migrate() { return D.migrate.apply(null, arguments); }
  function save() { return D.save.apply(null, arguments); }
  function sortTx() { return D.sortTx.apply(null, arguments); }

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

  /* ---------- juego de emojis ----------
     Va al lado del tema y por el mismo motivo: es cómo se ve la app, no
     qué dinero tienes. Fuera del estado, así una copia de seguridad
     llevada a otro móvil no le impone a nadie unos emojis que allí a lo
     mejor ni pegan. */

  var EMOJI_SETS = ["sistema", "noto", "twemoji"];

  function getEmojiSet() {
    var v;
    try { v = localStorage.getItem(EMOJI_KEY); } catch (e) { v = null; }
    return EMOJI_SETS.indexOf(v) >= 0 ? v : "sistema";
  }

  function setEmojiSet(v) {
    var elegido = EMOJI_SETS.indexOf(v) >= 0 ? v : "sistema";
    try { localStorage.setItem(EMOJI_KEY, elegido); } catch (e) {}
    applyEmojiSet(elegido);
    return elegido;
  }

  function applyEmojiSet(v) {
    var root = document.documentElement;
    if (v === "sistema") root.removeAttribute("data-emoji");
    else root.setAttribute("data-emoji", v);
  }

  /* ---------- exportar / importar ---------- */

  function exportJson() {
    return JSON.stringify(D.state, null, 2);
  }

  function importJson(text) {
    var parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.transactions)) {
      throw new Error("El archivo no tiene el formato de split.");
    }
    D.state = migrate(parsed);
    invalidateCats();
    sortTx();
    save();
    return D.state;
  }


  /* --- lo que se lleva el espacio común --- */
  D.EMOJI_SETS = EMOJI_SETS;
  D.applyEmojiSet = applyEmojiSet;
  D.applyTheme = applyTheme;
  D.exportJson = exportJson;
  D.getEmojiSet = getEmojiSet;
  D.getTheme = getTheme;
  D.importJson = importJson;
  D.setEmojiSet = setEmojiSet;
  D.setTheme = setTheme;
})();
