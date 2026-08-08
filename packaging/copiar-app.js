/* Copia la app (index.html, css/, js/) a packaging/www, que es lo que
   Capacitor mete dentro del APK.

   La app vive un nivel más arriba y no sabe nada de esto: sigue siendo
   HTML/CSS/JS que se abre con doble clic. Este script solo la duplica. */

const fs = require("fs");
const path = require("path");

const APP = path.resolve(__dirname, "..");
const WWW = path.join(__dirname, "www");

const INCLUIR = ["index.html", "css", "js"];

function copiar(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const nombre of fs.readdirSync(src)) {
      copiar(path.join(src, nombre), path.join(dst, nombre));
    }
  } else {
    fs.copyFileSync(src, dst);
  }
}

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

let n = 0;
for (const item of INCLUIR) {
  const src = path.join(APP, item);
  if (!fs.existsSync(src)) {
    console.error("Falta " + item + " en " + APP);
    process.exit(1);
  }
  copiar(src, path.join(WWW, item));
  n++;
}

/* recuento para saber que se copió lo que tocaba */
function contar(dir) {
  let c = 0;
  for (const nombre of fs.readdirSync(dir)) {
    const p = path.join(dir, nombre);
    c += fs.statSync(p).isDirectory() ? contar(p) : 1;
  }
  return c;
}

console.log("Copiados " + n + " elementos (" + contar(WWW) + " archivos) a www/");
