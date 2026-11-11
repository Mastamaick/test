# Cómo crear un personaje nuevo

Receta estándar para sumar a un rapero con la menor cantidad de imágenes en Gemini.
Cada personaje usa **25 poses**, que salen de **6 imágenes de Gemini** (1 ficha y 5 hojas).

## Bitácora y generador de prompts

**`BITACORA-PERSONAJES.xlsx`**, en la raíz del proyecto. OneDrive lo sincroniza, pero no se sube a git porque el repositorio es público.

- **Bitácora:** una fila por rapero, con estado, estatura, rasgos, ropa, poderes, poses listas y notas.
- **Generador:** eliges un rapero en la celda C3 y arma solo los 10 pedidos:
  - Ficha, las 4 hojas de poses y los agachados.
  - Efecto del especial y efecto del súper.
  - Retrato del súper.
  - Sonidos para ElevenLabs.
- **Poses:** dónde sale cada una de las 25 poses.

El diseño del Excel se puede rehacer con `tools/bitacora/crear_bitacora.py`, pero el script crea el archivo desde cero.

## Las 25 poses estándar

| Grupo | Poses (nombre del archivo en `assets/fighters/<id>/`) |
|---|---|
| Base | `idle` (guardia, obligatoria) |
| Golpes | `punch`, `punch2`, `punchH`, `kick`, `kick2`, `kickH` |
| Aire y defensa | `jumpUp`, `jumpFwd`, `airpunch`, `airkick`, `block`, `hit` |
| Reacciones y victoria | `dizzy`, `fall`, `taunt`, `winRound`, `winMatch`, `finisher` |
| Movimiento | `walk1`, `walk2`, `dashFwd`, `dashBack` |
| Agachado | `crouch`, `crouchDodge` |

Si falta alguna, el juego usa la más parecida. Los poderes con pose propia, como `eat` o `smoke1`, se suman aparte.

## Las 6 imágenes en Gemini

1. **Ficha (`idle`)**: el personaje de pie en guardia, mirando a la derecha, en pixel art 16-bit con contorno negro, a partir de la foto real. De esta imagen sale todo lo demás.
2. **Hoja de golpes** (grilla de 3×2): puño, segundo puño, puño fuerte, patada, segunda patada, patada fuerte.
3. **Hoja de aire y defensa** (3×2): salto hacia arriba, salto en diagonal, puño volador, patada voladora, cubriéndose, recibiendo un golpe.
4. **Hoja de reacciones** (3×2): mareado, derribado acostado, burla, victoria de round, victoria final, pose de poder máximo.
5. **Hoja de movimiento** (3×2): dos pasos al caminar, impulso hacia adelante y salto corto hacia atrás. Las figuras 5 y 6 se descartan.
6. **Guía de agachados**: una imagen con dos líneas magenta (ver más abajo) para `crouch` y `crouchDodge`.

Usa un chat nuevo de Gemini para cada imagen. Adjunta siempre el **primer plano de la cara** y la **ficha de cuerpo completo**. Así la cara no cambia entre hojas.

### Pedido base para una hoja (cambia solo la lista de poses)

> Crea una imagen NUEVA horizontal 16:9 con 6 poses de ESTE MISMO personaje de pixel art (imagen 2 = cuerpo completo, imagen 1 = primer plano de su cara). Grilla de 3 columnas por 2 filas, EXACTAMENTE 6 figuras de cuerpo completo bien separadas sin tocarse, TODAS mirando a la DERECHA, mismo tamaño, misma escala y mismo estilo pixel art 16-bit con contorno negro grueso. Fondo blanco puro, SIN sombras en el piso, SIN texto, SIN números, SIN efectos ni líneas de velocidad. RASGOS FIJOS: cara, pelo o gorro, barba, lentes, accesorios, ropa, colores y zapatillas IDÉNTICOS a la referencia, no cambies la barba ni los ojos. Poses: 1) … 6) …

### Hoja de movimiento (poses 1 a 4)

1. Caminando hacia adelante: paso con la pierna de adelante estirada y la de atrás doblada, puños en guardia.
2. Caminando: el paso siguiente, con las piernas cruzadas al medio.
3. Impulso rápido hacia adelante: cuerpo muy inclinado, una pierna atrás estirada, como lanzándose.
4. Salto corto hacia atrás: cuerpo inclinado hacia atrás, pies juntos despegando.

### Agachados con guía (por qué hace falta)

Si se le pide a Gemini "agachado", dibuja al personaje casi del mismo alto que de pie, y los puños no le pasarían por encima. La solución es darle un **lienzo con guía**:

- El personaje de pie a la izquierda.
- Una línea magenta al 58 % de su alto.
- Otra línea magenta en el piso.

Se le pide dibujar a la derecha los 2 agachados **bajo la línea de arriba**. Con eso salen al 70–85 % (guardia) y al 55–65 % (esquivando).

> Imagen 1 = primer plano de la cara de este personaje de pixel art. Imagen 2 = LIENZO: úsala como base y entrega esa misma imagen editada. Deja al personaje de pie a la izquierda tal cual y deja las dos líneas magenta. A su derecha, parados sobre la línea magenta de abajo (el piso), dibuja 2 figuras del MISMO personaje a la MISMA escala que la figura de pie: A) agachado en cuclillas profundas en guardia, mirando a la derecha, puños frente a la cara; B) agachado en cuclillas profundas esquivando, cabeza agachada y un brazo cubriéndola. REGLA CLAVE: la parte más alta de las figuras A y B debe quedar DEBAJO de la línea magenta de arriba, sin tocarla. Mismo pixel art 16-bit con contorno negro, misma cara, pelo o gorro, accesorios, ropa y colores. Fondo blanco, sin texto.

### Si Gemini dibuja más figuras de las pedidas

Pasa seguido (7 u 8 figuras en vez de 6). No hace falta repetir la imagen. El cortador numera las figuras en orden de lectura y tú eliges cuáles usar, con `-` para saltar las que sobran.

## Herramientas (`tools/sprites/`, PowerShell en Windows)

| Script | Qué hace |
|---|---|
| `refs.ps1 -Root . -OutDir <carpeta> -Ids <id>` | Arma las referencias para Gemini: `<id>-idle.png` (cuerpo sobre fondo blanco) y `<id>-face.png` (primer plano de la cabeza). |
| `guide.ps1 -Idle assets\fighters\<id>\idle.png -Out <id>-guide.png` | Arma el lienzo con las líneas magenta para los agachados. |
| `sheet.ps1 -In hoja.png -OutDir <carpeta> -Names 'walk1,walk2,dashFwd,dashBack,-,-' -RefH <alto de idle.png>` | Corta la hoja, quita el fondo blanco y escala todas las figuras con el mismo factor, para que la figura 1 (de pie) mida como la `idle`. |
| `sheet.ps1 … -Rows 1 -RefFrac 1 -Magenta -Names 'stand,crouch,crouchDodge'` | Lo mismo para la guía: borra las líneas magenta rellenando con los píxeles de arriba y abajo. |
| `contact.ps1 <salida.png> <lista de png>` | Pone las poses en fila, con los pies alineados, para revisarlas. |
| `take.ps1 <captura> <salida>` | Limpia el borde de una captura de pantalla de la imagen de Gemini. |

Después de cortar:

1. Copia los PNG a `assets/fighters/<id>/`.
2. En `src/roster.js` agrega `...MOVE_POSES` a la lista `sprite: poses(...)` del personaje.

## Consejos para gastar menos en Gemini

- Una hoja de 6 poses cuesta lo mismo que una pose suelta. Siempre pide hojas.
- No pidas correcciones en el mismo chat ("repite pero…"): Gemini tiende a devolver la misma imagen. Mejor abre un chat nuevo con el pedido corregido.
- Gemini tiene un límite diario de imágenes. Un personaje completo usa 6, así que caben unos 3 o 4 personajes nuevos por día.
- Las fotos reales y las hojas originales van en `.tmp-ref/`, que no se publica.
