# Empaquetado Android

Esta carpeta convierte la app en un **APK**. Vive aparte a propósito: la app de
arriba sigue siendo HTML/CSS/JS puro que se abre con doble clic, y no sabe nada
de todo esto. Si borras `packaging/`, la app sigue funcionando igual.

Usa [Capacitor](https://capacitorjs.com), que mete los archivos **dentro** del
APK. No hay servidor detrás: la app funciona sin internet y los datos siguen en
el almacenamiento local del móvil.

## Regenerar el APK después de tocar la app

```powershell
cd packaging
npm run apk
```

El APK sale en `android\app\build\outputs\apk\debug\app-debug.apk`.

`npm run apk` hace tres cosas: copia la app a `www/`, la sincroniza con el
proyecto Android y lanza Gradle.

## Requisitos y el detalle del JDK

- Android SDK (viene con Android Studio)
- **Java 21.** Capacitor 7 lo exige. Si tienes `JAVA_HOME` apuntando a un JDK 17
  el build falla con `invalid source release: 21`. La solución sin instalar nada
  es usar el JDK que trae Android Studio:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

## Instalarlo en el móvil

1. Copia `split.apk` (está en la raíz del repo) al teléfono por cable, Drive o
   WhatsApp contigo mismo.
2. Ábrelo desde el móvil. Android pedirá permiso para **instalar apps de origen
   desconocido**; hay que dárselo a la app desde la que lo abres (Archivos,
   Chrome…).
3. Listo. Aparece como **split** con su icono.

Con el móvil conectado por USB y la depuración USB activada también vale:

```powershell
adb install -r split.apk
```

## Sobre la firma

El APK está firmado con la **clave de depuración** de Android. Sirve para
instalarlo tú y usarlo, pero:

- No vale para subirlo a Google Play.
- Si algún día generas un APK de *release* con otra clave, Android lo tratará
  como una app distinta: habría que desinstalar esta primero, y **se perderían
  los datos guardados**. Exporta antes desde Ajustes → Exportar.

## Iconos

Están en `assets/`, generados con `scratchpad/gen_iconos.mjs`, que dibuja la
marca en un canvas y la centra midiendo la **tinta real del glifo**
(`actualBoundingBox*`). Centrarla con `text-anchor`/`dominant-baseline` de SVG
la dejaba baja, porque esos se apoyan en las métricas de la fuente y no en el
dibujo de la letra.

Para regenerarlos tras cambiar el diseño:

```powershell
node ..\..\..\scratchpad\gen_iconos.mjs      # o donde tengas el script
npx @capacitor/assets generate --android --assetPath assets
```

## Qué NO se sube al repo

`node_modules/`, `www/` y `android/build/` son generados. Están en `.gitignore`.
El proyecto `android/` sí conviene versionarlo si quieres conservar los ajustes
de tema de las barras del sistema (`res/values/styles.xml` y `values-night/`).
