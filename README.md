# El Rey de la Lleca · Batalla de raperos

Juego de pelea 2D para navegador, en pixel art, con raperos chilenos como luchadores. Se juega con teclado, control USB o Bluetooth, o pantalla táctil. No usa dependencias: es HTML, canvas y JavaScript.

© 2026 Mastamaick · Todos los derechos reservados. Ni el código, ni el arte, ni los audios, ni los personajes tienen licencia libre.

## Jugar

El juego carga los sonidos con `fetch`, así que hay que abrirlo con un servidor local. Por ejemplo:

```bash
npx serve .
```

o

```bash
python -m http.server
```

Después, abre la dirección que entrega el servidor en el navegador.

## Documentos

- [FASE-1.md](FASE-1.md): qué quedó hecho, la prueba con los jugadores, las voces que faltan, cómo agregar personajes y el plan de publicación.
- [PROYECTO.md](PROYECTO.md): referencia técnica con controles, daño, roster, escenarios y estructura del código.

## Estructura

- `index.html`: pantallas, estilos y botones.
- `src/roster.js`: personajes y escenarios. Es lo único que hay que tocar para cambiar el roster.
- `src/game.js`: motor del juego (física, golpes, IA, poderes, torre, audio, controles y dibujo).
- `assets/`: personajes, escenarios, efectos, interfaz y audio.
