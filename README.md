# Escenario Fight

Juego de peleas 2D para navegador con músicos como luchadores. No usa dependencias: es HTML, canvas y JavaScript.

## Jugar

Abre `index.html` en el navegador. Si el navegador bloquea los scripts locales, levanta un servidor con `npx serve .` o `python3 -m http.server`.

| | Moverse | Saltar | Golpe | Patada | Especial | Super |
|---|---|---|---|---|---|---|
| J1 | A / D | W | F | G | H | T |
| J2 | ← / → | ↑ | K | L | Ñ | O |

Para cubrirte, camina hacia atrás. `Esc` pausa el juego y `M` silencia el sonido. En el celular aparecen botones táctiles.

## Meter a tus amigos

Todo se edita en `src/roster.js`:

1. Copia un bloque de personaje y cambia `id`, `name`, colores, pelo y accesorios.
2. Pon su foto en `assets/faces/nombre.png` (cuadrada, cara centrada; mejor con el fondo quitado) y escribe `face: 'assets/faces/nombre.png'`.
3. Ponle nombre a su especial y elige el proyectil: `note`, `vinyl`, `wave`, `fire` o `ice`.
4. Elige su super: `beam` (rayo), `rain` (lluvia sobre el rival) o `rush` (embestida).
5. Ajusta `stats` (velocidad, poder y vida) entre 0.8 y 1.25 para mantenerlo equilibrado.

Para probar una cara sin tocar código, usa el botón "📷 cara" en la pantalla de selección. La foto queda guardada solo en ese navegador.

## Estructura

- `index.html`: menús y estilos
- `src/roster.js`: personajes y escenarios
- `src/game.js`: motor (física, golpes, IA, render y audio sintetizado)
