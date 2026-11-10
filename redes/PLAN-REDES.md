# Plan de redes · El Rey de la Lleca

Instagram **@elreydelalleca.cl** · también TikTok y YouTube Shorts (el mismo video vertical sirve para los tres).
Juego: **https://elreydelalleca.pages.dev** (link para la bio). El de GitHub, https://mastamaick.github.io/test/, sigue funcionando.

## Formato base: reel vertical por personaje (probado el 9 nov 2026)

- **Medida:** 1080×1920 (9:16), 15–20 s, con el sonido real del juego (voz del locutor nombrando el poder, golpes, música).
- **Estructura del cuadro:**
  - **Arriba:** el logo y el nombre del rapero en grafiti.
  - **Al medio:** la pelea grabada del juego.
  - **Franja amarilla:** el nombre de sus poderes.
  - **Abajo:** "¿TE LA PUEDES?", "JUEGA GRATIS · LINK EN LA BIO" y @elreydelalleca.cl.
- **Contenido del clip:** "ROUND 1", luego el poder especial y después la escena del súper con su golpe.
- **Hechos (9 nov 2026):** los 10 raperos jugables, cada uno contra un rival distinto, en `redes/videos/NN-<id>.mp4`. El Bruto y Jack Dee quedan fuera porque son secretos.

  | Video | Rapero | Rival |
  |---|---|---|
  | 01 | Jonas Sanche | Claudio Bastardo |
  | 02 | ChysteMC | Gran Rah |
  | 03 | Macrodee | Omega |
  | 04 | Ceaese | Mastamaick |
  | 05 | Gran Rah | Creabeatbox |
  | 06 | Veiderr | Ceaese |
  | 07 | Claudio Bastardo | ChysteMC |
  | 08 | Creabeatbox | Macrodee |
  | 09 | Mastamaick | Veiderr |
  | 10 | Omega | Jonas Sanche |

  Las 3 pruebas anteriores, todas contra Jonas, quedaron en `redes/videos/antiguos/`.
- **Costo:** $0. Sale del juego mismo, sin generadores de video.

### Cómo se hace (receta)
1. Abrir el juego con el servidor del proyecto. En Claude Code se usa la vista previa `escenario-fight`, que corre `node tools/video/serve.js . 5173`. Ese servidor guarda en `revision/videos/` lo que la página le envía.
2. En la consola de la página, cargar `await import('/tools/video/grabar.js')`. Trae dos funciones:
   - `__recClip(p1, p2, 'nombre.webm', [[300, go('ex')], [7000, go('super')], [7000, () => {}]])` graba el canvas y el audio del juego. Antes hace una pasada sin grabar para que el video no parta en negro. Hay que cambiar el rival (`p2`) en cada video para que no sea siempre el mismo.
   - `__overlay(id, 'PODER + SÚPER', 'PODER ESPECIAL Y SÚPER', 'marco.png')` dibuja el marco vertical.
3. Armar el video con `sh tools/video/vertical.sh grabacion.webm marco.png salida.mp4`. Recorta el centro de la pelea, pone el marco encima y deja el volumen a −14 LUFS, el estándar de Instagram y TikTok.
4. Revisar fotos sueltas del video antes de publicar.

### Serie propuesta (1 personaje por post, 3 a la semana)
| # | Rapero | Clip | Gancho del texto |
|---|---|---|---|
| 1 | Veiderr | Mars People + 20KILLA | La nave nodriza y el marciano |
| 2 | Omega el CTM | La Baltiloca + El Sur es Hardcore | La Baltica roja |
| 3 | Claudio Bastardo | Ráfaga de Vómito + Ñaaaaa | El más asqueroso |
| 4 | Mastamaick | El Completo + One Hit Wonder | Completo italiano como arma |
| 5 | Creabeatbox | Boom Tss Ka + El Drop | Beatbox que pega |
| 6 | Gran Rah | Lenguaje Vivo + Cúspide | Los libros |
| 7 | Ceaese | Demonio con Aros de Cruces + Utopía | El demonio |
| 8 | ChysteMC | Techyfutbol + Sun Joke | Pelotas de fútbol |
| 9 | Jonas Sanche | Daknowledge + Underground Business | El maletín |
| 10 | Macrodee | Macrodee en el Beat + 20KILLA | (el look nuevo quedó para después: la prueba no convenció) |
| 11 | Jack Dee | silueta negra: "¿quién es el retador secreto?" | Misterio, desbloquéalo |
| 12 | El Bruto CHR | silueta y luego La Ejecución | El jefe final |

### Otros formatos para alternar
- **Publicación en colaboración (Collab) con cada rapero:** el post sale en su cuenta y en la nuestra. Es lo que más alcance da; hay que pedirles que acepten la invitación.
- **"¿Quién gana?":** 2 caras de la selección y una encuesta en historias.
- **Antes / después:** la foto real junto al pixel art, solo si el rapero lo autoriza.
- **Reto:** "Gánale a la torre y manda la captura del CAMPEÓN". Se repostea a quien lo logre.
- **Teaser de desbloqueables:** las siluetas negras de la selección.

### Texto de ejemplo (post 1)
> 👽 VEIDERR desata MARS PEOPLE: la nave nodriza y un marciano que reparte combos. Y si te queda barra… 20KILLA junto a Macrodee 💥
> ¿Te la puedes? 🎮 Juega GRATIS en el link de la bio.
> #elreydelalleca #rapchileno #hiphopchile #freestylechile #pixelart #videojuegos #indiegame #gamedev #chile

## Intro para historias (hecha el 9 nov 2026)
- **Archivo:** `redes/videos/00-intro-historia.mp4`, 16 s, 1080×1920, −14 LUFS.
- **Partes:**
  1. Clip de IA de 5 s: Veiderr contra Omega en el andén de Baquedano, con el logo encima y el metro pasando.
  2. Pantalla VS animada.
  3. 7 cortes de poderes del juego.
  4. Cierre "¿TE LA PUEDES? · JUEGA GRATIS".
- **Música y sonido:** tema del jefe, bienvenida del anunciador, "¡pelea!" y el sonido de cada poder.
- **Clip de IA:** se hizo en **ElevenLabs** con Kling 2.5 Turbo, vertical, a partir de una imagen armada con el arte del juego (`revision/intro/inicio.png`). Costó unos 2.100 créditos de ElevenLabs (~US$0,39). Seedance 2.5 costaba unos 14.000.
- **Cómo rehacerla con otros raperos:**
  - En la consola de la página: `await import('/tools/video/intro.js'); await __introFrames('veiderr', 'omega')`. Dibuja el VS y el cierre.
  - Después: `sh tools/video/intro.sh clip_ia.mp4 vs.mp4 cortes.mp4 fin.mp4 salida.mp4`.

## Higgsfield (videos con IA)
- **Estado:** el plan gratis **no permite generar video**, aunque la cuenta tenga 10 créditos: pide el plan Basic o superior (probado el 9 nov 2026). Por eso los clips de IA se hacen en ElevenLabs.
- **Para qué conviene:** tomas que el juego no puede hacer, como un personaje en pixel art caminando por Santiago real o una intro cinematográfica. Para mostrar poderes, la grabación del juego es gratis y se ve igual al juego.

## Link del juego (listo el 9 nov 2026)
- **Link:** **https://elreydelalleca.pages.dev**, en Cloudflare Pages gratis, en la cuenta de Bryan.
- **Origen:** está conectado al repositorio `Mastamaick/test`, rama `ccr-7bdf7156-f3d981`, sin paso de compilación. Con cada push se publica solo.
- **Acceso de Cloudflare:** solo puede ver ese repositorio en GitHub.
- **Link viejo:** `mastamaick.github.io/test` sigue andando igual.
- **Dominio propio (si algún día se compra):** se agrega en Cloudflare, en el proyecto, en "Custom domains".
- **Primera visita:** la carga tarda más mientras Cloudflare guarda los archivos en su caché; después del primer visitante, unos 5 s. Comprimir las imágenes lo mejoraría para todos.
