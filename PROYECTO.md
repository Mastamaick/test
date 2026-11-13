# EL REY DE LA LLECA · Batalla de raperos

Juego de pelea 2D estilo arcade, en pixel art, con raperos chilenos como luchadores. Corre en el navegador (HTML + canvas + JavaScript, sin instalar nada) y se juega con teclado o pantalla táctil.

Toma el estilo y las ideas de los juegos de pelea clásicos, pero el código, el arte, los sonidos, los personajes y el nombre son propios.

---

## Estado actual (1 de noviembre de 2026)

**Listo y probado en el navegador.** Falta solo la fase de sonidos de los artistas (ver "Próxima fase").

### Menú principal y modos
El menú muestra los modos a la izquierda y, a la derecha, una imagen animada del modo elegido (raperos y escenario al azar). Si nadie toca nada por 7 segundos, va pasando solo por los modos. Se maneja con flechas y Enter, con el control o tocando.

- **Historia (la torre, 1 jugador):** eliges tu rapero y subes una torre de 6 rivales al azar. Arriba están el **jefe final (El Bruto CHR)** y después el **retador secreto (Jack Dee)**.
  - La dificultad de la CPU sube piso a piso.
  - Al ganar, el rival vencido recibe un sello de **DERROTADO**, el marcador sube solo y empieza la siguiente pelea, sin clics.
  - Si pierdes: **REINTENTAR** o **MENÚ**.
  - Al vencer a toda la torre aparece la **pantalla de campeón**: tu personaje en pose de victoria, el logo, papel picado y los rivales tachados.
- **Arcade:** una sola pelea contra la CPU. Eliges tu rapero y después a tu rival.
- **1 vs 1:** dos jugadores en el mismo teclado o con dos controles. Cada uno elige su rapero.
- **Práctica:** sin reloj, con la barra de poder siempre llena. El rival no ataca y nadie cae por K.O.: la vida vuelve sola a los 2 segundos sin recibir golpes.
- **Movimientos:** lo que hace cada tecla y los 3 poderes de cada rapero.
- **Ajustes** (se guardan en el navegador):
  - **Dificultad:** fácil, normal o difícil. Cambia el nivel de la CPU en Historia y Arcade.
  - **Sonido:** sí o no.
  - **Calidad de imagen:** alta dibuja el juego a la resolución real de la pantalla (hasta el doble de 1280×720; 1,5 veces en celular). Normal lo deja en 1280×720, por si va lento.
  - **Controles y teclas:** se elige una acción, se aprieta Enter y después la tecla nueva. Si la tecla ya era de otra acción, se intercambian. "Teclas de fábrica" vuelve a las originales.
- **Pausa (Esc o Start):** continuar, reiniciar pelea, ver controles o salir al menú.

### Reglas de la pelea
- **Desbloqueos:** el jefe y el retador secreto aparecen de incógnito (silueta y "???") hasta que les ganas. Después quedan elegibles. Se guardan en el navegador.
- **Si juegas con el Bruto:** el jefe de la torre es **El Bruto Verde** (copia con ropa verde y calavera en el gorro, `brutoverde` en `src/roster.js`), y después viene Jack Dee. Tus peleas son en escenarios al azar; el Estudio del Bruto queda solo para el jefe.
- **Mismo rapero en los dos lados:** el segundo sale con otros colores de ropa. Lo mismo pasa con el compañero del 20KILLA cuando el rival es justo ese compañero (Veiderr contra Macrodee y al revés).
- **El Bruto** solo es superior (más vida y daño, armadura y la CPU al máximo) cuando es el jefe de la CPU en la torre. Elegido por un jugador es casi normal.
- **Sin encerronas en la esquina:** si el rival está contra la pared, el que pega sale empujado hacia atrás. Cada golpe extra de un combo aturde menos, y al 6.º golpe seguido el que recibe se libera ("¡ZAFÓ!").
- **Combos con remate** (lista en `COMBOS`, `src/game.js`). Si los golpes entran seguidos, el último bota al rival con daño extra, cámara encima, rayos y el nombre del combo en grande:
  - **COMBO DE LA LLECA:** puño, puño, patada, patada fuerte. El nombre se puede cambiar por rapero con `combo: { name: '...' }` en `src/roster.js`.
  - **MARTILLAZO:** puño, patada, puño, puño fuerte.
  - **RÁFAGA:** puño, puño, puño fuerte.
  - **PATADÓN:** patada, patada, patada fuerte.
  - **BAJADA AL BARRIO:** agachado puño, puño, patada.
  - Ritmo tolerante (pensado para control USB, que entrega las pulsaciones con algo de retraso):
    - Mientras los golpes van armando un combo, el rival queda aturdido y se le empuja poco, así el golpe siguiente alcanza.
    - El botón queda guardado más tiempo (22 cuadros).
    - Si el que pega deja de atacar, el rival se suelta al tiro.
    - Alcanza con apretar cada ~0,3 a 0,45 s.
  - El contador de golpes seguidos ahora se reinicia cuando el rival se recupera o lo botan. Antes seguía sumando y podía soltar "¡ZAFÓ!" sin que hubiera un combo de verdad.
- **Golpes más fluidos:**
  - El personaje se echa atrás para cargar y avanza seco al pegar, dejando una estela de su color.
  - Después vuelve suave a la guardia, y la pose anterior se desvanece en 4 cuadros en vez de cortarse.
  - El que recibe el golpe se va para atrás.
  - Dibujos de preparación opcionales por rapero: `prepPunch`, `prepPunchH`, `prepKick` y `prepKickH` (ver PERSONAJES-NUEVOS.md).
- **Cámara y efectos:**
  - Los golpes fuertes tiran rayos de impacto y un cuadro blanco cortito.
  - Los poderes grandes sacuden la pantalla con zoom y un giro leve.
  - El super y el especial acercan la cámara al que los lanza.
  - **K.O. de un round:** cámara lenta con zoom al golpe final y destello.
  - **K.O. que gana la pelea:** cámara lenta larga, escenario oscuro con rayos girando en el color del ganador, acercamiento suave y "¡NOMBRE GANA LA PELEA!" bajo el K.O.
- **Impulso:** recorre más distancia y deja una estela del color del personaje.
- **Música de pelea:** 7 temas que se turnan (`fight`, `fight2`, `fight3`, y los de 1 minuto en loop `puerto`, `puerto2`, `faro`, `faro2`), sin repetir el de la pelea anterior. El jefe y el retador tienen el suyo. Valparaíso suena con `puerto` y La Serena con `faro` (una de sus 2 versiones al azar).
- **Pantallas:**
  - Título en grafiti.
  - Selección cara a cara: el J1 a la izquierda y el rival a la derecha (en Historia, "La Torre"). Cada panel muestra al personaje en grande con sus 3 poderes. El dibujo respira y, al confirmar, hace su burla con un destello.
  - Torre.
  - Versus antes de cada pelea.
  - Banners **ROUND 1/2/3** y **¡PELEA!** en grafiti.
  - Pausa con Esc.
- **Nombres de los raperos en letra de grafiti** (Sedgwick Ave Display) en todas las pantallas.

### Controles (jugador 1, teclas de fábrica)
Las teclas del jugador 1 se pueden cambiar en Ajustes → Controles y teclas.

| Tecla | Acción |
|---|---|
| A / D | moverse · retroceder = cubrirse (también bloquea poderes, pero igual quitan algo de vida) |
| A / D dos veces rápido | impulso: hacia el rival avanza de golpe (y se puede pegar al llegar), alejándose da un salto corto atrás |
| abajo + puño / abajo + patada | puño bajo / barrida: la barrida bota al rival y solo se cubre agachado |
| impulso hacia el rival + patada | patada voladora: lanza al rival al aire si no se cubre; si la bloquea, el que pateó queda expuesto |
| S | agacharse: los puños y el poder simple pasan por encima (las patadas sí pegan). Con atrás también cubre |
| W | saltar (se puede pasar por encima del rival para cambiar de lado) |
| K / O | puño / puño fuerte |
| L / Ñ | patada / patada fuerte (bota al rival) |
| K o L en el aire | puño y patada voladora |
| **8** | poder simple: bola de energía (sin barra, con recarga) |
| **9** | poder especial (2 barras) |
| **0** | super (3 barras), con cinemática de poder máximo |
| 2 | burla |
| Esc / M | menú de pausa / sonido |

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
