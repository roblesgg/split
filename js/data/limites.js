/* ============================================================
   split — límites de gasto

   Un límite es un tope con nombre: cuánto quieres gastar, en qué
   categorías, y cada cuánto se vacía. Una cuenta puede tener los que
   haga falta —«Gasto del mes» sin los préstamos, «Gasolina» solo con
   gasolina, «Caprichos» con tres categorías— y cada uno va a lo suyo.

   No es un tope duro: la app avisa, no bloquea. Bloquear haría que el
   gasto se apuntara en otro sitio, y entonces la app mentiría.

   CADA LÍMITE MANDA SOBRE LO SUYO. Un repostaje sube la barra de todos
   los límites que incluyan gasolina, y de ninguno más. Si no quieres que
   cuente dos veces, lo excluyes del general — que es explícito, se ve en
   su ficha y no hay que adivinar ninguna regla de prioridad.

   Lo que NUNCA cuenta, en ningún límite:

   - Los traspasos. Pasar dinero a tu propia hucha no es gastar, y no
     suma en ningún otro total de la app.
   - Lo que sale de un apartado. Ese dinero ya lo habías separado: si
     contara aquí lo estarías gastando dos veces, una contra su sobre y
     otra contra el límite.
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;
  var C = D.Ciclo;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function diaDeCorte() { return D.diaDeCorte.apply(null, arguments); }
  function diasEntre() { return D.diasEntre.apply(null, arguments); }
  function dowMon() { return D.dowMon.apply(null, arguments); }
  function etiquetaCiclo() { return D.etiquetaCiclo.apply(null, arguments); }
  function normalizeColor() { return D.normalizeColor.apply(null, arguments); }
  function parseYmd() { return D.parseYmd.apply(null, arguments); }
  function rangoDeCiclo() { return D.rangoDeCiclo.apply(null, arguments); }
  function save() { return D.save.apply(null, arguments); }
  function slugId() { return D.slugId.apply(null, arguments); }
  function ymd() { return D.ymd.apply(null, arguments); }

  /* Los mismos dos escalones que usan las barras del presupuesto, para
     que «al límite» signifique lo mismo en toda la app. */
  var CERCA = 0.85;

  var AMBITOS = ["todas", "solo", "salvo"];
  var MODOS = ["ciclo", "mes", "semana"];

  var DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes",
              "sábado", "domingo"];

  /* ============================================================
     La lista
     ============================================================ */

  function limites() {
    return Array.isArray(D.state.limites) ? D.state.limites : [];
  }

  function limitePorId(id) {
    return limites().find(function (l) { return l.id === id; }) || null;
  }

  function limitesDe(accId) {
    return limites().filter(function (l) { return l.accountId === accId; });
  }

  /* El que se enseña cuando solo cabe uno —la tarjeta del Resumen, la
     fila de Planes—: el general, si lo hay. «Cuánto me queda este mes» es
     lo que se viene a mirar, no el sub-tope de la gasolina. Sin ninguno
     general, el primero, que es el más viejo. */
  function limitePrincipalDe(accId) {
    var suyos = limitesDe(accId);
    if (!suyos.length) return null;
    return suyos.find(function (l) { return l.ambito !== "solo"; }) || suyos[0];
  }

  function normalizarAmbito(v) {
    return AMBITOS.indexOf(v) >= 0 ? v : "todas";
  }

  /* «Cada cuánto se vacía». De fábrica, con el mes de la app: quien no
     quiera pensarlo no tiene que tocarlo y todos sus límites cierran a
     la vez, que es lo que espera cualquiera. */
  function normalizarReinicio(r) {
    r = r || {};
    var modo = MODOS.indexOf(r.modo) >= 0 ? r.modo : "ciclo";
    if (modo === "mes") return { modo: "mes", dia: C.diaValido(r.dia) };
    if (modo === "semana") {
      var d = parseInt(r.dia, 10);
      return { modo: "semana", dia: (d >= 0 && d <= 6) ? d : 0 };
    }
    return { modo: "ciclo" };
  }

  function addLimite(data) {
    if (!Array.isArray(D.state.limites)) D.state.limites = [];
    var lim = {
      id: slugId("lim", data.name || "limite"),
      name: (data.name || "Límite").trim(),
      emoji: data.emoji || "🎯",
      color: normalizeColor(data.color != null ? data.color : 1),
      accountId: data.accountId,
      importe: Math.max(0, Math.round((+data.importe || 0) * 100) / 100),
      ambito: normalizarAmbito(data.ambito),
      categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds.slice() : [],
      reinicio: normalizarReinicio(data.reinicio)
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
    if (patch.importe != null) {
      lim.importe = Math.max(0, Math.round((+patch.importe || 0) * 100) / 100);
    }
    if (patch.ambito != null) lim.ambito = normalizarAmbito(patch.ambito);
    if (patch.categoryIds) lim.categoryIds = patch.categoryIds.slice();
    if (patch.reinicio) lim.reinicio = normalizarReinicio(patch.reinicio);
    save();
    return lim;
  }

  function deleteLimite(id) {
    D.state.limites = limites().filter(function (l) { return l.id !== id; });
    save();
    return { ok: true };
  }

  /* ============================================================
     Cuándo empieza y acaba el periodo en curso

     Tres formas de contar, una sola respuesta: dos fechas. Todo lo
     demás —lo gastado, los días que quedan, la etiqueta— sale de ahí,
     así que añadir una cuarta forma algún día es escribir un `if` aquí
     y nada más en toda la app.
     ============================================================ */

  function periodoDe(lim, hoy) {
    hoy = hoy || ymd(new Date());
    var r = normalizarReinicio(lim && lim.reinicio);

    if (r.modo === "semana") {
      /* Se retrocede hasta el día elegido: si hoy ES ese día, el periodo
         empieza hoy, no hace siete. */
      var d = parseYmd(hoy);
      var atras = (dowMon(d) - r.dia + 7) % 7;
      var ini = new Date(d.getFullYear(), d.getMonth(), d.getDate() - atras);
      var fin = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 6);
      return {
        desde: ymd(ini), hasta: ymd(fin), dias: 7,
        etiqueta: "Semana del " + ini.getDate(),
        cada: "semana"
      };
    }

    if (r.modo === "mes") {
      /* La misma matemática del ciclo, con otro día. Por eso vive suelta
         en core/dates y se le pasa el día en vez de leerlo de ahí. */
      var key = C.de(hoy, r.dia);
      var rango = C.rango(key, r.dia);
      return {
        desde: rango.desde, hasta: rango.hasta,
        dias: diasEntre(rango.desde, rango.hasta) + 1,
        etiqueta: C.etiqueta(key, "short", r.dia),
        cada: "mes"
      };
    }

    var kc = C.de(hoy, diaDeCorte());
    var rc = rangoDeCiclo(kc);
    return {
      desde: rc.desde, hasta: rc.hasta,
      dias: diasEntre(rc.desde, rc.hasta) + 1,
      etiqueta: etiquetaCiclo(kc, "short"),
      cada: "ciclo"
    };
  }

  /* ============================================================
     Qué gasto le toca a un límite
     ============================================================ */

  /* Si una categoría entra en este límite. Con «todas» entra todo; con
     «solo», nada más que las marcadas; con «salvo», todo menos ellas. */
  function afectaA(lim, categoryId) {
    var ids = lim.categoryIds || [];
    if (lim.ambito === "solo") return ids.indexOf(categoryId) >= 0;
    if (lim.ambito === "salvo") return ids.indexOf(categoryId) < 0;
    return true;
  }

  /* Un movimiento cuenta contra un límite si es un gasto de su cuenta,
     dentro del periodo, no sale de un apartado, y su categoría entra. */
  function cuenta(lim, t, per) {
    if (t.kind !== "out") return false;
    if (t.accountId !== lim.accountId) return false;
    if (t.apartadoId) return false;
    if (t.date < per.desde || t.date > per.hasta) return false;
    return afectaA(lim, t.categoryId);
  }

  function gastoDeLimite(lim, per) {
    per = per || periodoDe(lim);
    var total = 0;
    D.state.transactions.forEach(function (t) {
      if (cuenta(lim, t, per)) total += t.amount;
    });
    return Math.round(total * 100) / 100;
  }

  /* Todo lo que hace falta para pintar un límite, de una vez. */
  function estadoDeLimite(id, hoy) {
    var lim = typeof id === "string" ? limitePorId(id) : id;
    if (!lim) return null;

    var per = periodoDe(lim, hoy);
    var importe = lim.importe;
    var gastado = gastoDeLimite(lim, per);
    var queda = Math.round((importe - gastado) * 100) / 100;
    var ratio = importe > 0 ? gastado / importe : 0;
    var pasado = ratio > 1;
    var cerca = !pasado && ratio >= CERCA;

    var corridos = Math.min(per.dias, diasEntre(per.desde, hoy || ymd(new Date())) + 1);

    return {
      id: lim.id,
      name: lim.name,
      emoji: lim.emoji,
      color: lim.color,
      accountId: lim.accountId,
      ambito: lim.ambito,
      periodo: per,
      limite: importe,
      gastado: gastado,
      queda: queda,
      /* lo consumido, sin pasar de 100 para la barra */
      pct: Math.min(100, Math.round(ratio * 100)),
      /* lo que te queda, que es la cifra que se enseña grande */
      pctQueda: Math.max(0, Math.round((1 - ratio) * 100)),
      ratio: ratio,
      nivel: pasado ? "pasado" : cerca ? "cerca" : "ok",
      diasQuedan: Math.max(0, per.dias - Math.max(0, corridos))
    };
  }

  /* El de la tarjeta del Resumen y la fila de Planes, ya calculado. */
  function estadoPrincipalDe(accId, hoy) {
    var lim = limitePrincipalDe(accId);
    return lim ? estadoDeLimite(lim, hoy) : null;
  }

  function cuentasConLimite() {
    return D.state.accounts.filter(function (a) { return limitesDe(a.id).length > 0; });
  }

  /* Cómo se lee el ámbito de un límite en una línea. */
  function textoAmbito(lim) {
    var n = (lim.categoryIds || []).length;
    if (lim.ambito === "solo") {
      return n === 0 ? "sin categorías: no cuenta nada"
           : n === 1 ? "solo 1 categoría" : "solo " + n + " categorías";
    }
    if (lim.ambito === "salvo" && n) {
      return n === 1 ? "todo menos 1 categoría" : "todo menos " + n + " categorías";
    }
    return "todos los gastos";
  }

  /* Y cada cuánto se vacía, también en una línea. */
  function textoReinicio(lim) {
    var r = normalizarReinicio(lim.reinicio);
    if (r.modo === "semana") return "cada " + DIAS[r.dia];
    if (r.modo === "mes") return "cada día " + r.dia;
    return "con el mes de la app";
  }

  /* --- lo que se lleva el espacio común --- */
  D.AMBITOS_LIMITE = AMBITOS;
  D.DIAS_SEMANA = DIAS;
  D.addLimite = addLimite;
  D.afectaA = afectaA;
  D.cuentasConLimite = cuentasConLimite;
  D.deleteLimite = deleteLimite;
  D.estadoDeLimite = estadoDeLimite;
  D.estadoPrincipalDe = estadoPrincipalDe;
  D.gastoDeLimite = gastoDeLimite;
  D.limitePorId = limitePorId;
  D.limitePrincipalDe = limitePrincipalDe;
  D.limites = limites;
  D.limitesDe = limitesDe;
  D.periodoDeLimite = periodoDe;
  D.textoAmbitoLimite = textoAmbito;
  D.textoReinicioLimite = textoReinicio;
  D.updateLimite = updateLimite;
})();
