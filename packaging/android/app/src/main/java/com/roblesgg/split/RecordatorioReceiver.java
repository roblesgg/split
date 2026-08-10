package com.roblesgg.split;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Recibe la alarma de un recordatorio, enseña la notificación y vuelve a
 * programarla para la semana siguiente.
 *
 * Lo segundo es lo importante: AlarmManager solo dispara una vez. La
 * alternativa, setRepeating, Android la trata como inexacta y puede
 * correrla horas, que en un aviso de «hoy cobras a las tres» es la
 * diferencia entre servir y no servir.
 */
public class RecordatorioReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (intent == null) return;

        String id = intent.getStringExtra(RecordatorioPlugin.EXTRA_ID);
        String titulo = intent.getStringExtra(RecordatorioPlugin.EXTRA_TITULO);
        String texto = intent.getStringExtra(RecordatorioPlugin.EXTRA_TEXTO);
        int dia = intent.getIntExtra(RecordatorioPlugin.EXTRA_DIA, -1);
        int hora = intent.getIntExtra(RecordatorioPlugin.EXTRA_HORA, 9);
        int minuto = intent.getIntExtra(RecordatorioPlugin.EXTRA_MINUTO, 0);

        int codigo = (id == null ? "r" : id).hashCode() & 0x0000ffff;
        RecordatorioPlugin.avisar(ctx, codigo,
                titulo == null ? "split" : titulo,
                texto == null ? "" : texto);

        /* Y otra vez dentro de siete días. Se reutiliza el mismo código de
           alarma, que es el que la app cancelará cuando reprograme. */
        if (dia >= 0) {
            RecordatorioPlugin.programarUno(ctx, requestCodeDe(intent), id,
                    titulo == null ? "split" : titulo,
                    texto == null ? "" : texto,
                    dia, hora, minuto);
        }
    }

    /* El código con el que se puso esta alarma no viaja en el intent, así
       que se deriva igual que en la notificación: da un número estable por
       recordatorio y día. */
    private int requestCodeDe(Intent intent) {
        String id = intent.getStringExtra(RecordatorioPlugin.EXTRA_ID);
        int dia = intent.getIntExtra(RecordatorioPlugin.EXTRA_DIA, 0);
        return 7000 + (((id == null ? "r" : id) + "#" + dia).hashCode() & 0x000000ff);
    }
}
