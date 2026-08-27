/* ============================================================
   split — arrastrar los bloques del panel

   Se arrastra por el asa, nunca por el cuerpo: si el bloque entero fuera
   arrastrable no se podría hacer scroll dentro del panel, que es lo
   primero que uno intenta.

   Los demás no saltan de sitio: se mueven con la técnica de siempre
   —medir dónde estaban, cambiar el orden, y animar desde la diferencia—
   así que el bloque que deja hueco se aparta a la vista en vez de
   aparecer ya movido.

   Y con puntero, no con la API de arrastrar del navegador: esa no
   funciona con el dedo, que es donde se va a usar esto.
   ============================================================ */

(function () {
  "use strict";

  var A = window.App;
  var S = A.S, U = A.U, $$ = A.$$;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function renderInicio() { return A.renderInicio.apply(null, arguments); }

  /* Cuánto hay que mover el dedo antes de dar por hecho que arrastra.
     Con cero, un toque para pulsar la equis se llevaba el bloque. */
  var UMBRAL = 6;

  /* Mide dónde está cada bloque ahora mismo. */
  function posiciones(lista) {
    var m = {};
    $$(".panel-bloque", lista).forEach(function (n) {
      m[n.getAttribute("data-bloque")] = n.getBoundingClientRect().top;
    });
    return m;
  }

  /* Los coloca desde donde estaban y los suelta: el navegador anima la
     vuelta a su sitio nuevo. */
  function animarDesde(lista, antes) {
    $$(".panel-bloque", lista).forEach(function (n) {
      var id = n.getAttribute("data-bloque");
      var dy = (antes[id] || 0) - n.getBoundingClientRect().top;
      if (!dy) return;
      n.style.transition = "none";
      n.style.transform = "translateY(" + dy + "px)";
      /* dos cuadros: uno para que el navegador se coma la posición vieja
         y otro para que la transición arranque de verdad */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          n.style.transition = "transform var(--dur-base) var(--ease-ios)";
          n.style.transform = "";
        });
      });
    });
  }

  function arrastrar(lista, accId) {
    if (!lista) return;

    lista.addEventListener("pointerdown", function (e) {
      var grip = e.target.closest("[data-arrastrar]");
      if (!grip) return;

      var bloque = grip.closest(".panel-bloque");
      if (!bloque) return;

      var id = bloque.getAttribute("data-bloque");
      var y0 = e.clientY;
      var moviendo = false;
      var dy = 0;

      /* El puntero se captura en el asa: así el arrastre sigue aunque el
         dedo se salga del bloque, que es lo que pasa siempre. */
      grip.setPointerCapture(e.pointerId);

      function alMover(ev) {
        dy = ev.clientY - y0;

        if (!moviendo) {
          if (Math.abs(dy) < UMBRAL) return;
          moviendo = true;
          bloque.classList.add("panel-bloque--volando");
          lista.classList.add("panel-lista--arrastrando");
          U.haptic("light");
        }

        bloque.style.transform = "translateY(" + dy + "px)";

        /* ¿Ha pasado por encima del de arriba o del de abajo? Se compara
           con el centro del vecino: cambiar al rozarlo haría que los
           bloques bailaran con cualquier temblor del dedo. */
        var centro = bloque.getBoundingClientRect().top +
                     bloque.offsetHeight / 2;
        var vecinos = $$(".panel-bloque", lista);
        var i = vecinos.indexOf(bloque);

        var antes = vecinos[i - 1];
        var despues = vecinos[i + 1];
        var mover = 0;

        if (antes) {
          var ra = antes.getBoundingClientRect();
          if (centro < ra.top + ra.height / 2) mover = -1;
        }
        if (!mover && despues) {
          var rd = despues.getBoundingClientRect();
          if (centro > rd.top + rd.height / 2) mover = 1;
        }
        if (!mover) return;

        var pos = posiciones(lista);
        if (mover < 0) lista.insertBefore(bloque, antes);
        else lista.insertBefore(despues, bloque);

        /* El que se arrastra no se anima: lo lleva el dedo. Los demás sí,
           y por eso se recalcula su desplazamiento con la posición nueva
           del que va en la mano. */
        var suyo = bloque.style.transform;
        bloque.style.transform = "";
        var arriba = bloque.getBoundingClientRect().top;
        animarDesde(lista, pos);
        bloque.style.transition = "none";
        bloque.style.transform = suyo;
        y0 += (arriba - pos[id]);
        bloque.style.transform = "translateY(" + (ev.clientY - y0) + "px)";
        U.haptic("light");
      }

      function alSoltar() {
        grip.removeEventListener("pointermove", alMover);
        grip.removeEventListener("pointerup", alSoltar);
        grip.removeEventListener("pointercancel", alSoltar);

        bloque.classList.remove("panel-bloque--volando");
        lista.classList.remove("panel-lista--arrastrando");
        bloque.style.transition = "transform var(--dur-base) var(--ease-ios)";
        bloque.style.transform = "";

        if (!moviendo) return;

        /* El orden de la pantalla es el que manda: se guarda tal cual. */
        S.setPanel(accId, $$(".panel-bloque", lista).map(function (n) {
          return n.getAttribute("data-bloque");
        }));
        U.haptic("light");
      }

      grip.addEventListener("pointermove", alMover);
      grip.addEventListener("pointerup", alSoltar);
      grip.addEventListener("pointercancel", alSoltar);
      e.preventDefault();
    });

    /* Las flechas hacen lo mismo con la misma animación: hay quien no
       puede arrastrar, y hay veces que arrastrar en una lista larga es
       peor que dar dos toques. */
    lista.addEventListener("click", function (e) {
      var node = e.target.closest("[data-subir], [data-bajar]");
      if (!node) return;
      var id = node.getAttribute("data-subir") || node.getAttribute("data-bajar");
      var dir = node.hasAttribute("data-subir") ? -1 : 1;

      var antes = posiciones(lista);
      if (!S.moverBloque(accId, id, dir)) return;
      renderInicio();
      animarDesde($$("#panelLista")[0], antes);
      U.haptic("light");
    });
  }

  /* --- lo que usan otros archivos --- */
  A.arrastrarBloques = arrastrar;
})();
