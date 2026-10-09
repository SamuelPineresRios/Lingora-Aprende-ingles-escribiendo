# Vocabulario: palabras interactivas, fichas y calentado

Documento de implementación de la funcionalidad de vocabulario de Lingora:
traducir una palabra con solo pasar el cursor, guardarla y repasarla después.

Está pensado para que otro desarrollador entienda **qué hay, dónde está y por
qué se decidió así** sin tener que reconstruirlo leyendo todo el código.

---

## 1. Qué hace

**En la escena narrativa y en el chat**
- Cada palabra en inglés aparece subrayada con puntos. Al pasar el cursor
  (o tocarla, en móvil) se abre un recuadro con su **traducción** y un botón
  para **guardarla**; si ya estaba guardada, el botón lo indica.
- Mientras la frase se está escribiendo (efecto máquina de escribir) las
  palabras no son interactivas; lo son al terminar.

**Mi vocabulario (`/words`)**
- Lista de las palabras guardadas con traducción, categoría y fecha.
- **Buscador** por palabra, traducción o categoría, sin distinguir tildes ni
  mayúsculas.
- **Filtros** por categoría gramatical con recuento (Verbos, Sustantivos,
  Adjetivos…): solo aparecen las categorías que existen.
- **Detalle** de cada palabra: traducción, presente / pasado / participio (si
  es verbo), ejemplos de uso con su traducción y la frase donde se guardó.
- Borrado con protección de propiedad.

**En segundo plano**
- Al aparecer una escena o una respuesta de la IA, el navegador pide al
  backend que **genere en segundo plano** las fichas que falten. Cuando el
  alumno pasa el cursor, la ficha ya está.

---

## 2. Flujo de una palabra

```
hover / tap
   │
   ▼
InteractiveWords ──► ¿está en la caché de sesión? (lib/word-cache)
   │                        │ sí  → popover instantáneo
   │ no
   ▼
POST /api/words/lookup ──► ¿está en word_lookups? (caché global)
   │                              │ sí  → 4 ms
   │ no                           │
   ▼                              │
generateCard() ──► IA (Haiku 4.5, salida estructurada)
   │
   ▼
insert word_lookups (ON CONFLICT DO NOTHING) ──► ficha

Aparte, al montar la escena / llegar un mensaje:
POST /api/words/warm ──► 202 inmediato ──► cola de 2 hilos genera lo que falte
```

---

## 3. Modelo de datos

Dos tablas en `backend/src/db/schema.ts`:

### `word_lookups` — caché global de fichas (compartida por todos los alumnos)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text (PK) | UUID |
| `word` | text | **Palabra normalizada**; clave de la caché |
| `translation` | text | Traducción al español según la frase |
| `part_of_speech` | text | `verb`, `noun`, `adjective`… |
| `present` / `past` / `past_participle` | text null | Formas verbales; null si no es verbo |
| `examples` | jsonb | `[{ en, es }]`, 2-3 frases |
| `created_at` | timestamptz | |

Índice único: `word_lookups_word_key(word)`.

### `saved_words` — vocabulario de cada alumno

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text (PK) | UUID |
| `student_id` | text FK → users | `ON DELETE CASCADE` |
| `word_lookup_id` | text FK → word_lookups | `ON DELETE CASCADE` |
| `context` | text null | Frase donde la encontró (máx. 300) |
| `created_at` | timestamptz | |

Índices: único `saved_words_student_word_key(student_id, word_lookup_id)` e
índice `saved_words_student_idx(student_id, created_at)`.

**Por qué así**
- La ficha vive una sola vez y se comparte: genera coste de IA una vez, no una
  por alumno.
- El vocabulario guardado solo **referencia** la ficha; guardar la misma
  palabra dos veces choca con el único y no duplica.
- Guardar no vuelve a llamar a la IA (salvo que la ficha no exista, que no
  debería).

Cambios de esquema: `npm run db:push -w @vox/backend` (y `db:push:test`).

---

## 4. Backend

Módulo en `backend/src/modules/words/`.

### 4.1 Prompt y esquema — `prompts.ts`

`WORD_SYSTEM_PROMPT` pide: traducción **según el uso en la frase**, categoría
gramatical, formas verbales (null si no es verbo) y 2-3 ejemplos con su
traducción. `WORD_SCHEMA` se aplica con salida estructurada de Anthropic
(`output_config.format`), así que la respuesta es siempre JSON válido.

> **Trampa**: en la salida estructurada de Anthropic, `minItems`/`maxItems` de
> un array solo admiten `0` o `1`. Con `2` rechaza la petición entera (400).
> La cantidad de ejemplos se pide en la **descripción** y el servicio recorta
> a 3 por si acaso.

`completeChat` se llama con `maxTokens: 800`.

### 4.2 Servicio — `service.ts`

Constantes:

| Constante | Valor | Para qué |
|---|---|---|
| `MAX_CONTEXT_LENGTH` | 300 | Tope de la frase-contexto |
| `MAX_WARM_WORDS` | 60 | Tope de palabras por petición de calentado |
| `WARM_CONCURRENCY` | 2 | Generaciones simultáneas de la cola |

Funciones principales:

| Función | Responsabilidad |
|---|---|
| `normalizeWord(raw)` | Minúsculas y sin puntuación en los extremos. Los apóstrofos interiores se conservan (`don't`). |
| `readWord` / `readContext` | Validación: palabra no vacía y ≤ 64; contexto recortado. |
| `findLookup(word)` | Busca la ficha en la caché global. |
| `isSaved(studentId, lookupId)` | ¿Este alumno ya la guardó? (para el `saved` del popover) |
| `generateCard(word, context)` | Llama a la IA y normaliza la respuesta. |
| `generateAndStore` | Genera e inserta con `ON CONFLICT DO NOTHING`; si otra petición la insertó antes, lee la que quedó. |
| `lookupOrGenerate` | Coordina el registro `inFlight` (ver abajo). |
| `lookupWord` | Ficha para el hover: caché primero, IA si falta. |
| `saveWord` | Añade al vocabulario; idempotente. |
| `listSavedWords` | Vocabulario con la ficha completa, de lo más reciente a lo antiguo. |
| `deleteSavedWord` | Borra solo si es del alumno; si no, 404. |
| `warmWords` | Calentado: valida, deduplica, mira qué falta y encola. |
| `warmQueueIdle` | Espera a la cola en curso (tests y apagado ordenado). |

**Registro de generaciones en vuelo** (`inFlight: Map<string, Promise<LookupRow>>`)

Evita pagar dos veces la misma palabra y resuelve las carreras entre el
calentado y el cursor:

- Si el calentado ya está generando una palabra, el hover **espera esa misma
  promesa** en lugar de lanzar otra llamada.
- Si la cola aún no la empezó, el hover la genera él y la cola la salta al ver
  en la tabla que ya está.
- Al terminar (éxito o error) la entrada se borra con `.finally`.

**Cola del calentado**

- `warmWords` responde con `{ pending, cached }` y **no espera**: encadena
  `warmQueue = warmQueue.then(() => runWarmQueue(missing))`.
- Encadenar (en vez de lanzar colas en paralelo) mantiene el uso de la API bajo
  control y hace fiable `warmQueueIdle`.
- `runWarmQueue` trabaja con 2 hilos en el **orden recibido** (las palabras de
  las primeras líneas primero). Antes de generar cada palabra revalida la
  caché, por si otra cola o un hover la generó mientras esperaba.
- Un fallo se registra y la palabra queda fría; nunca rompe la escena.

### 4.3 Rutas — `routes.ts`

Montadas en `/api/words` (en `app.ts`), todas con `requireAuth`:

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `POST /api/words/lookup` | `{ word, context? }` | `200 { card }` |
| `POST /api/words/warm` | `{ words: string[] }` | `202 { pending, cached }` |
| `POST /api/words` | `{ word, context? }` | `201 { card }` (guardada) |
| `GET /api/words` | — | `200 { words }` |
| `DELETE /api/words/:id` | — | `204` o `404` |

`DELETE` usa `saved_id` (el de la fila del vocabulario, no el de la ficha) y
filtra por `student_id`: un alumno no puede borrar lo de otro (probado).

---

## 5. Frontend

### 5.1 `lib/word-cache.ts`

- **Caché de sesión** (`Map<string, WordCard>`) con `getCachedWord` /
  `setCachedWord`: la misma palabra no se pide dos veces en la sesión.
- `extractWords(text)`: separa palabras con `[\p{L}][\p{L}'’-]*` y las
  normaliza a minúsculas. **Mismo criterio que el backend.**
- `warmWords(texts)`: recolecta las palabras que no están en la caché de
  sesión y hace `POST /api/words/warm` en trozos de 60 (`WARM_CHUNK`), sin
  esperar respuesta y sin romper nada si falla.

El tipo `WordCard` vive aquí y lo importan el componente, la página y el
popover (la página lo extiende con `saved_id`, `saved_at` y `context`).

### 5.2 `components/InteractiveWords.tsx`

- Parte el texto en palabras y signos; las palabras se pintan como `span` con
  subrayado punteado, `role="button"` y `tabIndex` (accesible por teclado).
- **Hover** (`onMouseEnter`) y **tap/click** abren el popover; `focus` también
  (teclado). Al salir, se cierra con **220 ms de retardo** para que dé tiempo a
  mover el cursor dentro del recuadro; entrar en el popover cancela el cierre.
  `Escape` cierra; hay botón `×`.
- El popover se monta con `createPortal(document.body)` y `position: fixed`
  **a propósito**: dentro de la escena hay `transform` (el `scale` de los
  bustos) y un `fixed` normal quedaría relativo a ese contenedor.
- Se coloca encima de la palabra y, si no cabe, debajo; se limita en horizontal
  para no salirse de la pantalla.
- Contrarrespuestas fuera de orden: un `requestId` en un ref descarta respuestas
  de palabras que ya no están activas (evita que un hover viejo pise al nuevo).
- Guardar actualiza la tarjeta en la caché de sesión, así el botón queda en
  «Guardada» al instante.

### 5.3 Integraciones

**`components/IntroductionPlayer.tsx` (escena narrativa)**
```tsx
{lineComplete
  ? <InteractiveWords text={line.text} context={line.text} />
  : <TypewriterMessage … onComplete={() => setLineComplete(true)} />}
```
- Mientras escribe se ve la máquina de escribir; al terminar, las palabras se
  vuelven interactivas (el texto es idéntico, no hay salto visual).
- Al montar la escena: `warmWords([...líneas, ...expresiones])` — **en orden de
  aparición**.

**`components/MissionScreen.tsx` (chat)**
- La respuesta de la IA usa la misma alternancia con
  `isLastAssistantMessageTyping`; al terminar el tipeo,
  `onComplete → setIsLastMessageTyping(false)` y pasa a `InteractiveWords`.
- Los mensajes de sistema se pintan como texto plano (no interactivos).
- Un efecto sobre `messages` calienta las palabras de cada respuesta del
  asistente al aparecer.

### 5.4 `pages/Words.tsx` — Mi vocabulario

- Carga `GET /api/words` una vez; el detalle se pinta con esos datos, sin
  peticiones extra.
- Buscador y filtros en cliente (el vocabulario de un alumno es pequeño):
  `normalizeSearch` quita tildes con `normalize('NFD')` + `\p{Diacritic}`.
- Chips de categoría con recuento, generados desde las palabras existentes.
- Al filtrar, el detalle cae en la primera palabra visible (`filtered[0]`) y el
  contador de la cabecera pasa a «N de M palabras».
- Ruta `/words`, enlace **VOCABULARIO** en `StudentSidebar` y `/words` en
  `shared/src/routes.ts` (`STUDENT_PATHS`).
- Fondo: mismo envoltorio que Perfil y Grupos (`Canvas3DBackground` +
  `ResponsiveBackgroundSprites`, contenido en `relative z-10`).

### 5.5 `lib/part-of-speech.ts`

Traduce las categorías al español para la lista, el detalle y el popover
(`verb → Verbo/Verbos`, `noun → Sustantivo/Sustantivos`…). Si el modelo
devuelve una categoría desconocida, se capitaliza tal cual.

---

## 6. El calentado en detalle

1. Al montar la escena (o al aparecer una respuesta), `warmWords` extrae las
   palabras en orden y descarta las que la sesión ya tiene.
2. Se envían en trozos de 60; el backend responde **202** en ~200 ms.
3. `warmWords` mira qué falta en `word_lookups` (una consulta `inArray`) y
   encola solo eso, con 2 hilos, en orden.
4. El cursor tiene prioridad: si toca una palabra que la cola no empezó, el
   `lookup` la genera y la cola la salta; si ya se está generando, comparten
   promesa.

**Efecto medido**: abrir una escena con muchas palabras frías pidió 4 chunks
(202 en ~200 ms), la caché creció sola de 246 a 259 fichas en 12 s (en orden de
línea) y el hover de una palabra antes fría tardó **9 ms**.

---

## 7. Coste y rendimiento

Modelo: **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`), $1/MTok entrada y
$5/MTok salida.

| Concepto | Valor |
|---|---|
| Palabra ya cacheada | **$0** y ~4 ms (consulta indexada) |
| Palabra nueva | ~$0,0013 (≈ 700 tokens de entrada + ~110 de salida) |
| Una escena (~50 palabras nuevas) | ~$0,06 la primera vez que alguien la abre |
| Catálogo completo (75 misiones, ~3.000–4.000 palabras) | ~$4,5 repartido; ~$2,3 con Batch API |

- Cada palabra se paga **una sola vez en la vida de la app** (caché global).
- El calentado solo gasta por palabras que **aparecen en pantalla**; las que
  el servidor ya tiene las filtra sin llamar a la IA.
- La IA es espera de red, no CPU: el proceso del servidor no se carga y el
  alumno nunca espera al calentado (202 inmediato).
- Límite a vigilar: el de peticiones por minuto de Anthropic. Con 2 hilos y
  backoff (ya implementado en `lib/ai.ts`) no se dispara.

---

## 8. Decisiones (y por qué)

- **Caché global de fichas, no por alumno**: una palabra se paga una vez para
  todos. El vocabulario personal solo referencia la ficha.
- **Clave = palabra normalizada** (minúsculas, sin puntuación en los bordes):
  evita duplicar `Help`, `help!` y `help`. Los apóstrofos interiores se
  conservan porque son parte de la palabra.
- **Traducción contextual**: la ficha traduce la palabra **según la frase**,
  que es lo que un estudiante necesita en el momento de leerla.
- **No pre-generar el catálogo ahora**: el catálogo está a medias (20/75
  introducciones) y las introducciones se pueden regenerar. Pagar por
  adelantado sería pagar dos veces. El calentado converge al mismo coste solo
  por lo que se abre. La pasada completa en batch queda como paso opcional.
- **Colas encadenadas** en vez de paralelas: cuida el límite de la API y hace
  fiable `warmQueueIdle()` (tests y apagado ordenado).
- **Popover en portal + fixed**: los `transform` de la escena rompen `fixed`
  dentro del componente.
- **Interactividad al terminar el tipeo**: durante la máquina de escribir el
  texto está partido y las palabras no existen completas.
- **Buscador/filtros en cliente**: el vocabulario de un alumno cabe de sobra en
  memoria; hacerlo en servidor añadiría endpoints y latencia sin necesidad.

---

## 9. Trampas encontradas (y cómo quedaron resueltas)

| Problema | Detalle | Solución |
|---|---|---|
| Salida estructurada de Anthropic | `minItems`/`maxItems` solo admiten 0 o 1; con `2` la petición entera se rechaza con 400 | Quitar los límites del esquema, pedir «2 o 3» en la descripción y recortar en el servicio |
| Nombres con tilde | La regex `[A-Za-z]` partía `Márquez` en `M` + `rquez`, y esos fragmentos llegaban al vocabulario | `[\p{L}][\p{L}'’-]*` (letras Unicode) en el frontend y `normalizeWord` acorde |
| Cola del calentado en tests | La cola seguía corriendo al terminar un test y escribía en la base del siguiente | `warmQueueIdle()` en el `beforeEach` |
| Palabras con dígitos | `word0` → `word` al normalizar (se recortan los extremos no alfabéticos) | Es el comportamiento correcto; el test del tope usa solo letras |
| Generación duplicada entre colas | Una segunda cola podía regenerar una palabra ya generada por la primera | `runWarmQueue` revalida la caché antes de generar |
| `fixed` dentro de `transform` | El popover se posicionaba respecto al busto | Portal a `body` |

---

## 10. Pruebas

### Backend — `backend/tests/words.test.ts` (16 casos, IA mockeada)

- `normalizeWord`: mayúsculas, puntuación y apóstrofos interiores.
- `lookup`: exige sesión; rechaza palabras vacías o sin letras; devuelve la
  ficha completa; **genera una sola vez** (segunda consulta desde caché).
- Guardado: aparece en la lista con su ficha; guardar dos veces no duplica ni
  regenera; el lookup posterior marca `saved`; cada alumno solo ve lo suyo;
  borrado propio y `404` al intentar borrar lo ajeno.
- Calentado: exige sesión; solo genera las que faltan; tope de 60; ignora
  entradas vacías/no-texto; **no duplica si se pide en paralelo**; después de
  calentar, el lookup no llama a la IA.

### Navegador (Chromium vía CDP)

- Hover en la escena → popover con traducción → guardar → aparece en
  «Mi vocabulario» con formas verbales, ejemplos y la frase original.
- Chat: la respuesta de la IA se vuelve interactiva al terminar el tipeo.
- Buscador (sin tildes y por traducción), filtros con recuento, combinación y
  mensaje de «sin coincidencias».
- Calentado: 202 en ~200 ms, caché creciendo en segundo plano y hover en 9 ms.

---

## 11. Operación

```bash
# Arranque (desde la raíz)
npm run dev

# Esquema (crea word_lookups y saved_words)
npm run db:push -w @vox/backend
npm run db:push:test -w @vox/backend
```

```bash
# Consultar una ficha a mano
curl -X POST http://localhost:4000/api/words/lookup \
  -H 'Content-Type: application/json' -H "Cookie: speak_session=$COOKIE" \
  -d '{"word":"help","context":"How can I help you?"}'

# Calentar un lote
curl -X POST http://localhost:4000/api/words/warm \
  -H 'Content-Type: application/json' -H "Cookie: speak_session=$COOKIE" \
  -d '{"words":["flight","museum","booking"]}'
```

```sql
-- Tamaño de la caché y palabras más recientes
SELECT count(*) FROM word_lookups;
SELECT word, translation, created_at FROM word_lookups ORDER BY created_at DESC LIMIT 10;

-- Vocabulario de un alumno
SELECT wl.word, wl.translation, sw.created_at
FROM saved_words sw JOIN word_lookups wl ON wl.id = sw.word_lookup_id
WHERE sw.student_id = '<id>' ORDER BY sw.created_at DESC;

-- ¿Cuántas consultas de hover acertaron caché? (aproximación por created_at)
SELECT date_trunc('hour', created_at) AS hora, count(*) FROM word_lookups GROUP BY 1 ORDER BY 1 DESC LIMIT 12;
```

---

## 12. Deuda y futuro

- **Sin rate limiting**: `lookup` y `warm` pueden generar coste de IA. Está
  documentado en `SECURITY.md`; la mitigación es el rate limiting del borde y
  el tope de 60 por petición.
- **Pasada completa en batch** (opcional): cuando las 75 misiones estén
  generadas y estables, un script con Batch API (~50 % de descuento) dejaría
  todo el catálogo instantáneo desde el primer segundo (~$2-3).
- **Prompt caching**: el prompt + esquema (~650 tokens) es idéntico en cada
  ficha; marcarlo como cacheado bajaría la entrada de $1 a $0,10 por millón.
- **Alternativa sin IA a largo plazo**: un diccionario abierto (Wiktionary,
  Tatoeba) daría traducción y ejemplos gratis, a cambio de perder la traducción
  contextual y buena parte de la calidad curada.
- **Ideas de producto**: orden alfabético, tarjetas de repaso (flashcards) y
  «practicar esta palabra» con una mini-misión.

---

## Mapa de archivos

```
backend/
  src/db/schema.ts                       # word_lookups, saved_words
  src/modules/words/prompts.ts           # prompt + esquema de la ficha
  src/modules/words/service.ts           # caché, calentado, vocabulario
  src/modules/words/routes.ts            # /api/words/*
  tests/words.test.ts                    # 16 casos
frontend/src/
  lib/word-cache.ts                      # caché de sesión, extractWords, warmWords
  lib/part-of-speech.ts                  # categorías en español
  components/InteractiveWords.tsx        # palabras interactivas + popover
  components/IntroductionPlayer.tsx      # escena: tipeo → interactivo + calentado
  components/MissionScreen.tsx           # chat: respuesta → interactivo + calentado
  pages/Words.tsx                        # Mi vocabulario (buscador, filtros, detalle)
```
