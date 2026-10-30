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
//             type: 'beam' (rayo) | 'rain' (lluvia sobre el rival) | 'rush' (embestida)
// ============================================================
window.ROSTER = [
  {
    id: 'mcflow',
    name: 'MC FLOW',
    tagline: 'Rapero de batalla',
    face: null,
    skin: '#c68a5d', hairColor: '#1b1410',
    shirt: '#e8432e', pants: '#26324a', shoes: '#f2f2f2', accent: '#ffd23f',
    hair: 'cap', extras: ['chain'],
    stats: { speed: 1.1, power: 0.95, hp: 1.0 },
    special: { name: 'Rima Filosa', type: 'wave', color: '#ffd23f', speed: 11 },
    super:   { name: 'FREESTYLE INFINITO', type: 'rain', color: '#ffd23f' },
    quotes: ['¡Te rimo y te dejo mudo!', 'Ese flow no te alcanza.'],
  },
  {
    id: 'djvinilo',
    name: 'DJ VINILO',
    tagline: 'Dueño de la tornamesa',
    face: null,
    skin: '#f0c9a0', hairColor: '#6b3fa0',
    shirt: '#1f1f2b', pants: '#3a3a52', shoes: '#9a5cff', accent: '#9a5cff',
    hair: 'buzz', extras: ['headphones', 'glasses'],
    stats: { speed: 1.0, power: 1.0, hp: 1.0 },
    special: { name: 'Disco Rayado', type: 'vinyl', color: '#9a5cff', speed: 10 },
    super:   { name: 'EL DROP', type: 'beam', color: '#c79bff' },
    quotes: ['Se te cortó el beat.', 'Pista mezclada, rival liquidado.'],
  },
  {
    id: 'diva',
    name: 'LA DIVA',
    tagline: 'Cuatro octavas de dolor',
    face: null,
    skin: '#8d5a3b', hairColor: '#2a1a12',
    shirt: '#ff4fa3', pants: '#ff4fa3', shoes: '#ffd700', accent: '#ffe066',
    hair: 'afro', extras: [],
    stats: { speed: 0.95, power: 1.05, hp: 1.0 },
    special: { name: 'Nota Alta', type: 'note', color: '#ff8fc8', speed: 9 },
    super:   { name: 'DO DE PECHO', type: 'beam', color: '#ff8fc8' },
    quotes: ['Afinada hasta para pegar.', 'Bravo. Para mí.'],
  },
  {
    id: 'bajista',
    name: 'SLAP BAJISTA',
    tagline: 'Las cuatro cuerdas que duelen',
    face: null,
    skin: '#e3b48c', hairColor: '#28d17c',
    shirt: '#111111', pants: '#5a2d2d', shoes: '#28d17c', accent: '#28d17c',
    hair: 'mohawk', extras: ['chain'],
    stats: { speed: 0.9, power: 1.2, hp: 1.1 },
    special: { name: 'Golpe de Amp', type: 'fire', color: '#28d17c', speed: 8 },
    super:   { name: 'SLAP BASS', type: 'rush', color: '#28d17c' },
    quotes: ['Grave. Muy grave.', 'Nadie escucha al bajo... hasta hoy.'],
  },
  {
    id: 'trapero',
    name: 'ICE TRAP',
    tagline: 'Frío como el autotune',
    face: null,
    skin: '#5e3b28', hairColor: '#e8f6ff',
    shirt: '#69c9ff', pants: '#e8f6ff', shoes: '#69c9ff', accent: '#bdf0ff',
    hair: 'beanie', extras: ['chain', 'glasses'],
    stats: { speed: 1.2, power: 0.9, hp: 0.9 },
    special: { name: 'Autotune', type: 'ice', color: '#9fe6ff', speed: 12 },
    super:   { name: 'TORMENTA DE HIELO', type: 'rain', color: '#bdf0ff' },
    quotes: ['Skrrt. Fin de la pelea.', 'Hielo en la muñeca, hielo en tu cara.'],
  },
  {
    id: 'rockero',
    name: 'EL ROCKERO',
    tagline: 'Solo de guitarra en tu cara',
    face: null,
    skin: '#f3d0ad', hairColor: '#3b2414',
    shirt: '#2b2b2b', pants: '#1a2a5a', shoes: '#111111', accent: '#ff7a1a',
    hair: 'long', extras: [],
    stats: { speed: 1.0, power: 1.1, hp: 1.05 },
    special: { name: 'Riff de Fuego', type: 'fire', color: '#ff7a1a', speed: 10 },
    super:   { name: 'SOLO INFERNAL', type: 'rush', color: '#ff7a1a' },
    quotes: ['¡Arriba las manos, abajo tú!', 'Rock and roll nunca muere.'],
  },
];

// Escenarios: el fondo de cada pelea se elige al azar.
window.STAGES = [
  { name: 'Festival Central', sky: ['#1a0b2e', '#3d1a5c'], lights: ['#ff3fa4', '#3fd0ff', '#ffd23f'], crowd: '#0d0618', floor: '#221433' },
  { name: 'Club Subterráneo', sky: ['#05141a', '#0c3a40'], lights: ['#28d17c', '#9a5cff', '#28d17c'], crowd: '#020a0c', floor: '#0b2025' },
  { name: 'Teatro Municipal', sky: ['#2a0808', '#5c1414'], lights: ['#ffd9a0', '#ff7a1a', '#ffd9a0'], crowd: '#140303', floor: '#331010' },
];
