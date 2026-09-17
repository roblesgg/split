/* ============================================================
   split — genera js/iconos.js a partir de Lucide

   node herramientas/iconos.js <carpeta de lucide-static>

   La app no tiene build: esto no corre nunca al abrirla ni al compilar
   el APK. Se ejecuta a mano cuando se quiere subir de versión la
   librería, y lo que se publica es su resultado, `js/iconos.js`, que es
   un script clásico más.

   Qué hace:

   - Coge los 2.100 SVG de Lucide y se queda solo con lo de dentro del
     <svg>: el envoltorio lo pone icon(), que es quien decide tamaño y
     grosor. Así los de fuera y los de casa se dibujan igual.
   - Los reparte en grupos por tema, mirando el nombre y las etiquetas
     que trae la propia librería. Un icono sin tema se queda fuera: dos
     mil iconos sin ordenar no son una ayuda, son un montón.
   - Les pega palabras en español. Lucide está en inglés y la app no:
     sin esto, buscar «coche» no encontraría `car`.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const ORIGEN = process.argv[2];
if (!ORIGEN) {
  console.error("Uso: node herramientas/iconos.js <carpeta de lucide-static>");
  process.exit(1);
}

/* ---------- los temas, y por qué palabra entra cada icono ----------
   El orden manda: un icono cae en el primer tema que lo reclame, así
   que los más específicos van antes. */
const TEMAS = [
  ["dinero", "Dinero", ["wallet", "coin", "banknote", "money", "currency", "dollar",
    "euro", "pound", "yen", "bitcoin", "credit-card", "piggy", "bank", "landmark",
    "receipt", "invoice", "safe", "vault", "gem", "diamond", "hand-coins", "payment",
    "finance", "percent", "calculator", "chart-no", "badge-euro", "badge-dollar",
    "circle-dollar", "circle-euro", "square-euro", "square-dollar", "trending"]],
  ["compras", "Compras", ["shopping", "cart", "basket", "bag", "store", "tag", "gift",
    "package", "box", "barcode", "scan", "shirt", "shoe", "glasses", "watch", "ticket",
    "sale", "discount"]],
  ["comida", "Comida", ["utensils", "food", "pizza", "burger", "sandwich", "coffee",
    "cup", "beer", "wine", "martini", "milk", "egg", "apple", "banana", "cherry",
    "grape", "carrot", "salad", "soup", "ice-cream", "cake", "cookie", "croissant",
    "donut", "popcorn", "fish", "beef", "ham", "drumstick", "wheat", "chef", "restaurant",
    "bottle", "candy", "dessert", "vegan", "bread"]],
  ["casa", "Casa", ["home", "house", "door", "bed", "sofa", "lamp", "shower", "bath",
    "toilet", "washing", "refrigerator", "microwave", "cooking", "blinds", "armchair",
    "key", "plug", "lightbulb", "droplet", "flame", "heater", "fan", "trash", "brush",
    "hammer", "wrench", "drill", "paint", "ruler", "construction"]],
  ["transporte", "Transporte", ["car", "bus", "train", "tram", "bike", "bicycle",
    "motorcycle", "truck", "taxi", "fuel", "parking", "traffic", "road", "ship",
    "sailboat", "anchor", "scooter", "caravan", "ambulance", "forklift", "tractor",
    "helicopter", "rocket", "plane"]],
  ["viajes", "Viajes", ["plane", "luggage", "suitcase", "map", "compass", "globe",
    "mountain", "tent", "palm", "beach", "hotel", "passport", "backpack", "camping",
    "navigation", "pin", "signpost", "waypoint", "route", "landmark", "ferris"]],
  ["ocio", "Ocio", ["music", "guitar", "piano", "drum", "headphones", "film", "clapper",
    "video", "tv", "gamepad", "dice", "puzzle", "book", "library", "camera", "image",
    "palette", "paintbrush", "theater", "party", "cake", "sparkle", "star", "trophy",
    "medal", "award", "ticket", "popcorn", "radio", "podcast", "mic", "disc", "play"]],
  ["deporte", "Deporte", ["dumbbell", "bike", "run", "footprints", "activity", "heart-pulse",
    "volleyball", "football", "basketball", "tennis", "goal", "target", "swim", "ski",
    "waves", "timer", "stopwatch", "flag"]],
  ["salud", "Salud", ["heart", "pill", "syringe", "stethoscope", "hospital", "cross",
    "bandage", "thermometer", "brain", "tooth", "eye", "ear", "bone", "dna", "microscope",
    "accessibility", "baby", "person-standing", "leaf", "shield-plus"]],
  ["trabajo", "Trabajo", ["briefcase", "building", "office", "factory", "warehouse",
    "clipboard", "file", "folder", "printer", "paperclip", "pen", "pencil", "notebook",
    "graduation", "school", "presentation", "chart", "table", "calendar", "clock",
    "alarm", "mail", "inbox", "send", "phone", "contact", "id-card", "badge", "stamp",
    "scale", "gavel", "handshake", "users", "user", "network", "workflow"]],
  ["tecnologia", "Tecnología", ["smartphone", "laptop", "monitor", "computer", "tablet",
    "keyboard", "mouse", "server", "database", "hard-drive", "cpu", "memory", "wifi",
    "bluetooth", "signal", "battery", "power", "usb", "cable", "router", "cloud",
    "download", "upload", "lock", "unlock", "shield", "key-round", "fingerprint",
    "qr", "bot", "code", "terminal", "bug", "satellite", "antenna", "webcam",
    "speaker", "projector", "watch", "gauge"]],
  ["naturaleza", "Naturaleza", ["sun", "moon", "cloud", "rain", "snow", "wind", "storm",
    "umbrella", "rainbow", "thermometer", "tree", "flower", "sprout", "leaf", "seedling",
    "bug", "bird", "cat", "dog", "rabbit", "squirrel", "turtle", "fish", "paw", "shell",
    "earth", "sunrise", "sunset", "star", "sparkles", "recycle", "trees"]],
  ["simbolos", "Símbolos", ["circle", "square", "triangle", "hexagon", "diamond", "shapes",
    "heart", "star", "bookmark", "flag", "bell", "smile", "frown", "meh", "thumbs",
    "check", "x", "plus", "minus", "info", "help", "alert", "ban", "eye", "zap",
    "infinity", "asterisk", "hash", "at-sign", "quote", "sigma", "pi", "omega"]]
];

/* ---------- palabras en español ----------
   No es un diccionario completo, es lo que uno teclearía buscando el
   icono de una cuenta o de un gasto. Lo que no esté aquí se sigue
   encontrando por su nombre en inglés, que es el id. */
const ES = {
  wallet: "cartera monedero", coins: "monedas dinero", coin: "moneda",
  banknote: "billete dinero", "piggy-bank": "hucha ahorro", landmark: "banco edificio",
  "credit-card": "tarjeta credito", receipt: "recibo ticket factura",
  vault: "caja fuerte", gem: "joya diamante gema", "hand-coins": "pagar dinero",
  calculator: "calculadora cuentas", percent: "porcentaje",
  euro: "euro", "badge-euro": "euro", "circle-dollar-sign": "dinero",
  "shopping-cart": "carrito compra", "shopping-bag": "bolsa compra",
  "shopping-basket": "cesta compra", store: "tienda comercio", tag: "etiqueta precio",
  gift: "regalo", package: "paquete envio", shirt: "ropa camiseta",
  footprints: "pasos andar", glasses: "gafas", watch: "reloj",
  utensils: "comida restaurante cubiertos", "utensils-crossed": "comida restaurante",
  pizza: "pizza", beef: "carne", sandwich: "bocadillo sandwich",
  coffee: "cafe", "cup-soda": "refresco bebida", beer: "cerveza", wine: "vino",
  martini: "copa bebida", milk: "leche", egg: "huevo", apple: "manzana fruta",
  banana: "platano fruta", cherry: "cereza fruta", grape: "uva fruta",
  carrot: "zanahoria verdura", salad: "ensalada", soup: "sopa",
  "ice-cream-cone": "helado", "ice-cream-bowl": "helado", cake: "tarta pastel",
  "cake-slice": "tarta", cookie: "galleta", croissant: "cruasan desayuno",
  donut: "donut", popcorn: "palomitas cine", fish: "pescado", ham: "jamon",
  drumstick: "pollo carne", wheat: "trigo pan", "chef-hat": "cocina chef",
  "candy": "chuches dulce", home: "casa hogar", house: "casa hogar",
  "door-open": "puerta", bed: "cama dormir", sofa: "sofa salon", lamp: "lampara luz",
  "shower-head": "ducha bano", "bath": "bano banera", "toilet": "bano wc",
  "washing-machine": "lavadora", refrigerator: "nevera frigorifico",
  microwave: "microondas", "cooking-pot": "olla cocina", "key": "llave",
  "key-round": "llave", plug: "enchufe luz", "plug-zap": "luz electricidad",
  lightbulb: "bombilla luz", droplet: "agua gota", droplets: "agua",
  flame: "gas fuego", "trash-2": "basura", hammer: "martillo obra",
  wrench: "llave arreglo", "paint-roller": "pintura obra", "paintbrush": "pintura",
  ruler: "regla medir", "construction": "obra reforma",
  car: "coche automovil", "car-front": "coche", bus: "autobus bus",
  "train-front": "tren", "tram-front": "tranvia", bike: "bici bicicleta",
  "bike-electric": "bici", truck: "camion furgoneta", "car-taxi-front": "taxi",
  fuel: "gasolina combustible gasolinera", "circle-parking": "parking aparcamiento",
  "traffic-cone": "obras", ship: "barco", sailboat: "velero barco",
  anchor: "ancla barco", ambulance: "ambulancia", tractor: "tractor",
  plane: "avion vuelo", "plane-takeoff": "avion vuelo viaje",
  luggage: "maleta equipaje", briefcase: "maletin trabajo", map: "mapa",
  "map-pin": "sitio ubicacion", compass: "brujula", globe: "mundo mapa",
  mountain: "montana", "mountain-snow": "montana nieve", tent: "camping tienda",
  "palmtree": "playa palmera", hotel: "hotel", backpack: "mochila",
  navigation: "navegar", signpost: "senal camino",
  music: "musica", guitar: "guitarra musica", piano: "piano musica",
  drum: "bateria musica", headphones: "cascos musica", film: "cine pelicula",
  clapperboard: "cine pelicula", video: "video", tv: "television tele",
  gamepad: "videojuegos juego", "gamepad-2": "videojuegos juego",
  dices: "dados juego", puzzle: "puzzle juego", book: "libro lectura",
  "book-open": "libro", library: "biblioteca libros", camera: "camara foto",
  image: "foto imagen", palette: "arte pintura", "drama": "teatro",
  "party-popper": "fiesta", sparkles: "brillo capricho", star: "estrella favorito",
  trophy: "trofeo premio", medal: "medalla premio", award: "premio",
  ticket: "entrada ticket", radio: "radio", podcast: "podcast", mic: "micro",
  disc: "disco musica", dumbbell: "pesas gimnasio", "activity": "actividad",
  "heart-pulse": "salud pulso", volleyball: "voley", football: "futbol balon",
  basketball: "baloncesto", "tennis-ball": "tenis", goal: "porteria futbol",
  waves: "mar olas piscina", timer: "cronometro", flag: "bandera meta",
  heart: "corazon salud amor", pill: "pastilla medicina", syringe: "vacuna inyeccion",
  stethoscope: "medico salud", hospital: "hospital", "cross": "farmacia salud",
  bandage: "tirita herida", thermometer: "fiebre temperatura", brain: "cerebro",
  eye: "ojo ver", ear: "oido", bone: "hueso", dna: "adn", microscope: "laboratorio",
  baby: "bebe nino", accessibility: "accesibilidad",
  building: "edificio oficina", "building-2": "empresa oficina",
  factory: "fabrica industria", warehouse: "almacen nave",
  clipboard: "portapapeles nota", "file-text": "documento archivo",
  folder: "carpeta", printer: "impresora", paperclip: "clip adjunto",
  "pen-line": "boligrafo escribir", pencil: "lapiz escribir",
  notebook: "cuaderno libreta", "graduation-cap": "estudios universidad",
  school: "colegio escuela", presentation: "presentacion", "chart-column": "grafico datos",
  "chart-line": "grafico datos", "chart-pie": "grafico datos", table: "tabla datos",
  calendar: "calendario fecha", "calendar-days": "calendario",
  clock: "reloj hora", "alarm-clock": "despertador alarma",
  mail: "correo email sobre", inbox: "bandeja correo", send: "enviar",
  phone: "telefono", "contact": "contacto agenda", "id-card": "dni carnet",
  scale: "balanza justicia", gavel: "juez ley", handshake: "acuerdo trato",
  users: "gente personas", user: "persona perfil",
  smartphone: "movil telefono", laptop: "portatil ordenador",
  monitor: "pantalla monitor", computer: "ordenador", tablet: "tablet",
  keyboard: "teclado", mouse: "raton", server: "servidor", database: "base datos",
  "hard-drive": "disco duro", cpu: "procesador", wifi: "wifi internet",
  bluetooth: "bluetooth", "signal": "cobertura senal", "battery-full": "bateria",
  power: "encender apagar", usb: "usb", cloud: "nube", download: "descargar",
  upload: "subir", lock: "candado bloqueo", "lock-open": "abierto",
  shield: "escudo seguro", fingerprint: "huella", "qr-code": "codigo qr",
  bot: "robot", code: "codigo programar", terminal: "terminal consola",
  bug: "bicho error", satellite: "satelite", speaker: "altavoz",
  gauge: "medidor velocidad",
  sun: "sol dia", moon: "luna noche", "cloud-rain": "lluvia",
  "cloud-snow": "nieve", wind: "viento", "cloud-lightning": "tormenta",
  umbrella: "paraguas lluvia colchon", rainbow: "arcoiris", "tree-pine": "arbol pino",
  "tree-deciduous": "arbol", trees: "arboles bosque", flower: "flor",
  sprout: "planta brote", leaf: "hoja planta", bird: "pajaro", cat: "gato mascota",
  dog: "perro mascota", rabbit: "conejo", turtle: "tortuga", "paw-print": "mascota pata",
  shell: "concha playa", earth: "tierra mundo", sunrise: "amanecer",
  sunset: "atardecer", recycle: "reciclar",
  circle: "circulo", square: "cuadrado", triangle: "triangulo", hexagon: "hexagono",
  diamond: "rombo", shapes: "formas", bookmark: "marcador guardar",
  bell: "campana aviso", smile: "sonrisa contento", frown: "triste",
  "thumbs-up": "bien pulgar", check: "correcto hecho", "x": "cerrar no",
  plus: "mas anadir", minus: "menos quitar", info: "informacion",
  "circle-help": "ayuda duda", "triangle-alert": "aviso alerta", ban: "prohibido",
  zap: "rayo luz", infinity: "infinito", hash: "almohadilla", "at-sign": "arroba"
};

/* ---------- a trabajar ---------- */

function inner(svg) {
  const m = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svg);
  if (!m) return "";
  return m[1]
    .replace(/\s*\n\s*/g, "")      /* los SVG vienen con un nodo por línea */
    .replace(/\s{2,}/g, " ")
    .replace(/\s\/>/g, "/>")
    .trim();
}

const dir = path.join(ORIGEN, "icons");
const tags = JSON.parse(fs.readFileSync(path.join(ORIGEN, "tags.json"), "utf8"));
const version = JSON.parse(fs.readFileSync(path.join(ORIGEN, "package.json"), "utf8")).version;

function temaDe(id) {
  const palabras = (id + " " + (tags[id] || []).join(" ")).toLowerCase();
  for (const [clave, , llaves] of TEMAS) {
    if (llaves.some(k => palabras.includes(k))) return clave;
  }
  return null;
}

const porTema = {};
TEMAS.forEach(([clave]) => { porTema[clave] = []; });
const paths = {};
let fuera = 0;

fs.readdirSync(dir).filter(f => f.endsWith(".svg")).sort().forEach(f => {
  const id = f.replace(/\.svg$/, "");
  const tema = temaDe(id);
  if (!tema) { fuera++; return; }
  const d = inner(fs.readFileSync(path.join(dir, f), "utf8"));
  if (!d) { fuera++; return; }
  paths[id] = d;
  porTema[tema].push(id);
});

/* Las palabras de búsqueda de cada icono: su nombre, sus etiquetas y lo
   que se diría en español. Se guarda una sola cadena por icono: se
   busca con indexOf y no hace falta nada más. */
const buscar = {};
Object.keys(paths).forEach(id => {
  const partes = [id.replace(/-/g, " ")];
  (tags[id] || []).forEach(t => partes.push(t));
  if (ES[id]) partes.push(ES[id]);
  /* «car-front» hereda lo de «car» si no tiene lo suyo */
  if (!ES[id]) {
    const raiz = id.split("-")[0];
    if (ES[raiz]) partes.push(ES[raiz]);
  }
  buscar[id] = partes.join(" ").toLowerCase();
});

const grupos = TEMAS.filter(([clave]) => porTema[clave].length)
  .map(([clave, nombre]) => ({ id: clave, nombre: nombre, iconos: porTema[clave] }));

const total = Object.keys(paths).length;

const salida = `/* ============================================================
   split — la librería de iconos

   GENERADO POR herramientas/iconos.js. No se edita a mano.

   Son ${total} iconos de Lucide ${version} (licencia ISC, ver LICENCIAS.md),
   repartidos en ${grupos.length} grupos y con palabras en español para
   poder buscarlos. Del SVG original solo se guarda lo de dentro: el
   envoltorio lo pone icon(), que es quien decide tamaño y grosor, así
   que estos se dibujan igual que los de casa.

   Este archivo NO se carga al arrancar. Pesa lo que pesan dos mil
   dibujos y solo hace falta cuando alguien va a elegir un icono, así
   que lo pide UI.cargarIconos() la primera vez que se abre el selector.
   ============================================================ */

(function () {
  "use strict";

  var PATHS = ${JSON.stringify(paths)};

  var GRUPOS = ${JSON.stringify(grupos)};

  var BUSCAR = ${JSON.stringify(buscar)};

  window.UI.addIcons(PATHS, GRUPOS, BUSCAR);
})();
`;

fs.writeFileSync(path.join(RAIZ, "js", "iconos.js"), salida);
console.log("js/iconos.js: " + total + " iconos en " + grupos.length + " grupos"
  + " (" + fuera + " descartados por no encajar en ninguno)");
grupos.forEach(g => console.log("  " + g.nombre + ": " + g.iconos.length));
console.log("tamaño: " + Math.round(salida.length / 1024) + " KB");
