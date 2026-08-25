/* ============================================================
   split — el comprobador

   Cuarenta líneas en vez de un framework, por lo mismo que la app no
   tiene dependencias: para correr las pruebas no debería hacer falta
   instalar nada. `node tests/run.js` y ya.
   ============================================================ */

var fallos = 0, pasadas = 0, seccion = "";

function grupo(nombre) {
  seccion = nombre;
  console.log("\n  " + nombre);
}

function es(que, real, esperado) {
  var ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (ok) {
    pasadas++;
    console.log("    ok   " + que);
  } else {
    fallos++;
    console.log("    NO   " + que);
    console.log("         esperaba  " + JSON.stringify(esperado));
    console.log("         y ha dado " + JSON.stringify(real));
  }
}

function resumen() {
  console.log("\n" + (fallos
    ? "  " + fallos + " fallos de " + (fallos + pasadas)
    : "  " + pasadas + " comprobaciones, todas bien"));
  return fallos;
}

/* Carga un archivo de la app como si fuera un <script>: le da un `window`
   de mentira y lo evalúa. Los archivos son scripts clásicos, así que esto
   es exactamente lo que hace el navegador. */
function cargar(rutas, win) {
  var fs = require("fs"), path = require("path");
  var raiz = path.join(__dirname, "..");
  global.window = win;
  rutas.forEach(function (r) {
    /* eslint-disable no-eval */
    eval(fs.readFileSync(path.join(raiz, r), "utf8"));
  });
  return win;
}

module.exports = { grupo: grupo, es: es, resumen: resumen, cargar: cargar };
