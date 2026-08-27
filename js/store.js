/* ============================================================
   split — la API que ve el resto de la app

   Un solo sitio donde mirar qué sabe hacer la capa de datos. Lo de
   dentro está repartido en js/core y js/data; aquí solo se nombra.
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;
  var CAT_COLORS = D.CAT_COLORS;
  var DEFAULT_CATEGORIES = D.DEFAULT_CATEGORIES, DOW_SHORT = D.DOW_SHORT;
  var EMOJI_SETS = D.EMOJI_SETS, MONTHS = D.MONTHS, MONTHS_SHORT = D.MONTHS_SHORT;
  var RESUMEN_POR_DEFECTO = D.RESUMEN_POR_DEFECTO, accountBalance = D.accountBalance;
  var accountUsage = D.accountUsage, addAccount = D.addAccount, addCategory = D.addCategory;
  var addGoal = D.addGoal, addGoalSaving = D.addGoalSaving, addMonths = D.addMonths;
  var addRecurring = D.addRecurring, addTag = D.addTag, addTx = D.addTx;
  var applyEmojiSet = D.applyEmojiSet, applyTheme = D.applyTheme;
  var averageExpense = D.averageExpense, averageIncome = D.averageIncome;
  var balance = D.balance, byCategory = D.byCategory, delCiclo = D.delCiclo;
  var catById = D.catById, catColorVar = D.catColorVar, catExacta = D.catExacta;
  var categoriasMadre = D.categoriasMadre, categories = D.categories, categoriesOf = D.categoriesOf;
  var categoryUsage = D.categoryUsage, clearAll = D.clearAll, confirmarPendiente = D.confirmarPendiente;
  var corregirSaldo = D.corregirSaldo, cuotasQueQuedan = D.cuotasQueQuedan;
  var dailySpend = D.dailySpend;
  var declaredIncome = D.declaredIncome, deleteAccount = D.deleteAccount;
  var deleteCategory = D.deleteCategory, deleteGoal = D.deleteGoal, deleteRecurring = D.deleteRecurring;
  var deleteTag = D.deleteTag, deleteTx = D.deleteTx, descartarPendiente = D.descartarPendiente;
  var diasDe = D.diasDe, dowMon = D.dowMon, esAbierto = D.esAbierto, esHija = D.esHija;
  var etiquetaResumen = D.etiquetaResumen, expenseShapeFraction = D.expenseShapeFraction;
  var exportJson = D.exportJson, getEmojiSet = D.getEmojiSet, getTheme = D.getTheme;
  var hasSavedState = D.hasSavedState, hijasDe = D.hijasDe, importJson = D.importJson;
  var load = D.load, mediaCobradaDe = D.mediaCobradaDe, mensualizar = D.mensualizar;
  var money = D.money, moneyShort = D.moneyShort;
  var nextDue = D.nextDue;
  var nombreLargo = D.nombreLargo, num2 = D.num2, parseYmd = D.parseYmd;
  var pct = D.pct, pendientes = D.pendientes, plannedIncome = D.plannedIncome;
  var projectedExpense = D.projectedExpense, raizDe = D.raizDe, recurringMonthly = D.recurringMonthly;
  var relDayLabel = D.relDayLabel;
  var fechaLarga = D.fechaLarga;
  var reset = D.reset, restoreTx = D.restoreTx;
  var resumenCfg = D.resumenCfg, runRecurring = D.runRecurring, save = D.save;
  var savingsRate = D.savingsRate, setEmojiSet = D.setEmojiSet;
  var setIncome = D.setIncome, setResumen = D.setResumen, setTheme = D.setTheme;
  var signed = D.signed, tagById = D.tagById, tagUsage = D.tagUsage, toggleRecurring = D.toggleRecurring;
  var topMerchants = D.topMerchants, totalesResumen = D.totalesResumen, totals = D.totals;
  var ciclo = D.ciclo, cicloActual = D.cicloActual, txDeCiclo = D.txDeCiclo;
  var diaDeCiclo = D.diaDeCiclo, diasDeCiclo = D.diasDeCiclo, diasCorridos = D.diasCorridos;
  var rangoDeCiclo = D.rangoDeCiclo, etiquetaCiclo = D.etiquetaCiclo, nombreCiclo = D.nombreCiclo;
  var diaDeCorte = D.diaDeCorte, setDiaDeCorte = D.setDiaDeCorte, esMesNatural = D.esMesNatural;
  var serieDeCiclos = D.serieDeCiclos, CICLO_DIA_MAX = D.Ciclo.DIA_MAX;
  var esDiario = D.esDiario, esSemanal = D.esSemanal;
  var cadaDe = D.cadaDe, tocaEn = D.tocaEn, proximasFechas = D.proximasFechas;
  /* El objetivo de gasto de una cuenta: mira de DÓNDE sale el dinero. */
  var objetivoDe = D.objetivoDe, setObjetivo = D.setObjetivo;
  var gastoDeCuenta = D.gastoDeCuenta, estadoDeObjetivo = D.estadoDeObjetivo;
  var cuentasConObjetivo = D.cuentasConObjetivo;

  /* Los límites del mes: miran EN QUÉ se va, sin importar la cuenta. */
  var addLimite = D.addLimite, updateLimite = D.updateLimite, deleteLimite = D.deleteLimite;
  var limites = D.limites, limitePorId = D.limitePorId, vaciarLimites = D.vaciarLimites;
  var estadoDeLimite = D.estadoDeLimite, estadoDeLimites = D.estadoDeLimites;
  var gastoDeLimite = D.gastoDeLimite, limiteMasApurado = D.limiteMasApurado;
  var resumenDeLimites = D.resumenDeLimites, pctDeLimite = D.pctDeLimite;
  var afectaA = D.afectaA, tieneTope = D.tieneTope;
  var textoAmbitoLimite = D.textoAmbitoLimite, AMBITOS_LIMITE = D.AMBITOS_LIMITE;
  var textoAmbitoCortoLimite = D.textoAmbitoCortoLimite;

  /* El panel de cada cuenta: qué bloques y en qué orden. */
  var panelDe = D.panelDe, setPanel = D.setPanel, resetPanel = D.resetPanel;
  var panelTocado = D.panelTocado, ponerBloque = D.ponerBloque;
  var quitarBloque = D.quitarBloque, moverBloque = D.moverBloque;
  var PANEL_TODAS = D.PANEL_TODAS;
  var addApartado = D.addApartado, updateApartado = D.updateApartado;
  var deleteApartado = D.deleteApartado, apartadoById = D.apartadoById;
  var apartadosDe = D.apartadosDe, apartados = D.apartados, aportar = D.aportar;
  var estadoDeApartado = D.estadoDeApartado, reservadoDe = D.reservadoDe;
  var apartadoParaGasto = D.apartadoParaGasto, rellenarApartados = D.rellenarApartados;
  var upcomingRecurring = D.upcomingRecurring, updateAccount = D.updateAccount;
  var updateCategory = D.updateCategory, updateGoal = D.updateGoal, updateRecurring = D.updateRecurring;
  var updateTx = D.updateTx, ymd = D.ymd;

  /* ============================================================
     API pública
     ============================================================ */

  window.Store = {
    /* estado */
    get state() { return D.state; },
    load: load, save: save, reset: reset, clearAll: clearAll,
    hasSavedState: hasSavedState,

    /* categorías: ya no son una lista fija, viven en el estado */
    get CATEGORIES() { return categories(); },
    catById: catById, catExacta: catExacta,
    categoriesOf: categoriesOf,
    catColorVar: catColorVar,
    CAT_COLORS: CAT_COLORS,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
    addCategory: addCategory, updateCategory: updateCategory,
    deleteCategory: deleteCategory, categoryUsage: categoryUsage,
    MONTHS: MONTHS,
    MONTHS_SHORT: MONTHS_SHORT,
    DOW_SHORT: DOW_SHORT,

    /* mutaciones */
    addTx: addTx, updateTx: updateTx, deleteTx: deleteTx, restoreTx: restoreTx,
    addGoalSaving: addGoalSaving,

    /* cuentas */
    addAccount: addAccount, updateAccount: updateAccount,
    deleteAccount: deleteAccount, accountUsage: accountUsage,

    /* Objetivo de gasto por cuenta, que se vacía al cerrar el ciclo.
       estadoDeObjetivo() trae de una vez todo lo que hay que pintar, o
       null si esa cuenta no tiene ninguno. */
    objetivoDe: objetivoDe, setObjetivo: setObjetivo,
    gastoDeCuenta: gastoDeCuenta, estadoDeObjetivo: estadoDeObjetivo,
    cuentasConObjetivo: cuentasConObjetivo,

    /* Los límites del mes: un tope con nombre y las categorías a las que
       mira. estadoDeLimite() trae de una vez lo que hay que pintar de
       uno, y estadoDeLimites() la lista entera, en su orden. */
    addLimite: addLimite, updateLimite: updateLimite, deleteLimite: deleteLimite,
    limites: limites, limitePorId: limitePorId, vaciarLimites: vaciarLimites,
    estadoDeLimite: estadoDeLimite, estadoDeLimites: estadoDeLimites,
    gastoDeLimite: gastoDeLimite, limiteMasApurado: limiteMasApurado,
    resumenDeLimites: resumenDeLimites, pctDeLimite: pctDeLimite,
    afectaA: afectaA, tieneTope: tieneTope,
    textoAmbitoLimite: textoAmbitoLimite, textoAmbitoCortoLimite: textoAmbitoCortoLimite,
    AMBITOS_LIMITE: AMBITOS_LIMITE,

    /* El Resumen es un panel de bloques y cada cuenta tiene el suyo.
       Aquí solo se guardan nombres y su orden: qué pinta cada bloque lo
       sabe la capa de pantallas, que es quien los registra. */
    panelDe: panelDe, setPanel: setPanel, resetPanel: resetPanel,
    panelTocado: panelTocado, ponerBloque: ponerBloque,
    quitarBloque: quitarBloque, moverBloque: moverBloque,
    PANEL_TODAS: PANEL_TODAS,

    /* Apartados: sub-bolsas dentro de una cuenta. El saldo no se guarda,
       se calcula, así que editar o borrar un gasto nunca lo descuadra. */
    get APARTADOS() { return apartados(); },
    addApartado: addApartado, updateApartado: updateApartado,
    deleteApartado: deleteApartado, apartadoById: apartadoById,
    apartadosDe: apartadosDe, aportar: aportar,
    estadoDeApartado: estadoDeApartado, reservadoDe: reservadoDe,
    apartadoParaGasto: apartadoParaGasto,
    rellenarApartados: rellenarApartados,

    /* etiquetas */
    addTag: addTag, tagById: tagById, deleteTag: deleteTag, tagUsage: tagUsage,

    /* categorías dentro de categorías */
    esHija: esHija, hijasDe: hijasDe, categoriasMadre: categoriasMadre,
    raizDe: raizDe, nombreLargo: nombreLargo,

    /* metas */
    addGoal: addGoal, updateGoal: updateGoal, deleteGoal: deleteGoal,

    /* programados */
    addRecurring: addRecurring, updateRecurring: updateRecurring,
    deleteRecurring: deleteRecurring, toggleRecurring: toggleRecurring,
    runRecurring: runRecurring, nextDue: nextDue,
    upcomingRecurring: upcomingRecurring, recurringMonthly: recurringMonthly,
    proximasFechas: proximasFechas,
    mensualizar: mensualizar, diasDe: diasDe, esAbierto: esAbierto,
    esDiario: esDiario, esSemanal: esSemanal, cadaDe: cadaDe, tocaEn: tocaEn,
    cuotasQueQuedan: cuotasQueQuedan,
    mediaCobradaDe: mediaCobradaDe,

    /* cola de confirmación */
    pendientes: pendientes,
    confirmarPendiente: confirmarPendiente,
    descartarPendiente: descartarPendiente,

    /* ingresos y reparto */
    corregirSaldo: corregirSaldo,

    /* las tres cifras del Resumen */
    resumenCfg: resumenCfg, setResumen: setResumen,
    totalesResumen: totalesResumen, etiquetaResumen: etiquetaResumen,
    RESUMEN_POR_DEFECTO: RESUMEN_POR_DEFECTO,

    plannedIncome: plannedIncome, setIncome: setIncome,
    averageIncome: averageIncome, declaredIncome: declaredIncome,

    /* El ciclo: el «mes» de la app, que empieza el día que diga el
       usuario. Con día 1 es el mes natural de toda la vida. */
    ciclo: ciclo,                     /* en qué ciclo cae una fecha */
    cicloActual: cicloActual,
    rangoDeCiclo: rangoDeCiclo,       /* { desde, hasta } */
    diasDeCiclo: diasDeCiclo,
    diaDeCiclo: diaDeCiclo,           /* por qué día del ciclo va una fecha */
    diasCorridos: diasCorridos,       /* cuánto llevas recorrido del ciclo */
    etiquetaCiclo: etiquetaCiclo,     /* «agosto 2026» o «25 ago – 24 sep» */
    nombreCiclo: nombreCiclo,         /* la versión de título, sin año */
    diaDeCorte: diaDeCorte, setDiaDeCorte: setDiaDeCorte,
    esMesNatural: esMesNatural,
    CICLO_DIA_MAX: CICLO_DIA_MAX,

    /* selectores */
    txDeCiclo: txDeCiclo,
    totals: totals,
    balance: balance,
    accountBalance: accountBalance,
    byCategory: byCategory, delCiclo: delCiclo,
    serieDeCiclos: serieDeCiclos,
    dailySpend: dailySpend,
    savingsRate: savingsRate,
    topMerchants: topMerchants,
    averageExpense: averageExpense,
    projectedExpense: projectedExpense,
    expenseShapeFraction: expenseShapeFraction,

    /* fechas y formato */
    ymd: ymd, parseYmd: parseYmd, addMonths: addMonths, dowMon: dowMon,
    relDayLabel: relDayLabel, fechaLarga: fechaLarga,
    money: money, moneyShort: moneyShort, signed: signed, pct: pct, num2: num2,

    /* tema */
    getTheme: getTheme, setTheme: setTheme, applyTheme: applyTheme,
    getEmojiSet: getEmojiSet, setEmojiSet: setEmojiSet,
    applyEmojiSet: applyEmojiSet, EMOJI_SETS: EMOJI_SETS,

    /* datos */
    exportJson: exportJson, importJson: importJson
  };

})();
