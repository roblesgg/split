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

  /* Tener permiso para notificar no basta: desde Android 12 la alarma
     puede ser «inexacta» y el sistema correrla horas para ahorrar
     batería. En un aviso de «hoy cobras, dime cuánto» eso es la
     diferencia entre servir y no servir.

     Se contesta { exactas, sePuedePedir }. En un móvil viejo, o si el
     plugin es de antes, se dice que sí: no había nada que conceder. */
  function alarmasExactas() {
    var R = plugin();
    if (!R || typeof R.alarmasExactas !== "function") {
      return Promise.resolve({ exactas: true, sePuedePedir: false });
    }
    return R.alarmasExactas().then(function (r) {
      return { exactas: !!(r && r.exactas), sePuedePedir: !!(r && r.sePuedePedir) };
    }, function () { return { exactas: true, sePuedePedir: false }; });
  }

  /* Lleva a la pantalla del sistema donde se conceden. No hay diálogo:
     Android obliga a pasar por ajustes. */
  function pedirAlarmasExactas() {
    var R = plugin();
    if (!R || typeof R.pedirAlarmasExactas !== "function") return Promise.resolve();
    return R.pedirAlarmasExactas().then(function () {}, function () {});
  }

  /* Un aviso se manda de una de dos formas, según lo que la capa Android
     sepa hacer con él:

     - `dias`: días de la semana. Android programa la alarma y la vuelve a
       poner sola cada siete días, así que sigue avisando aunque no abras
       la app en meses. Solo vale para lo que de verdad es semanal.
     - `fechas`: instantes concretos. Para todo lo demás —mensual, cada
       tres meses, cada dos semanas, diario— porque no hay ningún día de
       la semana que los describa. Se mandan las próximas ocho y se
       reponen cada vez que se abre la app.

     Antes todo iba por `dias`, y eso hacía que un recibo mensual avisara
     TODAS las semanas: Android reprogramaba a los siete días sin saber
     que aquello era mensual. */
  function porSemana(r) {
    return r.freq === "semanal" && (r.cada || 1) === 1;
  }

  function fechasDe(r, S) {
    var hora = (r.hora || "09:00").split(":");
    return S.proximasFechas(r, 8).map(function (d) {
      var f = new Date(d.getFullYear(), d.getMonth(), d.getDate(),
                       +hora[0] || 9, +hora[1] || 0, 0, 0);
      return f.getTime();
    }).filter(function (ts) { return ts > Date.now(); });
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
        var aviso = {
          id: r.id,
          titulo: r.note,
          texto: textoDe(r, S),
          hora: r.hora || "09:00"
        };
        if (porSemana(r)) aviso.dias = S.diasDe(r);
        else aviso.fechas = fechasDe(r, S);
        return aviso;
      });

    return R.programar({ avisos: avisos }).then(function (res) {
      return (res && res.programados) || 0;
    }, function () { return 0; });
  }

  window.Avisos = {
    hay: hay,
    permitido: permitido,
    pedirPermiso: pedirPermiso,
    alarmasExactas: alarmasExactas,
    pedirAlarmasExactas: pedirAlarmasExactas,
    sincronizar: sincronizar
  };
})();
