package com.roblesgg.split;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.RemoteViews;

import androidx.core.content.ContextCompat;

/**
 * El límite del mes que esté más apurado.
 *
 * Es el que se quiere mirar sin abrir nada: el que está a punto de
 * reventar. Si tienes cinco límites y cuatro van bien, el quinto es la
 * única noticia.
 *
 * La severidad la lleva el texto y no solo el color de la barra: en un
 * widget de dos dedos de alto, y con el fondo que cada uno tenga puesto,
 * un color no se lee.
 */
public class LimiteWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager am, int[] ids) {
        for (int id : ids) pintar(ctx, am, id);
    }

    /** Al estirarlo o encogerlo hay que volver a pintar: cambia el layout. */
    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager am,
                                          int id, Bundle nuevas) {
        super.onAppWidgetOptionsChanged(ctx, am, id, nuevas);
        pintar(ctx, am, id);
    }

    static void pintar(Context ctx, AppWidgetManager am, int id) {
        SharedPreferences p = WidgetDatos.prefs(ctx);
        RemoteViews v = new RemoteViews(ctx.getPackageName(),
                WidgetMedida.esCorto(am, id)
                        ? R.layout.widget_limite_corto
                        : R.layout.widget_limite);

        boolean hay = p.getBoolean(WidgetDatos.HAY_LIMITE, false);

        if (hay) {
            String nivel = p.getString(WidgetDatos.LIMITE_NIVEL, "ok");
            int pct = Math.max(0, Math.min(100, p.getInt(WidgetDatos.LIMITE_PCT, 0)));

            v.setTextViewText(R.id.wlNombre, p.getString(WidgetDatos.LIMITE_NOMBRE, ""));
            v.setTextViewText(R.id.wlPct, pct + " %");
            v.setTextViewText(R.id.wlQueda, p.getString(WidgetDatos.LIMITE_QUEDA, ""));
            v.setTextViewText(R.id.wlTexto, p.getString(WidgetDatos.LIMITE_TEXTO, ""));
            v.setProgressBar(R.id.wlBarra, 100, pct, false);

            int color = ContextCompat.getColor(ctx,
                    "pasado".equals(nivel) ? R.color.widgetMal
                            : "cerca".equals(nivel) ? R.color.widgetAviso
                            : R.color.widgetBien);
            v.setTextColor(R.id.wlPct, color);
        } else {
            /* Sin límites puestos no hay nada que enseñar, y decirlo es
               mejor que una barra a cero que parece un límite gastado. */
            v.setTextViewText(R.id.wlNombre, ctx.getString(R.string.widget_sin_limites_titulo));
            v.setTextViewText(R.id.wlPct, "");
            v.setTextViewText(R.id.wlQueda, ctx.getString(R.string.widget_sin_limites_pie));
            v.setTextViewText(R.id.wlTexto, "");
            v.setProgressBar(R.id.wlBarra, 100, 0, false);
        }

        v.setOnClickPendingIntent(R.id.wlRaiz, WidgetDatos.abrirApp(ctx, null, 2));
        am.updateAppWidget(id, v);
    }
}
