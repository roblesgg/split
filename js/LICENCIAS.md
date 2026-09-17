# De dónde salen estos iconos

Los veintidós de las cuentas y los de la interfaz están dibujados aquí y viven
en `PATHS`, dentro de `ui.js`. No hay nada que declarar de esos.

Lo que sí viene de fuera es `iconos.js`, el archivo gordo que se descarga solo
cuando alguien abre **Buscar en más iconos**.

## iconos.js

- **Original**: [Lucide](https://lucide.dev), paquete `lucide-static` **1.47.0**
- **Licencia**: ISC, texto completo en `LICENSE-lucide.txt`
- **Tamaño**: 2.112 SVG sueltos → un archivo de 594 KB (139 KB por el cable)

Ciento quince de esos iconos vienen a su vez de [Feather](https://feathericons.com)
y llevan licencia MIT. Cuáles son exactamente lo dice el propio
`LICENSE-lucide.txt`, que trae las dos licencias y la lista; por eso se copia
entero y no solo la parte ISC.

**Cambios hechos sobre los originales**: de cada SVG se guarda solo lo de
dentro —los `<path>`, los `<circle>`—, sin el envoltorio `<svg>`. El envoltorio
lo pone `icon()`, que es quien decide tamaño, grosor y color, así que los de
fuera se dibujan exactamente igual que los de casa. Los dibujos no se han
tocado: ni un punto movido.

De los 2.112 se publican **1.884**. Los 228 que faltan son los que no encajan
en ninguno de los trece temas —flechas, chevrones, logotipos de marcas— y que
nadie va a poner de icono de una cuenta.

Lo que sí se añade es el español: Lucide está en inglés, y sin un diccionario
al lado buscar «coche» no encontraría `car`.

## Cómo se rehace

Se baja el paquete y se pasa la herramienta por encima:

```
npm pack lucide-static@1.47.0 && tar -xf lucide-static-*.tgz
node herramientas/iconos.js ./package
```

Escribe `js/iconos.js` y dice por consola cuántos han entrado en cada grupo.
La herramienta no corre nunca al abrir la app ni al compilar el APK: lo que se
publica es su resultado, que es un script clásico más.
