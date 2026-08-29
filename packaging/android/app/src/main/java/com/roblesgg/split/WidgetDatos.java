package com.roblesgg.split;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;

import org.json.JSONObject;

/**
 * La foto que los widgets pintan, y cómo se abre la app desde ellos.
 *
 * Vive aparte de los widgets porque los tres la comparten: uno enseña el
 * saldo, otro el límite más apurado y el tercero solo abre a apuntar, pero
 * los tres leen del mismo sitio y los tres tienen que abrir la app igual.
 *
 * La foto se guarda en SharedPreferences y no en un archivo: son cuatro
 * cadenas, se leen en el hilo principal al pintar el widget, y para eso
 * SharedPreferences está pensado.
 */
final class WidgetDatos {

    private WidgetDatos() { }

    static final String PREFS = "split.widgets";

    /** Lo que la app manda desde el lado web. Los textos, ya formateados. */
    static final String HAY = "hay";
    static final String CUENTA_NOMBRE = "cuentaNombre";
    static final String CUENTA_TIPO = "cuentaTipo";
    static final String CUENTA_SALDO = "cuentaSaldo";
    static final String CUENTA_COLOR = "cuentaColor";
    static final String HAY_LIMITE = "hayLimite";
    static final String LIMITE_NOMBRE = "limiteNombre";
    static final String LIMITE_TEXTO = "limiteTexto";
    static final String LIMITE_QUEDA = "limiteQueda";
    static final String LIMITE_PCT = "limitePct";
    static final String LIMITE_NIVEL = "limiteNivel";

    /** Con qué pantalla abrir la app al tocar el widget. */
    static final String EXTRA_ABRIR = "abrir";
    static final String ABRIR_GASTO = "gasto";

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /**
     * Guarda lo que llegue, campo a campo. Se leen del JSON con un valor
     * por defecto: una app vieja que mande menos campos no puede dejar el
     * widget a medias, y un campo que falte simplemente no se enseña.
     */
    static void guardar(Context ctx, JSONObject d) {
        if (d == null) return;
        SharedPreferences.Editor e = prefs(ctx).edit();

        e.putBoolean(HAY, d.optBoolean("hay", false));
        e.putString(CUENTA_NOMBRE, d.optString("cuentaNombre", ""));
        e.putString(CUENTA_TIPO, d.optString("cuentaTipo", ""));
        e.putString(CUENTA_SALDO, d.optString("cuentaSaldo", ""));
        e.putString(CUENTA_COLOR, d.optString("cuentaColor", ""));

        e.putBoolean(HAY_LIMITE, d.optBoolean("hayLimite", false));
        e.putString(LIMITE_NOMBRE, d.optString("limiteNombre", ""));
        e.putString(LIMITE_TEXTO, d.optString("limiteTexto", ""));
        e.putString(LIMITE_QUEDA, d.optString("limiteQueda", ""));
        e.putInt(LIMITE_PCT, d.optInt("limitePct", 0));
        e.putString(LIMITE_NIVEL, d.optString("limiteNivel", "ok"));

        e.apply();
    }

    /**
     * Un color que viene del lado web («#5b62f0»). Si no viniera, o
     * viniera mal, se usa el acento de la app: un widget sin color se ve
     * raro, pero uno que revienta al pintar no se ve en absoluto.
     */
    static int color(Context ctx, String hex, int siNo) {
        if (hex == null || hex.length() < 4) return siNo;
        try {
            return Color.parseColor(hex.trim());
        } catch (IllegalArgumentException ex) {
            return siNo;
        }
    }

    /**
     * Abrir la app. `donde` puede ser null (abre por donde estuviera) o
     * ABRIR_GASTO, que la abre directamente en «Nuevo gasto».
     *
     * FLAG_IMMUTABLE es obligatorio desde Android 12 y no molesta antes:
     * este PendingIntent no lo tiene que rellenar nadie.
     */
    static PendingIntent abrirApp(Context ctx, String donde, int codigo) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(Intent.ACTION_MAIN);
        i.addCategory(Intent.CATEGORY_LAUNCHER);
        /* SINGLE_TOP + la actividad en singleTask: si la app ya está
           abierta se le entrega el intent en vez de arrancar otra. */
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (donde != null) i.putExtra(EXTRA_ABRIR, donde);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(ctx, codigo, i, flags);
    }

    /**
     * Repinta los widgets que enseñan datos. Se llama cada vez que la app
     * manda foto nueva.
     *
     * El de apuntar no está aquí a propósito: no enseña ningún dato, solo
     * abre la app, así que no hay nada que repintarle nunca.
     *
     * Se hace con un broadcast de ACTION_APPWIDGET_UPDATE y no llamando a
     * onUpdate a mano: así pasa por el mismo camino que usa el sistema y
     * no hay dos formas de repintar que puedan divergir.
     */
    static void repintarTodos(Context ctx) {
        avisar(ctx, SaldoWidget.class);
        avisar(ctx, LimiteWidget.class);
    }

    private static void avisar(Context ctx, Class<?> widget) {
        AppWidgetManager am = AppWidgetManager.getInstance(ctx);
        ComponentName cn = new ComponentName(ctx, widget);
        int[] ids = am.getAppWidgetIds(cn);
        if (ids == null || ids.length == 0) return;   /* ninguno puesto */

        Intent i = new Intent(ctx, widget);
        i.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        ctx.sendBroadcast(i);
    }
}
