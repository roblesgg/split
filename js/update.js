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
  var VERSION = "1.24.0";

  var REPO = "roblesgg/split";
  var API = "https://api.github.com/repos/" + REPO + "/releases/latest";
  var RELEASES_URL = "https://github.com/" + REPO + "/releases/latest";

  var DISMISS_KEY = "split.update.dismissed";
  var LAST_KEY = "split.update.lastCheck";

  /* En el arranque no se pregunta más de una vez cada 6 h: la app se abre
     muchas veces al día y no hace falta llamar a GitHub en cada una. La
     comprobación manual desde Ajustes se salta este límite. */
  var AUTO_EVERY_MS = 6 * 60 * 60 * 1000;

  /* Ocho segundos se quedaban cortos con datos móviles flojos: la petición
     se cortaba sola y la app decía que no había conexión cuando sí la
     había, solo que lenta. */
  var TIMEOUT_MS = 15000;

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

  /* Un fallo con nombre. Antes cualquier problema —tardanza, un 403 de
     GitHub, la red caída— acababa en el mismo «¿tienes conexión?», que no
     ayuda a nadie a arreglar nada. */
  function fallo(clase, detalle) {
    var e = new Error(detalle || clase);
    e.clase = clase;
    return e;
  }

  function unIntento() {
    if (typeof fetch !== "function") {
      return Promise.reject(fallo("navegador", "este navegador no sabe hacer la consulta"));
    }

    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var cortado = false;
    var timer = ctrl ? setTimeout(function () {
      cortado = true;
      ctrl.abort();
    }, TIMEOUT_MS) : null;

    return fetch(API, {
      headers: { "Accept": "application/vnd.github+json" },
      signal: ctrl ? ctrl.signal : undefined,
      cache: "no-store"
    }).then(function (res) {
      if (timer) clearTimeout(timer);

      if (res.status === 403 || res.status === 429) {
        /* GitHub deja 60 consultas por hora sin identificarse. Se pasa
           antes de lo que parece si se comprueba a mano varias veces. */
        throw fallo("limite", "GitHub ha cortado por exceso de consultas");
      }
      if (!res.ok) throw fallo("http", "GitHub ha respondido " + res.status);

      return res.json().catch(function () {
        throw fallo("respuesta", "la respuesta de GitHub no se entiende");
      });
    }, function (err) {
      if (timer) clearTimeout(timer);
      if (err && err.clase) throw err;
      if (cortado) throw fallo("tardanza", "GitHub ha tardado más de 15 segundos");
      throw fallo("red", "no se ha podido llegar a GitHub");
    });
  }

  /* Un segundo intento tras dos segundos. La mayoría de los fallos de red
     en un móvil son de un momento —el wifi que cambia a datos, un túnel—
     y reintentar sale gratis. No se reintenta si GitHub ha cortado por
     exceso: insistir solo empeoraría eso. */
  function fetchLatest() {
    return unIntento().catch(function (err) {
      if (err.clase === "limite") throw err;
      return new Promise(function (res) { setTimeout(res, 2000); }).then(unIntento);
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
        url: (isAndroid() && apk) ? apk : RELEASES_URL,
        /* la página de la release, para el enlace de rescate de la tarjeta */
        page: (release && release.html_url) || RELEASES_URL
      };
    }, function (err) {
      /* sin cobertura, en avión o GitHub caído: la app sigue igual, pero
         ahora se sabe por qué y se le puede decir al usuario */
      return {
        status: "offline",
        clase: (err && err.clase) || "red",
        motivo: (err && err.message) || "no se ha podido llegar a GitHub"
      };
    });
  }

  /* Abrir fuera de la app, que es quien sabe descargar: el WebView por su
     cuenta no tiene gestor de descargas y con un APK no haría nada.

     Dentro de Capacitor hay que hacerlo con una navegación de primer
     nivel. `window.open` NO vale: acaba en onCreateWindow, que resuelve la
     dirección con getHitTestResult(), y eso solo devuelve algo cuando el
     usuario ha tocado un enlace de verdad. Llamado por código devuelve una
     ventana vacía, no se abre nada, y encima el respaldo no salta porque
     el objeto no es nulo.

     Con location.href entra por shouldOverrideUrlLoading: Capacitor ve que
     el host no es el suyo, lanza un intent del sistema y devuelve true, así
     que el navegador se lleva la descarga y la app se queda donde estaba. */
  function open(url) {
    if (enCapacitor() || isAndroid()) {
      try { location.href = url; return; } catch (e) { /* al plan B */ }
    }
    var w = null;
    try { w = window.open(url, "_blank"); } catch (e) { /* bloqueado */ }
    if (!w) { try { location.href = url; } catch (e) {} }
  }

  function enCapacitor() {
    return !!(window.Capacitor && typeof window.Capacitor.getPlatform === "function"
              && window.Capacitor.getPlatform() !== "web");
  }

  /* ---------- descarga dentro de la app ----------
     Si el plugin nativo está disponible, la actualización se baja sin salir
     de la app y salta directo al instalador. Si no lo está (navegador, o
     una versión antigua del envoltorio), se sigue abriendo el navegador
     como hasta ahora: peor, pero funciona.

     Android enseña igualmente su pantalla de confirmación. Eso no lo puede
     saltar ninguna app. */

  function pluginNativo() {
    var P = window.Capacitor && window.Capacitor.Plugins;
    var A = P && P.Actualizador;
    return (A && typeof A.descargar === "function") ? A : null;
  }

  /* Resuelve a:
       "instalando"   se descargó y se abrió el instalador
       "sin-permiso"  falta el permiso de instalar apps
       "sin-plugin"   no hay descarga nativa; que lo abra el navegador
       "error"        falló la descarga */
  function descargarEInstalar(url, alProgresar) {
    var A = pluginNativo();
    if (!A) return Promise.resolve("sin-plugin");

    return new Promise(function (resolve) {
      var suelta = null;
      function terminar(r) {
        if (suelta && typeof suelta.remove === "function") {
          try { suelta.remove(); } catch (e) {}
        }
        resolve(r);
      }

      try {
        suelta = A.addListener("progreso", function (ev) {
          if (typeof alProgresar === "function") alProgresar(ev);
          if (ev && ev.fase === "instalando") terminar("instalando");
          if (ev && ev.fase === "error") terminar("error");
        });
      } catch (e) { /* sin eventos se sigue igual, solo sin barra */ }

      A.descargar({ url: url }).then(function () {
        /* la resolución de verdad llega por el evento */
      }, function (err) {
        var msg = (err && (err.message || err.errorMessage)) || "";
        terminar(msg.indexOf("sin-permiso") >= 0 ? "sin-permiso" : "error");
      });
    });
  }

  function pedirPermisoInstalar() {
    var A = pluginNativo();
    if (A && typeof A.pedirPermiso === "function") {
      try { A.pedirPermiso(); } catch (e) {}
    }
  }

  window.Updater = {
    VERSION: VERSION,
    RELEASES_URL: RELEASES_URL,
    check: check,
    open: open,
    descargarEInstalar: descargarEInstalar,
    pedirPermisoInstalar: pedirPermisoInstalar,
    hayDescargaNativa: function () { return !!pluginNativo(); },
    enCapacitor: enCapacitor,
    dismiss: dismiss,
    isDismissed: isDismissed,
    isNewer: isNewer,
    parse: parse
  };
})();
