/* ============================================================
   split — recordatorios
   Sin build: script clásico, expone window.Avisos

   Hay trabajos en los que no se sabe lo que se va a cobrar hasta que se
   cobra. Para esos la app no apunta nada sola: avisa el día que toca y
   pregunta. El aviso tiene que llegar con la app cerrada, así que lo
   lleva la capa Android; aquí solo se decide QUÉ avisos hacen falta.

   La lista se manda entera cada vez que cambia algo. Actualizar avisos
   sueltos daría un estado que hay que conciliar, y no merece la pena para
   un puñado de alarmas: recalcular es más corto y no deja restos de
   programados que ya se borraron.
   ============================================================ */

(function () {
  "use strict";

  function plugin() {
    var P = window.Capacitor && window.Capacitor.Plugins;
    var R = P && P.Recordatorio;
    return (R && typeof R.programar === "function") ? R : null;
  }

  function hay() { return !!plugin(); }

  /* ¿Están permitidas las notificaciones ahora mismo? */
  function permitido() {
    var R = plugin();
    if (!R) return Promise.resolve(false);
    return R.disponible().then(function (r) { return !!(r && r.permitido); },
                               function () { return false; });
  }

  function pedirPermiso() {
    var R = plugin();
    if (!R || typeof R.pedirPermiso !== "function") return Promise.resolve(false);
    return R.pedirPermiso().then(function (r) { return !!(r && r.permitido); },
                                 function () { return false; });
  }

  /* Un programado mensual también avisa: se traduce su día del mes al día
     de la semana en que caiga el próximo, que es lo más cerca que se puede
     estar sin montar un calendario entero. Se recalcula en cada arranque,
     así que no se desfasa más de un mes. */
  function diasDe(r, S) {
    if (r.freq === "semanal") return S.diasDe(r);
    var proximo = S.nextDue(r);
    return [(proximo.getDay() + 6) % 7];
  }

  function textoDe(r, S) {
    if (r.tarifa > 0) {
      return "Dinos cuántas horas has echado y lo apuntamos.";
    }
    if (r.importeAbierto) {
      return "Dinos cuánto ha sido y lo apuntamos.";
    }
    return (r.kind === "in" ? "Hoy cobras " : "Hoy pagas ") + S.money(r.amount) + ".";
  }

  /* Recalcula y manda la lista. Se llama al arrancar y cada vez que se
     toca un programado. */
  function sincronizar(S) {
    var R = plugin();
    if (!R) return Promise.resolve(0);

    var avisos = (S.state.recurring || [])
      .filter(function (r) { return r.active && r.avisar; })
      .map(function (r) {
        return {
          id: r.id,
          titulo: r.note,
          texto: textoDe(r, S),
          dias: diasDe(r, S),
          hora: r.hora || "09:00"
        };
      });

    return R.programar({ avisos: avisos }).then(function (res) {
      return (res && res.programados) || 0;
    }, function () { return 0; });
  }

  window.Avisos = {
    hay: hay,
    permitido: permitido,
    pedirPermiso: pedirPermiso,
    sincronizar: sincronizar
  };
})();
