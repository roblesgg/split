/* ============================================================
   split — aviso de actualización
   Sin build: script clásico, expone window.Updater

   La app no tiene servidor detrás: el APK lleva todo dentro. Así que
   "actualizarse" es enterarse de que hay una release nueva en GitHub y
   bajarse el APK, que Android instala encima del anterior. Al estar
   firmado con la misma clave, los datos guardados se conservan.
   ============================================================ */

(function () {
  "use strict";

  /* Versión de ESTA copia de la app. Al publicar una release nueva hay
     que subirla aquí y etiquetar la release igual (vX.Y.Z), porque la
     comparación es entre este número y el tag de la última release. */
  var VERSION = "1.1.0";

  var REPO = "roblesgg/split";
  var API = "https://api.github.com/repos/" + REPO + "/releases/latest";
  var RELEASES_URL = "https://github.com/" + REPO + "/releases/latest";

  var DISMISS_KEY = "split.update.dismissed";
  var LAST_KEY = "split.update.lastCheck";

  /* En el arranque no se pregunta más de una vez cada 6 h: la app se abre
     muchas veces al día y no hace falta llamar a GitHub en cada una. La
     comprobación manual desde Ajustes se salta este límite. */
  var AUTO_EVERY_MS = 6 * 60 * 60 * 1000;
  var TIMEOUT_MS = 8000;

  /* ---------- comparación de versiones ---------- */

  function parse(v) {
    var m = String(v == null ? "" : v).trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }

  /* ¿`remote` es posterior a `local`? Si alguna no se entiende, se dice
     que no: más vale no avisar que avisar en falso. */
  function isNewer(remote, local) {
    var r = parse(remote), l = parse(local);
    if (!r || !l) return false;
    for (var i = 0; i < 3; i++) {
      if (r[i] > l[i]) return true;
      if (r[i] < l[i]) return false;
    }
    return false;
  }

  /* ---------- memoria de lo ya visto ---------- */

  function readKey(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function writeKey(k, v) {
    try { localStorage.setItem(k, v); } catch (e) { /* modo privado */ }
  }

  /* «Ahora no» silencia solo esa versión: la siguiente vuelve a avisar. */
  function dismiss(version) { writeKey(DISMISS_KEY, String(version)); }
  function isDismissed(version) { return readKey(DISMISS_KEY) === String(version); }

  function dueForAutoCheck() {
    var last = parseInt(readKey(LAST_KEY), 10);
    if (!isFinite(last)) return true;
    return (Date.now() - last) > AUTO_EVERY_MS;
  }

  /* ---------- consulta a GitHub ---------- */

  function fetchLatest() {
    if (typeof fetch !== "function") return Promise.reject(new Error("sin fetch"));

    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;

    return fetch(API, {
      headers: { "Accept": "application/vnd.github+json" },
      signal: ctrl ? ctrl.signal : undefined,
      cache: "no-store"
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  /* En el móvil el botón baja el APK directamente; en escritorio no sirve
     de nada, así que allí se abre la página de la release. */
  function isAndroid() {
    if (window.Capacitor && typeof window.Capacitor.getPlatform === "function") {
      return window.Capacitor.getPlatform() === "android";
    }
    return /Android/i.test(navigator.userAgent || "");
  }

  function apkFrom(release) {
    var assets = (release && release.assets) || [];
    for (var i = 0; i < assets.length; i++) {
      if (/\.apk$/i.test(assets[i].name || "")) return assets[i].browser_download_url;
    }
    return null;
  }

  /* Resuelve a uno de:
       { status: "update",  version, name, url }
       { status: "current", version }
       { status: "skipped" }            no tocaba comprobar todavía
       { status: "offline" }            sin conexión o GitHub no responde */
  function check(manual) {
    if (!manual && !dueForAutoCheck()) {
      return Promise.resolve({ status: "skipped" });
    }

    return fetchLatest().then(function (release) {
      writeKey(LAST_KEY, String(Date.now()));

      var tag = release && release.tag_name;
      if (!isNewer(tag, VERSION)) {
        return { status: "current", version: VERSION };
      }

      var apk = apkFrom(release);
      return {
        status: "update",
        version: String(tag).replace(/^v/i, ""),
        name: (release && release.name) || "",
        url: (isAndroid() && apk) ? apk : RELEASES_URL
      };
    }, function () {
      /* sin cobertura, en avión o GitHub caído: la app sigue igual */
      return { status: "offline" };
    });
  }

  /* Abrir fuera de la app. En el WebView de Capacitor una URL de otro
     host se delega al navegador del sistema, que es quien descarga el
     APK y se lo pasa al instalador de Android. */
  function open(url) {
    var w = null;
    try { w = window.open(url, "_blank"); } catch (e) { /* bloqueado */ }
    if (!w) { try { location.href = url; } catch (e) {} }
  }

  window.Updater = {
    VERSION: VERSION,
    RELEASES_URL: RELEASES_URL,
    check: check,
    open: open,
    dismiss: dismiss,
    isDismissed: isDismissed,
    isNewer: isNewer,
    parse: parse
  };
})();
