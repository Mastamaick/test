# Plan de redes · El Rey de la Lleca

Instagram **@elreydelalleca.cl** · también TikTok y YouTube Shorts (el mismo video vertical sirve para los tres).
Juego: https://mastamaick.github.io/test/ (ver "Cambiar el link" al final).

## Formato base: reel vertical por personaje (probado el 9 nov 2026)

- **Medida:** 1080×1920 (9:16), 15–20 s, con el sonido real del juego (voz del locutor nombrando el poder, golpes, música).
- **Estructura del cuadro:**
  - **Arriba:** el logo y el nombre del rapero en grafiti.
  - **Al medio:** la pelea grabada del juego.
  - **Franja amarilla:** el nombre de sus poderes.
  - **Abajo:** "¿TE LA PUEDES?", "JUEGA GRATIS · LINK EN LA BIO" y @elreydelalleca.cl.
- **Contenido del clip:** "ROUND 1", luego el poder especial y después la escena del súper con su golpe.
- **Primera prueba:** `redes/videos/01-veiderr-mars-people.mp4`.
- **Costo:** $0. Sale del juego mismo, sin generadores de video.

### Cómo se hace (receta)
1. Abrir el juego con el servidor del proyecto. En Claude Code se usa la vista previa `escenario-fight`, que corre `node tools/video/serve.js . 5173`. Ese servidor guarda en `revision/videos/` lo que la página le envía.
2. En la consola de la página:
   - Se usa `__recClip(p1, p2, 'nombre.webm', pasos)`, que graba el canvas y el audio del juego con MediaRecorder.
   - Se usa `__overlay(id, línea1, línea2, 'marco.png')`, que dibuja el marco vertical con las letras del juego.
   - Ninguna de las dos funciones está en el juego. Están escritas en la conversación del 9 de noviembre, así que hay que pedirle a Claude que las vuelva a crear.
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
| 10 | Macrodee | Macrodee en el Beat + 20KILLA | Look nuevo (cuando esté) |
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

## Higgsfield (videos con IA)
- **Estado:** el conector funciona, pero la cuenta es gratuita y tiene **10 créditos**. Un clip de 5 s con Kling 3.0 Turbo cuesta 7,5 créditos, así que alcanza para **un** video.
- **Para qué conviene:** tomas que el juego no puede hacer, como un personaje en pixel art caminando por Santiago real o una intro cinematográfica. Para mostrar poderes, la grabación del juego es gratis y se ve igual al juego.

## Cambiar el link (sin comprar dominio)
| Opción | Link resultante | Qué implica |
|---|---|---|
| Renombrar el repositorio `test` | mastamaick.github.io/**elreydelalleca** | 1 clic en GitHub. El link viejo deja de funcionar, salvo que se deje una página que redirija. |
| Repositorio `mastamaick.github.io` | **mastamaick.github.io** | El link más corto en GitHub; el juego pasa a la raíz. |
| Cloudflare Pages o Netlify (gratis) | **elreydelalleca.pages.dev** o **elreydelalleca.netlify.app** | Se conecta al mismo repositorio y se publica solo con cada push. Tiene el nombre del juego. |
