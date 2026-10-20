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

  /* Lee un archivo SIN tocar nada y dice qué trae, para poder enseñárselo
     a quien va a decidir si lo importa. Lanza con un mensaje que se puede
     leer tal cual si no vale. */
  function inspeccionarJson(text) {
    var parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { throw new Error("Ese archivo no es una copia de split."); }
    if (!parsed || !Array.isArray(parsed.transactions)) {
      throw new Error("Ese archivo no tiene el formato de split.");
    }
    /* De una versión más nueva que esta app: migrar solo sabe subir, y
       leerlo aquí lo estropearía sin avisar.

       La versión de esta app es la que sale de migrar, NO la de
       `freshState()`: ese se queda un escalón por debajo y se sube al
       cargar. Compararlo con él rechazaba lo que la propia app exporta. */
    var actual = migrate({ transactions: [] }).version;
    if (+parsed.version > actual) {
      throw new Error("Ese archivo es de una versión más nueva de split. Actualiza la app primero.");
    }
    var m = migrate(parsed);
    return { movimientos: m.transactions.length, cuentas: (m.accounts || []).length };
  }

  /* Sustituye todo por lo del archivo. Antes aparta lo que hay —si no cabe
     la copia, no importa nada— y si lo nuevo no se puede guardar, se queda
     lo de antes. */
  function importJson(text) {
    inspeccionarJson(text);
    var parsed = JSON.parse(text);

    if (!D.guardarCopiaAntes()) {
      throw new Error("No hay sitio para guardar una copia de lo que tienes. No he importado nada.");
    }

    var antes = D.state;
    D.state = migrate(parsed);
    invalidateCats();
    sortTx();
    if (!save()) {
      D.state = antes;
      invalidateCats();
      throw new Error("No he podido guardar lo importado. Sigues con lo de antes.");
    }
    return D.state;
  }


  /* ---------- cuándo se sacó la última copia ----------
     Una copia de seguridad que hay que acordarse de hacer no lo es, así
     que la app lleva la cuenta y avisa. La fecha vive FUERA del estado, en
     su propia clave: no entra en Exportar, no pasa por la migración y no
     cambia la forma de los datos. Es «la última vez que se sacó», no «la
     última vez que llegó a buen puerto»: el menú de compartir de Android
     no dice si se terminó de guardar. */

  var COPIA_KEY = "split.copia";
  var AVISO_KEY = "split.copia.aviso";
  var DIAS_SIN_COPIA = 14;    /* a partir de aquí se avisa */
  var MOVS_MINIMOS = 5;       /* con menos, no hay nada que cuidar todavía */

  function fechaGuardada(k) {
    try {
      var v = localStorage.getItem(k);
      return /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : null;
    } catch (e) { return null; }
  }

  function guardarFecha(k) {
    try { localStorage.setItem(k, D.ymd(new Date())); } catch (e) { /* sin almacenamiento */ }
  }

  function marcarCopia() { guardarFecha(COPIA_KEY); }
  function marcarAvisoDeCopia() { guardarFecha(AVISO_KEY); }

  /* Días desde la última copia; null si no ha sacado ninguna nunca. */
  function diasSinCopia() {
    var u = fechaGuardada(COPIA_KEY);
    if (!u) return null;
    var a = D.parseYmd(u), h = D.parseYmd(D.ymd(new Date()));
    return Math.max(0, Math.round((h - a) / 86400000));
  }

  /* ¿Hay que avisar ahora? Solo si hay algo que perder, hace tiempo que no
     se saca copia, y todavía no se ha avisado hoy: avisar a cada apertura
     es la forma de que dejen de leerlo. */
  function avisoDeCopia() {
    if (!D.state || (D.state.transactions || []).length < MOVS_MINIMOS) return false;
    var d = diasSinCopia();
    if (d !== null && d < DIAS_SIN_COPIA) return false;
    return fechaGuardada(AVISO_KEY) !== D.ymd(new Date());
  }

  /* --- lo que se lleva el espacio común --- */
  D.avisoDeCopia = avisoDeCopia;
  D.diasSinCopia = diasSinCopia;
  D.marcarAvisoDeCopia = marcarAvisoDeCopia;
  D.marcarCopia = marcarCopia;
  D.EMOJI_SETS = EMOJI_SETS;
  D.applyEmojiSet = applyEmojiSet;
  D.applyTheme = applyTheme;
  D.exportJson = exportJson;
  D.getEmojiSet = getEmojiSet;
  D.getTheme = getTheme;
  D.importJson = importJson;
  D.inspeccionarJson = inspeccionarJson;
  D.setEmojiSet = setEmojiSet;
  D.setTheme = setTheme;
})();
