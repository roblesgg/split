package com.roblesgg.split;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

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
 * detrás de la barra, que es como debe verse.
 *
 * Para que la barra de pestañas no acabe debajo del gesto de navegación, el
 * hueco de abajo se le pasa al CSS en --safe-b-native. Se hace así y no con
 * env(safe-area-inset-bottom) porque en el WebView de Android ese valor no
 * es de fiar; el CSS lo usa igualmente como respaldo.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final View root = findViewById(android.R.id.content);

        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets barras = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                            | WindowInsetsCompat.Type.displayCutout());

            /* el 0 de abajo es lo que deja que la app llegue al borde */
            view.setPadding(barras.left, barras.top, barras.right, 0);

            /* en píxeles CSS, no físicos: el CSS razona en los primeros */
            float densidad = getResources().getDisplayMetrics().density;
            int abajo = Math.round(barras.bottom / densidad);
            pasarHuecoAlWeb(abajo);

            /* CONSUMED evita que los hijos vuelvan a aplicar el mismo
               margen y acaben con el doble de separación. */
            return WindowInsetsCompat.CONSUMED;
        });

        /* Si el teclado tapa un campo, el WebView se redimensiona solo:
           pedimos que nos vuelvan a pasar los insets al cambiar. */
        ViewCompat.requestApplyInsets(root);
    }

    private void pasarHuecoAlWeb(final int abajoCss) {
        if (getBridge() == null) return;
        final WebView web = getBridge().getWebView();
        if (web == null) return;

        /* evaluateJavascript exige el hilo de interfaz */
        web.post(new Runnable() {
            @Override
            public void run() {
                web.evaluateJavascript(
                        "document.documentElement.style.setProperty("
                                + "'--safe-b-native','" + abajoCss + "px')",
                        null);
            }
        });
    }
}
