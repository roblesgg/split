/* ============================================================
   split — los widgets de la pantalla de inicio
   Sin build: script clásico, expone window.Widgets

   Un widget de Android es una vista del sistema, no un trozo de la app:
   vive fuera del WebView y no puede leer localStorage, que es donde está
   todo. Así que la app le deja una foto pequeña en SharedPreferences y el
   widget pinta esa foto.

   La foto va con los textos YA formateados. Podría mandarse el número y
   que Java lo formatease, pero entonces habría dos sitios donde se decide
   cómo se escribe un euro en español, y el día que cambie uno el otro se
   queda atrás. Aquí se manda «1.240,00 €» y Java lo pone tal cual.

   Cuándo se manda: al arrancar, al salir de la app —que es justo cuando
   el widget se va a ver— y después de cada repintado, con un respiro de
   por medio y solo si algo ha cambiado. Cruzar el puente a Java en cada
   tecla no aporta nada.

   Fuera de Android no hay plugin y todo esto se queda en nada: no falla,
   simplemente no hace nada.
   ============================================================ */

(function () {
  "use strict";

  var S = window.Store;

  function plugin() {
    var P = window.Capacitor && window.Capacitor.Plugins;
    var W = P && P.Widgets;
    return (W && typeof W.publicar === "function") ? W : null;
  }

  function hay() { return !!plugin(); }

  /* Los colores son variables de CSS —cada cuenta lleva el suyo de la
     paleta—, y Java no entiende «var(--cat-3)». Se resuelve aquí, que es
     donde está la hoja de estilos. */
  function hex(varCss) {
    var m = /^var\((--[a-z0-9-]+)\)$/i.exec(String(varCss || "").trim());
    if (!m) return "";
    var v = getComputedStyle(document.documentElement)
              .getPropertyValue(m[1]).trim();
    return /^#[0-9a-f]{3,8}$/i.test(v) ? v : "";
  }

  /* La foto. Lo que cabe en un widget y nada más: el saldo de la cuenta
     con la que operas —la que manda en el Resumen, que ya se recuerda de
     una vez para otra— y el límite del mes que esté más apurado. */
  function foto() {
    var accId = S.cuentaDelPanel();
    var cuenta = accId && S.state.accounts.find(function (a) { return a.id === accId; });
    var lim = S.limiteMasApurado(S.cicloActual());

    var f = {
      /* Para saber si vale la pena repintar: si no hay nada, el widget
         dice «abre split» en vez de enseñar ceros que no son. */
      hay: !!cuenta,
      /* No lo pinta nadie: está para que la foto cambie al cambiar de
         cuenta aunque dos se llamen igual y tengan el mismo saldo. */
      cuentaId: cuenta ? cuenta.id : "",
      cuentaNombre: cuenta ? cuenta.name : "",
      cuentaTipo: cuenta ? cuenta.type : "",
      cuentaSaldo: cuenta ? S.money(S.accountBalance(cuenta.id)) : "",
      cuentaColor: cuenta ? hex(S.catColorVar(cuenta)) : "",

      hayLimite: !!lim,
      limiteNombre: lim ? lim.name : "",
      /* «120,00 € de 200,00 €», que es como se cuenta en voz alta */
      limiteTexto: lim ? (S.money(lim.gastado) + " de " + S.money(lim.limite)) : "",
      limitePct: lim ? lim.pct : 0,
      /* ok | cerca | pasado. El color lo pone Java, pero la palabra viaja
         siempre con él: en un widget pequeño el color solo no se lee. */
      limiteNivel: lim ? lim.nivel : "ok",
      limiteQueda: lim
        ? (lim.queda >= 0 ? "Te quedan " + S.money(lim.queda)
                          : "Te has pasado " + S.money(-lim.queda))
        : ""
    };
    return f;
  }

  var ultima = null;   /* lo último que se mandó, para no repetirlo */
  var pendiente = null;

  function publicar() {
    var W = plugin();
    if (!W) return Promise.resolve(false);

    var f;
    try { f = foto(); } catch (e) { return Promise.resolve(false); }

    var firma = JSON.stringify(f);
    if (firma === ultima) return Promise.resolve(false);
    ultima = firma;

    return W.publicar(f).then(function () { return true; },
                              function () { ultima = null; return false; });
  }

  /* Después de repintar se espera un poco: al teclear un importe se
     repinta en cada dígito, y lo que interesa es la cifra final. */
  function publicarLuego() {
    if (!hay()) return;
    clearTimeout(pendiente);
    pendiente = setTimeout(publicar, 700);
  }

  /* Salir de la app es el momento en que el widget se va a ver, así que
     ahí no se espera: se manda ya. */
  function vigilar() {
    if (!hay()) return;
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        clearTimeout(pendiente);
        publicar();
      }
    });
    window.addEventListener("pagehide", function () {
      clearTimeout(pendiente);
      publicar();
    });
  }

  window.Widgets = {
    hay: hay,
    foto: foto,
    publicar: publicar,
    publicarLuego: publicarLuego,
    vigilar: vigilar
  };
})();
