package com.roblesgg.split;

import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Desde Android 15 (targetSdk 35) el sistema fuerza el modo edge-to-edge:
 * la ventana ocupa toda la pantalla e ignora android:statusBarColor. Sin
 * hacer nada, el WebView se dibuja por debajo de la barra de notificaciones
 * y la cabecera de la app queda tapada.
 *
 * Aquí se leen los márgenes reales del sistema (barras + muesca de la
 * cámara) y se aplican como padding al contenedor. Así el contenido web
 * empieza justo debajo de la barra, y la franja que queda arriba muestra el
 * fondo de la ventana, que es el color de página de la app.
 *
 * Se hace a mano en vez de con statusBarColor porque ese atributo ya no
 * tiene efecto en Android 15+.
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

            view.setPadding(barras.left, barras.top, barras.right, barras.bottom);

            /* CONSUMED evita que los hijos vuelvan a aplicar el mismo
               margen y acaben con el doble de separación. */
            return WindowInsetsCompat.CONSUMED;
        });

        /* Si el teclado tapa un campo, el WebView se redimensiona solo:
           pedimos que nos vuelvan a pasar los insets al cambiar. */
        ViewCompat.requestApplyInsets(root);
    }
}
