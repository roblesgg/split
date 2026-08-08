/* ============================================================
   split — adjuntos de los movimientos
   Sin build: script clásico, expone window.Attach

   Los adjuntos NO van en localStorage. El estado entero se guarda ahí
   como una cadena JSON, y la cuota ronda los 5 MB: una sola foto en
   base64 se la come y a partir de ahí deja de guardarse todo lo demás,
   que es mucho peor que no tener adjuntos.

   Así que van en IndexedDB, que da espacio de sobra, y el movimiento
   solo se queda con el id. Antes de guardar, la imagen se reduce con un
   canvas: de los 3-5 MB que suelta una cámara se pasa a ~150 KB, que es
   de sobra para leer un ticket.
   ============================================================ */

(function () {
  "use strict";

  var DB_NAME = "split.attachments";
  var STORE = "files";
  var VERSION = 1;

  var MAX_SIDE = 1400;      /* px del lado mayor tras reducir */
  var QUALITY = 0.72;       /* calidad JPEG */
  var MAX_BYTES = 4 * 1024 * 1024;   /* tope de entrada, antes de reducir */

  var dbPromise = null;

  function supported() {
    try { return typeof indexedDB !== "undefined" && !!indexedDB; }
    catch (e) { return false; }
  }

  function open() {
    if (!supported()) return Promise.reject(new Error("IndexedDB no disponible"));
    if (dbPromise) return dbPromise;

    dbPromise = new Promise(function (resolve, reject) {
      var req;
      try { req = indexedDB.open(DB_NAME, VERSION); }
      catch (e) { reject(e); return; }

      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
      /* en modo privado de algunos navegadores se queda bloqueada */
      req.onblocked = function () { reject(new Error("IndexedDB bloqueada")); };
    });

    /* si falla una vez, que el siguiente intento pueda volver a probar */
    dbPromise.catch(function () { dbPromise = null; });
    return dbPromise;
  }

  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode);
        var store = t.objectStore(STORE);
        var out = fn(store);
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error("transacción abortada")); };
      });
    });
  }

  function newId() {
    return "att" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- reducir la imagen ---------- */

  /* Devuelve un data URL ya reducido. Se usa data URL y no Blob porque
     así el adjunto se puede pintar en un <img> sin pedirle nada más a
     IndexedDB ni crear object URLs que luego hay que revocar. */
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error("sin archivo")); return; }
      if (file.size > MAX_BYTES) {
        reject(new Error("La imagen pesa más de 4 MB.")); return;
      }
      if (!/^image\//.test(file.type || "")) {
        reject(new Error("Solo se pueden adjuntar imágenes.")); return;
      }

      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("No se ha podido leer el archivo.")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("No se ha podido abrir la imagen.")); };
        img.onload = function () {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          if (!w || !h) { reject(new Error("Imagen vacía.")); return; }

          var escala = Math.min(1, MAX_SIDE / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * escala));
          var ch = Math.max(1, Math.round(h * escala));

          var canvas = document.createElement("canvas");
          canvas.width = cw; canvas.height = ch;
          var ctx = canvas.getContext("2d");
          /* fondo blanco: un PNG con transparencia pasado a JPEG saldría
             con el fondo en negro */
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(img, 0, 0, cw, ch);

          try {
            resolve({
              dataUrl: canvas.toDataURL("image/jpeg", QUALITY),
              width: cw, height: ch
            });
          } catch (e) { reject(new Error("No se ha podido procesar la imagen.")); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- API ---------- */

  /* Guarda el archivo ya reducido y devuelve su id. */
  function put(file) {
    return shrink(file).then(function (img) {
      var id = newId();
      var rec = {
        id: id,
        dataUrl: img.dataUrl,
        width: img.width,
        height: img.height,
        name: (file.name || "adjunto").slice(0, 60),
        savedAt: Date.now()
      };
      return tx("readwrite", function (store) { store.put(rec, id); })
        .then(function () { return rec; });
    });
  }

  function get(id) {
    return tx("readonly", function (store) { return store.get(id); })
      .then(function (r) { return r || null; })
      .catch(function () { return null; });
  }

  /* Varios de golpe, en una sola transacción. Devuelve solo los que
     existen: un id huérfano no debe romper el detalle del movimiento. */
  function getMany(ids) {
    if (!ids || !ids.length) return Promise.resolve([]);
    return open().then(function (db) {
      return new Promise(function (resolve) {
        var t = db.transaction(STORE, "readonly");
        var store = t.objectStore(STORE);
        var out = [];
        ids.forEach(function (id) {
          var req = store.get(id);
          req.onsuccess = function () { if (req.result) out.push(req.result); };
        });
        t.oncomplete = function () { resolve(out); };
        t.onerror = function () { resolve(out); };
      });
    }).catch(function () { return []; });
  }

  function del(id) {
    return tx("readwrite", function (store) { store.delete(id); })
      .catch(function () { /* si no se puede borrar, tampoco pasa nada grave */ });
  }

  function delMany(ids) {
    if (!ids || !ids.length) return Promise.resolve();
    return tx("readwrite", function (store) {
      ids.forEach(function (id) { store.delete(id); });
    }).catch(function () {});
  }

  /* Borra lo que ya no referencia ningún movimiento. Se llama al arrancar:
     si se borró un movimiento con adjuntos, sus imágenes se quedarían
     ocupando sitio para siempre. */
  function sweep(idsEnUso) {
    var vivos = {};
    (idsEnUso || []).forEach(function (id) { vivos[id] = 1; });
    return open().then(function (db) {
      return new Promise(function (resolve) {
        var t = db.transaction(STORE, "readwrite");
        var store = t.objectStore(STORE);
        var borrados = 0;
        var req = store.openCursor();
        req.onsuccess = function () {
          var cur = req.result;
          if (!cur) return;
          if (!vivos[cur.key]) { cur.delete(); borrados++; }
          cur.continue();
        };
        t.oncomplete = function () { resolve(borrados); };
        t.onerror = function () { resolve(borrados); };
      });
    }).catch(function () { return 0; });
  }

  window.Attach = {
    supported: supported,
    put: put,
    get: get,
    getMany: getMany,
    del: del,
    delMany: delMany,
    sweep: sweep,
    MAX_BYTES: MAX_BYTES
  };
})();
