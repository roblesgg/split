/* ============================================================
   split — los límites del mes

   Un límite es un tope CON NOMBRE: cuánto quieres gastar y en qué
   categorías. Puedes tener los que hagan falta — «Gasolina» con 200 € y
   solo la categoría gasolina, «Gastos» con 1.200 € y todo menos las
   suscripciones y la gasolina.

   Sustituye al reparto por porcentajes. Se guarda EN EUROS, que es como
   se piensa: «doscientos al mes de gasolina». El porcentaje sobre lo que
   entra sigue enseñándose, pero ya solo es una lectura, no el dato. Así
   la cifra que escribes es la que se queda, pase lo que pase con la
   pantalla o con lo que cobres.

   CADA LÍMITE MANDA SOBRE LO SUYO. Un repostaje sube la barra de todos
   los límites que incluyan gasolina, y de ninguno más. Si no quieres que
   cuente dos veces, la excluyes del general: es explícito, se ve en su
   ficha y no hay que adivinar ninguna regla de prioridad.

   Lo que NUNCA cuenta:

   - Los traspasos. Pasar dinero a tu propia hucha no es gastar, y no
     suma en ningún otro total de la app.
   - Lo que sale de un apartado. Ese dinero ya lo habías separado: si
     contara aquí lo estarías gastando dos veces, una contra su sobre y
     otra contra el límite.
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function catExacta() { return D.catExacta.apply(null, arguments); }
  function cicloActual() { return D.cicloActual.apply(null, arguments); }
  function diasCorridos() { return D.diasCorridos.apply(null, arguments); }
  function diasDeCiclo() { return D.diasDeCiclo.apply(null, arguments); }
  function normalizeColor() { return D.normalizeColor.apply(null, arguments); }
  function plannedIncome() { return D.plannedIncome.apply(null, arguments); }
  function save() { return D.save.apply(null, arguments); }
  function slugId() { return D.slugId.apply(null, arguments); }
  function txDeCiclo() { return D.txDeCiclo.apply(null, arguments); }

  /* Los mismos dos escalones que usan las barras de toda la app, para
     que «al límite» signifique lo mismo en todas partes. */
  var CERCA = 0.85;

  var AMBITOS = ["todas", "solo", "salvo"];

  /* ============================================================
     La lista
     ============================================================ */

  function limites() {
    return Array.isArray(D.state.limites) ? D.state.limites : [];
  }

  function limitePorId(id) {
    return limites().find(function (l) { return l.id === id; }) || null;
  }

  function normalizarAmbito(v) {
    return AMBITOS.indexOf(v) >= 0 ? v : "todas";
  }

  function importeValido(v) {
    return Math.max(0, Math.round((+v || 0) * 100) / 100);
  }

  function addLimite(data) {
    if (!Array.isArray(D.state.limites)) D.state.limites = [];
    var lim = {
      id: slugId("lim", data.name || "limite"),
      name: (data.name || "Límite").trim(),
      emoji: data.emoji || "🎯",
      color: normalizeColor(data.color != null ? data.color : 1),
      importe: importeValido(data.importe),
      ambito: normalizarAmbito(data.ambito),
      categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds.slice() : []
    };
    D.state.limites.push(lim);
    save();
    return lim;
  }

  function updateLimite(id, patch) {
    var lim = limitePorId(id);
    if (!lim) return null;
    if (patch.name != null) lim.name = String(patch.name).trim() || lim.name;
    if (patch.emoji != null) lim.emoji = patch.emoji;
    if (patch.color != null) lim.color = normalizeColor(patch.color);
    if (patch.importe != null) lim.importe = importeValido(patch.importe);
    if (patch.ambito != null) lim.ambito = normalizarAmbito(patch.ambito);
    if (patch.categoryIds) lim.categoryIds = patch.categoryIds.slice();
    save();
    return lim;
  }

  function deleteLimite(id) {
    D.state.limites = limites().filter(function (l) { return l.id !== id; });
    save();
    return { ok: true };
  }

  function vaciarLimites() {
    D.state.limites = [];
    save();
  }

  /* Una categoría que desaparece se cae de todas las listas. Si la
     dejáramos, un límite «solo estas» se quedaría apuntando a algo que
     ya no existe y su barra no volvería a moverse. */
  function olvidarCategoria(catId) {
    limites().forEach(function (l) {
      l.categoryIds = (l.categoryIds || []).filter(function (id) { return id !== catId; });
    });
  }

  /* ============================================================
     Qué gasto le toca a cada límite
     ============================================================ */

  /* Excluir «Suscripciones» excluye también sus subcategorías. Nadie que
     aparte una familia entera espera que una hija se le cuele por
     detrás, y lo mismo al revés: elegir la madre las trae a todas. */
  function enLista(ids, catId) {
    if (!ids || !ids.length) return false;
    if (ids.indexOf(catId) >= 0) return true;
    var c = catExacta(catId);
    return !!(c && c.parentId && ids.indexOf(c.parentId) >= 0);
  }

  /* Si una categoría entra en este límite. Con «todas» entra todo; con
     «solo», nada más que las marcadas; con «salvo», todo menos ellas. */
  function afectaA(lim, categoryId) {
    if (lim.ambito === "solo") return enLista(lim.categoryIds, categoryId);
    if (lim.ambito === "salvo") return !enLista(lim.categoryIds, categoryId);
    return true;
  }

  /* Lo gastado contra un límite en un ciclo. txDeCiclo ya deja fuera lo
     que no es de este mes; aquí se quitan los traspasos, lo que sale de
     un apartado y lo que no entra en su ámbito. */
  function gastoDeLimite(lim, key) {
    var total = 0;
    txDeCiclo(key || cicloActual()).forEach(function (t) {
      if (t.kind !== "out") return;
      if (t.apartadoId) return;
      if (!afectaA(lim, t.categoryId)) return;
      total += t.amount;
    });
    return Math.round(total * 100) / 100;
  }

  /* Todo lo que hace falta para pintar un límite, de una vez. */
  function estadoDeLimite(id, key) {
    var lim = typeof id === "string" ? limitePorId(id) : id;
    if (!lim) return null;
    key = key || cicloActual();

    var importe = lim.importe;
    var gastado = gastoDeLimite(lim, key);
    var queda = Math.round((importe - gastado) * 100) / 100;
    var ratio = importe > 0 ? gastado / importe : 0;
    var pasado = ratio > 1;
    var cerca = !pasado && ratio >= CERCA;

    return {
      id: lim.id,
      key: key,
      name: lim.name,
      emoji: lim.emoji,
      color: lim.color,
      ambito: lim.ambito,
      limite: importe,
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

  /* La lista entera ya calculada, en el orden en que se crearon. */
  function estadoDeLimites(key) {
    key = key || cicloActual();
    return limites().map(function (l) { return estadoDeLimite(l, key); });
  }

  /* El que hay que mirar cuando solo cabe uno: el que va más apurado.
     De un vistazo lo que importa es qué está a punto de reventar, no el
     primero que se creó. */
  function limiteMasApurado(key) {
    var mejor = null;
    estadoDeLimites(key).forEach(function (e) {
      if (e.limite <= 0) return;
      if (!mejor || e.ratio > mejor.ratio) mejor = e;
    });
    return mejor;
  }

  /* ============================================================
     Las lecturas de arriba

     Los límites pueden solaparse —«todas» y «solo gasolina» a la vez—,
     así que sumar importes no da «lo presupuestado»: daría de más. Lo
     que sí es siempre cierto es cuánto has gastado de lo que TIENE
     tope, y eso es lo que se enseña.
     ============================================================ */

  /* Un gasto está cubierto si entra en al menos un límite. */
  function tieneTope(catId) {
    return limites().some(function (l) { return afectaA(l, catId); });
  }

  function resumenDeLimites(key) {
    key = key || cicloActual();
    var ests = estadoDeLimites(key);
    var conTope = 0, sinTope = 0;

    txDeCiclo(key).forEach(function (t) {
      if (t.kind !== "out" || t.apartadoId) return;
      if (tieneTope(t.categoryId)) conTope += t.amount;
      else sinTope += t.amount;
    });

    return {
      key: key,
      cuantos: ests.length,
      pasados: ests.filter(function (e) { return e.nivel === "pasado"; }).length,
      cerca: ests.filter(function (e) { return e.nivel === "cerca"; }).length,
      /* lo gastado que cae dentro de algún límite y lo que no. Sumar
         importes no valdría: dos límites pueden solaparse y la suma
         daría de más. Esto es cierto siempre. */
      conTope: Math.round(conTope * 100) / 100,
      sinTope: Math.round(sinTope * 100) / 100,
      base: plannedIncome()
    };
  }

  /* Lo que supone un límite sobre lo que entra, para la línea pequeña.
     Es una lectura, no el dato: el dato son los euros. */
  function pctDeLimite(lim) {
    var base = plannedIncome();
    if (!(base > 0)) return null;
    return Math.round((lim.importe / base) * 100);
  }

  /* Cómo se lee el ámbito de un límite en una línea. */
  function textoAmbito(lim) {
    var n = (lim.categoryIds || []).length;
    if (lim.ambito === "solo") {
      return n === 0 ? "sin categorías: no cuenta nada"
           : n === 1 ? "1 categoría" : n + " categorías";
    }
    if (lim.ambito === "salvo" && n) {
      return n === 1 ? "todo menos 1 categoría" : "todo menos " + n + " categorías";
    }
    return "todos los gastos";
  }

  /* La versión corta, para la fila de la lista: ahí solo hay una línea
     y lo que sobra se corta. Con una sola categoría se dice su nombre,
     que es más útil que «1 categoría» y ocupa lo mismo. */
  function textoAmbitoCorto(lim) {
    var ids = lim.categoryIds || [];
    var nombre = function () {
      var c = catExacta(ids[0]);
      return c ? c.name.toLowerCase() : "1 categoría";
    };
    if (lim.ambito === "solo") {
      return ids.length === 0 ? "nada"
           : ids.length === 1 ? "solo " + nombre()
           : "solo " + ids.length + " categorías";
    }
    if (lim.ambito === "salvo" && ids.length) {
      return ids.length === 1 ? "todo menos " + nombre()
                              : "todo menos " + ids.length;
    }
    return "todo";
  }

  /* --- lo que se lleva el espacio común --- */
  D.AMBITOS_LIMITE = AMBITOS;
  D.addLimite = addLimite;
  D.afectaA = afectaA;
  D.deleteLimite = deleteLimite;
  D.estadoDeLimite = estadoDeLimite;
  D.estadoDeLimites = estadoDeLimites;
  D.gastoDeLimite = gastoDeLimite;
  D.limiteMasApurado = limiteMasApurado;
  D.limitePorId = limitePorId;
  D.limites = limites;
  D.olvidarCategoria = olvidarCategoria;
  D.pctDeLimite = pctDeLimite;
  D.resumenDeLimites = resumenDeLimites;
  D.textoAmbitoCortoLimite = textoAmbitoCorto;
  D.textoAmbitoLimite = textoAmbito;
  D.tieneTope = tieneTope;
  D.updateLimite = updateLimite;
  D.vaciarLimites = vaciarLimites;
})();
