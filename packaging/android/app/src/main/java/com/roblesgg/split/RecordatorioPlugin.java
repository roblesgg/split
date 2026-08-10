package com.roblesgg.split;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.List;

/**
 * Recordatorios de cobros.
 *
 * Hay trabajos en los que no se sabe lo que se va a cobrar hasta que se
 * cobra. Para esos la app no apunta nada sola: avisa el día que toca, a la
 * hora que se le diga, y pregunta.
 *
 * El aviso tiene que salir aunque la app esté cerrada, así que lo lleva
 * AlarmManager y no un temporizador de JavaScript.
 *
 * Cómo funciona:
 *
 * - El lado web manda la lista completa de avisos cada vez que cambia algo.
 *   No se intenta actualizar uno suelto: recalcular la lista entera es más
 *   corto y no deja restos de programados borrados.
 * - Cada aviso es un día de la semana y una hora, así que se programa la
 *   próxima vez que caiga y, al saltar, se vuelve a programar para la
 *   semana siguiente. Repetir con setRepeating no vale: Android lo trata
 *   como inexacto y puede correrlo horas.
 * - Las alarmas NO sobreviven a un reinicio del teléfono. Por eso también
 *   se reprograma todo cada vez que se abre la app, que es lo que hace el
 *   lado web al arrancar.
 */
@CapacitorPlugin(
        name = "Recordatorio",
        permissions = {
                @Permission(alias = "avisos", strings = { android.Manifest.permission.POST_NOTIFICATIONS })
        })
public class RecordatorioPlugin extends Plugin {

    public static final String CANAL = "cobros";
    public static final String EXTRA_ID = "recordatorioId";
    public static final String EXTRA_TITULO = "recordatorioTitulo";
    public static final String EXTRA_TEXTO = "recordatorioTexto";
    public static final String EXTRA_DIA = "recordatorioDia";
    public static final String EXTRA_HORA = "recordatorioHora";
    public static final String EXTRA_MINUTO = "recordatorioMinuto";

    /** Los ids de alarma se derivan de esto para no chocar con nada. */
    private static final int BASE = 7000;

    @Override
    public void load() {
        crearCanal(getContext());
    }

    static void crearCanal(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CANAL) != null) return;

        NotificationChannel canal = new NotificationChannel(
                CANAL, "Cobros y pagos", NotificationManager.IMPORTANCE_DEFAULT);
        canal.setDescription("Avisos de lo que toca cobrar o pagar");
        nm.createNotificationChannel(canal);
    }

    /** ¿Puede la app enseñar notificaciones? */
    @PluginMethod
    public void disponible(PluginCall call) {
        JSObject r = new JSObject();
        r.put("permitido", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        call.resolve(r);
    }

    /** Pide el permiso de notificaciones (Android 13+). */
    @PluginMethod
    public void pedirPermiso(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) { call.resolve(); return; }
        requestPermissionForAlias("avisos", call, "trasPermiso");
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void trasPermiso(PluginCall call) {
        JSObject r = new JSObject();
        r.put("permitido", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        call.resolve(r);
    }

    /**
     * Reemplaza todos los avisos. Recibe { avisos: [{ id, titulo, texto,
     * dias: [0..6 con lunes=0], hora: "HH:MM" }] }.
     */
    @PluginMethod
    public void programar(PluginCall call) {
        borrarTodos();

        JSArray avisos = call.getArray("avisos");
        if (avisos == null) { call.resolve(); return; }

        int puestos = 0;
        try {
            List<JSONObject> lista = avisos.toList();
            for (int i = 0; i < lista.size(); i++) {
                JSONObject a = lista.get(i);
                String id = a.optString("id", "r" + i);
                String titulo = a.optString("titulo", "split");
                String texto = a.optString("texto", "");
                String hora = a.optString("hora", "09:00");

                String[] hm = hora.split(":");
                int h = hm.length > 0 ? parseInt(hm[0], 9) : 9;
                int m = hm.length > 1 ? parseInt(hm[1], 0) : 0;

                org.json.JSONArray dias = a.optJSONArray("dias");
                if (dias == null) continue;

                for (int d = 0; d < dias.length(); d++) {
                    int dia = dias.optInt(d, -1);
                    if (dia < 0 || dia > 6) continue;
                    programarUno(getContext(), BASE + puestos, id, titulo, texto, dia, h, m);
                    puestos++;
                    /* Tope de seguridad: nadie necesita mil alarmas, y así
                       un estado corrupto no llena el sistema. */
                    if (puestos >= 120) break;
                }
                if (puestos >= 120) break;
            }
        } catch (Exception e) {
            call.reject("no se han podido programar los avisos");
            return;
        }

        guardarCuantos(getContext(), puestos);

        JSObject r = new JSObject();
        r.put("programados", puestos);
        call.resolve(r);
    }

    private static int parseInt(String s, int porDefecto) {
        try { return Integer.parseInt(s.trim()); } catch (Exception e) { return porDefecto; }
    }

    /**
     * Programa una alarma para el próximo día de la semana indicado a esa
     * hora. Si hoy es ese día pero ya ha pasado la hora, se va a la semana
     * que viene: avisar de algo con la hora ya cumplida es ruido.
     */
    static void programarUno(Context ctx, int codigo, String id, String titulo,
                             String texto, int diaLunes0, int hora, int minuto) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, hora);
        c.set(Calendar.MINUTE, minuto);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);

        /* Calendar cuenta domingo = 1; la app cuenta lunes = 0. */
        int objetivo = ((diaLunes0 + 1) % 7) + 1;
        int guard = 0;
        while ((c.get(Calendar.DAY_OF_WEEK) != objetivo
                || c.getTimeInMillis() <= System.currentTimeMillis()) && guard++ < 10) {
            c.add(Calendar.DAY_OF_YEAR, 1);
        }

        Intent i = new Intent(ctx, RecordatorioReceiver.class);
        i.putExtra(EXTRA_ID, id);
        i.putExtra(EXTRA_TITULO, titulo);
        i.putExtra(EXTRA_TEXTO, texto);
        i.putExtra(EXTRA_DIA, diaLunes0);
        i.putExtra(EXTRA_HORA, hora);
        i.putExtra(EXTRA_MINUTO, minuto);

        PendingIntent pi = PendingIntent.getBroadcast(ctx, codigo, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        /* setExactAndAllowWhileIdle necesita un permiso que Android 12+ no
           da de oficio, así que se intenta y se cae a la versión inexacta,
           que para un aviso de «hoy cobras» vale de sobra: llegar diez
           minutos tarde no rompe nada. */
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.set(AlarmManager.RTC_WAKEUP, c.getTimeInMillis(), pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, c.getTimeInMillis(), pi);
            }
        } catch (SecurityException e) {
            am.set(AlarmManager.RTC_WAKEUP, c.getTimeInMillis(), pi);
        }
    }

    /** Quita las alarmas puestas la vez anterior. */
    private void borrarTodos() {
        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        int cuantos = leerCuantos(ctx);
        for (int i = 0; i < cuantos; i++) {
            Intent intent = new Intent(ctx, RecordatorioReceiver.class);
            PendingIntent pi = PendingIntent.getBroadcast(ctx, BASE + i, intent,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (pi != null) { am.cancel(pi); pi.cancel(); }
        }
        guardarCuantos(ctx, 0);
    }

    /* Cuántas alarmas hay puestas, para poder cancelarlas luego. Sobrevive
       a que la app se cierre, que es cuando hace falta. */
    private static void guardarCuantos(Context ctx, int n) {
        ctx.getSharedPreferences("split.recordatorios", Context.MODE_PRIVATE)
           .edit().putInt("cuantos", n).apply();
    }

    private static int leerCuantos(Context ctx) {
        return ctx.getSharedPreferences("split.recordatorios", Context.MODE_PRIVATE)
                  .getInt("cuantos", 0);
    }

    /** Lanza la notificación. La llama el receptor cuando salta la alarma. */
    static void avisar(Context ctx, int codigo, String titulo, String texto) {
        crearCanal(ctx);

        Intent abrir = new Intent(ctx, MainActivity.class);
        abrir.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, codigo, abrir,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new androidx.core.app.NotificationCompat.Builder(ctx, CANAL)
                .setSmallIcon(android.R.drawable.ic_menu_my_calendar)
                .setContentTitle(titulo)
                .setContentText(texto)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setPriority(androidx.core.app.NotificationCompat.PRIORITY_DEFAULT)
                .build();

        try {
            NotificationManagerCompat.from(ctx).notify(codigo, n);
        } catch (SecurityException e) {
            /* sin permiso de notificaciones: no se avisa y ya está */
        }
    }
}
