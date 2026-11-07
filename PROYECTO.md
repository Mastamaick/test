# EL REY DE LA LLECA · Batalla de raperos

Juego de pelea 2D estilo arcade, en pixel art, con raperos chilenos como luchadores. Corre en el navegador (HTML + canvas + JavaScript, sin instalar nada) y se juega con teclado o pantalla táctil.

Toma el estilo y las ideas de los juegos de pelea clásicos, pero el código, el arte, los sonidos, los personajes y el nombre son propios.

---

## Estado actual (1 de noviembre de 2026)

**Listo y probado en el navegador.** Falta solo la fase de sonidos de los artistas (ver "Próxima fase").

### Modo de juego
- **Modo Torre (1 jugador):** eliges tu rapero y subes una torre de 6 rivales al azar. Arriba están el **jefe final (El Bruto CHR)** y después el **retador secreto (Jack Dee)**.
  - La dificultad de la CPU sube piso a piso.
  - Al ganar, el rival vencido recibe un sello de **DERROTADO**, el marcador sube solo y empieza la siguiente pelea, sin clics.
  - Si pierdes: **REINTENTAR** o **MENÚ**.
  - Al vencer a toda la torre aparece la **pantalla de campeón**: tu personaje en pose de victoria, el logo, papel picado y los rivales tachados.
- **Desbloqueos:** el jefe y el retador secreto aparecen de incógnito (silueta y "???") hasta que les ganas. Después quedan elegibles. Se guardan en el navegador.
- **Si juegas con el Bruto:** el jefe de la torre es **El Bruto Verde** (copia con ropa verde y calavera en el gorro, `brutoverde` en `src/roster.js`), y después viene Jack Dee. Tus peleas son en escenarios al azar; el Estudio del Bruto queda solo para el jefe.
- **Mismo rapero en los dos lados:** el segundo sale con otros colores de ropa. Lo mismo pasa con el compañero del 20KILLA cuando el rival es justo ese compañero (Veiderr contra Macrodee y al revés).
- **El Bruto** solo es superior (más vida y daño, armadura y la CPU al máximo) cuando es el jefe de la CPU en la torre. Elegido por un jugador es casi normal.
- **2 jugadores** está programado pero apagado en el menú, por ahora.
- **Sin encerronas en la esquina:** si el rival está contra la pared, el que pega sale empujado hacia atrás. Cada golpe extra de un combo aturde menos, y al 6.º golpe seguido el que recibe se libera ("¡ZAFÓ!").
- **Impulso:** recorre más distancia y deja una estela del color del personaje.
- **Música de pelea:** 3 temas que se turnan (`fight`, `fight2`, `fight3`), sin repetir el de la pelea anterior. El jefe y el retador tienen el suyo.
- **Pantallas:**
  - Título en grafiti.
  - Selección con panel grande del personaje y sus 3 poderes.
  - Torre.
  - Versus antes de cada pelea.
  - Banners **ROUND 1/2/3** y **¡PELEA!** en grafiti.
  - Pausa con Esc.
- **Nombres de los raperos en letra de grafiti** (Sedgwick Ave Display) en todas las pantallas.

### Controles (jugador 1)
| Tecla | Acción |
|---|---|
| A / D | moverse · retroceder = cubrirse (también bloquea poderes, pero igual quitan algo de vida) |
| A / D dos veces rápido | impulso: hacia el rival avanza de golpe (y se puede pegar al llegar), alejándose da un salto corto atrás |
| impulso hacia el rival + patada | patada voladora: lanza al rival al aire si no se cubre; si la bloquea, el que pateó queda expuesto |
| S | agacharse: los puños y el poder simple pasan por encima (las patadas sí pegan). Con atrás también cubre |
| W | saltar (se puede pasar por encima del rival para cambiar de lado) |
| F / V | puño / puño fuerte |
| G / B | patada / patada fuerte (bota al rival) |
| F o G en el aire | puño y patada voladora |
| **K** | poder simple: bola de energía (sin barra, con recarga) |
| **P** | poder especial (2 barras) |
| **L** | super (3 barras), con cinemática de poder máximo |
| R | burla |
| Esc / M | pausa / sonido |

**Control USB o Bluetooth** (Xbox, PlayStation o genérico con mapeo estándar): cruceta o stick para moverse, saltar y agacharse (abajo); dos toques rápidos a un lado = impulso. Se detecta solo al conectarlo y aparece "🎮 Control conectado". El control 1 es J1 y el control 2 es J2. En los menús, la cruceta mueve, A/✕ confirma y B/○ vuelve.

| Botón | Acción |
|---|---|
| X / □ | puño |
| Y / △ | puño fuerte |
| A / ✕ | patada |
| B / ○ | patada fuerte |
| LB / L1 | poder |
| RB / R1 | especial |
| LT o RT (L2 / R2) | super |
| Select | burla |
| Start | pausa |

**Pantalla táctil:**
- Joystick que aparece donde se apoya el dedo (mitad izquierda): a los lados camina (dos toques rápidos = impulso), hacia arriba salta y hacia abajo se agacha.
- A la derecha, poderes arriba (PODER · ESP · SUPER) y golpes abajo, más un botón de pausa (II).
- Pantalla completa automática con el primer toque en Android, y botón ⛶.
- En la selección, el primer toque muestra al personaje y el segundo lo confirma.
- En celular vertical aparece "Gira el teléfono para jugar".

### Daño (para que los poderes siempre valgan más)
- **Golpes:**
  - Suaves: 5 a 7.
  - Fuertes: 7,5 a 9.
- **Poderes:**
  - Poder simple: 11.
  - Especiales: alrededor de 22 a 36.
  - Supers: alrededor de 30 a 50.
- **Bloqueo:**
  - Un poder bloqueado quita el 40 % de su daño.
  - Un golpe bloqueado quita el 12 %.

---

## Roster (11 personajes)

Todos se editan en **`src/roster.js`**.

| Rapero | Poder (K) | Especial (P, 2 barras) | Super (L, 3 barras) |
|---|---|---|---|
| Jonas Sanche | FLOW PESADO | DAKNOWLEDGE: caen bloques de piedra con palabras | UNDERGROUND BUSINESS: maletín bomba |
| ChysteMc | RIMA AL AIRE | TECHYFUTBOL: come un brócoli y lanza 8 balones que buscan al rival | SUN JOKE: esfera de energía (pose de Hokage) |
| Macrodee | AROMA | MACRODEE EN EL BEAT: parlantes gigantes disparan bolas | 20KILA: rayo con Veiderr (LEY 20MIL) |
| Ceaese | TINTA VIVA | DEMONIO CON AROS DE CRUCES: paraliza, quema 5 veces y patea | UTOPÍA: rayos de colores |
| Gran Rah | LÁGRIMA DE MERCURIO | LENGUAJE VIVO: hojas que vuelan | CÚSPIDE: escalera de libros dorados y caída en picada |
| Veiderr | LINTERNA | MARS PEOPLE: ovni que dispara | 20KILA: rayo con Macrodee |
| Claudio Bastardo | GARGAJO | RÁFAGA DE VÓMITO | ÑAAAAA: grito |
| **Creabeatbox** (nuevo) | BOMBO | BOOM TSS KA: los sonidos del beatbox vuelan como palabras | EL DROP: arma el beat, hipnotiza al rival y salen del suelo barras de ecualizador gigantes |
| **Mastamaick** (nuevo) | PROTEÍNA | EL COMPLETO: se come un completo (no recibe daño mientras come), se prende en fuego y mete 2 combos imposibles de bloquear o esquivar | ONE HIT WONDER ("guan jit guonder"): 4 pesas rusas alternando las manos |
| Jack Dee (retador secreto) | VERSÍCULO | UN APLAUSO PAL WEON: manos gigantes | DÉJENME EN PAZ: prédica con la Biblia |
| El Bruto CHR (jefe final) | HUMO DENSO | CHAITO: lo manda al cielo y, mientras cae, el Bruto se toma una lata | LA EJECUCIÓN: el humo lo atrapa, 12 golpes rápidos y lo manda a la otra esquina. Se esquiva saltando justo cuando sopla, o cubriéndose |

### Escenarios (12 al azar, en `src/roster.js` → `STAGES`)
- La Florida
- Metro Baquedano
- Plaza de Puente Alto
- Teatro Caupolicán
- Salida del Metro
- Vagón del Metro
- Plaza de Maipú
- Frente a La Moneda
- Barrio Bellavista
- La Vega Central
- Cerro San Cristóbal
- Punta de Lobos (Pichilemu): el escenario de Mastamaick, con música playera de reggae y hip hop. Sale siempre que pelea él y también al azar.
- Estudio del Bruto: solo cuando pelea el jefe.

---

## Cómo está armado

```
index.html            pantallas, estilos y botones
src/roster.js         personajes y escenarios (lo único que hay que tocar para cambiar el roster)
src/game.js           motor: física, golpes, IA, poderes, torre, audio, dibujo
assets/fighters/<id>/ una imagen PNG por pose (idle, punch, kick, airkick, finisher...)
assets/stages/        fondos 16:9 (el piso queda al 86 % del alto)
assets/powers/        dibujos de efectos de poderes
assets/ui/            logo, VS, banners en grafiti
assets/audio/         music/ (menú, pelea, jefe, victoria) · sfx/ (golpes y poderes) · voice/ (anunciador)
```

### Agregar o cambiar un personaje
La receta completa (las 25 poses estándar, los pedidos para Gemini y los scripts de recorte en `tools/sprites/`) está en **[PERSONAJES-NUEVOS.md](PERSONAJES-NUEVOS.md)**.

1. Crea `assets/fighters/<id>/` con las poses en PNG de fondo transparente, mirando a la derecha y con los pies al borde inferior. Como mínimo, `idle.png`. La lista de poses estándar está al principio de `src/roster.js`.
2. Agrega su ficha en `src/roster.js`: nombre, color, poder, especial y super.
3. Si falta una pose, el juego usa la más parecida.

### Cómo se hicieron las imágenes
- **Personajes:** hojas de poses en Gemini, usando la pose de guardia como referencia de la cara. Se cortan, se les quita el fondo blanco y se escalan a la misma altura.
- **Escenarios, efectos y banners:** generados con IA en el mismo estilo pixel art.
- **Voces del anunciador y música:** ElevenLabs.

---

## Próxima fase: sonidos de los artistas
Cuando los chicos manden sus audios, se reemplazan o agregan en `assets/audio/`:
- **Frase de burla de cada uno:** en el roster, `taunt: { audio: 'assets/voices/<id>/taunt.mp3' }`.
- **Voces gritando el nombre de su poder:** `assets/audio/voice/call_<tipo>.mp3`. Reemplazan al anunciador.
- **Efectos propios de cada poder:** `assets/audio/sfx/pw_*.mp3`.

Formato ideal: MP3 o WAV, una frase por archivo, sin música de fondo.

## Publicar para que otros lo prueben
El plan de publicación y protección (repositorio privado, Cloudflare Pages con código ofuscado y acceso solo para invitados) está en [FASE-1.md](FASE-1.md), punto 5.

`.gitignore` ya excluye las fotos reales, las referencias y las hojas originales.
