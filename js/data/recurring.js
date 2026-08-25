/* ============================================================
   split — pagos y cobros programados
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;

  /* Puentes a lo que vive en otro archivo. Se resuelven en la llamada,
     así que da igual el orden en que se carguen los scripts. */
  function addMonths() { return D.addMonths.apply(null, arguments); }
  function currentMonthKey() { return D.currentMonthKey.apply(null, arguments); }
  function daysInMonth() { return D.daysInMonth.apply(null, arguments); }
  function dowMon() { return D.dowMon.apply(null, arguments); }
  function monthKey() { return D.monthKey.apply(null, arguments); }
  function nextId() { return D.nextId.apply(null, arguments); }
  function normalizeTime() { return D.normalizeTime.apply(null, arguments); }
  function parseYmd() { return D.parseYmd.apply(null, arguments); }
  function pendientes() { return D.pendientes.apply(null, arguments); }
  function save() { return D.save.apply(null, arguments); }
  function slugId() { return D.slugId.apply(null, arguments); }
  function sortTx() { return D.sortTx.apply(null, arguments); }
  function ymd() { return D.ymd.apply(null, arguments); }

  /* ============================================================
     Pagos y cobros programados
     ============================================================ */

  function addRecurring(data) {
    var r = {
      id: slugId("rec", data.note || "programado"),
      kind: data.kind === "in" ? "in" : data.kind === "transfer" ? "transfer" : "out",
      amount: Math.max(0, Math.round((+data.amount || 0) * 100) / 100),
      categoryId: data.categoryId || "otros",
      accountId: data.accountId || D.state.accounts[0].id,
      toAccountId: data.kind === "transfer" ? (data.toAccountId || null) : null,
      note: (data.note || "").trim() || "Programado",
      day: Math.min(28, Math.max(1, parseInt(data.day, 10) || 1)),
      freq: data.freq === "semanal" ? "semanal" : "mensual",
      /* lunes = 0, igual que dowMon. Varios, que hay trabajos de martes
         y jueves. */
      weekdays: normalizarDias(data.weekdays, parseInt(data.weekday, 10) || 0),
      /* 14 pagas solo tiene sentido en un ingreso mensual */
      pagas: (data.kind === "in" && +data.pagas === 14) ? 14 : 12,
      confirmar: !!data.confirmar,

      /* Sin importe fijo: el sueldo depende de las horas, así que no se
         apunta nada solo, se pregunta. */
      importeAbierto: !!data.importeAbierto,
      /* Si además se cobra por horas, se pregunta cuántas y multiplica. */
      tarifa: data.tarifa != null && +data.tarifa > 0
        ? Math.round((+data.tarifa) * 100) / 100 : null,

      /* Recordatorio: a qué hora avisar el día que toca. */
      hora: normalizeTime(data.hora) || "09:00",
      avisar: !!data.avisar,

      /* Un préstamo no es para siempre: son doce letras y se acabó. Con
         `cuotas` puestas, el programado se apaga solo al llegar y deja de
         contar en lo que compromete al mes. `pagadas` lleva la cuenta. */
      cuotas: data.cuotas != null && +data.cuotas > 0
        ? Math.min(600, Math.round(+data.cuotas)) : null,
      pagadas: 0,


      active: data.active !== false,
      /* Mensual arranca en el mes anterior, para que el de este mes se
         apunte en cuanto llegue su día. Semanal arranca hoy, para que la
         primera vez sea el próximo día de la semana elegido y no se
         apunten de golpe semanas ya pasadas.

         `yaHecho` es para cuando el programado nace de un movimiento que
         se acaba de apuntar: el de este periodo ya está puesto, así que
         se marca como hecho y el siguiente será el que toque. */
      lastPosted: data.yaHecho ? currentMonthKey() : addMonths(currentMonthKey(), -1),
      lastDate: ymd(data.desde ? parseYmd(data.desde) : new Date())
    };
    D.state.recurring.push(r);
    save();
    return r;
  }

  function updateRecurring(id, patch) {
    var r = D.state.recurring.find(function (x) { return x.id === id; });
    if (!r) return null;
    if (patch.note != null) r.note = String(patch.note).trim() || r.note;
    if (patch.kind != null) {
      r.kind = patch.kind;
      if (r.kind !== "transfer") r.toAccountId = null;
    }
    if (patch.amount != null) r.amount = Math.max(0, Math.round((+patch.amount || 0) * 100) / 100);
    if (patch.categoryId != null) r.categoryId = patch.categoryId;
    if (patch.accountId != null) r.accountId = patch.accountId;
    if (patch.toAccountId !== undefined) r.toAccountId = patch.toAccountId;
    if (patch.day != null) r.day = Math.min(28, Math.max(1, parseInt(patch.day, 10) || 1));
    if (patch.freq != null) {
      var nueva = patch.freq === "semanal" ? "semanal" : "mensual";
      /* Cambiar de ritmo empieza de cero: si no, al pasar a semanal se
         apuntarían de golpe todas las semanas desde una fecha vieja. */
      if (nueva !== r.freq) {
        r.freq = nueva;
        r.lastDate = ymd(new Date());
        r.lastPosted = currentMonthKey();
      }
    }
    if (patch.weekdays != null) {
      r.weekdays = normalizarDias(patch.weekdays, diasDe(r)[0]);
      delete r.weekday;
    }
    if (patch.pagas != null) r.pagas = (r.kind === "in" && +patch.pagas === 14) ? 14 : 12;
    if (patch.confirmar != null) r.confirmar = !!patch.confirmar;
    if (patch.importeAbierto != null) r.importeAbierto = !!patch.importeAbierto;
    if (patch.tarifa !== undefined) {
      r.tarifa = patch.tarifa != null && +patch.tarifa > 0
        ? Math.round((+patch.tarifa) * 100) / 100 : null;
    }
    if (patch.hora != null) r.hora = normalizeTime(patch.hora) || r.hora || "09:00";
    if (patch.avisar != null) r.avisar = !!patch.avisar;
    if (patch.cuotas !== undefined) {
      r.cuotas = patch.cuotas != null && +patch.cuotas > 0
        ? Math.min(600, Math.round(+patch.cuotas)) : null;
      if (r.cuotas == null) r.pagadas = 0;
    }
    if (patch.active != null) r.active = !!patch.active;
    save();
    return r;
  }

  function deleteRecurring(id) {
    D.state.recurring = D.state.recurring.filter(function (r) { return r.id !== id; });
    save();
  }

  function toggleRecurring(id) {
    var r = D.state.recurring.find(function (x) { return x.id === id; });
    if (!r) return null;
    r.active = !r.active;
    save();
    return r;
  }

  function dateOfMonth(monthKeyStr, day) {
    var p = monthKeyStr.split("-");
    return new Date(+p[0], +p[1] - 1, Math.min(day, daysInMonth(monthKeyStr)));
  }

  /* Apunta los programados que ya han vencido, mes a mes desde el último
     apuntado hasta hoy. Se llama al arrancar la app. */
  /* ---------- cuándo toca ----------
     Mensual: el día del mes elegido, con la salvedad de que un ingreso de
     14 pagas añade una extra en junio y en diciembre, que es como se
     reparten aquí.
     Semanal: el día de la semana elegido, cada siete días. */

  function esSemanal(r) { return r.freq === "semanal"; }

  /* Los días de la semana en los que toca. Antes era uno solo; ahora son
     varios, porque hay trabajos de martes y jueves. Se acepta lo viejo
     para no romper lo que ya estaba guardado. */
  function diasDe(r) {
    if (Array.isArray(r.weekdays) && r.weekdays.length) {
      return r.weekdays.slice().sort(function (a, b) { return a - b; });
    }
    return [Math.min(6, Math.max(0, parseInt(r.weekday, 10) || 0))];
  }

  function normalizarDias(lista, respaldo) {
    var vistos = {}, out = [];
    (Array.isArray(lista) ? lista : []).forEach(function (d) {
      var n = parseInt(d, 10);
      if (!isFinite(n) || n < 0 || n > 6 || vistos[n]) return;
      vistos[n] = true;
      out.push(n);
    });
    if (!out.length) out = [respaldo == null ? 0 : respaldo];
    return out.sort(function (a, b) { return a - b; });
  }

  /* Un programado «de importe abierto» no apunta nada por su cuenta: solo
     avisa de que toca y pregunta cuánto ha sido. Es lo que hace falta
     cuando el sueldo depende de las horas que se acaben echando. */
  function esAbierto(r) { return !!r.importeAbierto; }

  /* Fechas pendientes desde la última apuntada hasta hoy, sin incluir
     futuras. Devuelve [{ fecha: Date, extra: bool }]. */
  function vencimientos(r, hasta) {
    var out = [];
    var guard = 0;

    if (esSemanal(r)) {
      var dias = diasDe(r);
      var desde = r.lastDate ? parseYmd(r.lastDate) : new Date();
      var d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
      /* día a día desde el siguiente al último apuntado: con varios días
         elegidos ya no vale saltar de siete en siete */
      d.setDate(d.getDate() + 1);
      while (d <= hasta && guard++ < 400) {
        if (dias.indexOf(dowMon(d)) >= 0) out.push({ fecha: new Date(d), extra: false });
        d.setDate(d.getDate() + 1);
      }
      return out;
    }

    var cur = currentMonthKey();
    var m = r.lastPosted ? addMonths(r.lastPosted, 1) : cur;
    while (m <= cur && guard++ < 120) {
      var fecha = dateOfMonth(m, r.day);
      if (fecha > hasta) break;
      out.push({ fecha: fecha, extra: false });
      /* la paga extra cae el mismo día, en junio y en diciembre */
      if (r.kind === "in" && +r.pagas === 14) {
        var mes = +m.split("-")[1];
        if (mes === 6 || mes === 12) out.push({ fecha: fecha, extra: true });
      }
      m = addMonths(m, 1);
    }
    return out;
  }

  /* Marca hasta dónde se ha llegado, para no repetir. */
  function anotarUltimo(r, fecha) {
    if (esSemanal(r)) r.lastDate = ymd(fecha);
    else r.lastPosted = monthKey(ymd(fecha));
  }

  function movimientoDe(r, fecha, extra) {
    return {
      /* La tarifa viaja con el movimiento pendiente para que al
         confirmarlo se puedan pedir horas en vez de euros aunque
         entretanto se haya cambiado el programado. */
      tarifa: r.tarifa || null,
      id: nextId(),
      createdAt: Date.now(),
      date: ymd(fecha),
      time: r.hora || "",
      kind: r.kind,
      categoryId: r.categoryId,
      accountId: r.accountId,
      toAccountId: r.kind === "transfer" ? r.toAccountId : null,
      amount: r.amount,
      note: extra ? r.note + " (paga extra)" : r.note,
      memo: "",
      tags: [],
      attachments: [],
      fromRecurring: r.id
    };
  }

  /* Apunta lo vencido. Lo que pida confirmación no se apunta: se deja en
     la cola de pendientes para preguntar el importe al abrir la app, que
     un sueldo casi nunca cae clavado. */
  function runRecurring() {
    if (!Array.isArray(D.state.recurring)) D.state.recurring = [];
    if (!Array.isArray(D.state.pendientes)) D.state.pendientes = [];

    var hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    var puestos = 0, encolados = 0;

    D.state.recurring.forEach(function (r) {
      if (!r.active) return;
      vencimientos(r, hoy).forEach(function (v) {
        /* Con las cuotas contadas, al llegar a la última se apaga y no se
           apunta ninguna más. Se apaga en vez de borrarse: el histórico y
           lo ya apuntado siguen ahí, y se puede reactivar. */
        if (r.cuotas && (r.pagadas || 0) >= r.cuotas) {
          r.active = false;
          return;
        }

        var mov = movimientoDe(r, v.fecha, v.extra);
        /* Sin importe fijo no hay nada que apuntar todavía: se pregunta
           siempre, aunque no se haya marcado «preguntarme el importe». */
        if (r.confirmar || esAbierto(r)) {
          D.state.pendientes.push(mov);
          encolados++;
        } else {
          D.state.transactions.push(mov);
          puestos++;
        }
        if (r.cuotas) r.pagadas = (r.pagadas || 0) + 1;
        anotarUltimo(r, v.fecha);
      });

      /* si esa era la última, se apaga ya y no espera al mes que viene */
      if (r.cuotas && (r.pagadas || 0) >= r.cuotas) r.active = false;
    });

    if (puestos || encolados) { sortTx(); save(); }
    return puestos;
  }


  /* --- lo que se lleva el espacio común --- */
  D.addRecurring = addRecurring;
  D.dateOfMonth = dateOfMonth;
  D.deleteRecurring = deleteRecurring;
  D.diasDe = diasDe;
  D.esAbierto = esAbierto;
  D.esSemanal = esSemanal;
  D.runRecurring = runRecurring;
  D.toggleRecurring = toggleRecurring;
  D.updateRecurring = updateRecurring;
})();
