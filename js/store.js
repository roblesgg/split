/* ============================================================
   split — la API que ve el resto de la app

   Un solo sitio donde mirar qué sabe hacer la capa de datos. Lo de
   dentro está repartido en js/core y js/data; aquí solo se nombra.
   ============================================================ */

(function () {
  "use strict";

  var D = window.Datos;
  var CAT_COLORS = D.CAT_COLORS, DEFAULT_ALLOCATION = D.DEFAULT_ALLOCATION;
  var DEFAULT_CATEGORIES = D.DEFAULT_CATEGORIES, DOW_SHORT = D.DOW_SHORT;
  var EMOJI_SETS = D.EMOJI_SETS, MONTHS = D.MONTHS, MONTHS_SHORT = D.MONTHS_SHORT;
  var RESUMEN_POR_DEFECTO = D.RESUMEN_POR_DEFECTO, accountBalance = D.accountBalance;
  var accountUsage = D.accountUsage, addAccount = D.addAccount, addCategory = D.addCategory;
  var addGoal = D.addGoal, addGoalSaving = D.addGoalSaving, addMonths = D.addMonths;
  var addRecurring = D.addRecurring, addTag = D.addTag, addTx = D.addTx;
  var allocationSum = D.allocationSum, applyEmojiSet = D.applyEmojiSet, applyTheme = D.applyTheme;
  var averageExpense = D.averageExpense, averageIncome = D.averageIncome;
  var balance = D.balance, budgetFor = D.budgetFor, budgetTotal = D.budgetTotal;
  var budgetedCategories = D.budgetedCategories, byCategory = D.byCategory;
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
  var relDayLabel = D.relDayLabel, removeAllocation = D.removeAllocation;
  var fechaLarga = D.fechaLarga;
  var reset = D.reset, resetAllocation = D.resetAllocation, restoreTx = D.restoreTx;
  var resumenCfg = D.resumenCfg, runRecurring = D.runRecurring, save = D.save;
  var savingsPct = D.savingsPct, savingsRate = D.savingsRate, setAllocation = D.setAllocation;
  var allocationPct = D.allocationPct, allocationSumPct = D.allocationSumPct;
  var savingsPctRedondo = D.savingsPctRedondo;
  var setAllocationEuros = D.setAllocationEuros, setEmojiSet = D.setEmojiSet;
  var setIncome = D.setIncome, setResumen = D.setResumen, setTheme = D.setTheme;
  var signed = D.signed, tagById = D.tagById, tagUsage = D.tagUsage, toggleRecurring = D.toggleRecurring;
  var topMerchants = D.topMerchants, totalesResumen = D.totalesResumen, totals = D.totals;
  var unbudgetedCategories = D.unbudgetedCategories;
  var ciclo = D.ciclo, cicloActual = D.cicloActual, txDeCiclo = D.txDeCiclo;
  var diaDeCiclo = D.diaDeCiclo, diasDeCiclo = D.diasDeCiclo, diasCorridos = D.diasCorridos;
  var rangoDeCiclo = D.rangoDeCiclo, etiquetaCiclo = D.etiquetaCiclo, nombreCiclo = D.nombreCiclo;
  var diaDeCorte = D.diaDeCorte, setDiaDeCorte = D.setDiaDeCorte, esMesNatural = D.esMesNatural;
  var serieDeCiclos = D.serieDeCiclos, CICLO_DIA_MAX = D.Ciclo.DIA_MAX;
  var esDiario = D.esDiario, esSemanal = D.esSemanal;
  var cadaDe = D.cadaDe, tocaEn = D.tocaEn, proximasFechas = D.proximasFechas;
  var addLimite = D.addLimite, updateLimite = D.updateLimite, deleteLimite = D.deleteLimite;
  var limites = D.limites, limitesDe = D.limitesDe, limitePorId = D.limitePorId;
  var limitePrincipalDe = D.limitePrincipalDe, estadoPrincipalDe = D.estadoPrincipalDe;
  var gastoDeLimite = D.gastoDeLimite, estadoDeLimite = D.estadoDeLimite;
  var periodoDeLimite = D.periodoDeLimite, afectaA = D.afectaA;
  var cuentasConLimite = D.cuentasConLimite;
  var textoAmbitoLimite = D.textoAmbitoLimite, textoReinicioLimite = D.textoReinicioLimite;
  var AMBITOS_LIMITE = D.AMBITOS_LIMITE, DIAS_SEMANA = D.DIAS_SEMANA;
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

    /* Topes de gasto con nombre. Una cuenta puede tener los que haga
       falta, cada uno con su ámbito de categorías y su reinicio.
       estadoDeLimite() trae de una vez todo lo que hay que pintar, y
       estadoPrincipalDe() el de la cuenta cuando solo cabe uno. */
    addLimite: addLimite, updateLimite: updateLimite, deleteLimite: deleteLimite,
    limites: limites, limitesDe: limitesDe, limitePorId: limitePorId,
    limitePrincipalDe: limitePrincipalDe, estadoPrincipalDe: estadoPrincipalDe,
    gastoDeLimite: gastoDeLimite, estadoDeLimite: estadoDeLimite,
    periodoDeLimite: periodoDeLimite, afectaA: afectaA,
    cuentasConLimite: cuentasConLimite,
    textoAmbitoLimite: textoAmbitoLimite, textoReinicioLimite: textoReinicioLimite,
    AMBITOS_LIMITE: AMBITOS_LIMITE, DIAS_SEMANA: DIAS_SEMANA,

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
    allocationSum: allocationSum, savingsPct: savingsPct,
    setAllocation: setAllocation, resetAllocation: resetAllocation,
    /* El porcentaje se guarda con decimales para que los euros no se
       muevan solos; estos tres son los que se pintan. */
    allocationPct: allocationPct, allocationSumPct: allocationSumPct,
    savingsPctRedondo: savingsPctRedondo,
    setAllocationEuros: setAllocationEuros, removeAllocation: removeAllocation,
    unbudgetedCategories: unbudgetedCategories,
    budgetedCategories: budgetedCategories,
    budgetFor: budgetFor, budgetTotal: budgetTotal,
    DEFAULT_ALLOCATION: DEFAULT_ALLOCATION,

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
    byCategory: byCategory,
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
