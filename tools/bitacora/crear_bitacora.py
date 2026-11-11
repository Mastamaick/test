# Crea BITACORA-PERSONAJES.xlsx (bitácora + generador de prompts para Gemini/ElevenLabs).
# OJO: crea el archivo DESDE CERO con los 12 raperos originales; si ya tiene datos nuevos, se pierden.
# Úsalo solo para cambiar el diseño, y guarda antes una copia de la bitácora.
# Uso (Windows):  py -m pip install openpyxl   y luego   py tools/bitacora/crear_bitacora.py BITACORA-NUEVA.xlsx
import re, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter

OUT = sys.argv[1]
F = 'Arial'
NAVY = '1F1640'; GOLD = 'FFD23F'; PINK = 'FF3FA4'; INPUT = 'FFF6CC'; GREY = 'F2F2F2'
thin = Side(style='thin', color='C9C9C9')
box = Border(left=thin, right=thin, top=thin, bottom=thin)
def font(**k): return Font(name=F, **k)
def hdr(c, fill=NAVY, color='FFFFFF'):
    c.font = font(bold=True, color=color); c.fill = PatternFill('solid', fgColor=fill)
    c.alignment = Alignment(wrap_text=True, vertical='center', horizontal='center'); c.border = box

wb = Workbook()

# ---------------- Instrucciones ----------------
ins = wb.active; ins.title = 'Instrucciones'
ins.column_dimensions['A'].width = 3; ins.column_dimensions['B'].width = 110
lines = [
    ('EL REY DE LA LLECA · Bitácora de personajes y generador de prompts', 'title'),
    ('', None),
    ('Para qué sirve', 'h'),
    ('1) BITÁCORA: una fila por rapero, con lo que ya está en el juego y lo que viene (estado, rasgos, poderes, poses listas).', None),
    ('2) GENERADOR: eliges un rapero de la bitácora y te arma los 11 pedidos listos para copiar en Gemini (u otra app de diseño) y en ElevenLabs.', None),
    ('3) POSES: las 25 poses estándar del juego y en qué hoja de Gemini sale cada una.', None),
    ('', None),
    ('Cómo sumar a un rapero nuevo', 'h'),
    ('1. En BITÁCORA, completa una fila nueva (debajo de los que ya están). Las celdas amarillas son las que se llenan a mano.', None),
    ('   Mínimo: Nombre, Estatura, Contextura, Cara y pelo, Ropa, Poder, Especial y Súper (nombre y qué hace).', None),
    ('2. En GENERADOR, celda C3, elige su nombre en la lista. Todos los pedidos se arman solos.', None),
    ('3. PASO 0 · CABEZA: pide la cabeza (pedido 0) con 2 o 3 fotos reales y la cara de otro personaje como referencia de estilo. Se aprueba antes de seguir.', None),
    ('4. CONTROL DE PARECIDO: define en la Bitácora el color principal de la ropa, el gorro, el objeto distintivo y la silueta. La columna "Control de parecido" avisa si ya lo usa otro. Compara con la fila de todos (tools/sprites/lineup.ps1).', None),
    ('5. CUERPO: pide el cuerpo (pedido 1) con la cabeza aprobada, y después las hojas de poses (pedidos 2 a 6) con la ficha y la cabeza.', None),
    ('6. Anota en BITÁCORA cuántas poses van listas y cambia el Estado.', None),
    ('', None),
    ('Colores', 'h'),
    ('Amarillo claro = se llena a mano.   Gris = fórmula (no tocar).   Azul oscuro = títulos.', None),
    ('', None),
    ('Reglas de arte (para que todos se vean integrados)', 'h'),
    ('• Pixel art 16-bit con contorno negro grueso, cuerpo completo, mirando a la DERECHA, fondo blanco puro, sin texto.', None),
    ('• Siempre adjuntar el primer plano de la cara y la ficha; así la cara no cambia entre hojas.', None),
    ('• Revisar cada pose: que no salgan 3 brazos ni 3 piernas.', None),
    ('• Un chat nuevo de Gemini por imagen; no pedir correcciones en el mismo chat.', None),
    ('• Las fotos reales y hojas originales van en .tmp-ref/ (no se publican).', None),
    ('', None),
    ('Notas', 'h'),
    ('• Los datos de los 12 raperos actuales salen del juego (src/roster.js). Los rasgos están descritos a partir de los dibujos: revísalos y corrígelos si algo no calza.', None),
    ('• La Estatura de los raperos actuales no está registrada: complétala cuando la tengas (sirve para las proporciones del dibujo).', None),
    ('• La receta completa y los scripts para cortar las hojas están en PERSONAJES-NUEVOS.md.', None),
]
for i, (t, kind) in enumerate(lines, start=2):
    c = ins.cell(row=i, column=2, value=t); c.alignment = Alignment(wrap_text=True, vertical='top')
    if kind == 'title': c.font = font(bold=True, size=16, color=NAVY)
    elif kind == 'h': c.font = font(bold=True, size=12, color=PINK)
    else: c.font = font(size=11)

# ---------------- Listas ----------------
ls = wb.create_sheet('Listas')
lists = {
    'Estado': ['En el juego', 'Secreto / desbloqueable', 'Jefe', 'En diseño (Gemini)', 'Esperando fotos', 'Propuesto', 'En pausa'],
    'Contextura': ['Delgado', 'Normal', 'Atlético', 'Robusto', 'Grande y corpulento'],
    'SiNo': ['Sí', 'No'],
    'ColorRopa': ['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Mezclilla', 'Azul', 'Celeste', 'Burdeo', 'Rojo', 'Verde', 'Amarillo', 'Naranjo', 'Café', 'Morado', 'Multicolor', 'Por definir'],
    'Gorro': ['Jockey negro', 'Jockey blanco', 'Jockey gris', 'Jockey de color', 'Gorro de lana', 'Pañuelo', 'Sin gorro', 'Otro'],
}
for j, (name, vals) in enumerate(lists.items(), start=1):
    ls.cell(row=1, column=j, value=name).font = font(bold=True)
    for i, v in enumerate(vals, start=2): ls.cell(row=i, column=j, value=v).font = font()
    ls.column_dimensions[get_column_letter(j)].width = 26
ls.sheet_state = 'hidden'

# ---------------- Bitácora ----------------
bt = wb.create_sheet('Bitácora', 1)
cols = [
    ('ID (sin espacios)', 14), ('Nombre', 20), ('Estado', 18), ('Fecha de alta', 12), ('Propuesto por', 16),
    ('Estatura (cm)', 10), ('Contextura', 14), ('Tono de piel', 14), ('Cara y pelo (barba, peinado, lentes, tatuajes)', 38),
    ('Gorro y accesorios', 28), ('Ropa de arriba', 30), ('Ropa de abajo', 24), ('Zapatillas', 20), ('Color de acento (hex)', 12),
    ('Personalidad / actitud', 26), ('Poder simple: nombre', 18), ('Poder simple: qué hace', 30), ('Especial: nombre', 22),
    ('Especial: qué hace', 40), ('Súper: nombre', 22), ('Súper: qué hace', 44), ('Escenario propio', 18), ('Frase de burla', 26),
    ('Fotos recibidas', 10), ('Poses listas (de 25)', 10), ('Avance', 9), ('Notas', 36),
    ('Color principal de la ropa', 14), ('Gorro', 14), ('Objeto distintivo', 26), ('Silueta: cómo se reconoce de lejos', 30), ('Control de parecido', 36),
]
bt.cell(row=1, column=1, value='BITÁCORA DE PERSONAJES').font = font(bold=True, size=14, color=NAVY)
bt.cell(row=2, column=1, value='Una fila por rapero. Celdas amarillas = se llenan a mano; "Avance" se calcula solo. Agrega los nuevos debajo de la última fila.').font = font(italic=True, color='666666')
HR = 4
for j, (h, w) in enumerate(cols, start=1):
    hdr(bt.cell(row=HR, column=j, value=h)); bt.column_dimensions[get_column_letter(j)].width = w
bt.row_dimensions[HR].height = 48
bt.freeze_panes = bt.cell(row=HR + 1, column=3)

S = 'Pose de energía del poder simple: bola de energía con su nombre (sin barra, con recarga).'
data = [
    ['jonas', 'JONAS SANCHE', 'En el juego', '', '', '', 'Normal', 'Moreno claro', 'Bigote y chivo finos, lentes redondos dorados', 'Gorro blanco ajustado', 'Polerón gris claro con letras azules', 'Pantalón cargo negro', 'Blancas', '#ffd23f', 'Tranquilo, sonrisa confiada', 'FLOW PESADO', S, 'DAKNOWLEDGE', 'Caen bloques de piedra con palabras sobre el rival', 'UNDERGROUND BUSINESS', 'Maletín bomba que explota', '', 'Así suena la calle.', 'Sí', 25, '', 'Polerón con letras: en el VS no voltearlo para que no se lean al revés.'],
    ['chystemc', 'CHYSTEMC', 'En el juego', '', '', '', 'Normal', 'Moreno', 'Sonrisa grande, barba corta', 'Jockey azul hacia atrás con pañuelo blanco debajo', 'Chaleco inflado celeste sobre polera blanca', 'Short blanco', 'Grises con rojo', '#2d6bff', 'Alegre y burlón', 'RIMA AL AIRE', S, 'TECHYFUTBOL', 'Come un brócoli y lanza 8 balones que buscan al rival', 'SUN JOKE', 'Esfera de energía azul en la mano (pose de Hokage) y se lanza contra el rival', '', 'Micrófono abierto.', 'Sí', 25, '', ''],
    ['macrodee', 'MACRODEE', 'En el juego', '', '', '', 'Normal', 'Moreno claro', 'Barba', 'Jockey negro', 'Polerón burdeo', 'Pantalón negro', 'Negras', '#c2334d', 'Intenso, de escenario', 'AROMA', S, 'MACRODEE EN EL BEAT', 'Parlantes gigantes disparan bolas', '20KILLA', 'Rayo verde junto a Veiderr (LEY 20MIL)', '', 'Hazlo mientras puedas.', 'Sí', 25, '', 'Look nuevo (puffer verde, polerón negro, lentes gruesos) en pausa: la prueba no convenció.'],
    ['ceaese', 'CEAESE', 'En el juego', '', '', '', 'Delgado', 'Moreno claro', 'Lentes oscuros, brazos tatuados', 'Pañuelo blanco en la cabeza', 'Camisa clara abierta', 'Jeans azules', 'Blancas', '#ff6a2b', 'Rápido y callejero', 'TINTA VIVA', S, 'DEMONIO CON AROS DE CRUCES', 'Un demonio paraliza al rival, lo quema 5 veces y lo patea', 'UTOPÍA', 'Rayos de colores tipo arcoíris', '', 'Cada tatuaje es una pelea ganada.', 'Sí', 25, '', ''],
    ['granrah', 'GRAN RAH', 'En el juego', '', '', '', 'Robusto', 'Claro', 'Pelo largo canoso y barba larga gris', '', 'Ropa negra', 'Pantalón azul oscuro', 'Negras', '#c9d6e3', 'Sabio y pesado', 'LÁGRIMA DE MERCURIO', S, 'LENGUAJE VIVO', 'Hojas de papel que vuelan contra el rival', 'CÚSPIDE', 'Escalera de libros dorados y caída en picada', '', 'Hay segundos que duran para siempre.', 'Sí', 25, '', ''],
    ['veiderr', 'VEIDERR', 'En el juego', '', '', '', 'Normal', 'Moreno claro', 'Lentes de sol negros, chivo, aro', 'Jockey negro, reloj plateado', 'Polera negra', 'Short plateado brillante', 'Blancas', '#ff3b3b', 'Seguro, oscuro', 'LINTERNA', S, 'MARS PEOPLE', 'Un ovni dispara y baja un marciano que reparte combos', '20KILLA', 'Rayo verde junto a Macrodee', '', 'Yo soy tu padre.', 'Sí', 25, '', ''],
    ['claudio', 'CLAUDIO BASTARDO', 'En el juego', '', '', '', 'Robusto', 'Claro', 'Cabeza rapada, barba, brazos tatuados', '', 'Musculosa blanca con letras', 'Pantalón negro', 'Blancas', '#ffb300', 'Asqueroso y gritón', 'GARGAJO', S, 'RÁFAGA DE VÓMITO', 'Lanza un chorro de vómito verde', 'ÑAAAAA', 'Grito que lanza letras gigantes', '', '¡Ñaaaaa!', 'Sí', 25, '', ''],
    ['creabeatbox', 'CREABEATBOX', 'En el juego', '', '', '', 'Normal', 'Moreno claro', 'Lentes transparentes, barba corta, brazos tatuados', 'Jockey negro con corona dorada', 'Polera negra', 'Pantalón negro', 'Blancas', '#ff3030', 'Rítmico, siempre haciendo beat', 'BOMBO', S, 'BOOM TSS KA', 'Los sonidos del beatbox vuelan como palabras', 'EL DROP', 'Arma el beat, hipnotiza al rival y salen del suelo barras de ecualizador gigantes', '', '', 'Sí', 25, '', ''],
    ['mastamaick', 'MASTAMAICK', 'En el juego', '', '', '', 'Atlético', 'Moreno claro', 'Barba corta', 'Jockey negro', 'Chaqueta negra', 'Jeans azules', 'Blancas', '#ff8a1f', 'Deportista, de gimnasio', 'PROTEÍNA', S, 'EL COMPLETO', 'Se come un completo (no recibe daño mientras come), se prende en fuego y mete 2 combos imposibles de bloquear', 'ONE HIT WONDER', '4 pesas rusas alternando las manos', 'Punta de Lobos', '', 'Sí', 25, '', ''],
    ['omega', 'OMEGA EL CTM', 'En el juego', '', '', '', 'Robusto', 'Claro', 'Barba castaña con chivo canoso, cadena plateada', 'Jockey negro con el símbolo Ω', 'Polerón deportivo negro con franjas blancas', 'Buzo negro', 'Negras', '#d8dde6', 'Rudo, del sur', 'GROTESCO', S, 'LA BALTILOCA', 'Lanza una lata de Báltica roja que explota', 'EL SUR ES HARDCORE', 'Terremoto: rocas salen del suelo', '', '', 'Sí', 25, '', ''],
    ['jackdee', 'JACK DEE', 'Secreto / desbloqueable', '', '', '', 'Normal', 'Moreno claro', '', '', 'Ropa negra', 'Jeans azules', 'Blancas', '#ffd76a', 'Predicador de la calle', 'VERSÍCULO', S, 'UN APLAUSO PAL WEON', 'Manos gigantes que aplauden al rival', 'DÉJENME EN PAZ', 'Prédica con la Biblia', '', 'Déjame en paz.', 'Sí', 25, '', 'Retador secreto: se desbloquea ganándole en la torre.'],
    ['bruto', 'EL BRUTO CHR', 'Jefe', '', '', '', 'Grande y corpulento', 'Moreno claro', 'Barba', 'Jockey negro', 'Ropa negra', 'Pantalón negro', 'Negras', '#d9a92b', 'Jefe final, intimidante', 'HUMO DENSO', S, 'CHAITO', 'Manda al rival al cielo y, mientras cae, se toma una lata', 'LA EJECUCIÓN', 'El humo atrapa al rival, 12 golpes rápidos y lo manda a la otra esquina', 'Estudio del Bruto', 'Bienvenido a mi casa.', 'Sí', 25, '', 'Jefe final. Versión verde (brutoverde) cuando el jugador elige al Bruto.'],
]
# correcciones de rasgos (revisadas con tools/sprites/lineup.ps1) y columnas del control de parecido
fix = {  # id: {columna: valor}  (9 cara, 10 gorro, 11 arriba, 12 abajo)
    'macrodee': {9: 'Pelo corto oscuro, lentes de marco delgado, barba corta', 10: '', 11: 'Polerón burdeo con capucha'},
    'ceaese': {9: 'Lentes de sol redondos, cuello y brazos tatuados', 10: 'Pañuelo estampado en la frente', 11: 'Camisa blanca a rayas abierta sobre polera blanca', 12: 'Jeans azules anchos'},
    'granrah': {10: 'Jockey negro hacia atrás', 11: 'Polerón negro con estampado', 12: 'Pantalón cargo negro'},
    'claudio': {9: 'Cabeza rapada con tatuaje, lentes, barba, brazos tatuados', 11: 'Musculosa blanca con letras DOCK'},
    'creabeatbox': {9: 'Lentes transparentes, barba corta, brazos tatuados, cadena plateada'},
    'mastamaick': {9: 'Barba corta, sonrisa', 10: 'Jockey negro con letras blancas', 11: 'Chaqueta negra abierta sobre polera estampada'},
    'jackdee': {9: 'Barba corta', 10: 'Jockey negro hacia atrás', 11: 'Polera negra con logo azul redondo'},
    'bruto': {9: 'Cara redonda, barba, cabeza grande', 10: 'Jockey negro con logo rojo', 11: 'Polerón negro con estampado rojo y blanco'},
}
look = {  # color principal, gorro, objeto distintivo, silueta
    'jonas': ['Gris claro', 'Gorro de lana', 'Gorro blanco y lentes redondos dorados', 'Gorro blanco ajustado y polerón claro'],
    'chystemc': ['Celeste', 'Jockey de color', 'Chaleco inflado celeste', 'Jockey azul hacia atrás y short blanco'],
    'macrodee': ['Burdeo', 'Sin gorro', 'Polerón burdeo', 'Cabeza descubierta, todo burdeo y negro'],
    'ceaese': ['Blanco', 'Pañuelo', 'Pañuelo en la frente y tatuajes', 'Camisa abierta, jeans anchos'],
    'granrah': ['Negro', 'Jockey negro', 'Pelo largo y barba canosos', 'Melena larga gris'],
    'veiderr': ['Negro', 'Jockey negro', 'Short plateado y lentes de sol', 'Piernas al aire con short brillante'],
    'claudio': ['Blanco', 'Sin gorro', 'Musculosa DOCK y tatuajes', 'Cabeza rapada, brazos tatuados'],
    'creabeatbox': ['Negro', 'Jockey negro', 'Corona dorada en el jockey', 'Todo negro con cadena'],
    'mastamaick': ['Negro', 'Jockey negro', 'Polera estampada bajo chaqueta', 'Chaqueta abierta y jeans'],
    'omega': ['Negro', 'Jockey negro', 'Franjas blancas y cadena', 'Buzo deportivo con franjas'],
    'jackdee': ['Negro', 'Jockey negro', 'Logo azul en la polera', 'Jockey hacia atrás y jeans'],
    'bruto': ['Negro', 'Jockey negro', 'Estampado rojo, corpulento', 'El más grande del juego'],
}
for row in data:
    for col, v in fix.get(row[0], {}).items(): row[col - 1] = v
    row.extend(look.get(row[0], ['', '', '', '']))
# Los raperos nuevos (sin anunciar) NO van en este script, que es público: se agregan a mano en el Excel.
FIRST = HR + 1; LAST = 80
input_fill = PatternFill('solid', fgColor=INPUT); calc_fill = PatternFill('solid', fgColor=GREY)
for r in range(FIRST, LAST + 1):
    row = data[r - FIRST] if r - FIRST < len(data) else None
    for j in range(1, len(cols) + 1):
        c = bt.cell(row=r, column=j)
        c.font = font(); c.border = box; c.alignment = Alignment(wrap_text=True, vertical='top')
        if j == 26:  # Avance
            c.value = f'=IF(Y{r}="","",MIN(1,Y{r}/25))'; c.number_format = '0%'; c.fill = calc_fill
        elif j == 32:  # Control de parecido: avisa si el color de ropa o el gorro ya lo usa otro
            rg = lambda L: f'{L}${FIRST}:{L}${LAST}'
            ropa = f'IF(OR(AB{r}="",AB{r}="Por definir",AB{r}="Multicolor"),"",IF(COUNTIF({rg("AB")},AB{r})>1,"Ropa "&LOWER(AB{r})&": la usan "&(COUNTIF({rg("AB")},AB{r})-1)&" más. ",""))'
            gorro = f'IF(OR(AC{r}="",AC{r}="Sin gorro",AC{r}="Otro"),"",IF(COUNTIF({rg("AC")},AC{r})>1,AC{r}&": lo usan "&(COUNTIF({rg("AC")},AC{r})-1)&" más. ",""))'
            c.value = f'=IF(AND(AB{r}="",AC{r}=""),"",IF({ropa}&{gorro}="","Distinto: ningún otro con este color y gorro",{ropa}&{gorro}))'
            c.fill = calc_fill
        else:
            c.fill = input_fill
            if row is not None and row[j - 1] != '': c.value = row[j - 1]
    bt.cell(row=r, column=4).number_format = 'dd-mm-yyyy'
bt.auto_filter.ref = f'A{HR}:{get_column_letter(len(cols))}{LAST}'
for col, lst, n in [('C', 'A', 7), ('G', 'B', 5), ('X', 'C', 2), ('AB', 'D', 16), ('AC', 'E', 8)]:
    dv = DataValidation(type='list', formula1=f'=Listas!${lst}$2:${lst}${n + 1}', allow_blank=True)
    bt.add_data_validation(dv); dv.add(f'{col}{FIRST}:{col}{LAST}')
dvn = DataValidation(type='whole', operator='between', formula1='0', formula2='40', allow_blank=True)
bt.add_data_validation(dvn); dvn.add(f'Y{FIRST}:Y{LAST}')
bt['F4'].comment = Comment('Estatura real en cm. Los 12 actuales no la tienen registrada: complétala cuando la sepas.', 'Bitácora')
bt['I4'].comment = Comment('Rasgos que NO deben cambiar entre poses. Los de los raperos actuales están descritos desde el dibujo del juego: revísalos.', 'Bitácora')
bt['AF4'].comment = Comment('Avisa si el color principal de la ropa o el gorro ya lo usa otro rapero. Lo ideal es que cada uno tenga algo propio que se reconozca de lejos.', 'Bitácora')
bt['Y4'].comment = Comment('Cuántas de las 25 poses estándar ya están cortadas y en assets/fighters/<id>/.', 'Bitácora')

# ---------------- Generador ----------------
g = wb.create_sheet('Generador', 2)
g.column_dimensions['A'].width = 3; g.column_dimensions['B'].width = 30; g.column_dimensions['C'].width = 120
g['B1'] = 'GENERADOR DE PROMPTS'; g['B1'].font = font(bold=True, size=14, color=NAVY)
g['B3'] = 'Elige el rapero ►'; g['B3'].font = font(bold=True, size=12)
g['C3'] = 'JONAS SANCHE'; g['C3'].font = font(bold=True, size=12); g['C3'].fill = PatternFill('solid', fgColor=GOLD); g['C3'].border = box
dvg = DataValidation(type='list', formula1=f"='Bitácora'!$B${FIRST}:$B${LAST}", allow_blank=False)
g.add_data_validation(dvg); dvg.add('C3')
g['C4'] = 'Elige un nombre de la lista (sale de la columna Nombre de la Bitácora). Todo lo de abajo se arma solo.'; g['C4'].font = font(italic=True, color='666666')

hdr(g.cell(row=6, column=2, value='Dato')); hdr(g.cell(row=6, column=3, value='Lo que dice la Bitácora'))
fields = [  # etiqueta, columna en Bitácora
    ('ID', 'A'), ('Estatura (cm)', 'F'), ('Contextura', 'G'), ('Tono de piel', 'H'), ('Cara y pelo', 'I'), ('Gorro y accesorios', 'J'),
    ('Ropa de arriba', 'K'), ('Ropa de abajo', 'L'), ('Zapatillas', 'M'), ('Personalidad', 'O'), ('Poder simple', 'P'), ('Poder simple: qué hace', 'Q'),
    ('Especial', 'R'), ('Especial: qué hace', 'S'), ('Súper', 'T'), ('Súper: qué hace', 'U'), ('Color de acento', 'N'),
    ('Objeto distintivo', 'AD'), ('Silueta', 'AE'),
]
ref = {'Nombre': '$C$3'}
for i, (lab, col) in enumerate(fields, start=7):
    g.cell(row=i, column=2, value=lab).font = font(bold=True)
    c = g.cell(row=i, column=3, value=f"=IFERROR(INDEX('Bitácora'!${col}${FIRST}:${col}${LAST},MATCH($C$3,'Bitácora'!$B${FIRST}:$B${LAST},0))&\"\",\"\")")
    c.font = font(); c.fill = calc_fill; c.border = box; c.alignment = Alignment(wrap_text=True, vertical='top')
    g.cell(row=i, column=2).border = box
    ref[lab] = f'$C${i}'
r0 = 7 + len(fields)
# frases de ayuda (calculadas)
helpers = [
    ('Frase de estatura', f'=IF({ref["Estatura (cm)"]}="","",IF(VALUE({ref["Estatura (cm)"]})<168,"bajo de estatura",IF(VALUE({ref["Estatura (cm)"]})>182,"alto","de estatura media"))&" ("&{ref["Estatura (cm)"]}&" cm)")'),
    # cada parte termina en "; " y la siguiente fila corta el último separador: así un dato vacío no deja huecos
    ('Rasgos (borrador)', '=' + '&'.join([
        f'IF({ref["Cara y pelo"]}="","","cara: "&{ref["Cara y pelo"]}&"; ")',
        f'IF({ref["Gorro y accesorios"]}="","","gorro y accesorios: "&{ref["Gorro y accesorios"]}&"; ")',
        f'IF({ref["Ropa de arriba"]}="","","arriba: "&{ref["Ropa de arriba"]}&"; ")',
        f'IF({ref["Ropa de abajo"]}="","","abajo: "&{ref["Ropa de abajo"]}&"; ")',
        f'IF({ref["Zapatillas"]}="","","zapatillas: "&{ref["Zapatillas"]}&"; ")'])),
    ('Rasgos fijos (para todos los pedidos)', f'=IF($C${r0 + 1}="","(completa cara, gorro y ropa en la Bitácora)",LEFT($C${r0 + 1},LEN($C${r0 + 1})-2))'),
    ('Físico (borrador)', '=' + '&'.join([
        f'IF($C${r0}="","",$C${r0}&"; ")',
        f'IF({ref["Contextura"]}="","","contextura "&LOWER({ref["Contextura"]})&"; ")',
        f'IF({ref["Tono de piel"]}="","","tono de piel "&LOWER({ref["Tono de piel"]})&"; ")'])),
    ('Cabeza (rasgos)', f'=IF({ref["Cara y pelo"]}="","",{ref["Cara y pelo"]})&IF({ref["Gorro y accesorios"]}="","","; "&{ref["Gorro y accesorios"]})'),
    ('Sello', f'=IF({ref["Objeto distintivo"]}="","","Su sello para reconocerlo de lejos: "&{ref["Objeto distintivo"]}&". ")&IF({ref["Silueta"]}="","","Silueta: "&{ref["Silueta"]}&". ")'),
    ('Descripción física', f'=IF($C${r0 + 3}="","","Características físicas: "&LEFT($C${r0 + 3},LEN($C${r0 + 3})-2)&". ")&IF({ref["Personalidad"]}="","","Personalidad: "&{ref["Personalidad"]}&". ")'),
]
for k, (lab, f_) in enumerate(helpers):
    r = r0 + k
    g.cell(row=r, column=2, value=lab).font = font(bold=True); g.cell(row=r, column=2).border = box
    c = g.cell(row=r, column=3, value=f_); c.font = font(); c.fill = calc_fill; c.border = box; c.alignment = Alignment(wrap_text=True, vertical='top')
    ref[lab] = f'$C${r}'

def fx(template):
    """'texto {Campo} texto' -> fórmula Excel con literales de <=240 caracteres (límite de Excel: 255 por literal)."""
    parts = re.split(r'(\{[^}]+\})', template); out = []
    for p in parts:
        if not p: continue
        if p.startswith('{'): out.append(ref[p[1:-1]])
        else:
            for k in range(0, len(p), 240): out.append('"' + p[k:k + 240].replace('"', '""') + '"')
    return '=' + '&'.join(out)

BASE = ('Crea una imagen NUEVA horizontal 16:9 con 6 poses de ESTE MISMO personaje de pixel art (imagen 2 = cuerpo completo, imagen 1 = primer plano de su cara). '
        'Grilla de 3 columnas por 2 filas, EXACTAMENTE 6 figuras de cuerpo completo bien separadas sin tocarse, TODAS mirando a la DERECHA, mismo tamaño, misma escala y mismo estilo pixel art 16-bit con contorno negro grueso. '
        'Fondo blanco puro, SIN sombras en el piso, SIN texto, SIN números, SIN efectos ni líneas de velocidad. Cada figura con 2 brazos y 2 piernas, sin extremidades de más. '
        'RASGOS FIJOS, IDÉNTICOS a la referencia (no cambies la barba ni los ojos): {Rasgos fijos (para todos los pedidos)}. Poses: ')
prompts = [
    ('0 · Cabeza (se aprueba antes del cuerpo)', 'Gemini · adjuntar 2 o 3 fotos reales + una cara de otro personaje del juego como referencia de estilo',
     'Las primeras imágenes son fotos reales de {Nombre}. La ÚLTIMA imagen es solo una referencia de ESTILO (la cara de otro personaje del mismo videojuego): copia su estilo de dibujo, grosor de contorno y forma de sombrear, pero NO su cara. '
     'Crea una imagen NUEVA horizontal 16:9 con 4 cabezas de ESTA persona (cabeza y cuello, sin cuerpo), en pixel art 16-bit con contorno negro grueso, proporciones de caricatura de videojuego de pelea retro, todas a la misma escala y bien separadas: '
     '1) de frente, serio; 2) de tres cuartos mirando a la DERECHA, serio; 3) de tres cuartos a la DERECHA, gritando con rabia; 4) de tres cuartos a la DERECHA, sonrisa burlona. '
     'Que sea MUY reconocible como la persona de las fotos. Rasgos: {Cabeza (rasgos)}. Fondo blanco puro, sin texto, sin números, sin sombras.'),
    ('1 · Cuerpo completo (pose de guardia "idle")', 'Gemini · adjuntar la cabeza aprobada (paso 0) + 1 foto real de cuerpo',
     'Imagen 1 = cabeza de pixel art YA APROBADA de {Nombre}: úsala EXACTAMENTE igual (misma cara, pelo, gorro, accesorios y estilo), sin redibujarla. Imagen 2 = foto real, solo para la contextura. '
     'Dibuja a este personaje de cuerpo completo para un videojuego de pelea retro, en pixel art 16-bit con contorno negro grueso, de pie en guardia de pelea (puños arriba, piernas abiertas), mirando a la DERECHA. '
     '{Descripción física}Rasgos y ropa: {Rasgos fijos (para todos los pedidos)}. {Sello}'
     'Proporciones de caricatura con cabeza algo grande, como los demás personajes del juego. Cuerpo con 2 brazos y 2 piernas. Fondo blanco puro, sin sombra, sin texto, una sola figura.'),
    ('2 · Hoja de golpes', 'Gemini · adjuntar primer plano de la cara + ficha',
     BASE + '1) puño rápido hacia adelante; 2) segundo puño con el otro brazo; 3) puño fuerte con todo el cuerpo girado; 4) patada frontal media; 5) segunda patada baja; 6) patada fuerte alta.'),
    ('3 · Hoja de aire y defensa', 'Gemini · adjuntar primer plano de la cara + ficha',
     BASE + '1) saltando hacia arriba, rodillas recogidas; 2) saltando en diagonal hacia adelante; 3) puño volador hacia abajo en el aire; 4) patada voladora en el aire; 5) cubriéndose con los dos antebrazos frente a la cara; 6) recibiendo un golpe, cuerpo echado hacia atrás con cara de dolor.'),
    ('4 · Hoja de reacciones y victoria', 'Gemini · adjuntar primer plano de la cara + ficha',
     BASE + '1) mareado, tambaleándose; 2) derribado, acostado de espaldas en el suelo; 3) burla, gesto provocador hacia el rival; 4) victoria de round, puño en alto; 5) victoria final, pose de celebración épica; 6) pose de poder máximo, cargando energía con los brazos abiertos (para su súper {Súper}).'),
    ('5 · Hoja de movimiento', 'Gemini · adjuntar primer plano de la cara + ficha',
     BASE + '1) caminando hacia adelante: pierna de adelante estirada y la de atrás doblada, puños en guardia; 2) caminando: el paso siguiente, piernas cruzadas al medio; 3) impulso rápido hacia adelante: cuerpo muy inclinado, una pierna atrás estirada, como lanzándose; 4) salto corto hacia atrás: cuerpo inclinado hacia atrás, pies juntos despegando; 5) de pie en guardia; 6) de pie en guardia. (Las figuras 5 y 6 se descartan.)'),
    ('6 · Agachados (con lienzo guía)', 'Gemini · adjuntar primer plano de la cara + lienzo de tools/sprites/guide.ps1',
     'Imagen 1 = primer plano de la cara de este personaje de pixel art. Imagen 2 = LIENZO: úsala como base y entrega esa misma imagen editada. Deja al personaje de pie a la izquierda tal cual y deja las dos líneas magenta. '
     'A su derecha, parados sobre la línea magenta de abajo (el piso), dibuja 2 figuras del MISMO personaje a la MISMA escala que la figura de pie: A) agachado en cuclillas profundas en guardia, mirando a la derecha, puños frente a la cara; B) agachado en cuclillas profundas esquivando, cabeza agachada y un brazo cubriéndola. '
     'REGLA CLAVE: la parte más alta de las figuras A y B debe quedar DEBAJO de la línea magenta de arriba, sin tocarla. Mismo pixel art 16-bit con contorno negro, misma cara, ropa y colores ({Rasgos fijos (para todos los pedidos)}). Cada figura con 2 brazos y 2 piernas. Fondo blanco, sin texto.'),
    ('7 · Efecto del especial', 'Gemini · sin adjuntos',
     'Dibuja el efecto visual del poder especial "{Especial}" para un videojuego de pelea retro: {Especial: qué hace}. Estilo pixel art 16-bit con contorno negro, colores vivos (color principal {Color de acento}), SOLO el efecto, sin personajes, sin texto. '
     'Fondo negro puro (el negro se vuelve transparente en el juego, así que el brillo debe verse sobre negro). Si el efecto tiene varias partes (proyectiles, explosión, objetos), ponlas separadas en una grilla, cada una completa y sin tocarse.'),
    ('8 · Efecto del súper', 'Gemini · sin adjuntos',
     'Dibuja el efecto visual del súper "{Súper}" para un videojuego de pelea retro: {Súper: qué hace}. Debe verse más grande y espectacular que un especial. Estilo pixel art 16-bit con contorno negro, colores vivos (color principal {Color de acento}), SOLO el efecto, sin personajes, sin texto. '
     'Fondo negro puro (se vuelve transparente en el juego). Si tiene varias partes, sepáralas en una grilla, cada una completa y sin tocarse.'),
    ('9 · Retrato de la escena del súper', 'Gemini · adjuntar primer plano de la cara + ficha',
     'Retrato vertical de ESTE MISMO personaje de pixel art (imagen 2 = cuerpo completo, imagen 1 = cara) para la escena de poder máximo de su súper "{Súper}": cuerpo completo en pose épica y desafiante, cargando el poder ({Súper: qué hace}). '
     'Mismo pixel art 16-bit con contorno negro grueso; rasgos idénticos: {Rasgos fijos (para todos los pedidos)}. Fondo de rayos de color {Color de acento} y negro saliendo desde el centro, estilo cómic. Sin texto. Cuerpo con 2 brazos y 2 piernas.'),
    ('10 · Sonido del especial y del súper', 'ElevenLabs · efectos de sonido',
     'Efecto de sonido de videojuego de pelea retro arcade, corto (1 a 2 segundos), para el poder "{Especial}": {Especial: qué hace}. Impacto fuerte y claro, sin música ni voces. '
     '— Segundo efecto, para el súper "{Súper}": {Súper: qué hace}. Más largo (2 a 3 segundos), épico, con golpe final grave.'),
]
pr = r0 + len(helpers) + 2
hdr(g.cell(row=pr, column=2, value='Pedido')); hdr(g.cell(row=pr, column=3, value='Prompt listo para copiar'))
for k, (title, where, tpl) in enumerate(prompts):
    r = pr + 1 + k
    a = g.cell(row=r, column=2, value=f'{title}\n({where})'); a.font = font(bold=True, color=NAVY); a.alignment = Alignment(wrap_text=True, vertical='top'); a.border = box
    c = g.cell(row=r, column=3, value=fx(tpl)); c.font = font(size=10); c.alignment = Alignment(wrap_text=True, vertical='top'); c.border = box; c.fill = calc_fill
    g.row_dimensions[r].height = 165
g.freeze_panes = 'A5'

# ---------------- Poses ----------------
ps = wb.create_sheet('Poses', 3)
ps.column_dimensions['A'].width = 16; ps.column_dimensions['B'].width = 30; ps.column_dimensions['C'].width = 34
for j, h in enumerate(['Archivo (pose)', 'Qué es', 'Sale de'], start=1): hdr(ps.cell(row=1, column=j, value=h))
poses = [
    ('idle', 'Guardia (obligatoria)', '1 · Ficha'), ('punch', 'Puño', '2 · Hoja de golpes'), ('punch2', 'Segundo puño', '2 · Hoja de golpes'),
    ('punchH', 'Puño fuerte', '2 · Hoja de golpes'), ('kick', 'Patada', '2 · Hoja de golpes'), ('kick2', 'Segunda patada', '2 · Hoja de golpes'),
    ('kickH', 'Patada fuerte', '2 · Hoja de golpes'), ('jumpUp', 'Salto hacia arriba', '3 · Aire y defensa'), ('jumpFwd', 'Salto en diagonal', '3 · Aire y defensa'),
    ('airpunch', 'Puño volador', '3 · Aire y defensa'), ('airkick', 'Patada voladora', '3 · Aire y defensa'), ('block', 'Cubriéndose', '3 · Aire y defensa'),
    ('hit', 'Recibiendo golpe', '3 · Aire y defensa'), ('dizzy', 'Mareado', '4 · Reacciones'), ('fall', 'Derribado', '4 · Reacciones'),
    ('taunt', 'Burla', '4 · Reacciones'), ('winRound', 'Victoria de round', '4 · Reacciones'), ('winMatch', 'Victoria final', '4 · Reacciones'),
    ('finisher', 'Poder máximo', '4 · Reacciones'), ('walk1', 'Paso 1', '5 · Movimiento'), ('walk2', 'Paso 2', '5 · Movimiento'),
    ('dashFwd', 'Impulso adelante', '5 · Movimiento'), ('dashBack', 'Salto corto atrás', '5 · Movimiento'), ('crouch', 'Agachado en guardia', '6 · Agachados'),
    ('crouchDodge', 'Agachado esquivando', '6 · Agachados'),
]
for i, p in enumerate(poses, start=2):
    for j, v in enumerate(p, start=1):
        c = ps.cell(row=i, column=j, value=v); c.font = font(); c.border = box
ps.cell(row=len(poses) + 3, column=1, value='Los poderes con pose propia (por ejemplo eat o smoke1) se suman aparte. Si falta una pose, el juego usa la más parecida.').font = font(italic=True, color='666666')

for ws in wb.worksheets: ws.sheet_view.showGridLines = ws.title not in ('Instrucciones',)
wb.active = 0
wb.save(OUT)
print('ok', OUT)
