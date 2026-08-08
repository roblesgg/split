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

No hay datos de ejemplo cargados por defecto. La primera vez, un tutorial
corto explica Resumen, Movimientos, el reparto por porcentajes, Análisis y
Planes, y termina con la única cuenta con la que arranca la app: se llama
«Banco», sin dinero ni movimientos. Ese último paso deja cambiarle el nombre
si se quiere (por ejemplo, al banco real que uses) y lleva directo a
**Ajustes** para meter tus ingresos y decidir el reparto.

El tutorial se enseña una sola vez, la primera vez que hay algo guardado en
`localStorage`; a partir de ahí no vuelve a aparecer.

## Dos interfaces, un solo código

| Ancho | Interfaz |
|---|---|
| **< 900 px** | Columna única, tab bar inferior, hojas que suben desde abajo y se arrastran para cerrar |
| **≥ 900 px** | Barra lateral fija, panel de dos columnas, los diálogos se centran en pantalla |
| **≥ 1320 px** | La columna principal gana peso y los gráficos crecen |

No hay marco de móvil en escritorio ni maquetación duplicada: son los mismos
componentes recolocados.

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
| **Planes** | Cuentas, pagos programados y metas de ahorro, todo con crear, editar y borrar |
| **Ajustes** | Ingresos, reparto por porcentajes, tema y exportar/importar |

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

En **Planes → Programados** defines lo que se repite cada mes: alquiler,
suscripciones, la nómina, o un traspaso automático a la hucha.

- Se apuntan **solos** el día que toca, la próxima vez que abras la app. Si has
  estado semanas sin entrar, recupera todos los meses pendientes de una vez.
- El día máximo es el **28**, para que caiga en todos los meses incluido febrero.
- Cada uno se puede **pausar** sin borrarlo.
- Los que ya se apuntaron son movimientos normales: se pueden editar o borrar
  uno a uno sin tocar la programación.

Los de ejemplo arrancan con `lastPosted` en el mes en curso para no duplicarse
con los movimientos de demostración que ya existen.

## Cuentas y metas

Ambas se crean, editan y borran desde **Planes**.

Una cuenta **no se puede borrar si tiene movimientos**: dejaría importes
huérfanos y descuadraría el saldo total, así que la app avisa de cuántos hay en
lugar de borrar a ciegas. Tampoco deja quedarse sin ninguna cuenta.

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
2. Regenera el APK (`packaging/`, ver más abajo).
3. Publica una release etiquetada igual (`vX.Y.Z`) con el `split.apk` adjunto.

Si te saltas el paso 3, nadie se entera de la actualización; si te saltas el 1,
la app seguirá avisando de una versión que ya tiene instalada.

## Estructura

```
index.html
css/
  tokens.css        color, espaciado, radios, curvas y métricas de layout
  base.css          reset, carcasa responsive, barra lateral y tab bar
  components.css    tarjetas, filas, medidores, hojas, teclado, toasts
  charts.css        capa de gráficos: marcas, ejes, tooltips, tabla
  screens.css       piezas de cada pantalla y el editor de reparto
js/
  store.js          datos, localStorage, migraciones y selectores
  update.js         versión instalada y aviso de release nueva
  attach.js         adjuntos en IndexedDB, con reducción de la imagen
  ui.js             iconos SVG, hojas arrastrables, toasts, háptica
  charts.js         motor de gráficos en SVG, escrito a mano
  app.js            render de pantallas, formularios y eventos
```

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

## Cómo se calcula la proyección del mes

La típica regla de tres (*gastado ÷ días transcurridos × días del mes*) miente:
el alquiler y las cuotas caen a principio de mes, así que el día 7 el ritmo
aparente se dispara y proyecta cifras absurdas.

En su lugar `projectedExpense()` mide la **forma** real de tu gasto: qué
fracción del total mensual llevabas gastada a esta misma altura del mes en los
6 meses anteriores. Si a día 7 sueles llevar el 45 %, lo gastado hasta hoy se
divide entre 0,45. Los fijos ya pagados no se duplican. Sin historial
suficiente, cae al reparto lineal.

## Lo que todavía no hace

- **Programados solo mensuales.** No hay semanal, trimestral ni anual.
- **Una sola moneda** (euros).
- **Sin deudas ni préstamos**: un préstamo hay que llevarlo a mano como
  movimientos sueltos.

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
