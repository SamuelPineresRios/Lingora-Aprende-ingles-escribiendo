# Contenido generado de las misiones y puesta en producción

Este documento explica, en fácil, qué contenido de las misiones genera la IA,
dónde queda guardado y **qué hay que hacer para que en producción ningún alumno
vea «Preparando la escena» ni «Preparando el vocabulario»**.

---

## 1. Qué se genera y dónde vive

La tabla `missions` guarda los datos base de cada misión (título, descripción,
contexto, personaje, nivel…). Lo que escribe la IA vive en dos tablas aparte,
**una fila por misión y compartida por todos los alumnos**:

| Tabla | Qué guarda |
|---|---|
| `mission_introductions` | La escena narrativa: título de escena, descripción, personajes (con género), diálogo con traducciones, expresiones útiles y la dirección de arte del fondo |
| `mission_vocabulary` | Las 5 palabras clave: palabra, traducción, ejemplo y traducción del ejemplo |

- `mission_id` es **único** en ambas tablas, así que no se puede duplicar.
- La clave foránea apunta a `missions` con `ON DELETE CASCADE`.

Ejemplo real:

```
 m-001 | Pedir direcciones | escena «En la calle del centro» | 5 líneas | primera palabra: excuse
```

---

## 2. Por qué importa: las esperas que evita

La escena y el vocabulario se generan **la primera vez que alguien los pide**
(dos llamadas al modelo, varios segundos). Mientras eso pasa, la interfaz
mostraba «Preparando la escena» o «Preparando el vocabulario».

Si el contenido ya está generado en la base de datos, esas fases solo leen
(decenas de milisegundos) y no hay espera. Por eso el paso clave de producción
es **generarlo todo antes de abrir la app a los alumnos**.

---

## 3. Cómo se precalienta

```bash
npm run content:prewarm -w @vox/backend          # genera lo que falte
npm run content:prewarm -w @vox/backend -- --dry # muestra lo que haría, sin tocar nada
```

- **Idempotente**: solo pide lo que falta. Si se corta a la mitad, se vuelve a
  ejecutar y sigue donde iba.
- **Concurrencia 3**: unas pocas llamadas en paralelo para no saturar la API.
- **Coste**: ~150 llamadas al modelo la primera vez (céntimos con Haiku). El
  uso se comparte entre todos los alumnos y después solo hay lecturas.
- **Fallos de red**: se avisa por misión y se reintenta volviendo a ejecutar.

También se ejecuta **automáticamente** al terminar `missions:generate` y
`missions:seed` (ver el porqué en la sección 5).

---

## 4. Puesta en producción paso a paso

1. **Aplicar el esquema** contra la base de datos de producción:

   ```bash
   DATABASE_URL=<la de producción> npm run db:push -w @vox/backend
   ```

2. **Sembrar las misiones** (si la base está vacía). Al terminar, el script ya
   precalienta escena y vocabulario:

   ```bash
   DATABASE_URL=<la de producción> npm run missions:seed -w @vox/backend
   ```

   Si prefieres hacerlo por separado: ejecuta `content:prewarm` después.

3. **Comprobar que no falta nada**:

   ```sql
   SELECT (SELECT count(*) FROM missions)               AS misiones,
          (SELECT count(*) FROM mission_introductions) AS escenas,
          (SELECT count(*) FROM mission_vocabulary)    AS vocabularios;
   ```

   Las tres cifras deben **coincidir**. Si algún número es menor, vuelve a
   ejecutar `content:prewarm`.

4. **Prueba final**: abre una misión en una ventana de incógnito y en el móvil.
   La cabecera (título y descripción) debe entrar directa y el vocabulario no
   debe mostrar ningún «Preparando…».

> El contenido es **dato, no código**: no viaja con el despliegue. Cada entorno
> (local, staging, producción) necesita su propio precalentado, o importar las
> dos tablas desde otro entorno.

---

## 5. Contenido nuevo (misiones futuras)

Cuando se añaden misiones con `missions:generate` o `missions:seed`, el script
llama al precalentado al terminar: el contenido nuevo nace listo y ningún
alumno paga la generación.

- Se puede desactivar con `--no-prewarm`, por ejemplo si el proveedor de IA
  está caído o si solo quieres sembrar los títulos y generar después:

  ```bash
  npm run missions:seed -w @vox/backend -- --no-prewarm
  ```

  Después puedes precalentar cuando quieras con `content:prewarm`, que solo
  hará las nuevas.

**¿Por qué automático por defecto?** Porque el objetivo es que nunca haya una
espera para el alumno, y lo fácil es olvidarse de lanzar el precalentado a
mano. La bandera existe como válvula de escape para no gastar llamadas cuando
no toca.

---

## 6. En la interfaz: sin esperas

Aunque el contenido esté generado, la petición tarda un poco en viajar. Para
que no se note:

- **Caché en memoria de la sesión**: la escena y el vocabulario precargados se
  guardan y la pantalla monta con ellos desde el primer render.
- **Precarga por adelantado**:
  - al mostrar la lista de misiones se piden las escenas de las tarjetas
    visibles (así también funciona en móvil, donde no hay hover);
  - al pasar el cursor o enfocar una tarjeta, se pide su escena;
  - mientras se lee la cabecera, se pide el vocabulario (la cabecera dura
    varios segundos).
- **Pantallas neutras**: si alguna vez hay que generar en vivo (contenido muy
  nuevo o recarga directa), en lugar de un spinner y un texto de espera se ve
  un fondo oscuro un instante.

La caché en memoria se pierde al recargar la página; entonces se vuelve a pedir
al backend, que responde de inmediato porque ya está generado.

---

## 7. Qué NO cubre

- **Saludo del chat**: se genera en vivo cada conversación (tiene su propio
  indicador «escribiendo…»). No es cacheable.
- **Traducciones al pasar el cursor** («Traduciendo…»): las fichas de cada
  palabra se generan al mostrarse la escena (calentado en segundo plano), así
  que casi siempre están listas. Precalentarlas todas por adelantado implica
  muchas más llamadas de IA y no suele compensar.
- **Avatares**: vienen de DiceBear (cachea un año) y se precargan durante la
  cabecera.

---

## 8. Problemas frecuentes

| Síntoma | Qué hacer |
|---|---|
| Aparece «Preparando la escena» en producción | Ejecutar `content:prewarm` contra la base de datos de producción y comprobar los `count` |
| El precalentado terminó con fallos | Volver a ejecutarlo: solo reintenta lo pendiente |
| Añadí misiones y quiero generarlas ya | `npm run content:prewarm -w @vox/backend` |
| Un docente regeneró una escena | Es una acción explícita: sube la versión y queda guardada; no hay nada que hacer |
| Quiero saber cuánto contenido hay | Consulta de `count` de la sección 4 |
