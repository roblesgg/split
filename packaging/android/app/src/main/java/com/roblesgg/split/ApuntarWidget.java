package com.roblesgg.split;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

/**
 * Un botón: abre la app directamente en «Nuevo gasto».
 *
 * No enseña ningún dato, así que no depende de la foto y nunca está
 * desactualizado. Es el widget que ahorra los tres toques de siempre —
 * abrir, buscar el botón, tocarlo— que son justo los que hacen que un
 * gasto pequeño acabe sin apuntarse.
 */
public class ApuntarWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager am, int[] ids) {
        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_apuntar);
            v.setOnClickPendingIntent(R.id.waRaiz,
                    WidgetDatos.abrirApp(ctx, WidgetDatos.ABRIR_GASTO, 3));
            am.updateAppWidget(id, v);
        }
    }
}
