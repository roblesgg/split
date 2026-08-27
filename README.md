# split

App de finanzas personales: reparte tu sueldo por porcentajes, registra gastos e
ingresos, y mira qué está pasando de verdad con tu dinero.

Vanilla puro: HTML + CSS + JS, sin build, sin dependencias, sin npm.

## Cómo abrirla

Doble clic en `index.html`. Ya está.

Funciona desde `file://` porque no usa módulos ES ni `fetch`: los scripts son
clásicos y se cargan en orden. Comprobado en Chrome que `localStorage` también
funciona desde `file://`, así que lo que registres sobrevive a las recargas sin
montar ningún servidor.

Si algún navegador bloqueara el almacenamiento (modo privado, políticas
corporativas), la app lo detecta y sigue funcionando en memoria durante la
sesión. Si te pasa y quieres persistencia, sírvela por HTTP:

```
npx serve .          # o
python -m http.server
```

## La primera vez que se abre

No hay datos de ejemplo cargados por defecto: se arranca en blanco. La primera
vez sale un cuestionario corto, cinco pasos, que no es un folleto sino cuatro
preguntas:

| Paso | Qué pregunta |
|---|---|
| **Privacidad** | No pregunta: dice que nada sale del móvil. Va primero a propósito, antes de pedirle a nadie que escriba cuánto gana |
| **Cuentas** | Dónde tienes el dinero, y cuánto hay ahora en cada sitio |
| **Trabajos** | De dónde te entra: fijo, por horas o variable. Se puede saltar |
| **Cuándo empieza tu mes** | El día en que se reinicia todo |
| **Listo** | Un resumen de lo que se va a crear |

Lo que **no** se pregunta —categorías, presupuesto, reparto— se pone sobre la
marcha. Preguntarlo todo el primer día es la forma más rápida de que alguien
cierre la app y no vuelva.

El paso del mes va **después** de los trabajos por una razón: para casi todo el
mundo el mes empieza el día que cobra, así que en cuanto se sabe cuándo cobra
la app propone ese día en vez de preguntar a secas. Si has dicho que cobras el
25, la opción marcada es «El día 25 · el día que cobras»; si no has puesto
ningún trabajo, ni se ofrece.

Nada se guarda hasta el último botón. Mientras tanto todo vive en `ui.ob`, así
que se puede ir y volver entre pasos sin dejar cuentas a medias, y **Saltar**
de verdad no toca nada: quien salte se queda con el mes del calendario, que es
lo que la app hacía antes de que esto se pudiera elegir.

El cuestionario se enseña una sola vez, la primera vez que hay algo guardado en
`localStorage`; a partir de ahí no vuelve a aparecer.

## Dos interfaces, un solo código

| Ancho | Interfaz |
|---|---|
| **< 900 px** | Columna única, tab bar inferior, hojas que suben desde abajo y se arrastran para cerrar |
| **≥ 900 px** | Barra lateral fija, panel de dos columnas, los diálogos se centran en pantalla |
| **≥ 1320 px** | La columna principal gana peso y los gráficos crecen |

No hay marco de móvil en escritorio ni maquetación duplicada: son los mismos
componentes recolocados.

## Cuándo empieza tu mes

De fábrica el mes de la app es el del calendario: del 1 al último día. Pero si
cobras el 25 y tu mes de verdad va del 25 al 24, se cambia el día en que se
reinicia todo: el cuestionario de bienvenida lo pregunta, y después está
siempre en **Ajustes → Cuándo empieza tu mes**.

Ese día manda sobre **todo lo que la app cuenta**: los totales del Resumen, el
presupuesto, el histórico de Análisis, la navegación de Movimientos y el mapa de
calor. No hay dos calendarios conviviendo — si tu mes empieza el 25, la app
entera empieza el 25, y la cabecera dice «25 ago – 24 sep» en vez de «agosto»,
porque llamarle agosto sería mentir.

- El día máximo es el **28**, por lo mismo que en los programados: un mes que
  empezara el 31 no existiría en febrero.
- **Lo que se cobra sigue el calendario, no el ciclo.** Un recibo domiciliado el
  día 3 se cobra el 3, tengas el corte donde lo tengas. El ciclo manda en lo que
  se mira; el calendario, en lo que se paga.
- Con el día 1 —lo que trae la app— todo funciona exactamente como funcionaba
  antes de que existieran los ciclos.

Por dentro, un ciclo se identifica por el mes en el que **empieza**, así que
sigue siendo una clave `AAAA-MM` y todo lo que ya guardaba meses no se entera.

## Cuánto cuentas al mes y el reparto

En **Ajustes** decides sobre cuánto dinero repartir:

- **Automático** — la media de lo que ha entrado de verdad en tus últimos 3, 6 o
  12 meses cerrados. No hay que declarar nada: si un mes cobras más, la media
  sube sola. Los meses sin ningún ingreso no cuentan, para que no hundan la
  media cuando aún no usabas la app.
- **Manual** — una cifra fija que pones tú.

Debajo repartes ese dinero en **porcentajes** por partida con los deslizadores.
Lo que no repartes es tu ahorro, y los presupuestos en euros salen de ahí.

No hay que configurar sueldos ni número de pagas: no todo lo que entra es una
nómina, y no todos los meses entra lo mismo.

## Qué hay en cada pantalla

| Pantalla | Qué hace |
|---|---|
| **Resumen** | Tarjetas de cuenta deslizables, KPI del mes, categorías, lo que viene programado, el reparto del sueldo y el presupuesto |
| **Movimientos** | Histórico por día, filtro ingresos/gastos, búsqueda, navegación por mes, detalle con editar y eliminar |
| **Análisis** | Histórico con rango 3M/6M/12M, ahorro por mes, tasa de ahorro, reparto por categoría, mapa de calor y lecturas automáticas |
| **Planes** | Cuentas con su objetivo de gasto, pagos programados y metas de ahorro, todo con crear, editar y borrar |
| **Ajustes** | El día en que empieza tu mes, ingresos, reparto por porcentajes, tema y exportar/importar |

## Objetivo de gasto por cuenta

Cada cuenta puede llevar un **objetivo de gasto** que se vacía solo cuando
empieza el ciclo siguiente. Se pone al crearla o editarla, y dejar el campo
vacío es no tener ninguno.

La cifra que manda es **el porcentaje que te queda**, no lo gastado: es lo que
de verdad se quiere saber al mirar. Los euros van debajo, en pequeño, para
quien quiera el detalle.

- En el **Resumen**, la tarjeta de la cuenta lleva la barra llenándose y
  «te queda el 72 % de 2000 €».
- **Dentro de la cuenta**, el porcentaje va grande, con la barra y el detalle
  en euros y los días que quedan de ciclo.
- En **Planes**, la lista de cuentas dice cuáles tienen objetivo.

Los escalones son los mismos que los del presupuesto por categorías, para que
«al límite» signifique lo mismo en toda la app: a partir del **85 %** avisa, y
pasado el 100 % lo dice en rojo. El color nunca va solo: cada escalón lleva su
icono y su frase.

**No es un tope duro: la app avisa, no bloquea.** Si te impidiera apuntar el
gasto, lo apuntarías en otro sitio y entonces la app te estaría mintiendo.

Solo cuenta lo que **sale de esa cuenta como gasto**. Un traspaso a tu propia
hucha no es gastar, así que no suma, igual que no suma en ningún otro total.
Tampoco suma lo que sale de un apartado (ver más abajo).

## Apartados

Un **apartado** es una sub-bolsa dentro de una cuenta. Separas 200 € para
gasolina y esos 200 dejan de contar en el resto de tus gastos, porque ya los
tienes guardados.

**Apartar no mueve el dinero de sitio: lo reserva.** El saldo de la cuenta sigue
siendo el mismo, y por eso lo que ves en la app sigue cuadrando con lo que ves
en el banco. Dentro de la cuenta se enseñan las dos cifras: el saldo y cuánto
de ese saldo está disponible de verdad.

Se crean desde **la cuenta a la que pertenecen**, con su nombre, su emoji y su
color. Cada uno lleva:

- **Cuánto apartas cada ciclo.** Se mete solo al empezar cada uno. Si lo dejas
  vacío, vas metiendo tú a mano cuando quieras.
- **Las categorías que se descuentan solas.** Si «Gasolina» está atada al
  apartado, un gasto de gasolina pagado con esa cuenta sale de ahí sin que
  tengas que decir nada. Al apuntarlo la app te lo dice, y se puede quitar de un
  toque.

### La regla que lo hace útil

Un gasto que sale de un apartado **no cuenta en el objetivo de gasto de la
cuenta ni en el presupuesto por categorías**. Ese dinero ya lo habías separado:
si contara otra vez, lo estarías gastando dos veces.

Lo que sí hace es contar donde tiene que contar. Sale en Movimientos, en los
totales del ciclo y en el gráfico de en qué se te va, porque ese gasto existió.
Lo único que cambia es que no consume tu presupuesto general, porque consumió
el suyo.

### El sobrante se acumula

Si apartas 200 € y gastas 160, el ciclo siguiente empiezas con 240. Es lo que
haría un sobre de verdad. Para bajarlo, se devuelve a la cuenta a mano con el
botón de la fila.

**Pasarte no está bloqueado.** Si te pasas, el apartado se queda en negativo y
la app lo dice en rojo, pero te deja apuntarlo. Bloquearlo haría que el gasto se
apuntara en otro sitio, y entonces la app te estaría mintiendo.

### Cómo se guarda

El saldo **no se guarda: se calcula**. Lo que se guarda son los aportes —cuánto
has metido y en qué ciclo— y el saldo sale de restarles lo gastado. Un número
guardado que hubiera que ir subiendo y bajando a mano se desincronizaría en
cuanto editas o borras un movimiento, y en una app de dinero eso no se puede
permitir.

Borrar un apartado **no borra sus gastos**: los suelta. Vuelven a contar en el
objetivo de la cuenta, que es donde habrían estado siempre.

## Categorías

Se crean, se renombran, se les cambia el **emoji** y el **color**, y se borran.
No hay límite: la app trae unas básicas y a partir de ahí cada uno monta las
suyas.

De fábrica vienen diez de gasto (Comida, Compras, Gasolina, Transporte, Hogar,
Ocio, Salud, Suscripciones, Regalos y Otros) y cuatro de ingreso (Ingreso,
Sueldo, Extra y Regalo).

Se gestionan desde **Ajustes → Categorías**, o con el botón **+** que hay al
final del selector cuando estás apuntando un movimiento: crea la categoría sin
perder el importe que llevaras tecleado y vuelve con ella ya elegida.

Una categoría **no se puede borrar si tiene movimientos**, igual que las
cuentas: la app dice cuántos hay en lugar de dejar importes sin clasificar. Las
nuevas de gasto entran en el reparto al 0 %, así que crear una no te mueve
ningún presupuesto.

### Los 16 colores

Están en `tokens.css` como `--cat-1..16`, en **8 familias de tono × 2
luminosidades**. Los pares de una misma familia (azul / azul hondo, rojo /
granate) se distinguen por claro-oscuro, que el daltonismo no altera; las
familias entre sí, por tono.

Con 16 colores no existe separación perfecta bajo daltonismo: el suelo es ΔE 4,2
en claro y 2,2 en oscuro, y ese último es entre azul y violeta, que ya venía así
de `--series-1` / `--series-7`. No importa aquí porque **el color de una
categoría nunca viaja solo**: siempre lleva su emoji y su nombre al lado.

## Qué se guarda de cada movimiento

Importe, categoría, cuenta, **fecha y hora**, un **título** corto para la lista,
**notas** largas para lo que no cabe en el título, **etiquetas** y **adjuntos**.

Las **etiquetas** son transversales a la categoría: «Vacaciones» puede caer en
Comida y en Transporte a la vez. Se crean al vuelo desde el propio movimiento.

Los **adjuntos** (fotos de tickets) **no van en `localStorage`**. El estado
entero se guarda ahí como una cadena JSON y la cuota ronda los 5 MB: una sola
foto en base64 se la comería y a partir de ahí dejaría de guardarse todo lo
demás. Van en **IndexedDB**, y el movimiento solo se queda con el id. Antes de
guardarla, la imagen se reduce con un canvas a 1400 px de lado mayor y JPEG al
72 %, que deja un ticket de cámara en unos 150 KB.

Ojo con esto: **el archivo de Exportar no lleva los adjuntos**, solo sus ids. Al
importarlo en otro dispositivo el movimiento aparece entero pero sin las
imágenes.

## Traspasos entre cuentas

Mover dinero de la corriente a la hucha **no es un gasto**. El tipo `transfer`
resta de una cuenta y suma en la otra, y queda fuera de totales, categorías,
presupuestos y estadísticas. En la lista se ve como `Cuenta A → Cuenta B`, sin
signo de más ni de menos.

Se hace desde el botón **+** eligiendo la pestaña «Traspaso», o desde
**Planes → Hacer un traspaso**.

## Pagos programados

En **Planes → Programados** defines lo que se repite: el alquiler, las
suscripciones, la nómina, el seguro del coche o un traspaso automático a la
hucha.

Cuatro ritmos, que es como se habla:

| Ritmo | Qué se elige |
|---|---|
| **Día** | Cada cuántos días (hasta 30) |
| **Semana** | Qué días de la semana —se pueden marcar varios— y cada cuántas semanas (hasta 8) |
| **Mes** | Qué día del mes y cada cuántos meses (hasta 12) |
| **Año** | Qué día del mes. Es el mismo día, una vez al año |

- El **día del mes llega hasta 31**. Los meses que no lo tengan, cae en su
  último día: un recibo del 31 se cobra el 30 en abril, no en mayo.
- Los días son del **calendario**, no de tu ciclo: si tienes el corte el 25, el
  recibo del día 3 se sigue cobrando el 3. El ciclo manda en lo que se mira; el
  calendario, en lo que se paga.
- Se apuntan **solos** el día que toca, la próxima vez que abras la app. Si has
  estado semanas sin entrar, recupera todo lo pendiente de una vez.
- Cada uno se puede **pausar** sin borrarlo.
- Los que ya se apuntaron son movimientos normales: se pueden editar o borrar
  uno a uno sin tocar la programación.
- Cambiar el ritmo o el «cada cuántos» **empieza a contar de cero**. Si no, al
  pasar algo a semanal se apuntarían de golpe todas las semanas desde una fecha
  vieja.

Por dentro solo hay **tres** reglas —diario, semanal y mensual— y un «cada N».
Con eso sale todo: cada dos semanas es semanal con cada 2, y cada año es mensual
con cada 12. La interfaz ofrece cuatro palabras porque es como se habla, pero
los datos no necesitan un cuarto concepto, y cada concepto de más es una regla
más que puede fallar.

### Cuando no se sabe cuánto va a ser

Hay trabajos en los que no sabes lo que vas a cobrar hasta que cobras, y recibos
que varían un poco cada mes. Para esos la app **no apunta nada sola**: te avisa
el día que toca y te pregunta.

La pantalla de confirmar es una cifra grande y un teclado, como al apuntar un
movimiento: es lo único que estás haciendo ahí.

- Si el programado va **por horas**, se piden horas y no euros. Hacer la
  multiplicación de cabeza cada vez es justo lo que la app tiene que ahorrarte:
  se teclea «18,50» y debajo pone «A 12,00 € la hora · 222,00 €».
- Se **propone una cifra**: la media de lo que de verdad ha entrado por ese
  programado. Es un botón, no un valor puesto de oficio — verlo y decidir es
  distinto de encontrártelo escrito sin saber de dónde sale. Si no hay historial
  todavía, se propone lo previsto.
- «Esta vez no lo he cobrado» descarta ese y ya está: la próxima vez que toque
  vuelve a preguntar.

### Los avisos en el móvil

Un programado puede avisarte el día que toca, a la hora que le digas. Eso lo
lleva la capa Android con `AlarmManager`, para que llegue con la app cerrada.

Hay dos formas de mandarle un aviso, según lo que pueda representar:

- **Por días de la semana**, para lo que de verdad es semanal. Android vuelve a
  poner la alarma sola cada siete días, así que sigue avisando aunque no abras
  la app en meses.
- **Por fechas concretas**, para todo lo demás: mensual, cada tres meses, cada
  dos semanas, diario. No hay ningún día de la semana que los describa. Se
  mandan las **ocho próximas** y se reponen cada vez que abres la app.

Antes todo iba por días de la semana, y por eso **un recibo mensual avisaba
todas las semanas**: Android reprogramaba a los siete días sin saber que aquello
era mensual.

**Dos permisos, no uno.** Notificar se pide con un diálogo, y solo cuando
guardas un programado que lo necesita: salir de la nada con un diálogo de
permisos es de las cosas que hacen desinstalar una app. Pero desde Android 12
hay un segundo permiso, el de **poner la alarma a su hora**: sin él el sistema
puede correrla horas para ahorrar batería, y en un aviso de «hoy cobras» eso es
la diferencia entre servir y no servir. Ese no se puede pedir con un diálogo, así
que la app lo comprueba y, si falta, avisa una vez con un botón que lleva
directo a la pantalla de ajustes donde se concede.

Las alarmas **no sobreviven a un reinicio del teléfono**. Por eso se reponen
todas cada vez que se abre la app.

## Cuentas y metas

Ambas se crean, editan y borran desde **Planes**.

Borrar una cuenta que tiene cosas dentro **pregunta antes, con las cifras
delante**: «¿Borrar «Efectivo» y todo lo suyo? Se va con ella: 128 movimientos,
3 programados, 1 apartado». Si dices que sí, se va todo junto.

Se va todo a propósito. Dejar los movimientos de una cuenta que ya no existe
descuadraría el saldo total y los dejaría fuera de todas las pantallas, que es
peor que borrarlos: seguirían contando en las cifras sin poder verlos ni
arreglarlos.

El aviso dice además una cosa que no se ve venir: si entre esos movimientos hay
**traspasos**, el traspaso tiene dos cuentas, así que al irse cambia también el
saldo de la otra — dinero que no estabas borrando. Las imágenes de los tickets
que colgaran de esos movimientos se limpian solas en el siguiente arranque.

Una cuenta vacía se borra sin preguntar, que no hay nada que perder. Y no deja
quedarse sin ninguna cuenta.

Cada cuenta lleva **su color**, de la misma paleta de 16 que las categorías, y
se ve como una tarjeta en el carrusel del Resumen. El color va mezclado con
tinta oscura antes de pintarlo (60 % y 38 % en los dos extremos del degradado)
para que el texto blanco pase de 4,5:1 sobre los dieciséis tonos, incluidos los
claros como el amarillo.

## En el móvil

El APK está en la [última release](https://github.com/roblesgg/split/releases/latest).
Se instala bajándolo al teléfono y abriéndolo (Android pedirá permiso para
instalar de origen desconocido). La app va entera dentro: funciona sin internet
y los datos se quedan en el móvil. A partir de ahí, la propia app avisa de las
versiones nuevas.

Para regenerarlo tras cambiar algo, mira `packaging/README.md`.

## Actualizaciones

La app avisa sola cuando hay una versión nueva. Al abrirla mira la **última
release de GitHub**; si su etiqueta es posterior a la versión que llevas
dentro, sale una tarjeta arriba del Resumen con **Actualizar** y **Ahora no**.

- En el móvil, **Actualizar** descarga el `split.apk` de esa release y Android
  lo instala encima del que ya tienes. Al estar firmado con la misma clave, **no
  se pierden los datos**.
- En escritorio abre la página de la release, que es donde están los archivos.
- **Ahora no** silencia solo esa versión; la siguiente vuelve a avisar.
- En **Ajustes → Acerca de** se ve la versión instalada y se puede buscar a
  mano en cualquier momento.

Sin conexión no pasa nada: la comprobación falla en silencio y la app sigue
funcionando igual. En el arranque no se pregunta más de una vez cada 6 h.

### Al publicar una versión nueva

Los dos números tienen que coincidir, porque la comparación es entre ellos:

1. Sube `VERSION` en `js/update.js`.
2. Escribe las notas en `.github/release-notes/vX.Y.Z.md` (opcional, pero es lo
   que se ve al actualizar).
3. **Actions → Publicar release → Run workflow**, con la versión sin la «v».
   El workflow corre las pruebas, compila el APK firmado, crea la etiqueta y
   publica la release con `split.apk` adjunto.

El workflow compara la versión que le pides con la de `js/update.js` y se
planta si no coinciden: una app que se anuncia como 1.1.0 mientras la última
release es la 1.2.0 avisaría en bucle de una actualización que ya tienes
puesta.

## Estructura

Un archivo, un trabajo. Nada por encima de unas 600 líneas: cuando algo se pasa,
se parte por temas antes de seguir creciendo.

```
index.html
css/
  tokens.css        color, espaciado, radios, curvas y métricas de layout
  base.css          reset, carcasa responsive, barra lateral y tab bar
  components/       una pieza por archivo, en el orden en que cascadean
    card.css        tarjetas, cuentas y saldo
    data.css        cifra grande, anillo, KPI, tiles y tarjeta de límite
    row.css         filas, medidores, anillos y chips
    pick.css        elegir de una lista, rosco y filas del presupuesto
    controls.css    interruptores, segmented y botones
    sheet.css       la hoja y el teclado del importe
    field.css       campos, emoji, notas, etiquetas y adjuntos
    category.css    rejilla, formulario y lista de categorías
    feedback.css    vacío, toasts, aviso de versión y tutorial
  charts.css        capa de gráficos: marcas, ejes, tooltips, tabla
  screens.css       piezas de cada pantalla y el editor de reparto
js/
  core/             lo que no sabe nada de finanzas
    base.js         el espacio común de la capa de datos (window.Datos)
    format.js       euros, porcentajes y decimales en es-ES
    dates.js        fechas en local y la matemática del ciclo (D.Ciclo)
  data/             un archivo por tema, todos cuelgan de window.Datos
    ciclo.js        el día de corte configurado, atado a la matemática
    apartados.js    sub-bolsas dentro de una cuenta
    limites.js      el objetivo de gasto de una cuenta
    catalog.js      categorías de fábrica, colores y búsqueda por id
    demo.js         los datos de ejemplo, con semilla fija
    state.js        con qué arranca, cómo se guarda y las migraciones
    tx.js           movimientos
    accounts.js     cuentas
    categories.js   crear, renombrar y borrar categorías
    tags.js         etiquetas
    goals.js        metas de ahorro
    recurring.js    pagos y cobros programados
    pendientes.js   la cola de lo que hay que confirmar
    budget.js       ingresos y reparto del sueldo
    select.js       totales, series, proyección y tasa de ahorro
    prefs.js        tema, emojis y exportar/importar
  store.js          la fachada: window.Store, la API que ve la app
  charts/           motor de gráficos en SVG, escrito a mano
    espacio.js      el espacio común (window.Graficos)
    base.js         nodos SVG, color, ticks, curvas y tooltip
    line.js  columns.js  sparkline.js  donut.js
    ring.js  heatmap.js  breakdown.js
  charts.js         la fachada: window.Charts
  update.js         versión instalada y aviso de release nueva
  attach.js         adjuntos en IndexedDB, con reducción de la imagen
  avisos.js         qué recordatorios hacen falta (los pone la capa Android)
  ui.js             iconos SVG, hojas arrastrables, toasts, háptica
  app/
    base.js         window.App: estado de interfaz, hojas y ayudantes
    parts.js        trozos que salen en más de una pantalla
    shell.js        router, barra de arriba, botón atrás y tema
    init.js         arranque: monta las hojas, engancha y pinta
  screens/          una pantalla u hoja por archivo, con su cableado al lado
    inicio.js  movs.js  analisis.js  planes.js
    ajustes.js  ajustes-render.js
    form.js  form-guardar.js  form-render.js  form-apartado.js
    add.js   add-render.js     hoja de añadir movimiento
    detail.js  pick.js  cuenta.js  cobro.js  onboard.js
tests/              sin dependencias: node tests/run.js
  ayuda.js          cuarenta líneas en vez de un framework
  ciclo.js  limites.js  apartados.js  programados.js  cuentas.js
  migracion.js      de una versión publicada a la de hoy, de punta a punta
packaging/          convierte la app en un APK; si lo borras, la app sigue igual
```

### Cómo encajan las piezas

Sin build y sin módulos ES, porque la app tiene que abrirse con doble clic desde
`file://`. Los scripts son clásicos y se cargan en orden, y cada capa tiene un
espacio común donde sus archivos se leen entre ellos, más una fachada que es lo
único que ve el resto:

| Capa | Espacio común | Fachada |
|---|---|---|
| Datos | `window.Datos` | `window.Store` |
| Gráficos | `window.Graficos` | `window.Charts` |
| Interfaz | `window.App` | — |

En la interfaz no hay fachada porque no hay nadie fuera: `window.App` es a la
vez el espacio común y lo que la capa Android llama para el botón atrás
(`App.atras()`).

**Añadir una pantalla** son tres pasos: crear `js/screens/loquesea.js`, terminarlo
con `A.screens["loquesea"] = renderLoquesea;` y añadir su `<script>`. El router no
se toca.

**Añadir cableado** es registrarlo con `A.wire(fn)` al final del archivo; el
arranque los llama a todos en el orden en que están los `<script>`.

Cuando un archivo necesita algo de otro, lo llama por un puente
(`function goTo() { return A.goTo.apply(null, arguments); }`) que se resuelve en
la llamada y no al cargar, así que el orden de los `<script>` solo importa para
las constantes.

## Las pruebas

```
node tests/run.js
```

Sin dependencias y sin navegador, igual que la app: los archivos son scripts
clásicos, así que la prueba los lee y los evalúa como haría el navegador.

Lo que hay ahí es **la aritmética**, que es lo que no se ve y lo que más duele
cuando falla: los ciclos, los límites de cuenta, los apartados y el calendario
de los programados. Lo que se ve en pantalla se comprueba abriendo la app, que
para eso se abre con doble clic.

Y **la migración**, que es lo único de todo el proyecto que no tiene segunda
oportunidad: si se pierde algo, se pierde en el móvil de alguien que ya tenía
sus datos dentro. Por eso no se comprueba paso a paso sino de punta a punta —un
estado real de la versión publicada entra, sale en el esquema de hoy, y se
cuenta que siga estando todo— más el camino largo desde la primera versión de
todas, que es lo que tiene quien no actualiza desde hace un año. Y que migrar
dos veces no cambie nada, porque abrir la app veinte veces migra veinte veces.

Las pruebas corren también en el workflow de publicación, **antes** de compilar
el APK: una migración rota no llega a una release.

## El lenguaje visual

Neumorfismo en escala de grises, **usado con medida**. El relieve fuerte —dos
sombras enfrentadas, `--nm-out` para lo elevado y `--nm-in` para lo hundido— se
reserva a **lo que se pulsa**: botones, teclas, pestañas, el canal del selector
y el hueco donde se escribe el importe. Al pulsar, el control pasa de elevado a
hundido, y ahí es donde el efecto tiene sentido.

Las tarjetas, iconos, campos y pistas de progreso **no** lo llevan: van con una
sombra suave y un filo de 1px. Ponerlo en todo hacía que la pantalla pareciera
acolchada.

Es puro `box-shadow`: no hace falta ninguna librería, y así la app sigue
abriéndose con doble clic y funcionando sin internet.

**El color aparece en muy pocos sitios, y siempre porque significa algo:**

| Dónde | Qué color | Por qué |
|---|---|---|
| Punto de la pestaña activa, anillo de progreso, foco del teclado | Índigo `#5b62f0` | Es la única marca de acento de la app |
| Barras de ahorro por mes | Tinta arriba, rojo abajo | Positivo y negativo tienen que leerse como opuestos |
| Reparto por categorías y sus deslizadores | Paleta categórica | Aquí el color **es** el dato: distingue ocho partidas |
| Importes que entran, avisos de presupuesto | Verde / ámbar / rojo | Siempre con signo o icono al lado, nunca color a solas |

Todo lo demás — tarjetas, botones, iconos, avatares, tiles — es gris.

## Números grandes, botones grandes

Dos escalas en `tokens.css`, y ahí es donde está la regla: si hace falta un
tamaño nuevo, se añade a la escala, no suelto en el archivo de turno.

**El texto** tiene un suelo, `--t-min`, en 12,5 px. Nada baja de ahí: un texto
que hay que acercarse a leer no está diciendo nada, o sube o sobra. Encima,
`--t-hint` para ayudas y pies, `--t-body` para el texto normal, `--t-label` para
etiquetas y `--t-title` para títulos de tarjeta.

**Las cifras** tienen la suya, porque el número *es* el dato y manda sobre el
texto que lo acompaña: `--num-hero` (42 px) para la cifra que se teclea,
`--num-xl` para la protagonista de una tarjeta, `--num-l` para un KPI y
`--num-m` para una fila de lista.

La regla de fondo: **una cifra grande por tarjeta, nunca dos.** Si hay dos,
ninguna es la importante. Por eso en el móvil las tres cifras del Resumen van
dos arriba y la de ahorro entera debajo: las tres en una fila no caben —quedan
88 px por tarjeta y «−576,63 €» pide 129— y aunque cupieran no dejarían ver
cuál importa. En escritorio, donde hay sitio, van las tres.

**Y el porcentaje manda sobre el euro** en todo lo que es un límite. «Te queda
el 38 %» arriba y «148,50 € de 400 €» debajo, no al revés: lo que se quiere
saber de un vistazo es cuánto margen queda, no la resta.

### Lo que se pulsa

`--tap` (56 px) para lo que se pulsa a propósito —botones, teclas del importe,
filas— y `--tap-min` (48 px) como suelo de todo lo demás. Fallar un toque en una
app de dinero da miedo.

Cuando un enlace tiene que verse pequeño —el «+ Nueva» de una cabecera, la «×»
del buscador— **el texto se queda pequeño y el objetivo no**: se extiende con una
zona invisible hasta el mínimo, sin mover nada de sitio.

Está comprobado midiendo el objetivo real de cada elemento pulsable de las cinco
pantallas y las hojas, incluidas esas zonas invisibles.

## Sobre los colores de los gráficos

La paleta de series está validada para daltonismo y contraste contra las
superficies reales de este tema (`#ECEDF1` en claro, `#22242A` en oscuro): pasa
banda de luminosidad, croma, separación CVD y contraste en los dos modos.

En claro hay cuatro colores por debajo de 3:1 sobre el gris. Por eso todos los
gráficos llevan **etiquetas visibles y vista de tabla**: el color nunca es el
único canal que transporta el dato.

El gráfico de Historial no usa la paleta categórica sino la forma de **énfasis**:
la serie que cuenta va en tinta y el contexto en un gris validado a 3:1. Es lo
que le permite quedarse en blanco y negro sin perder identidad.

## Cómo se calcula la proyección del ciclo

La típica regla de tres (*gastado ÷ días transcurridos × días del ciclo*)
miente: el alquiler y las cuotas caen al principio, así que al octavo día el
ritmo aparente se dispara y proyecta cifras absurdas.

En su lugar `projectedExpense()` mide la **forma** real de tu gasto: qué
fracción del total llevabas gastada a esta misma altura del ciclo en los 6
anteriores. Si al octavo día sueles llevar el 45 %, lo gastado hasta hoy se
divide entre 0,45. Los fijos ya pagados no se duplican. Sin historial
suficiente, cae al reparto lineal.

## Lo que todavía no hace

- **Una sola moneda** (euros).

Los préstamos sí se llevan, aunque aquí ponía que no: un gasto programado admite
un número de cuotas y al llegar a la última se apaga solo.

## Datos

Arranca en blanco: una cuenta, sin movimientos (ver «La primera vez que se
abre»). Para probar la app ya cargada, hay ~340 movimientos de ejemplo de 13
meses, generados de forma determinista, disponibles en **Ajustes → Datos de
ejemplo**. Para volver al punto de partida (una cuenta, sin nada): **Ajustes →
Vaciar todo**.

El estado guardado se migra solo al abrir una versión nueva (`migrate()` en
`store.js`), así que actualizar la app no te borra nada.

Los adjuntos viven aparte, en IndexedDB. Al arrancar se barren los que ya no
cuelgan de ningún movimiento, para que borrar un gasto no deje su foto ocupando
sitio para siempre.

Todo vive en tu navegador, en tu dispositivo. No hay servidor detrás y tus datos
no salen de aquí. La única conexión que hace la app es preguntarle a GitHub si
hay una versión nueva (ver «Actualizaciones»), y en esa llamada no va nada tuyo.
