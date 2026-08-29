package com.roblesgg.split;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;

/**
 * Un botón: abre la app directamente en «Nuevo gasto».
 *
 * No enseña ningún dato, así que no depende de la foto y nunca está
 * desactualizado. Es el widget que ahorra los tres toques de siempre —
 * abrir, buscar el botón, tocarlo— que son justo los que hacen que un
 * gasto pequeño acabe sin apuntarse.
 *
 * En una sola celda se queda solo el círculo: el rótulo no cabe, y un
 * «+» en el color de la app se entiende sin leer nada.
 */
public class ApuntarWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager am, int[] ids) {
        for (int id : ids) pintar(ctx, am, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager am,
                                          int id, Bundle nuevas) {
        super.onAppWidgetOptionsChanged(ctx, am, id, nuevas);
        pintar(ctx, am, id);
    }

    static void pintar(Context ctx, AppWidgetManager am, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(),
                WidgetMedida.esCorto(am, id)
                        ? R.layout.widget_apuntar_corto
                        : R.layout.widget_apuntar);
        v.setOnClickPendingIntent(R.id.waRaiz,
                WidgetDatos.abrirApp(ctx, WidgetDatos.ABRIR_GASTO, 3));
        am.updateAppWidget(id, v);
    }
}
