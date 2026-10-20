package com.roblesgg.split;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;

/**
 * Saca una copia de los datos fuera de la app: la escribe en un archivo y
 * abre el menú de compartir de Android, para guardarla en Drive, mandarla
 * por correo o por WhatsApp, o dejarla en Archivos.
 *
 * Por qué hace falta: el botón de exportar de la parte web crea un archivo
 * con un enlace de descarga del navegador, y dentro del WebView de
 * Capacitor eso no guarda nada —se comprobó en un móvil real: tras pulsarlo
 * no aparece ningún archivo en todo el almacenamiento—. Pero la app decía
 * «Archivo descargado» igualmente.
 *
 * El archivo va a la caché privada de la app y se le pasa al menú de
 * compartir con un content:// del FileProvider que ya existe, así que no
 * hace falta ningún permiso de almacenamiento. Contiene las finanzas de
 * alguien: se tira el anterior cada vez, para que no se acumulen copias en
 * la caché, y Android puede vaciarla cuando quiera.
 */
@CapacitorPlugin(name = "Copia")
public class CopiaPlugin extends Plugin {

    private static final String CARPETA = "copias";

    /** Para que el lado web sepa si puede contar con esto. */
    @PluginMethod
    public void disponible(PluginCall call) {
        JSObject r = new JSObject();
        r.put("disponible", true);
        call.resolve(r);
    }

    @PluginMethod
    public void compartir(PluginCall call) {
        final String texto = call.getString("texto");
        String nombre = call.getString("nombre");

        if (texto == null || texto.isEmpty()) {
            call.reject("No hay nada que guardar.");
            return;
        }
        /* El nombre llega de la web: se deja en letras, números, punto,
           guion y guion bajo, y siempre acaba en .json. Nada de barras. */
        if (nombre == null || nombre.isEmpty()) nombre = "split.json";
        nombre = nombre.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!nombre.endsWith(".json")) nombre = nombre + ".json";

        final Context ctx = getContext();
        try {
            File dir = new File(ctx.getCacheDir(), CARPETA);
            if (!dir.exists() && !dir.mkdirs()) {
                call.reject("No se ha podido preparar la copia.");
                return;
            }
            File[] viejas = dir.listFiles();
            if (viejas != null) {
                for (File f : viejas) {
                    //noinspection ResultOfMethodCallIgnored
                    f.delete();
                }
            }

            File destino = new File(dir, nombre);
            Writer w = new OutputStreamWriter(new FileOutputStream(destino), StandardCharsets.UTF_8);
            try {
                w.write(texto);
            } finally {
                w.close();
            }

            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", destino);

            Intent envio = new Intent(Intent.ACTION_SEND);
            envio.setType("application/json");
            envio.putExtra(Intent.EXTRA_STREAM, uri);
            envio.putExtra(Intent.EXTRA_SUBJECT, "Copia de split");
            /* El permiso de lectura tiene que ir también en el ClipData: es
               lo que lo hace llegar a la app que elijas en el menú. */
            envio.setClipData(ClipData.newRawUri("copia", uri));
            envio.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent menu = Intent.createChooser(envio, "Guardar copia de split");
            menu.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(menu);

            JSObject r = new JSObject();
            r.put("bytes", destino.length());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("No se ha podido preparar la copia.");
        }
    }
}
