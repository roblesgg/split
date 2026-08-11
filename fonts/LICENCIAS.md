# De dónde salen estos emojis

Los emojis de Apple, Samsung y Xiaomi son fuentes propietarias. No se pueden
redistribuir dentro de otra app, así que aquí no están y no van a estar: quien
tenga un Samsung los ve porque se los pone su móvil, no porque los traiga split.

Lo que sí se puede meter son juegos con licencia abierta. Hay dos, convertidos
a `woff2` para que ocupen lo menos posible:

**Cambios hechos sobre los originales**: los dos archivos se han convertido de
`ttf` a `woff2`. Nada más: ni se han recortado glifos ni se ha retocado ningún
dibujo. La CC-BY obliga a decirlo, y aquí queda dicho.

El texto completo de cada licencia viaja al lado, en `LICENSE-OFL-1.1.txt` y
`LICENSE-twemoji.txt`, y se copia dentro del APK con las fuentes.

## noto-emoji.woff2

- **Original**: `Noto-COLRv1.ttf` de [googlefonts/noto-emoji](https://github.com/googlefonts/noto-emoji)
- **Licencia**: SIL Open Font License 1.1 (`LICENSE-OFL-1.1.txt`)
- **Tamaño**: 5,0 MB el original → 1,9 MB en woff2
- Es el juego de Google: lo que se ve en un Pixel y en la mayoría de Android
  sin capa encima.
- Se dibuja más grande que los demás (1,245 em de avance frente a 1,0), así que
  el `@font-face` lleva `size-adjust: 80 %`. Con eso ocupa exactamente lo mismo
  que el del sistema y no descoloca las líneas de texto.

## twemoji.woff2

- **Original**: `Twemoji.Mozilla.ttf` de [mozilla/twemoji-colr](https://github.com/mozilla/twemoji-colr)
- **Licencia**: el dibujo es de Twemoji, **CC-BY 4.0**; la herramienta que hace
  la fuente es de Mozilla, Apache 2.0 (`LICENSE-twemoji.txt`).
- **Tamaño**: 1,4 MB el original → 0,5 MB en woff2
- Es el juego plano de Twitter, el que usa Firefox en Linux. Sin degradados ni
  sombras: pega con el resto de la app.
- **La CC-BY obliga a dar crédito**, y por eso el crédito aparece en Ajustes
  cuando se elige este juego, no solo en este archivo.

## Cómo se rehacen

```sh
curl -L -o noto.ttf \
  https://raw.githubusercontent.com/googlefonts/noto-emoji/main/fonts/Noto-COLRv1.ttf
curl -L -o twemoji.ttf \
  https://github.com/mozilla/twemoji-colr/releases/latest/download/Twemoji.Mozilla.ttf

pip install fonttools brotli
python3 - <<'PY'
from fontTools.ttLib import TTFont
for entrada, salida in (("noto.ttf", "noto-emoji.woff2"),
                        ("twemoji.ttf", "twemoji.woff2")):
    f = TTFont(entrada)
    f.flavor = "woff2"
    f.save(salida)
PY
```

No se recortan a un puñado de emojis a propósito: el nombre de una categoría lo
escribe cada uno con el teclado de su móvil, y un juego incompleto dejaría unos
emojis con el estilo elegido y otros con el del sistema.
