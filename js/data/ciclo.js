/* ============================================================
   split — el ciclo configurado

   La matemática está en core/dates.js (D.Ciclo) y no sabe nada del
   estado: se le pasa el día y calcula. Aquí es donde ese día se lee de
   los ajustes, para que el resto de la app no tenga que arrastrarlo.

   Con día 1 —lo que trae la app de fábrica— un ciclo es un mes natural y
   todo se comporta exactamente como se comportó siempre.
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;
  var C = D.Ciclo;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function save() { return D.save.apply(null, arguments); }
  function ymd() { return D.ymd.apply(null, arguments); }

  /* El día en que se reinicia todo. Se lee con cuidado: esto se llama
     también antes de que haya estado cargado. */
  function diaDeCorte() {
    var c = D.state && D.state.ciclo;
    return C.diaValido(c && c.dia);
  }

  function setDiaDeCorte(dia) {
    D.state.ciclo = { dia: C.diaValido(dia) };
    save();
  }

  function esMesNatural() { return diaDeCorte() === 1; }

  /* Las mismas funciones de core/dates, ya atadas al día configurado. */
  function ciclo(dateStr) { return C.de(dateStr, diaDeCorte()); }
  function cicloQueEmpieza(dateStr) { return C.queEmpieza(dateStr, diaDeCorte()); }

  function cicloActual() { return ciclo(ymd(new Date())); }
  function rangoDeCiclo(key) { return C.rango(key, diaDeCorte()); }
  function diasDeCiclo(key) { return C.dias(key, diaDeCorte()); }
  function diaDeCiclo(dateStr, key) { return C.diaDentro(dateStr, key, diaDeCorte()); }
  function etiquetaCiclo(key, style) { return C.etiqueta(key, style, diaDeCorte()); }
  function nombreCiclo(key) { return C.nombre(key, diaDeCorte()); }

  /* Para qué mes cuenta un movimiento.

     Normalmente, el mes en el que cae: se gasta y se cuenta el mismo día.
     Pero un sueldo que se cobra el 25 se gasta en el mes que entra, no en
     el que se acaba, así que un movimiento puede llevar dicho a mano para
     cuál cuenta. Cuando lo lleva, manda eso y no la fecha.

     Todo lo que agrupa por mes pasa por aquí. Es la única forma de que un
     ingreso adelantado salga en el mes que le toca en los totales, en la
     media de ingresos, en la tasa de ahorro y en los límites a la vez: si
     cada pantalla lo decidiera por su cuenta, tarde o temprano dos
     dirían cosas distintas del mismo dinero. */
  function cicloDeMov(t) {
    if (!t) return null;
    return cicloValido(t.ciclo) || ciclo(t.date);
  }

  /* Una clave de ciclo es «2026-10». Se comprueba porque viene de lo
     guardado, y un valor a medias colaría el movimiento en un mes que no
     existe, de donde no habría forma de sacarlo. */
  function cicloValido(key) {
    return /^\d{4}-\d{2}$/.test(String(key || "")) ? String(key) : null;
  }

  /* Cuánto llevas recorrido del ciclo, en días. Hoy cuenta entero: si vas
     por el tercero, llevas 3 de los 31. Es lo que sustituye a
     `new Date().getDate()` en todo lo que mide por dónde vas. */
  function diasCorridos(key) {
    var hoy = ymd(new Date());
    var r = rangoDeCiclo(key);
    if (hoy < r.desde) return 0;
    if (hoy > r.hasta) return diasDeCiclo(key);
    return diaDeCiclo(hoy, key);
  }

  /* --- lo que se lleva el espacio común --- */
  D.ciclo = ciclo;
  D.cicloDeMov = cicloDeMov;
  D.cicloQueEmpieza = cicloQueEmpieza;
  D.cicloValido = cicloValido;
  D.cicloActual = cicloActual;
  D.diaDeCiclo = diaDeCiclo;
  D.diaDeCorte = diaDeCorte;
  D.diasCorridos = diasCorridos;
  D.diasDeCiclo = diasDeCiclo;
  D.esMesNatural = esMesNatural;
  D.etiquetaCiclo = etiquetaCiclo;
  D.nombreCiclo = nombreCiclo;
  D.rangoDeCiclo = rangoDeCiclo;
  D.setDiaDeCorte = setDiaDeCorte;
})();
