package com.roblesgg.split;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * El puente entre la app y los widgets de la pantalla de inicio.
 *
 * Un widget es una vista del sistema: se dibuja fuera del WebView, con la
 * app cerrada, y no puede leer localStorage, que es donde está todo. Así
 * que la app le deja una foto pequeña en SharedPreferences y el widget
 * pinta esa foto.
 *
 * Aquí no se decide nada: se guarda lo que llega y se avisa a los widgets
 * de que hay foto nueva. Qué se enseña lo decide el lado web, que es quien
 * sabe de dinero, y los textos vienen ya formateados para que no haya dos
 * sitios distintos donde se escribe un euro en español.
 */
@CapacitorPlugin(name = "Widgets")
public class WidgetsPlugin extends Plugin {

    /**
     * Guarda la foto y repinta los widgets que haya puestos.
     *
     * Se responde siempre bien: que no haya ningún widget colocado no es un
     * error, es lo normal hasta que alguien pone el primero.
     */
    @PluginMethod
    public void publicar(PluginCall call) {
        JSObject datos = call.getData();
        WidgetDatos.guardar(getContext(), datos);
        WidgetDatos.repintarTodos(getContext());

        JSObject r = new JSObject();
        r.put("ok", true);
        call.resolve(r);
    }
}
