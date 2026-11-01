# EL REY DE LA LLECA · Cierre de la Fase 1

**Fecha:** 1 de noviembre de 2026
**Estado:** juego completo y jugable, listo para la prueba de los jugadores.

La referencia técnica (estructura del código, daño, cómo agregar personajes) está en [PROYECTO.md](PROYECTO.md).

---

## 1. Qué quedó hecho en la Fase 1

### El juego
- **Género:** juego de pelea 2D estilo arcade en pixel art, con raperos chilenos.
- **Plataforma:** corre en el navegador, sin instalar nada: computador, tablet y celular.
- **Personajes:** 11 raperos con 3 poderes cada uno (poder simple, especial y super) y voz del anunciador para cada poder.
  - **El Bruto CHR:** jefe final. Solo es superior cuando lo controla la CPU en la torre.
  - **Jack Dee:** retador secreto. Aparece después del jefe y se desbloquea al ganarle.
- **Modo Torre (1 jugador):** 6 rivales al azar con dificultad creciente, después el jefe y el retador secreto.
  - Entre peleas, la torre avanza sola: el rival vencido recibe el sello DERROTADO.
  - Al terminarla aparece la pantalla de **campeón**: corona, papel picado y los rivales tachados.
- **Escenarios:** 11 lugares de Santiago, más el estudio del Bruto.
- **Presentación:** pantalla de versus antes de cada pelea, banners en grafiti (ROUND / ¡PELEA!) y nombres en letra de grafiti.
- **Música:** del menú, de pelea, del jefe y de victoria.
- **Mecánicas:**
  - Bloqueo hacia atrás, que también bloquea poderes, pero igual quitan algo de vida.
  - Saltar por encima del rival y golpes aéreos.
  - Mareo y desbloqueos guardados.
  - Los golpes suaves se encadenan.

### Controles
- **Teclado:**
  - A/D moverse, W saltar.
  - F/V puño y puño fuerte, G/B patada y patada fuerte.
  - K poder, P especial, L super.
  - R burla, Esc pausa.
- **Control USB o Bluetooth** (Xbox, PlayStation o genérico):
  - Cruceta o stick para moverse.
  - X/□ puño, Y/△ puño fuerte, A/✕ patada, B/○ patada fuerte.
  - LB poder, RB especial, LT/RT super.
  - Start pausa.
  - Funciona también en los menús.
- **Pantalla táctil:**
  - Joystick que aparece donde apoyas el dedo, en la mitad izquierda.
  - Botones de poderes arriba y golpes abajo.
  - Botón de pausa.
  - Pantalla completa automática en Android.
  - En vertical pide girar el teléfono.

### Material gráfico
- **Afiche** en Canva con los 11 personajes: https://canva.link/7a8gtugogefxipa
- **Logo** del juego en grafiti: `assets/ui/title.png`.

---

## 2. Prueba con los jugadores

### Cómo jugarlo
- Hasta publicarlo, se puede jugar desde un celular conectado al mismo Wi-Fi que el PC:
  - Mientras el servidor de prueba esté encendido, la dirección es `http://192.168.10.10:5174`.
  - El Wi-Fi tiene que estar configurado como red privada en Windows.
- Para los jugadores habrá un link público (ver punto 5).

### Qué les pedimos que reporten
- **Equipo:** qué dispositivo y navegador usaron (por ejemplo, "Android Chrome" o "iPhone Safari").
- **Controles:** si se sienten cómodos, sobre todo el joystick táctil y el control USB.
- **Equilibrio:** personajes o poderes demasiado fuertes o demasiado débiles.
- **Fallas:** cosas que se vean mal (dibujos cortados, poses raras) o que se traben. Idealmente con captura de pantalla.
- **Dificultad:** si la torre es muy fácil o muy difícil.
- **Cambios:** qué les gustaría cambiar de su propio personaje.

---

## 3. Fase 2: voces de los artistas

Cada artista graba sus frases y las reemplazamos en el juego. Hoy esas frases las dice un anunciador generado por voz sintética.

**Formato:**
- Celular o micrófono, en un lugar sin ruido y sin música de fondo.
- Un archivo por frase, en MP3, WAV o nota de voz de WhatsApp.
- Que se note la energía, como gritándolo en una batalla.

| Artista | 1. Especial (gritarlo) | 2. Super (gritarlo) | 3. Burla | 4. Victoria |
|---|---|---|---|---|
| Jonas Sanche | "DAKNOWLEDGE" | "UNDERGROUND BUSINESS" | frase libre | frase libre |
| ChysteMc | "TECHYFUTBOL" | "SUN JOKE" | frase libre | frase libre |
| Macrodee | "MACRODEE EN EL BEAT" | "20KILA" | frase libre | frase libre |
| Ceaese | "DEMONIO CON AROS DE CRUCES" | "UTOPÍA" | frase libre | frase libre |
| Gran Rah | "LENGUAJE VIVO" | "CÚSPIDE" | frase libre | frase libre |
| Veiderr | "MARS PEOPLE" | "20KILA" | frase libre | frase libre |
| Claudio Bastardo | "RÁFAGA DE VÓMITO" | "ÑAAAAA" | frase libre | frase libre |
| Creabeatbox | "BOOM TSS KA" (en beatbox) | "EL DROP" | frase o beat libre | frase libre |
| Mastamaick | "EL COMPLETO" | "ONE HIT WONDER" | frase libre | frase libre |
| Jack Dee | "UN APLAUSO PAL WEON" | "DÉJENME EN PAZ" | frase libre | frase libre |
| El Bruto CHR | "CHAITO" | "LA EJECUCIÓN" | frase libre | frase libre |

**Opcional:** un quejido al recibir un golpe fuerte y un grito al caer (K.O.). Si alguien quiere cambiar el nombre de un poder, es el momento.

**Dónde van:** las voces de los poderes van en `assets/audio/voice/call_<poder>.mp3` y las burlas en el campo `taunt` de `src/roster.js`.

---

## 4. Fase 3: nuevos personajes (si el juego crece)

Cada personaje nuevo necesita:
1. **Fotos** de la persona: cara de frente y de perfil, y cuerpo entero con su ropa típica. Solo como referencia; no se publican.
2. **Poses** en el mismo estilo pixel art, generadas en Gemini con su pose de guardia como referencia de la cara. Son unas 20 poses:
   - Guardia.
   - Puños y patadas, normales y fuertes.
   - Saltos y golpes aéreos.
   - Bloqueo, golpe recibido, mareo y caída.
   - Burla, las dos victorias y la pose de poder máximo.
3. **Tres poderes** con su idea, nombre y pronunciación. Mientras más ligados a su música o personalidad, mejor.
4. **Su ficha** en `src/roster.js` y la programación de su especial y su super.

**Tiempo estimado:** de 1 a 2 sesiones de trabajo por personaje.

---

## 5. Publicación y protección

**Plan:**
1. **Código fuente:** en un repositorio de GitHub **privado** (`mastamaick/test`). Es la copia legible y nadie más la ve.
2. **Publicación:** con **Cloudflare Pages**, que es gratis. Toma el repo privado y publica solo la versión para jugar, con el código **ofuscado** (comprimido e ilegible).
3. **Acceso durante la prueba:** **Cloudflare Access**, gratis hasta 50 personas. Solo entran los correos invitados, con un código que les llega por email.
4. **Derechos:** aviso "© 2026 Mastamaick · Todos los derechos reservados" en el juego y en el repositorio.

En cualquier juego de navegador, las imágenes y los audios siempre se pueden descargar. Eso solo se cubre con el aviso de derechos.

**Estado:**
- Git instalado.
- Pendiente: crear la cuenta de Cloudflare (la creas tú) y conectar el repo.

---

## 6. Pendientes conocidos
- Probar el control USB real. Si se sigue sintiendo lento, comparar con cable y con Bluetooth.
- Ajustar el equilibrio de daño según los comentarios de los jugadores.
- El modo 2 jugadores está programado pero apagado en el menú.
