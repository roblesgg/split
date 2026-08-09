package com.roblesgg.split;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Descarga el APK de la nueva versión desde la propia app y abre el
 * instalador, sin pasar por el navegador.
 *
 * Lo que NO se puede evitar: Android siempre enseña su pantalla de
 * confirmación antes de instalar. Ninguna app puede instalarse sola en
 * silencio salvo que sea propietaria del dispositivo. Lo que se ahorra
 * aquí es el navegador, la descarga en la bandeja de notificaciones y el
 * ir a buscar el archivo a mano.
 *
 * El APK va a la carpeta privada de la app (getExternalFilesDir), que no
 * necesita permisos de almacenamiento, y se le pasa al instalador con un
 * content:// del FileProvider, porque desde Android 7 un file:// en un
 * intent revienta con FileUriExposedException.
 */
@CapacitorPlugin(name = "Actualizador")
public class ActualizadorPlugin extends Plugin {

    private static final String FICHERO = "split-update.apk";

    private long idDescarga = -1;
    private BroadcastReceiver receptor = null;
    private Handler reloj = null;
    private Runnable sonda = null;

    /** Para que el lado web sepa si puede contar con esto. */
    @PluginMethod
    public void disponible(PluginCall call) {
        JSObject r = new JSObject();
        r.put("disponible", true);
        r.put("permiso", puedeInstalar());
        call.resolve(r);
    }

    /** Abre los ajustes donde se concede el permiso de instalar. */
    @PluginMethod
    public void pedirPermiso(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !puedeInstalar()) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void descargar(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Falta la dirección del APK.");
            return;
        }

        if (!puedeInstalar()) {
            /* Sin este permiso la descarga no sirve de nada: el instalador
               se abriría y Android lo cortaría. Mejor avisar antes. */
            call.reject("sin-permiso");
            return;
        }

        final Context ctx = getContext();
        final DownloadManager dm =
                (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) { call.reject("Este móvil no tiene gestor de descargas."); return; }

        /* si quedó un intento anterior a medias, se tira */
        File destino = new File(ctx.getExternalFilesDir(null), FICHERO);
        if (destino.exists() && !destino.delete()) {
            call.reject("No se ha podido preparar la descarga.");
            return;
        }

        DownloadManager.Request req;
        try {
            req = new DownloadManager.Request(Uri.parse(url));
        } catch (Exception e) {
            call.reject("Dirección no válida."); return;
        }
        req.setTitle("split");
        req.setDescription("Descargando la actualización");
        req.setDestinationInExternalFilesDir(ctx, null, FICHERO);
        req.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        req.setMimeType("application/vnd.android.package-archive");

        limpiar();
        idDescarga = dm.enqueue(req);

        receptor = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id != idDescarga) return;
                limpiarSonda();
                if (descargaCorrecta(dm)) {
                    emitir("instalando", 100);
                    instalar();
                } else {
                    emitir("error", 0);
                }
                limpiar();
            }
        };

        /* Android 14 exige declarar si el receptor acepta emisiones de
           fuera; la de DownloadManager la manda el sistema. */
        ContextCompat.registerReceiver(ctx, receptor,
                new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                ContextCompat.RECEIVER_EXPORTED);

        arrancarSonda(dm);
        emitir("descargando", 0);
        call.resolve();
    }

    /* ---------- interioridades ---------- */

    private boolean puedeInstalar() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    private boolean descargaCorrecta(DownloadManager dm) {
        Cursor c = dm.query(new DownloadManager.Query().setFilterById(idDescarga));
        boolean ok = false;
        if (c != null) {
            if (c.moveToFirst()) {
                int col = c.getColumnIndex(DownloadManager.COLUMN_STATUS);
                ok = col >= 0 && c.getInt(col) == DownloadManager.STATUS_SUCCESSFUL;
            }
            c.close();
        }
        return ok;
    }

    /** Va mirando cuánto lleva descargado para poder pintar la barra. */
    private void arrancarSonda(final DownloadManager dm) {
        reloj = new Handler(Looper.getMainLooper());
        sonda = new Runnable() {
            @Override
            public void run() {
                Cursor c = dm.query(new DownloadManager.Query().setFilterById(idDescarga));
                if (c != null) {
                    if (c.moveToFirst()) {
                        int iHecho = c.getColumnIndex(
                                DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
                        int iTotal = c.getColumnIndex(
                                DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
                        if (iHecho >= 0 && iTotal >= 0) {
                            long hecho = c.getLong(iHecho), total = c.getLong(iTotal);
                            if (total > 0) {
                                emitir("descargando", (int) (hecho * 100 / total));
                            }
                        }
                    }
                    c.close();
                }
                if (reloj != null) reloj.postDelayed(this, 400);
            }
        };
        reloj.postDelayed(sonda, 400);
    }

    private void instalar() {
        try {
            File apk = new File(getContext().getExternalFilesDir(null), FICHERO);
            Uri uri = FileProvider.getUriForFile(getContext(),
                    getContext().getPackageName() + ".fileprovider", apk);

            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            emitir("error", 0);
        }
    }

    private void emitir(String fase, int pct) {
        JSObject d = new JSObject();
        d.put("fase", fase);
        d.put("pct", pct);
        notifyListeners("progreso", d);
    }

    private void limpiarSonda() {
        if (reloj != null && sonda != null) reloj.removeCallbacks(sonda);
        reloj = null;
        sonda = null;
    }

    private void limpiar() {
        limpiarSonda();
        if (receptor != null) {
            try { getContext().unregisterReceiver(receptor); } catch (Exception ignored) {}
            receptor = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        limpiar();
        super.handleOnDestroy();
    }
}
