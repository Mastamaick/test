// ============================================================
//  ROSTER — aquí se editan los personajes. Es lo único que
//  necesitas tocar para meter a tus amigos.
//
//  face:      ruta a una foto PNG/JPG de la cara (recortada,
//             idealmente cuadrada y con fondo transparente).
//             Ej: 'assets/faces/pedro.png'. Si es null se dibuja
//             una cara de caricatura.
//  hair:      'cap' | 'beanie' | 'afro' | 'mohawk' | 'long' | 'bun' | 'buzz' | 'none'
//  extras:    cualquier combinación de 'headphones', 'glasses', 'chain'
//  stats:     speed / power / hp  (1.0 = normal; rango sano 0.8 - 1.25)
//  special:   proyectil. type: 'note' | 'vinyl' | 'wave' | 'fire' | 'ice'
//  super:     se activa con la barra llena.
//             kind: 'briefcase' maletín · 'rasengan' esfera · 'duo' con su
//               compañero (partner: id) · 'books' escalera de libros
//               'rainbow' rayos de colores · 'smoke' humo · 'bible' prédica
//             Sin kind usa type: 'beam' (rayo) | 'rain' (lluvia) | 'rush' (embestida)
//  sprite:    (opcional) dibujo del personaje en vez del esqueleto.
//             Se arma con poses('assets/fighters/x/', [lista]) y cada pose es
//             un PNG con ese nombre: assets/fighters/x/punch.png, etc.
//             PNG con fondo transparente, mirando a la DERECHA, recortado
//             justo a los pies, con la MISMA cara en todas las poses.
//
//             SET ESTÁNDAR POR PERSONAJE (25 imágenes, receta en PERSONAJES-NUEVOS.md):
//               idle      guardia (obligatoria)
//               punch     puño normal              (J1 F · J2 K)
//               punchH    puño fuerte              (J1 V · J2 I)
//               kick      patada normal            (J1 G · J2 L)
//               kickH     patada fuerte, bota al rival (J1 B · J2 J)
//               jumpUp    salto hacia arriba
//               jumpFwd   salto en diagonal
//               block     defenderse (caminar hacia atrás)
//               hit       recibir un golpe
//               dizzy     mareado tras recibir mucho daño (el juego le
//                         dibuja pajaritos encima)
//               fall      caída al suelo, acostado (K.O. y patada fuerte)
//               taunt     burla                    (J1 R · J2 U)
//               winRound  victoria de round
//               winMatch  victoria de la pelea
//               airpunch / airkick  puño y patada voladora en pleno salto
//               punch2 / kick2  segunda animación del puño y la patada suaves
//                         (se alternan al pegar seguido)
//             MOVIMIENTO (MOVE_POSES, 6 imágenes):
//               walk1 / walk2  dos pasos al caminar (se alternan)
//               dashFwd   impulso hacia adelante (doble toque hacia el rival)
//               dashBack  salto corto hacia atrás (doble toque alejándose)
//               crouch    agachado en guardia (S / flecha abajo)
//               crouchDodge agachado esquivando: se ve cuando viene un golpe
//               finisher  pose de PODER MÁXIMO: aparece en grande justo antes
//                         del super (si falta se usa winMatch o la burla)
//             Si falta una pose se usa la más parecida (punchH→punch,
//             fall→hit tumbado, winMatch→winRound...) o la guardia animada.
//  taunt:     { text: 'frase', audio: 'assets/voices/x/taunt.mp3' } de la
//             burla (sin audio la lee la voz sintética).
//  spriteHeight: alto en pantalla en px (por defecto 230).
//  spriteFace: recorte de la cabeza para el retrato [x, y, ancho, alto]
//             en fracciones de la imagen idle.
// ============================================================
// poses('assets/fighters/jonas/', ['idle', 'punch']) → { idle: '.../idle.png', punch: '.../punch.png' }
const poses = (dir, names) => Object.fromEntries(names.map(n => [n, dir + n + '.png']));
// poses de movimiento (caminar, impulso, agacharse); WALK_DASH es la parte que ya tienen todos los que aún no traen agachados
const WALK_DASH = ['walk1', 'walk2', 'dashFwd', 'dashBack'];
const MOVE_POSES = [...WALK_DASH, 'crouch', 'crouchDodge'];

window.ROSTER = [
  // TODO: frases, especial y súper provisorios hasta tener los datos reales
  // (los campos face/hair/extras/skin/colores solo se usan si falta el dibujo)
  {
    id: 'jonas',
    name: 'JONAS SANCHE',
    tagline: 'Rap chileno',
    sprite: poses('assets/fighters/jonas/', ['idle', 'punch', 'punchH', 'kick', 'kickH', 'jumpUp', 'jumpFwd', 'block', 'hit', 'dizzy', 'fall', 'taunt', 'winRound', 'winMatch', 'finisher', 'punch2', 'kick2', 'airpunch', 'airkick', ...MOVE_POSES]),
    skin: '#c68a5d', hairColor: '#1b1410',
    shirt: '#e9e9ee', pants: '#151519', shoes: '#f2f2f2', accent: '#ffd23f',
    hair: 'beanie', extras: ['glasses', 'chain'],
    stats: { speed: 1.0, power: 1.05, hp: 1.0 },
    special: { name: 'FLOW PESADO', type: 'wave', color: '#ffd23f', speed: 10 },
    ex:      { name: 'DAKNOWLEDGE', kind: 'wordfall' },
    super:   { name: 'UNDERGROUND BUSINESS', kind: 'briefcase', type: 'beam', color: '#ffd23f' },
    quotes: ['Así suena la calle.', 'Escucha bien.'],
  },
  {
    id: 'chystemc',
    name: 'CHYSTEMC',
    tagline: 'Rap chileno',
    // look nuevo: jockey azul y chaleco celeste; su finisher es de Hokage con la esfera del SUN JOKE.
    // eat: comiendo brócoli (TECHYFUTBOL); punch2: gancho hacia arriba
    sprite: poses('assets/fighters/chystemc/', ['idle', 'punch', 'punchH', 'kick', 'kickH', 'jumpUp', 'jumpFwd', 'block', 'hit', 'dizzy', 'fall', 'taunt', 'winRound', 'winMatch', 'finisher', 'punch2', 'kick2', 'airpunch', 'airkick', 'eat', ...MOVE_POSES]),
    skin: '#c68a5d', hairColor: '#1b1410',
    shirt: '#16161c', pants: '#c9c9cf', shoes: '#f2f2f2', accent: '#2d6bff',
    hair: 'cap', extras: [],
    stats: { speed: 1.1, power: 0.95, hp: 1.0 },
    special: { name: 'RIMA AL AIRE', type: 'note', color: '#5b8cff', speed: 11 },
    ex:      { name: 'TECHYFUTBOL', kind: 'balls' },
    super:   { name: 'SUN JOKE', kind: 'rasengan', type: 'rush', color: '#5b8cff' },
    quotes: ['Micrófono abierto.', 'Otra más pa la cuenta.'],
  },
  // TODO: poses (14), frases, especial y súper provisorios para los 5 nuevos
  {
    id: 'macrodee', name: 'MACRODEE', tagline: 'Rap chileno',
    sprite: poses('assets/fighters/macrodee/', ['idle', 'punch', 'punchH', 'kick', 'kickH', 'jumpUp', 'jumpFwd', 'block', 'hit', 'dizzy', 'fall', 'taunt', 'winRound', 'winMatch', 'punch2', 'kick2', 'finisher', 'airpunch', 'airkick', ...MOVE_POSES]),
    spriteHeight: 258, // es alto
    skin: '#c99a6e', hairColor: '#111', shirt: '#5e1a26', pants: '#141418', shoes: '#111', accent: '#c2334d',
    hair: 'buzz', extras: ['glasses'],
    stats: { speed: 1.0, power: 1.0, hp: 1.05 },
    special: { name: 'AROMA', type: 'wave', color: '#ff5a76', speed: 10 },
    ex:      { name: 'MACRODEE EN EL BEAT', kind: 'speakers' },
    super:   { name: '20KILLA', kind: 'duo', partner: 'veiderr', type: 'beam', color: '#ff5a76' }, // con Veiderr: LEY 20MIL
    quotes: ['Hazlo mientras puedas.', 'Así se hace en vivo.'],
  },
  {
    id: 'ceaese', name: 'CEAESE', tagline: 'Rap chileno',
    sprite: poses('assets/fighters/ceaese/', ['idle', 'punch', 'punchH', 'kick', 'kickH', 'jumpUp', 'jumpFwd', 'block', 'hit', 'dizzy', 'fall', 'taunt', 'winRound', 'winMatch', 'punch2', 'kick2', 'finisher', 'airpunch', 'airkick', ...MOVE_POSES]),
    skin: '#f1dccb', hairColor: '#3b2a1e', shirt: '#d8401f', pants: '#2f4f86', shoes: '#f2f2f2', accent: '#ff6a2b',
    hair: 'buzz', extras: ['glasses', 'chain'],
    stats: { speed: 1.15, power: 0.95, hp: 0.95 },
    special: { name: 'TINTA VIVA', type: 'fire', color: '#ff6a2b', speed: 11 },
    ex:      { name: 'DEMONIO CON AROS DE CRUCES', kind: 'demon' },
    super:   { name: 'UTOPÍA', kind: 'rainbow', type: 'beam', color: '#ff6a2b' },
    quotes: ['Cada tatuaje es una pelea ganada.', 'Nuki.'],
  },
  {
    id: 'granrah', name: 'GRAN RAH', tagline: 'Rap chileno',
    sprite: poses('assets/fighters/granrah/', ['idle', 'punch', 'punchH', 'kick', 'kickH', 'jumpUp', 'jumpFwd', 'block', 'hit', 'dizzy', 'fall', 'taunt', 'winRound', 'winMatch', 'punch2', 'kick2', 'finisher', 'airpunch', 'airkick', ...MOVE_POSES]),
    skin: '#e6c3a1', hairColor: '#b8b8b8', shirt: '#151519', pants: '#26324a', shoes: '#111', accent: '#c9d6e3',
    hair: 'long', extras: [],
    stats: { speed: 0.85, power: 1.15, hp: 1.2 },
    special: { name: 'LÁGRIMA DE MERCURIO', type: 'ice', color: '#c9d6e3', speed: 8 },
    ex:      { name: 'LENGUAJE VIVO', kind: 'papers' },
    super:   { name: 'CÚSPIDE', kind: 'books', type: 'rush', color: '#c9d6e3' },
    quotes: ['Hay segundos que duran para siempre.', 'No me des precio.'],
  },
  {
    id: 'veiderr', name: 'VEIDERR', tagline: 'Rap chileno',
    sprite: poses('assets/fighters/veiderr/', ['idle', 'punch', 'punchH', 'kick', 'kickH', 'jumpUp', 'jumpFwd', 'block', 'hit', 'dizzy', 'fall', 'taunt', 'winRound', 'winMatch', 'punch2', 'kick2', 'finisher', 'airpunch', 'airkick', ...MOVE_POSES]),
    skin: '#e3b894', hairColor: '#111', shirt: '#151519', pants: '#d6cfbd', shoes: '#f2f2f2', accent: '#ff3b3b',
    hair: 'cap', extras: ['glasses'],
    stats: { speed: 1.05, power: 1.05, hp: 1.0 },
    special: { name: 'LINTERNA', type: 'wave', color: '#ffe14d', speed: 12 },
    ex:      { name: 'MARS PEOPLE', kind: 'ufo' },
    super:   { name: '20KILLA', kind: 'duo', partner: 'macrodee', type: 'beam', color: '#ff3b3b' }, // con Macrodee: LEY 20MIL
    quotes: ['Yo soy tu padre.', 'Apaga la luz.'],
  },
  {
    id: 'claudio', name: 'CLAUDIO BASTARDO', tagline: 'Somos veneno',
    sprite: poses('assets/fighters/claudio/', ['idle', 'punch', 'punchH', 'kick', 'kickH', 'jumpUp', 'jumpFwd', 'block', 'hit', 'dizzy', 'fall', 'taunt', 'winRound', 'winMatch', 'punch2', 'kick2', 'vomit', 'scream', 'finisher', 'airpunch', 'airkick', ...MOVE_POSES]),
    skin: '#d9a273', hairColor: '#6b6b6b', shirt: '#eeeeee', pants: '#141418', shoes: '#111', accent: '#ffb300',
    hair: 'buzz', extras: ['glasses', 'chain'],
    stats: { speed: 0.95, power: 1.1, hp: 1.05 },
    special: { name: 'GARGAJO', type: 'fire', color: '#7cbf3a', speed: 10 },
    ex:      { name: 'RÁFAGA DE VÓMITO', kind: 'vomit', color: '#7cbf3a' },
    super:   { name: 'ÑAAAAA', kind: 'scream', type: 'beam', color: '#ffb300' },
    quotes: ['¡Ñaaaaa!', 'Somos veneno.'],
  },
  // animador y beatboxer: sus poderes salen del micrófono
  {
    id: 'creabeatbox', name: 'CREABEATBOX', tagline: '',
    // beat: haciendo beatbox con el micrófono (pose de sus dos poderes)
    sprite: poses('assets/fighters/creabeatbox/', ['idle', 'punch', 'punchH', 'kick', 'kickH', 'jumpUp', 'jumpFwd', 'block', 'hit', 'dizzy', 'fall', 'taunt', 'winRound', 'winMatch', 'finisher', 'punch2', 'airpunch', 'airkick', 'beat', ...MOVE_POSES]),
    skin: '#c99a6e', hairColor: '#111', shirt: '#111', pants: '#111', shoes: '#f2f2f2', accent: '#ff3030',
    hair: 'cap', extras: ['glasses', 'chain'],
    stats: { speed: 1.05, power: 1.0, hp: 1.0 },
    special: { name: 'BOMBO', type: 'wave', color: '#ff3030', speed: 11 },
    ex:      { name: 'BOOM TSS KA', kind: 'beatwords' },
    super:   { name: 'EL DROP', kind: 'eqdrop', type: 'beam', color: '#ff3030' },
    quotes: [],
  },
  {
    id: 'mastamaick', name: 'MASTAMAICK', tagline: '',
    // eat / eat2: comiendo y masticando el completo · powerup: con fuego · throw1 / throw2: lanzando pesas rusas
    sprite: poses('assets/fighters/mastamaick/', ['idle', 'punch', 'punchH', 'kick', 'kickH', 'jumpUp', 'jumpFwd', 'block', 'hit', 'dizzy', 'fall', 'taunt', 'winRound', 'winMatch', 'finisher', 'punch2', 'kick2', 'airpunch', 'airkick', 'eat', 'eat2', 'powerup', 'throw1', 'throw2', ...WALK_DASH]),
    skin: '#d9a273', hairColor: '#111', shirt: '#f2f2f2', pants: '#3a5d8f', shoes: '#f2f2f2', accent: '#ff8a1f',
    hair: 'cap', extras: [],
    stats: { speed: 1.0, power: 1.05, hp: 1.0 },
    special: { name: 'PROTEÍNA', type: 'fire', color: '#ff8a1f', speed: 11 },
    ex:      { name: 'EL COMPLETO', kind: 'completo' },
    super:   { name: 'ONE HIT WONDER', kind: 'kettlebells', type: 'rush', color: '#ff8a1f' }, // se pronuncia "guan jit guonder"
    quotes: [],
  },
  // RETADOR SECRETO: aparece de incógnito en la torre después de vencer al Bruto; si le ganas, queda elegible.
  // Hoy es pastor: su pose de super es de terno con la Biblia.
  {
    id: 'jackdee', name: 'JACK DEE', tagline: 'De la calle al púlpito',
    locked: true, secret: true,
    sprite: poses('assets/fighters/jackdee/', ['idle', 'punch', 'punchH', 'kick', 'kickH', 'jumpUp', 'jumpFwd', 'block', 'hit', 'dizzy', 'fall', 'taunt', 'winRound', 'winMatch', 'finisher', 'punch2', 'kick2', 'preach', 'airpunch', 'airkick']),
    skin: '#c69872', hairColor: '#111', shirt: '#151519', pants: '#3a5d8f', shoes: '#f2f2f2', accent: '#ffd76a',
    hair: 'cap', extras: [],
    stats: { speed: 1.15, power: 1.0, hp: 0.95 },
    special: { name: 'VERSÍCULO', type: 'note', color: '#ffd76a', speed: 11 },
    ex:      { name: 'UN APLAUSO PAL WEON', kind: 'clap' },
    // origin: punto de la Biblia en la pose preach (adelante, alto) en fracciones del alto del personaje
    super:   { name: 'DÉJENME EN PAZ', kind: 'bible', type: 'beam', color: '#ffe9a0', origin: [0.55, 0.7] },
    poseScale: { preach: 1.15 }, // el dibujo de pastor salió más chico que sus otras poses
    finisherScale: 1.25, // su pose de poder máximo trae la Biblia y los rayos arriba: se agranda para que él se vea del tamaño del resto
    quotes: ['Déjame en paz.', 'Arrepiéntete, hermano.'],
  },
  // JEFE FINAL: más grande, pega más fuerte y siempre pelea en su estudio. Se puede elegir después de vencerlo.
  {
    id: 'bruto',
    name: 'EL BRUTO CHR',
    tagline: 'Jefe final',
    boss: true, locked: true, home: 'Estudio del Bruto',
    // falta: pose de super (finisher); su victoria de pelea es bebiendo una Baltica
    sprite: poses('assets/fighters/bruto/', ['idle', 'punch', 'punchH', 'kick', 'kickH', 'jumpUp', 'jumpFwd', 'block', 'hit', 'dizzy', 'fall', 'taunt', 'winRound', 'winMatch', 'punch2', 'kick2', 'smoke1', 'smoke2', 'finisher', 'airpunch', 'airkick']),
    spriteHeight: 250,
    winSfx: 'can', // al ganar la pelea abre y se toma la lata
    skin: '#e0b08a', hairColor: '#3b2414',
    shirt: '#141418', pants: '#141418', shoes: '#0d0d10', accent: '#d9a92b',
    hair: 'cap', extras: ['chain'],
    stats: { speed: 0.95, power: 1.1, hp: 1.1 }, // elegido por un jugador: apenas más fuerte que el resto
    bossStats: { speed: 0.9, power: 1.25, hp: 1.45 }, // como jefe de la CPU en la torre: aguanta mucho más
    special: { name: 'HUMO DENSO', type: 'wave', color: '#9aa39a', speed: 8 },
    ex:      { name: 'CHAITO', kind: 'launch' },
    super:   { name: 'LA EJECUCIÓN', kind: 'smoke', type: 'rush', color: '#d9a92b' },
    quotes: ['Bienvenido a mi casa.', 'Aquí mando yo.'],
  },
];

// JEFE SUPLENTE: si juegas con el Bruto, el jefe de la torre es esta copia con ropa verde y calavera en el gorro.
// recolor: dark tiñe la ropa negra; skull cambia el logo dorado del gorro por una calavera. No se puede elegir.
{
  const bruto = ROSTER.find(c => c.id === 'bruto');
  ROSTER.push(Object.assign({}, bruto, {
    id: 'brutoverde', name: 'EL BRUTO VERDE', standIn: 'bruto',
    recolor: { dark: '#1f6a3a' }, skull: true,
    shirt: '#163d22', pants: '#163d22', accent: '#3fbf6a',
  }));
}

// Escenarios: el fondo de cada pelea se elige al azar entre los que no tienen off: true.
//  bg: imagen de fondo 16:9 (opcional). El piso donde se paran los luchadores
//      queda a la altura del 86 % de la imagen.
//  Sin bg se dibuja un escenario de concierto con sky, lights, crowd y floor.
window.STAGES = [
  { name: 'La Florida', bg: 'assets/stages/la-florida.png' },
  { name: 'Metro Baquedano', bg: 'assets/stages/baquedano.jpg' },
  { name: 'Plaza de Puente Alto', bg: 'assets/stages/puente-alto.jpg' },
  { name: 'Teatro Caupolicán', bg: 'assets/stages/caupolican.jpg' },
  { name: 'Salida del Metro', bg: 'assets/stages/metro-noche.jpg' },
  { name: 'Vagón del Metro', bg: 'assets/stages/vagon.jpg' },
  { name: 'Plaza de Maipú', bg: 'assets/stages/maipu.jpg' },
  { name: 'Frente a La Moneda', bg: 'assets/stages/la-moneda.jpg' },
  { name: 'Barrio Bellavista', bg: 'assets/stages/bellavista.jpg' },
  { name: 'La Vega Central', bg: 'assets/stages/vega.jpg' },
  { name: 'Cerro San Cristóbal', bg: 'assets/stages/san-cristobal.jpg' },
  // escenario propio del jefe: solo sale cuando pelea el Bruto (home)
  { off: true, name: 'Estudio del Bruto', bg: 'assets/stages/estudio-bruto.jpg' },
  // escenarios de concierto de ejemplo, apagados mientras probamos el estilo dibujado
  { off: true, name: 'Festival Central', sky: ['#1a0b2e', '#3d1a5c'], lights: ['#ff3fa4', '#3fd0ff', '#ffd23f'], crowd: '#0d0618', floor: '#221433' },
  { off: true, name: 'Club Subterráneo', sky: ['#05141a', '#0c3a40'], lights: ['#28d17c', '#9a5cff', '#28d17c'], crowd: '#020a0c', floor: '#0b2025' },
  { off: true, name: 'Teatro Municipal', sky: ['#2a0808', '#5c1414'], lights: ['#ffd9a0', '#ff7a1a', '#ffd9a0'], crowd: '#140303', floor: '#331010' },
];
