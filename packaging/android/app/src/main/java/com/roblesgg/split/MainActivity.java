package com.roblesgg.split;

import android.os.Bundle;
import android.view.ActionMode;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/**
 * Desde Android 15 (targetSdk 35) el sistema fuerza el modo edge-to-edge:
 * la ventana ocupa toda la pantalla e ignora android:statusBarColor y
 * android:navigationBarColor. Hay que repartir a mano el hueco de las
 * barras, y arriba y abajo no interesa lo mismo.
 *
 * ARRIBA se aparta el contenido, porque si no la cabecera de la app queda
 * debajo del reloj y no se lee.
 *
 * ABAJO no. Apartarlo dejaba al descubierto una franja con el fondo de la
 * ventana, que se veía como un trozo negro pegado a la barra de navegación.
 * El WebView llega hasta el borde y es la propia app la que se ve por
 * detrás de la barra.
 *
 * El hueco de abajo se le pasa al CSS en --safe-b-native, y así la barra de
 * pestañas se separa lo que mida la barra de ese móvil en concreto: no es
 * lo mismo el gesto (~24dp) que los tres botones (~48dp), y hay fabricantes
 * con sus propias medidas.
 *
 * Se manda el valor y NO se calcula en CSS con env(safe-area-inset-bottom)
 * porque en el WebView de Android ese valor no es de fiar.
 */
public class MainActivity extends BridgeActivity {

    /** Último hueco conocido, en píxeles CSS. */
    private int huecoAbajo = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* Antes de super.onCreate, que es cuando Capacitor carga la página:
           un plugin registrado después no lo vería el lado web. */
        registerPlugin(ActualizadorPlugin.class);

        super.onCreate(savedInstanceState);

        /* La página tarda en cargar más de lo que tarda la primera pasada de
           layout. Si solo se inyectara al recibir los insets, el documento
           que recibe el valor sería el de antes de cargar la app y se
           perdería al reemplazarlo. Por eso se vuelve a inyectar cada vez
           que termina de cargar. */
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                pasarHuecoAlWeb();
            }
        });

        quitarSeleccionDeTexto();

        final View root = findViewById(android.R.id.content);

        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets barras = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                            | WindowInsetsCompat.Type.displayCutout());

            /* el 0 de abajo es lo que deja que la app llegue al borde */
            view.setPadding(barras.left, barras.top, barras.right, 0);

            /* en píxeles CSS, no físicos: el CSS razona en los primeros */
            float densidad = getResources().getDisplayMetrics().density;
            huecoAbajo = Math.round(barras.bottom / densidad);
            pasarHuecoAlWeb();

            /* CONSUMED evita que los hijos vuelvan a aplicar el mismo
               margen y acaben con el doble de separación. */
            return WindowInsetsCompat.CONSUMED;
        });

        /* Si el teclado tapa un campo, el WebView se redimensiona solo:
           pedimos que nos vuelvan a pasar los insets al cambiar. */
        ViewCompat.requestApplyInsets(root);
    }

    /**
     * El WebView es un visor de páginas, y una página se puede seleccionar:
     * al mantener pulsado cualquier sitio salían los agarraderos azules, la
     * lupa y el menú de copiar. En una app eso no pinta nada.
     *
     * El CSS ya lo apaga con user-select, pero conviene cortarlo también
     * aquí: el WebView de Android no siempre le hace caso —depende de la
     * versión de System WebView que lleve el móvil— y el gesto largo lo
     * atiende la vista nativa antes de que el CSS tenga nada que decir.
     *
     * Esto no afecta a la pulsación larga de la app (mantener pulsada una
     * categoría para editarla), que la lleva el JavaScript con sus propios
     * eventos de toque y no con el long click de Android.
     */
    private void quitarSeleccionDeTexto() {
        if (getBridge() == null) return;
        final WebView web = getBridge().getWebView();
        if (web == null) return;

        web.setLongClickable(false);
        web.setHapticFeedbackEnabled(false);
        web.setOnLongClickListener(v -> true);   // consumido: no llega a nadie
    }

    /**
     * Y si aun así algo consiguiera arrancar una selección, aquí se corta la
     * barra flotante de Copiar / Compartir / Buscar antes de que aparezca.
     */
    @Override
    public void onActionModeStarted(ActionMode mode) {
        if (mode != null) mode.finish();
        super.onActionModeStarted(mode);
    }

    private void pasarHuecoAlWeb() {
        if (getBridge() == null) return;
        final WebView web = getBridge().getWebView();
        if (web == null) return;

        final String js = "document.documentElement.style.setProperty("
                + "'--safe-b-native','" + huecoAbajo + "px')";

        /* evaluateJavascript exige el hilo de interfaz */
        web.post(new Runnable() {
            @Override
            public void run() {
                web.evaluateJavascript(js, null);
            }
        });
    }
}
