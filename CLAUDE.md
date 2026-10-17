# Split · Contexto para agentes

> Léelo entero antes de tocar nada. Es corto a propósito: Split es mantenimiento ligero, no un proyecto en construcción.

## Quién manda aquí

- **Dueño:** Álvaro Robles (DripDev). Háblale en español de España, de tú, claro y directo. Sin jerga.
- **Jefe de proyectos:** otra sesión de Claude Code que coordina todos los proyectos de DripDev. Puede escribirte, y tú a él con `SendMessage`.

  **Cómo encontrarle:** los nombres de sesión (`documents-xx`) los pone Claude Code y **cambian al reiniciar VS Code**. La agenda está en `C:\Users\roble\Documents\DripDev\SESIONES.md`. Nada más arrancar: ejecuta `ListAgents`, **actualiza tu fila** en ese archivo y lee las demás. Si el nombre que figura ya no existe, repite `ListAgents`, preséntate al candidato y corrige la tabla.

  Avísale cuando: toques algo que afecte a otros proyectos o a la marca, no puedas hacer un `git push`, o encuentres algo gordo.
- **Tú:** el agente que mantiene Split. Las conversaciones con Álvaro van en tu propio chat.

## Lo que más importa

**Álvaro usa Split todos los días, en su móvil, con sus cuentas de verdad.** Esto no es una app en desarrollo: es una herramienta en uso.

- **Los datos viven en el móvil** (IndexedDB y localStorage). No hay servidor ni copia en la nube. **Si rompes la base de datos local, Álvaro pierde sus finanzas y no hay forma de recuperarlas.**
- Antes de tocar nada que cambie la forma de los datos o su versión de esquema: **para y pregunta**. Y si hay migración, que sea reversible y esté probada con datos de ejemplo.
- Ante la duda entre "arreglo elegante" y "arreglo que no rompe nada": el segundo.

## Qué es Split

App de finanzas personales: cuentas, gastos, ahorro y pagos programados. **HTML, CSS y JavaScript puros, sin compilación**, más un APK para Android. Repositorio público `roblesgg/split`.

- `index.html` · `css/` · `js/` (app, charts, core, data, screens) · `fonts/` · `vendor/`
- `herramientas/`, `packaging/` (generación del APK), `tests/`
- `docs/DISENO.md` es la identidad visual de la app. Respétala.

## Cómo se trabaja aquí

Esto es mantenimiento: **nada de encargos ni fases**. Álvaro te dice qué falla o qué quiere, lo arreglas, lo pruebas y lo subes.

1. **Entiende el problema antes de tocar.** Si no puedes reproducirlo, pregúntale cómo lo provoca él.
2. **Cambios pequeños y acotados.** No aproveches para reescribir cosas que funcionan.
3. **Pruébalo de verdad** antes de decir que está. `tests/` existe; si tu cambio es de lógica, deja un test.
4. **Commits en español**, una línea que diga qué cambia. Identidad: `Alvaro DripDev <Alvaro@dripdev.dev>`.
5. **Sube el número de versión** cuando el cambio llegue al móvil, para que se note que ha entrado.
6. **Rama `main`** directamente, salvo que el cambio sea grande; entonces, rama aparte y lo hablas antes.

## Reglas que no se rompen

1. **Nunca pierdas datos de Álvaro.** Ver arriba. Es la regla número uno.
2. **Nada de secretos en el código.** Si algo necesita una clave, para y pregunta.
3. **No toques otros proyectos** ni carpetas fuera de `split/`. Hay otros agentes trabajando en paralelo.
4. **Coste cero.** Nada de servicios de pago ni dependencias nuevas sin preguntar. Split no tiene compilación y eso es una virtud: no la rompas metiendo un empaquetador.
5. **Si `git push` falla** con *"fork: Resource temporarily unavailable"*, no te lo saltes: avisa al Jefe de Proyectos, que lo sube él.
6. **No publiques nada** (release, APK, tienda) sin el OK expreso de Álvaro.

## Marca y estándares de DripDev

- Contexto general, dominio y normas: `C:\Users\roble\Documents\DripDev\_marca\drip-garage-recursos\CONTEXTO-IA.md`
- Identidad visual de Split: `docs/DISENO.md` y `…\_marca\drip-garage-recursos\manual-productos\split.md`
- Tecnologías y seguridad: `TECNOLOGIAS.md` y `SEGURIDAD.md` en el mismo repositorio de marca.
- En documentos de marca, **separa siempre lo observado de lo propuesto**. No inventes activos ni patrones.

## Cómo hablar con Álvaro

- Explica en sencillo qué has hecho y qué falta.
- Si algo es una suposición tuya, dilo.
- Si lo que pide choca con la regla 1, díselo antes de hacerlo.
