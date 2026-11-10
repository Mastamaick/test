# EL REY DE LA LLECA · Documento funcional y mapa del proyecto

Actualizado: 8 de noviembre de 2026. En línea en https://mastamaick.github.io/test/ (rama `ccr-7bdf7156-f3d981`, se publica sola con cada push). Instagram: **@elreydelalleca.cl**.

Este documento resume qué es el juego, cómo funciona, qué métodos de trabajo sirvieron (y cuáles no) y las 3 opciones para llevarlo a otros formatos. Los detalles de controles y modos siguen en [PROYECTO.md](PROYECTO.md); la receta para agregar personajes, en [PERSONAJES-NUEVOS.md](PERSONAJES-NUEVOS.md).

---

## 1. Qué es

Juego de pelea 2D estilo arcade, en pixel art, con raperos chilenos de verdad como luchadores. Corre en el navegador (HTML + canvas + JavaScript, sin librerías), en computador y celular, con teclado, pantalla táctil o control USB/Bluetooth. Toma ideas de los juegos de pelea clásicos, pero el código, el arte, las voces y los personajes son propios.

| Pieza | Dónde | Tamaño |
|---|---|---|
| Motor de pelea, menús, poderes, CPU, sonido | `src/game.js` | ~3.300 líneas |
| Personajes y escenarios (editable sin tocar el motor) | `src/roster.js` | ~270 líneas |
| Página, pantallas y estilos | `index.html` | — |
| Dibujos, escenarios, música, voces y efectos | `assets/` | 86 MB |
| Herramientas para recortar y escalar dibujos | `tools/sprites/` | 13 scripts |

## 2. Qué tiene hoy

### Personajes (12 elegibles + 1 jefe suplente)

| Personaje | Poder simple | Poder especial | Súper |
|---|---|---|---|
| Jonas Sanche | Flow Pesado | Daknowledge | Underground Business |
| ChysteMC | Rima al Aire | Techyfutbol | Sun Joke |
| Macrodee | Aroma | Macrodee en el Beat | 20Killa (con Veiderr) |
| Ceaese | Tinta Viva | Demonio con Aros de Cruces | Utopía |
| Gran Rah | Lágrima de Mercurio | Lenguaje Vivo | Cúspide |
| Veiderr | Linterna | Mars People (nave nodriza + marciano) | 20Killa (con Macrodee) |
| Claudio Bastardo | Gargajo | Ráfaga de Vómito | Ñaaaaa |
| Creabeatbox | Bombo | Boom Tss Ka | El Drop |
| Mastamaick | Proteína | El Completo | One Hit Wonder |
| Omega el CTM | Grotesco | La Baltiloca | El Sur es Hardcore (3 golpes) |
| Jack Dee (retador secreto) | Versículo | Un Aplauso pal Weón | Déjenme en Paz |
| El Bruto CHR (jefe final) | Humo Denso | Chaito | La Ejecución |
| El Bruto Verde | — copia del Bruto con calavera, jefe cuando juegas con el Bruto — | | |

Cada personaje tiene 27 a 30 dibujos: guardia, 3 puños, 3 patadas, saltos, golpes en el aire, bloqueo, golpe recibido, mareo, caída, burla, 2 celebraciones, poder máximo, 2 pasos, 2 impulsos, agachado, esquiva, **puño bajo y barrida**. El Bruto tiene además todas sus poses mirando a la izquierda para que "MIC ABE" y "LF" se lean al derecho.

### Escenarios
13 fondos dibujados: La Florida, Metro Baquedano, Plaza de Puente Alto, Teatro Caupolicán, Salida del Metro, Vagón del Metro, Plaza de Maipú, Frente a La Moneda, Barrio Bellavista, La Vega Central, Cerro San Cristóbal, Punta de Lobos y el Estudio del Bruto (solo para el jefe). Hay 3 escenarios más sin dibujo (Festival Central, Club Subterráneo, Teatro Municipal), apagados.

### Cómo se juega
- **Modo Torre (1 jugador):** 6 rivales al azar, luego el jefe y el retador secreto, con dificultad que sube. Desbloqueos guardados en el navegador. Pantalla de campeón al final.
- **Golpes:** puño, puño fuerte, patada, patada fuerte (bota), golpes en el aire, **puño bajo y barrida** (abajo + golpe; la barrida solo se cubre agachado), **patada voladora** (impulso + patada).
- **Defensa:** retroceder cubre; agachado esquiva puños y poderes simples; la barrida obliga a cubrirse abajo.
- **Barra de poder de 3 niveles:** poder simple (sin barra), especial (2 barras), súper (3 barras) con escena de poder máximo y voz del locutor.
- **Daño parejo (9 nov 2026):**
  - Todo poder especial hace ~25 de daño y todo súper ~35, multiplicado por la fuerza propia del rapero (`stats.power`, de 0,95 a 1,15).
  - Se ajusta en `POWER_SCALE` (`src/game.js`), con un factor por poder medido contra un rival quieto.
- **Sonido parejo:**
  - Toda la música quedó en −12 LUFS.
  - El "whoosh" de cada golpe y el salto quedaron mucho más bajos, porque cansaban después de jugar rato.
- **Reglas anti-abuso:** sin encerronas en la esquina, combos que aturden cada vez menos, "¡ZAFÓ!" al 6.º golpe seguido, mareo por daño acumulado.
- **Carga:** primero la guardia de todos (para el menú), luego escenarios y el resto. La pelea espera en la pantalla VS con barra de carga.
- **Controles:** teclado, táctil (joystick + botones) y control USB/Bluetooth. Pantalla completa en iPhone al agregarlo a inicio (ya tiene `manifest.json`).

## 3. Mapa de trabajo: lo que funcionó

### Dibujos de personajes (Gemini, por Chrome)
| Qué | Cómo se hace | Por qué |
|---|---|---|
| Cambiar ropa o look sin cambiar poses | Componer las poses originales en **cuadrícula 2×2** (`grid2.ps1`), mandar la hoja + **solo** la referencia de aspecto, pedir "LAS POSES NO SE TOCAN" | En fila, Gemini encima las figuras y al recortar se cortan puños y pies |
| Mantener la misma cara | Una hoja por grupo de poses, con la guardia aprobada como referencia | Pose por pose, la cara cambiaba |
| Letras en la ropa | Voltear la hoja ya generada y pedir corregir **solo las letras**; se guarda en `izq/` y se declara en `spriteLeft` | El juego voltea el dibujo y las letras quedaban al revés |
| Poses de golpe con brazo o pierna estirada | Cuadrícula 2×2 con espacio a la derecha de cada figura | Evita extremidades cortadas o encimadas |
| Caras con más expresión | Editar la hoja pidiendo solo cambiar la expresión | Omega quedó con caras de esfuerzo, dolor y mareo |
| Primero una prueba | 1 imagen de la guardia, se aprueba, después el resto | Ahorra créditos cuando el look no convence |
| Revisión antes de instalar | Hoja de contacto en grande, buscando **3 brazos o 3 piernas** y bigotes que no van | Pasó con el puño de CHR y la barrida de Jack Dee |

Recorte y escala: `sheet.ps1` / `split.ps1` / `cutout.ps1` → `fitheight.ps1` (al alto de la pose original) → `holes.ps1` (fondo blanco atrapado entre brazo y cabeza).

### Poderes y efectos
- Efectos como dibujos **aparte** (en `assets/powers/`), nunca pegados a las poses, en el mismo pixel art y contorno negro que los luchadores, sobre fondo verde y recortados.
- Voces del locutor con ElevenLabs (voz Murdock, `[excited] ¡NOMBRE!`), verificadas por transcripción.

### Proceso
- Probar todo en el navegador antes de dar algo por listo, y hacer commit y push a la misma rama.
- Preguntar antes de gastar generaciones o elegir arte.
- Fotos reales, hojas originales y referencias en carpetas ignoradas por git (`.tmp-ref/`, `revision/`, `Participantes foto real/`).

## 4. Lo que no funcionó (no repetir)

| Intento | Problema |
|---|---|
| Arte de poderes en Canva | Se veía como sticker pegado, otro estilo |
| Trasplantar zapatillas con script | Quedaba mal; se redibujó todo en Gemini |
| Pedir poses sueltas, una por una | La cara cambiaba entre poses |
| Figuras en fila para golpes estirados | Encimadas; al recortar quedan cortadas |
| Mandar la guardia como referencia junto a la hoja | Gemini copiaba esa pose en todas las figuras (hay que decir "solo referencia de aspecto") |
| Descargar de Gemini | Chrome bloquea descargas repetidas; se captura la imagen en pantalla |
| Más de ~19 imágenes al día en Gemini | Límite diario; hay que esperar |

## 5. Pendiente

- Separar más los cuerpos en pelea para que no se encimen (hoy el mínimo es 75 px y cada cuerpo mide ~140 px).
- Modo 2 jugadores en el menú (está programado pero apagado).
- Comprimir imágenes: 86 MB es mucho para celular y para una app.
- Frases de los raperos.
- Barrida de Jonas: el polerón dice otra cosa en vez de "TOMMY".
- Macrodee con look nuevo (en pausa: la prueba del 9 nov no convenció):
  - Chaqueta verde acolchada, polerón negro, lentes gruesos y barba.
  - La guardia de prueba está en `.tmp-ref/macrodee/test1.png`. Falta aprobarla y hacer las otras 29 poses.
- Redes: serie de reels por personaje (ver [redes/PLAN-REDES.md](redes/PLAN-REDES.md)) y cambiar el link del juego.

## 6. Opciones para llevarlo a otros formatos

Las 3 opciones parten del mismo juego web. Van de la más cercana a la más lejana.

### A. APK para Android (la más directa)
- **Cómo:** envolver la página como app con **Capacitor** (o como TWA con Bubblewrap). El juego ya funciona en celular, con táctil y control.
- **Pasos:** comprimir imágenes (de 86 MB a ~15–25 MB) → modo sin internet (todo dentro de la app) → ícono y pantalla de inicio → generar APK firmado.
- **Esfuerzo:** días, no semanas. **Costo:** nada para instalar el APK directo; USD 25 una vez para publicar en Google Play.
- **Se puede repartir el APK** por link sin pasar por la tienda.

### B. App en tiendas (Google Play y App Store)
- **Cómo:** el mismo proyecto de Capacitor sirve para iPhone.
- **Requisitos:** cuenta de Apple Developer (USD 99 al año) y un Mac con Xcode para compilar; política de privacidad; capturas y ficha de la tienda.
- **Ojo legal:** usa la imagen real de personas y nombres de canciones. Conviene tener por escrito la autorización de cada rapero antes de publicar en tiendas; Apple y Google pueden pedirla.
- **Esfuerzo:** 1–3 semanas sobre la opción A, más la revisión de cada tienda.

### C. ROM para consola retro
- **Qué implica:** una ROM (Game Boy Advance, Super Nintendo, Mega Drive) **no** reutiliza este código: hay que reescribir el juego entero en C o ensamblador para esa consola.
- **El arte habría que rehacerlo:** pantallas de 240×160 (GBA), luchadores de ~64 px de alto y 16 colores por personaje; los dibujos actuales tienen ~500 px y miles de colores. Habría que redibujar cada pose a mano o con un proceso dedicado.
- **Esfuerzo:** meses. Es un proyecto aparte, interesante como edición de colección (incluso en cartucho físico), pero no como siguiente paso.
- **Alternativa cercana:** una versión "estilo retro" que sigue siendo web/APK pero con filtro de baja resolución, sin reescribir nada.

**Recomendación:** A → B, y dejar C como proyecto especial a futuro. El primer paso concreto en común para A y B es comprimir las imágenes.
