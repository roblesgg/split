package com.roblesgg.split;

import android.appwidget.AppWidgetManager;
import android.os.Bundle;

/**
 * De qué tamaño lo ha dejado el usuario.
 *
 * Un widget se puede estirar y encoger, y el sistema no reparte el
 * contenido: si no se hace nada, el mismo layout se pinta igual en una
 * fila que en cuatro, con los renglones apretados o flotando en medio.
 * Así que se mira el alto que tiene y se elige layout.
 *
 * El alto llega en `dp` a través de las opciones del widget, que existen
 * desde Android 4.1. En Android 12 y más hay una forma más fina —dar un
 * layout por tamaño y que el sistema elija—, pero haría falta mantener
 * dos caminos que hacen lo mismo. Este vale en todas las versiones.
 *
 * El corte está en 100 dp porque una fila del escritorio son unos 70 y
 * dos rondan las 110: por debajo de ahí solo cabe un renglón, y meter
 * tres con calzador es la forma segura de que no se lea ninguno.
 */
final class WidgetMedida {

    private WidgetMedida() { }

    private static final int CORTE = 100;

    /** true si el widget es de una sola fila y toca la versión corta. */
    static boolean esCorto(AppWidgetManager am, int id) {
        if (am == null) return false;
        Bundle o = am.getAppWidgetOptions(id);
        if (o == null) return false;

        int alto = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        /* 0 es «todavía no se sabe»: pasa en la primera pasada, antes de
           que el lanzador mida. Ahí se pinta el normal, que es el tamaño
           con el que el widget se coloca. */
        return alto > 0 && alto < CORTE;
    }
}
