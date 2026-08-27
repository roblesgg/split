/* ============================================================
   split — las pruebas

   node tests/run.js

   Sin dependencias y sin navegador, igual que la app. Lo que hay aquí es
   la aritmética —ciclos, límites, apartados, calendario— y la migración,
   que es lo único que no tiene segunda oportunidad. Lo que se ve en
   pantalla se comprueba abriendo la app, que para eso se abre con doble
   clic.
   ============================================================ */

var t = require("./ayuda");

console.log("\nsplit — pruebas");

[["El ciclo", "./ciclo"],
 ["Límites de cuenta", "./limites"],
 ["Apartados", "./apartados"],
 ["Programados", "./programados"],
 ["Borrar una cuenta", "./cuentas"],
 ["El panel de cada cuenta", "./paneles"],
 ["La migración", "./migracion"]].forEach(function (par) {
  console.log("\n" + par[0]);
  console.log("─".repeat(par[0].length));
  require(par[1])();
});

process.exit(t.resumen() ? 1 : 0);
