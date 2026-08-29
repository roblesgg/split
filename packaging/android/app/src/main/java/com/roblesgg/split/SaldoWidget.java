package com.roblesgg.split;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.RemoteViews;

import androidx.core.content.ContextCompat;

/**
 * El saldo de la cuenta con la que operas, en la pantalla de inicio.
 *
 * Cuál es esa cuenta no se pregunta al colocar el widget: es la que manda
 * en el Resumen, que la app ya recuerda de una vez para otra. Así hay un
 * solo sitio donde se elige la cuenta y el widget nunca enseña una
 * distinta de la que ves al abrir.
 *
 * El nombre de la cuenta va siempre delante del saldo: sin él, una cifra
 * suelta en la pantalla de inicio no dice de qué es.
 */
public class SaldoWidget extends AppWidgetProvider {

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
                        ? R.layout.widget_saldo_corto
                        : R.layout.widget_saldo);

        boolean hay = p.getBoolean(WidgetDatos.HAY, false);

        if (hay) {
            v.setTextViewText(R.id.wsNombre, p.getString(WidgetDatos.CUENTA_NOMBRE, ""));
            v.setTextViewText(R.id.wsSaldo, p.getString(WidgetDatos.CUENTA_SALDO, ""));
            v.setTextViewText(R.id.wsTipo, p.getString(WidgetDatos.CUENTA_TIPO, ""));
            /* La pastilla de color es blanca en el dibujo y se tiñe aquí:
               el color lo trae la app y un drawable no puede saberlo. */
            v.setInt(R.id.wsRail, "setColorFilter", WidgetDatos.color(
                    ctx, p.getString(WidgetDatos.CUENTA_COLOR, ""),
                    ContextCompat.getColor(ctx, R.color.colorAccent)));
        } else {
            /* Antes de abrir la app por primera vez no hay foto que pintar.
               Se dice, en vez de enseñar un 0,00 € que no es verdad. */
            v.setTextViewText(R.id.wsNombre, ctx.getString(R.string.widget_sin_datos_titulo));
            v.setTextViewText(R.id.wsSaldo, "—");
            v.setTextViewText(R.id.wsTipo, ctx.getString(R.string.widget_sin_datos_pie));
            v.setInt(R.id.wsRail, "setColorFilter",
                    ContextCompat.getColor(ctx, R.color.widgetCarril));
        }

        v.setOnClickPendingIntent(R.id.wsRaiz, WidgetDatos.abrirApp(ctx, null, 1));
        am.updateAppWidget(id, v);
    }
}
