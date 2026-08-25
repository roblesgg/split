/* ============================================================
   split — apartados

   Un apartado es una sub-bolsa DENTRO de una cuenta, no una cuenta
   nueva. Apartar 200 € para gasolina no mueve dinero a ninguna parte:
   reserva. El banco sigue teniendo lo mismo, y por eso el saldo de la
   app sigue cuadrando con el del banco de verdad, que es lo primero que
   se rompe en cuanto empiezas a inventarte traspasos.

   El saldo NO se guarda: se calcula. Un número guardado que hay que ir
   subiendo y bajando a mano se desincroniza en cuanto editas o borras un
   movimiento, y en una app de dinero eso no se puede permitir. Lo que se
   guarda son los aportes —cuánto has metido y cuándo— y el saldo sale de
   restarles lo gastado.

   Al cerrar el ciclo el sobrante SE ACUMULA: si apartas 200 y gastas
   160, el siguiente empiezas con 240. Es lo que haría un sobre de
   verdad. Para bajarlo se devuelve a la cuenta a mano.
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function addMonths() { return D.addMonths.apply(null, arguments); }
  function ciclo() { return D.ciclo.apply(null, arguments); }
  function cicloActual() { return D.cicloActual.apply(null, arguments); }
  function normalizeColor() { return D.normalizeColor.apply(null, arguments); }
  function raizDe() { return D.raizDe.apply(null, arguments); }
  function save() { return D.save.apply(null, arguments); }
  function slugId() { return D.slugId.apply(null, arguments); }

  /* Los mismos escalones que el límite de cuenta y las barras del
     presupuesto: «al límite» significa lo mismo en toda la app. */
  var CERCA = 0.85;

  function lista() {
    return Array.isArray(D.state.apartados) ? D.state.apartados : [];
  }

  function apartadoById(id) {
    return lista().find(function (x) { return x.id === id; }) || null;
  }

  function apartadosDe(accId) {
    return lista().filter(function (x) { return x.accountId === accId; });
  }

  /* ---------- crear, editar, borrar ---------- */

  function addApartado(data) {
    if (!Array.isArray(D.state.apartados)) D.state.apartados = [];
    var ap = {
      id: slugId("ap", data.name || "apartado"),
      name: (data.name || "Apartado").trim(),
      emoji: data.emoji || "📦",
      color: normalizeColor(data.color != null ? data.color : 1),
      accountId: data.accountId,
      porCiclo: Math.max(0, Math.round((+data.porCiclo || 0) * 100) / 100),
      categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds.slice() : [],
      aportes: []
    };
    /* Lo que pongas al crearlo entra ya, en el ciclo en curso: si no, un
       apartado recién hecho nacería vacío y no se entendería. */
    var inicial = data.inicial != null ? +data.inicial : ap.porCiclo;
    if (inicial > 0) {
      ap.aportes.push({ ciclo: cicloActual(), importe: Math.round(inicial * 100) / 100,
                        auto: true });
    }
    D.state.apartados.push(ap);
    save();
    return ap;
  }

  function updateApartado(id, patch) {
    var ap = apartadoById(id);
    if (!ap) return null;
    if (patch.name != null) ap.name = String(patch.name).trim() || ap.name;
    if (patch.emoji != null) ap.emoji = patch.emoji;
    if (patch.color != null) ap.color = normalizeColor(patch.color);
    if (patch.porCiclo != null) {
      ap.porCiclo = Math.max(0, Math.round((+patch.porCiclo || 0) * 100) / 100);
    }
    if (patch.categoryIds != null) {
      ap.categoryIds = Array.isArray(patch.categoryIds) ? patch.categoryIds.slice() : [];
    }
    save();
    return ap;
  }

  /* Borrar un apartado no borra sus gastos: los suelta. Vuelven a contar
     en el límite de la cuenta, que es donde habrían estado siempre. */
  function deleteApartado(id) {
    var i = lista().findIndex(function (x) { return x.id === id; });
    if (i < 0) return { ok: false, sueltos: 0 };
    var sueltos = 0;
    D.state.transactions.forEach(function (t) {
      if (t.apartadoId === id) { delete t.apartadoId; sueltos++; }
    });
    D.state.apartados.splice(i, 1);
    save();
    return { ok: true, sueltos: sueltos };
  }

  /* ---------- apartar y devolver ---------- */

  /* Un importe negativo devuelve dinero a la cuenta. Es el mismo apunte
     al revés, y así no hay dos caminos que mantener. */
  function aportar(id, importe, key) {
    var ap = apartadoById(id);
    if (!ap) return null;
    var n = Math.round((+importe || 0) * 100) / 100;
    if (!n) return ap;
    ap.aportes.push({ ciclo: key || cicloActual(), importe: n, auto: false });
    save();
    return ap;
  }

  /* ---------- el relleno de cada ciclo ---------- */

  /* Se llama al arrancar. Si has estado meses sin abrir la app, recupera
     los ciclos pendientes de uno en uno, igual que hacen los pagos
     programados: un apartado con 50 al ciclo tiene que tener 150 después
     de tres ciclos sin mirarlo, no 50. */
  function rellenarApartados() {
    var actual = cicloActual();
    var puestos = 0;
    lista().forEach(function (ap) {
      if (!(ap.porCiclo > 0)) return;
      var ultimo = null;
      ap.aportes.forEach(function (a) {
        if (a.auto && (ultimo === null || a.ciclo > ultimo)) ultimo = a.ciclo;
      });
      /* sin ninguno automático todavía, se empieza por el de ahora */
      var key = ultimo === null ? actual : addMonths(ultimo, 1);
      var guarda = 0;
      while (key <= actual && guarda++ < 120) {
        ap.aportes.push({ ciclo: key, importe: ap.porCiclo, auto: true });
        puestos++;
        key = addMonths(key, 1);
      }
    });
    if (puestos) save();
    return puestos;
  }

  /* ---------- lo que se calcula ---------- */

  function apartadoDe(t) {
    return t && t.apartadoId ? t.apartadoId : null;
  }

  function gastadoDe(id) {
    var total = 0;
    D.state.transactions.forEach(function (t) {
      if (t.kind !== "out") return;
      if (apartadoDe(t) !== id) return;
      total += t.amount;
    });
    return Math.round(total * 100) / 100;
  }

  function gastadoDeEnCiclo(id, key) {
    var total = 0;
    D.state.transactions.forEach(function (t) {
      if (t.kind !== "out") return;
      if (apartadoDe(t) !== id) return;
      if (ciclo(t.date) !== key) return;
      total += t.amount;
    });
    return Math.round(total * 100) / 100;
  }

  function apartadoTotal(ap) {
    var total = 0;
    (ap.aportes || []).forEach(function (a) { total += a.importe; });
    return Math.round(total * 100) / 100;
  }

  /* Todo lo que hace falta para pintar un apartado, de una vez. */
  function estadoDeApartado(id, key) {
    var ap = apartadoById(id);
    if (!ap) return null;
    key = key || cicloActual();

    var metido = apartadoTotal(ap);
    var gastado = gastadoDe(id);
    var saldo = Math.round((metido - gastado) * 100) / 100;
    /* Lo que se enseña es cuánto queda de lo que hay dentro, no del ciclo:
       si vienes acumulando, el sobre tiene más de lo que apartas al mes. */
    var ratio = metido > 0 ? gastado / metido : (gastado > 0 ? Infinity : 0);
    var pasado = saldo < 0;
    var cerca = !pasado && metido > 0 && ratio >= CERCA;

    return {
      id: id,
      key: key,
      apartado: ap,
      metido: metido,
      gastado: gastado,
      gastadoEnCiclo: gastadoDeEnCiclo(id, key),
      saldo: saldo,
      pct: metido > 0 ? Math.min(100, Math.round(ratio * 100)) : (gastado > 0 ? 100 : 0),
      pctQueda: metido > 0 ? Math.max(0, Math.round((1 - ratio) * 100)) : 0,
      nivel: pasado ? "pasado" : cerca ? "cerca" : "ok"
    };
  }

  /* Lo que la cuenta tiene reservado. Un apartado en negativo no reserva
     nada: ese dinero ya se gastó y el saldo de la cuenta ya lo refleja. */
  function reservadoDe(accId) {
    var total = 0;
    apartadosDe(accId).forEach(function (ap) {
      var e = estadoDeApartado(ap.id);
      if (e && e.saldo > 0) total += e.saldo;
    });
    return Math.round(total * 100) / 100;
  }

  /* ---------- a qué apartado va un gasto ---------- */

  /* Si la categoría está atada a un apartado de esa cuenta, el gasto se
     descuenta solo. Apuntar tiene que costar lo mismo que antes: nadie
     va a elegir el sobre a mano cada vez que echa gasolina. */
  function apartadoParaGasto(accountId, categoryId) {
    if (!accountId || !categoryId) return null;
    var raiz = raizDe(categoryId);
    var raizId = raiz ? raiz.id : categoryId;
    var encontrado = null;
    apartadosDe(accountId).forEach(function (ap) {
      if (encontrado) return;
      if ((ap.categoryIds || []).some(function (c) {
        return c === categoryId || c === raizId;
      })) encontrado = ap;
    });
    return encontrado;
  }

  /* --- lo que se lleva el espacio común --- */
  D.addApartado = addApartado;
  D.apartadoById = apartadoById;
  D.apartadoParaGasto = apartadoParaGasto;
  D.apartados = lista;
  D.apartadosDe = apartadosDe;
  D.aportar = aportar;
  D.deleteApartado = deleteApartado;
  D.estadoDeApartado = estadoDeApartado;
  D.rellenarApartados = rellenarApartados;
  D.reservadoDe = reservadoDe;
  D.updateApartado = updateApartado;
})();
