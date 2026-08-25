/* ============================================================
   split — límites de gasto por cuenta

   Un objetivo de gasto para una cuenta, que se vacía solo cuando cierra
   el ciclo. No es un tope duro: la app avisa, no bloquea. Bloquear haría
   que el gasto se apuntara en otro sitio, y entonces la app mentiría.

   Solo cuenta lo que SALE de la cuenta como gasto. Un traspaso a tu
   propia hucha no es gastar, así que no suma, igual que no suma en
   ningún otro total de la app.
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function ciclo() { return D.ciclo.apply(null, arguments); }
  function cicloActual() { return D.cicloActual.apply(null, arguments); }
  function diasCorridos() { return D.diasCorridos.apply(null, arguments); }
  function diasDeCiclo() { return D.diasDeCiclo.apply(null, arguments); }
  function save() { return D.save.apply(null, arguments); }

  /* Los mismos dos escalones que usan las barras del presupuesto, para
     que «al límite» signifique lo mismo en toda la app. */
  var CERCA = 0.85;

  function cuenta(accId) {
    return D.state.accounts.find(function (a) { return a.id === accId; }) || null;
  }

  function limiteDe(accId) {
    var a = cuenta(accId);
    var v = a && a.limite;
    return (typeof v === "number" && v > 0) ? v : null;
  }

  /* Vacío, cero o nada quitan el límite: no hace falta un interruptor
     aparte para algo que ya se dice dejando el campo en blanco. */
  function setLimite(accId, importe) {
    var a = cuenta(accId);
    if (!a) return null;
    var n = parseFloat(importe);
    if (isFinite(n) && n > 0) a.limite = Math.round(n * 100) / 100;
    else delete a.limite;
    save();
    return a;
  }

  /* Lo gastado de una cuenta en un ciclo. Los traspasos quedan fuera. */
  function gastoDeCuenta(accId, key) {
    var total = 0;
    D.state.transactions.forEach(function (t) {
      if (t.kind !== "out") return;
      if (t.accountId !== accId) return;
      if (ciclo(t.date) !== key) return;
      total += t.amount;
    });
    return Math.round(total * 100) / 100;
  }

  /* Todo lo que hace falta para pintar un límite, de una vez. Devuelve
     null si esa cuenta no tiene ninguno, que es lo normal. */
  function estadoDeLimite(accId, key) {
    var limite = limiteDe(accId);
    if (limite == null) return null;
    key = key || cicloActual();

    var gastado = gastoDeCuenta(accId, key);
    var queda = Math.round((limite - gastado) * 100) / 100;
    var ratio = limite > 0 ? gastado / limite : 0;
    var pasado = ratio > 1;
    var cerca = !pasado && ratio >= CERCA;

    return {
      key: key,
      limite: limite,
      gastado: gastado,
      queda: queda,
      /* lo consumido, sin pasar de 100 para la barra */
      pct: Math.min(100, Math.round(ratio * 100)),
      /* lo que te queda, que es la cifra que se enseña grande */
      pctQueda: Math.max(0, Math.round((1 - ratio) * 100)),
      ratio: ratio,
      nivel: pasado ? "pasado" : cerca ? "cerca" : "ok",
      diasQuedan: Math.max(0, diasDeCiclo(key) - diasCorridos(key))
    };
  }

  function cuentasConLimite() {
    return D.state.accounts.filter(function (a) { return limiteDe(a.id) != null; });
  }

  /* --- lo que se lleva el espacio común --- */
  D.cuentasConLimite = cuentasConLimite;
  D.estadoDeLimite = estadoDeLimite;
  D.gastoDeCuenta = gastoDeCuenta;
  D.limiteDe = limiteDe;
  D.setLimite = setLimite;
})();
