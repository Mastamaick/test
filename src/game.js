// ============================================================
//  ESCENARIO — motor de pelea 2D (canvas, sin dependencias)
//  Lógica a 60 fps fijos. Personajes dibujados con esqueleto
//  de poses interpoladas (no sprites), así cualquier personaje
//  nuevo del roster sale animado gratis.
// ============================================================
(() => {
'use strict';

const W = 1280, H = 720, GROUND = 620;
const ARENA_L = 70, ARENA_R = W - 70;
const ROUND_TIME = 99, ROUNDS_TO_WIN = 2;
const HP_SCALE = 2.2;
const GRAV = 0.9, JUMP_V = 17.5;

const canvas = document.getElementById('game');
let ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);

// ---------- storage seguro ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin storage */ } },
};

// el sonido ya está activo: se quita el aviso "toca para activar el sonido" de la portada
function soundReady() { const h = document.getElementById('soundHint'); if (h) h.hidden = true; }

// ---------- ajustes del jugador (se guardan en el navegador) ----------
const settings = { diff: store.get('set:diff') || 'normal', quality: store.get('set:quality') || 'alta' };
// nitidez: el juego se piensa en 1280x720, pero se dibuja a la resolución real de la pantalla (hasta el doble),
// porque los dibujos tienen el doble de detalle del que cabe en 720p. En celular se limita a 1,5 para no pedirle tanto.
// dificultad de la CPU: lv = nivel en Arcade; add = cuánto sube o baja cada piso de la torre (y el jefe)
const DIFF = { facil: { name: 'FÁCIL', lv: 0.35, add: -0.18 }, normal: { name: 'NORMAL', lv: 0.6, add: 0 }, dificil: { name: 'DIFÍCIL', lv: 0.9, add: 0.1 } };
if (!DIFF[settings.diff]) settings.diff = 'normal';
let RES = 1;
function fitCanvas() {
  const cssW = canvas.clientWidth || W, dpr = window.devicePixelRatio || 1;
  const max = settings.quality === 'alta' ? (matchMedia('(pointer: coarse)').matches ? 1.5 : 2) : 1;
  const r = Math.max(1, Math.min(max, Math.ceil(cssW * dpr / W * 4) / 4));
  if (r === RES && canvas.width === Math.round(W * r)) return;
  RES = r; canvas.width = Math.round(W * RES); canvas.height = Math.round(H * RES);
}
addEventListener('resize', fitCanvas);

// ---------- caras (foto opcional) ----------
const faceImgs = {};
function loadFace(ch) {
  const src = store.get('face:' + ch.id) || ch.face;
  if (!src) { delete faceImgs[ch.id]; return; }
  const img = new Image();
  img.onload = () => { faceImgs[ch.id] = img; renderSelect(); };
  img.src = src;
}
ROSTER.forEach(loadFace);

// ---------- sprites (arte dibujado por personaje) ----------
// ch.sprite = { idle: 'ruta.png', punch: ..., kick: ..., ... }. Solo idle es
// obligatoria: las poses que falten se animan a partir de idle.
// ---------- cargador de imágenes: pocas descargas a la vez y las urgentes (la pelea que va a empezar) se adelantan ----------
const Loader = {
  cache: {}, queue: [], active: 0, MAX: 6,
  slow: /[?&]lento/.test(location.search) ? 150 : 0, // prueba: ?lento simula internet lento
  img(src, urgent) {
    let e = this.cache[src];
    if (!e) { e = this.cache[src] = { src }; e.promise = new Promise(r => { e.resolve = r; }); this.queue.push(e); }
    if (urgent && !e.started) { this.queue.splice(this.queue.indexOf(e), 1); this.queue.unshift(e); }
    this.pump();
    return e.promise;
  },
  pump() {
    while (this.active < this.MAX && this.queue.length) {
      const e = this.queue.shift(), img = new Image(); e.started = true; this.active++;
      const end = ok => { this.active--; e.done = true; e.resolve(ok ? img : null); this.pump(); };
      img.onload = () => end(true); img.onerror = () => end(false);
      if (this.slow) setTimeout(() => { img.src = e.src; }, this.slow); else img.src = e.src;
    }
  },
};
window.__loader = Loader;
const spriteImgs = {};
// only: lista de poses a cargar (si falta, todas las que aún no estén). Devuelve una promesa que termina al cargar o fallar.
// urgent: se adelanta en la cola (los dos luchadores de la pelea que viene)
function loadSprites(ch, only, urgent) {
  if (!ch.sprite) return Promise.resolve();
  const set = spriteImgs[ch.id] || (spriteImgs[ch.id] = {});
  const list = (only || Object.keys(ch.sprite)).filter(p => ch.sprite[p] && !set[p]);
  return Promise.all(list.map(pose => Loader.img(ch.sprite[pose], urgent).then(img => {
    if (!img || set[pose]) return;
    const out = ch.recolor ? recolor(img, ch) : img; out._footX = footCenter(out); set[pose] = out;
    if (pose === 'idle') renderSelect();
    // dibujo propio mirando a la izquierda (ropa con letras): se guarda volteado para que el juego lo dé vuelta como siempre
    if (ch.spriteLeft && ch.spriteLeft[pose]) return Loader.img(ch.spriteLeft[pose], urgent).then(li => {
      if (!li) return;
      const c = document.createElement('canvas'); c.width = li.width; c.height = li.height;
      const g = c.getContext('2d'); g.translate(li.width, 0); g.scale(-1, 1); g.drawImage(li, 0, 0);
      const l = ch.recolor ? recolor(c, ch) : c; l._footX = footCenter(l); out._L = l;
    });
  })));
}
// ---------- colores alternativos (jefe suplente, mismo rapero en los dos lados) ----------
// ch.recolor = { dark: '#rrggbb' tiñe la ropa negra/gris, hue: grados para girar la ropa de color }.
// La piel, los contornos y lo blanco no se tocan. ch.skull pone una calavera en vez del logo dorado del gorro.
const ALT_COLORS = { dark: '#24407a', hue: 120 };
const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function hueOf(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
function rotateHue(r, g, b, deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), k = (1 - c) / 3, q = Math.sqrt(1 / 3) * s;
  const m = [c + k, k - q, k + q], cl = v => Math.max(0, Math.min(255, Math.round(v)));
  return [cl(r * m[0] + g * m[1] + b * m[2]), cl(r * m[2] + g * m[0] + b * m[1]), cl(r * m[1] + g * m[2] + b * m[0])];
}
function recolor(img, ch) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  let id; try { id = g.getImageData(0, 0, c.width, c.height); } catch (e) { return img; } // file:// sin servidor
  const d = id.data, o = ch.recolor, tint = o.dark && hexRGB(o.dark), gold = [];
  if (ch.skull) id._orig = new Uint8ClampedArray(d);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 40) continue;
    const r = d[i], gg = d[i + 1], b = d[i + 2], sat = Math.max(r, gg, b) - Math.min(r, gg, b), L = (r * 3 + gg * 6 + b) / 10, hue = hueOf(r, gg, b);
    if (ch.skull && hue > 20 && hue < 75 && sat >= 15 && L > 40 && L < 175 && amidDark(id, i >> 2)) gold.push(i >> 2);    // negro/gris de la ropa (la barba y la piel son cálidas: no se tiñen)
    if (tint && L >= 14 && L < 115 && (sat < 12 || (sat < 28 && (hue < 10 || hue > 50)))) { const k = L / 60; d[i] = Math.min(255, tint[0] * k); d[i + 1] = Math.min(255, tint[1] * k); d[i + 2] = Math.min(255, tint[2] * k); }
    // ropa de color: se salta el rango de la piel; los rojos solo si son oscuros (no los labios)
    else if (o.hue && sat > 50 && ((hue >= 50 && hue <= 330) || ((hue < 12 || hue > 330) && L < 110))) [d[i], d[i + 1], d[i + 2]] = rotateHue(r, gg, b, o.hue);
  }
  const ring = ch.skull && (capLogo(gold, c.width) || capLetters(id));
  if (ring) skullOver(d, c.width, ring, tint || [30, 30, 30]);
  g.putImageData(id, 0, 0);
  return c;
}
// rodeado sobre todo de negro (la tela del gorro). Se mira la imagen original, antes de teñir.
function amidDark(id, p) {
  const s = id._orig || (id._orig = new Uint8ClampedArray(id.data)), w = id.width, h = id.height, x = p % w, y = (p / w) | 0;
  let dk = 0, n = 0;
  for (let dy = -4; dy <= 4; dy += 2) for (let dx = -4; dx <= 4; dx += 2) {
    const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
    const j = (yy * w + xx) * 4; n++;
    const mx = Math.max(s[j], s[j + 1], s[j + 2]), mn = Math.min(s[j], s[j + 1], s[j + 2]);
    if (s[j + 3] > 40 && (s[j] * 3 + s[j + 1] * 6 + s[j + 2]) / 10 < 45 && mx - mn < 30) dk++;
  }
  return dk >= n * 0.5;
}
// el logo del gorro es un aro dorado: entre las manchas doradas, la de tamaño de aro y hueca (no la lata ni la llama)
function capLogo(gold, w) {
  const set = new Set(gold), seen = new Set(); let best = null;
  for (const s of gold) {
    if (seen.has(s)) continue;
    const comp = [], q = [s]; seen.add(s);
    while (q.length) { const p = q.pop(); comp.push(p); const x = p % w, y = (p / w) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const n = (y + dy) * w + x + dx; if (set.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } } }
    let x0 = w, y0 = 1e9, x1 = 0, y1 = 0;
    for (const p of comp) { const x = p % w, y = (p / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (bw < 12 || bh < 10 || bw > 50 || bh > 50 || bw / bh > 2 || bh / bw > 2 || comp.length / (bw * bh) > 0.55) continue;
    if (!best || comp.length > best.length) best = comp;
  }
  return best;
}
// gorro con letras (LF del Bruto): manchas de rojo puro en el tercio de arriba; se elige la más rodeada de tela negra
// (no la lata ni el logo del pecho) y se tapa con la calavera junto con su borde blanco
function capLetters(id) {
  const w = id.width, H = id.height, s = id._orig, top = w > H ? H : Math.floor(H * 0.3); // acostado (caída): el gorro puede estar en el suelo
  const pure = p => { const j = p * 4; return s[j + 3] > 40 && s[j] > 120 && s[j] - s[j + 1] > 80 && s[j] - s[j + 2] > 70; };
  const blackAt = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= H) return false; const j = (y * w + x) * 4; return s[j + 3] > 40 && s[j] < 60 && s[j + 1] < 60 && s[j + 2] < 60; };
  const seen = new Uint8Array(w * top), comps = []; let best = null, bestDark = 0.3;
  for (let p0 = 0; p0 < w * top; p0++) {
    if (seen[p0] || !pure(p0)) continue;
    const q = [p0]; seen[p0] = 1; let x0 = w, y0 = H, x1 = 0, y1 = 0, n = 0;
    while (q.length) { const p = q.pop(), x = p % w, y = (p / w) | 0; n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= top) continue; const r = yy * w + xx; if (!seen[r] && pure(r)) { seen[r] = 1; q.push(r); } } }
    if (n < 6 || x1 - x0 > 45 || y1 - y0 > 45) continue;
    const box = [x0, y0, x1, y1]; comps.push(box);
    if (Math.max(x1 - x0, y1 - y0) + 1 > 3 * (Math.min(x1 - x0, y1 - y0) + 1)) continue; // franja larga: barra del logo del pecho
    let dk = 0, m = 0; // borde de la mancha, 5 px afuera: ¿tela negra del gorro?
    for (let x = x0 - 5; x <= x1 + 5; x += 2) { m += 2; dk += blackAt(x, y0 - 5) + blackAt(x, y1 + 5); }
    for (let y = y0 - 5; y <= y1 + 5; y += 2) { m += 2; dk += blackAt(x0 - 5, y) + blackAt(x1 + 5, y); }
    if (dk / m > bestDark) { bestDark = dk / m; best = box.slice(); }
  }
  if (!best) return null;
  // la L y la F pueden salir como manchas separadas: se suman las vecinas
  for (let grew = true; grew;) { grew = false;
    for (const b of comps) {
      if (b[0] >= best[0] && b[1] >= best[1] && b[2] <= best[2] && b[3] <= best[3]) continue;
      const gx = Math.max(b[0] - best[2], best[0] - b[2]), gy = Math.max(b[1] - best[3], best[1] - b[3]);
      if (gx <= 18 && gy <= 8 && Math.max(b[2], best[2]) - Math.min(b[0], best[0]) <= 55 && Math.max(b[3], best[3]) - Math.min(b[1], best[1]) <= 45) { best = [Math.min(b[0], best[0]), Math.min(b[1], best[1]), Math.max(b[2], best[2]), Math.max(b[3], best[3])]; grew = true; }
    } }
  const [x0, y0, x1, y1] = best, out = [];
  for (let y = Math.max(0, y0 - 3); y <= Math.min(H - 1, y1 + 3); y++) for (let x = Math.max(0, x0 - 3); x <= Math.min(w - 1, x1 + 3); x++) {
    const j = (y * w + x) * 4, r = s[j], g = s[j + 1], b = s[j + 2];
    if (s[j + 3] > 40 && ((r > 100 && r - g > 75 && r - b > 65) || (Math.min(r, g, b) > 150))) out.push(y * w + x);
  }
  return out;
}
// calavera en pixel art donde estaba el logo del gorro (mismo tamaño de pixel que el dibujo)
const SKULL = ['..####..', '.######.', '########', '#..##..#', '#..##..#', '###..###', '.######.', '.#.##.#.'];
function skullOver(d, w, gold, tint) {
  let x0 = w, y0 = 1e9, x1 = 0, y1 = 0;
  for (const p of gold) { const x = p % w, y = (p / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const cap = tint.map(v => v * 0.45);
  for (const p of gold) d.set(cap, p * 4);
  const px = Math.max(2, Math.round(Math.max(x1 - x0, y1 - y0) / SKULL.length)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const ox = Math.round(cx - px * 4), oy = Math.round(cy - px * 4);
  SKULL.forEach((row, j) => [...row].forEach((ch, k) => {
    const col = ch === '#' ? [232, 228, 214] : cap;
    for (let yy = 0; yy < px; yy++) for (let xx = 0; xx < px; xx++) {
      const i = ((oy + j * px + yy) * w + ox + k * px + xx) * 4; if (i < 0 || i >= d.length || d[i + 3] < 40) continue;
      if (ch === '#' || row.includes('#')) d.set(col, i);
    }
  }));
}
// copia de un personaje con otros colores de ropa (se crea una vez y se reusa)
const altCache = {};
function altOf(ch) {
  if (!altCache[ch.id]) { altCache[ch.id] = Object.assign({}, ch, { id: ch.id + '-alt', recolor: ch.altColors || ALT_COLORS, altOf: ch.id }); loadSprites(altCache[ch.id]); }
  return altCache[ch.id];
}
// centro de los pies (fracción del ancho): es el punto que se apoya en x del
// luchador, así un golpe con el brazo estirado no corre el cuerpo hacia atrás
function footCenter(img) {
  try {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const y0 = Math.floor(img.height * 0.9), d = g.getImageData(0, y0, img.width, img.height - y0).data;
    let sum = 0, n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) { sum += (i >> 2) % img.width; n++; }
    return n ? sum / n / img.width : 0.5;
  } catch (e) { return 0.5; } // file:// sin servidor no deja leer pixeles
}
// por internet son ~300 imágenes: primero la guardia de todos (las caras del menú) y después el resto de las poses
ROSTER.forEach(ch => loadSprites(ch, ['idle']));
// fondos con imagen: stage.bg (después de las caras, antes del resto de las poses)
const stageImgs = {};
const loadStage = (st, urgent) => st && st.bg ? Loader.img(st.bg, urgent).then(img => { if (img) stageImgs[st.bg] = img; }) : Promise.resolve();
STAGES.forEach(st => loadStage(st));
ROSTER.forEach(ch => loadSprites(ch));
// todo lo que necesita una pelea: escenario, poses de los dos y los dibujos de los poderes.
// onProgress(0..1) va contando; la promesa termina cuando está todo (o falló, para no quedarse pegado)
function preloadFight(chars, stage, onProgress) {
  const jobs = [loadStage(stage, true), ...chars.flatMap(ch => Object.keys(ch.sprite || {}).map(p => loadSprites(ch, [p], true)))];
  let n = 0; const tick = () => { n++; if (onProgress) onProgress(n / jobs.length); };
  jobs.forEach(j => j.then(tick));
  return Promise.all(jobs);
}
const spriteSet = ch => spriteImgs[ch.id] && spriteImgs[ch.id].idle ? spriteImgs[ch.id] : null;
// tamaño de los luchadores en pantalla: SIZE agranda dibujo, cuerpo y alcance de los golpes por igual
const SIZE = 1.3;
const spriteH = ch => (ch.spriteHeight || 230) * SIZE;
// dibujos de los poderes (mismo pixel art de los personajes). Los de energía vienen
// sobre fondo negro y se dibujan sumando luz, así el negro no se ve.
const POWER_ART = ['can_red', 'can_fly', 'foam', 'rock_tall', 'rock_wide', 'rock1', 'rock2', 'rock3', 'rock4', 'vomit_ball', 'vomit_puddle', 'vomit_splash', 'ball', 'book', 'briefcase', 'cross', 'demon', 'explosion', 'hand', 'holy', 'orb_blue', 'orb_green', 'orb_pink', 'paper', 'slab', 'smoke', 'speaker', 'speaker_side', 'ufo', 'mothership', 'alien_drop', 'alien_punch', 'alien_kick'];
const GLOW_ART = ['cross', 'explosion', 'holy', 'orb_blue', 'orb_green', 'orb_pink'];
const powerImgs = {};
POWER_ART.forEach(n => Loader.img('assets/powers/' + n + '.png').then(img => { if (img) powerImgs[n] = img; }));
// dibuja un arte de poder centrado en (x, y) con ancho w; o: { rot, alpha, flipX, h }
function art(name, x, y, w, o = {}) {
  const img = powerImgs[name]; if (!img) return false;
  const h = o.h || w * img.height / img.width;
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  if (o.flipX) ctx.scale(-1, 1);
  if (o.alpha != null) ctx.globalAlpha = Math.max(0, Math.min(1, o.alpha));
  if (GLOW_ART.includes(name)) ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = false; ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore(); return true;
}
// alcance que muestra el dibujo de un ataque (de los pies a la punta del puño o el pie),
// para que un golpe que se ve conectar también conecte en el juego
function spriteReach(ch, pose) {
  const set = spriteSet(ch), img = set && set[pose];
  if (!img) return 0;
  const k = spriteH(ch) / set.idle.height;
  return (1 - (img._footX ?? 0.5)) * img.width * k - 20;
}
// silueta blanca para el destello al recibir golpe (se calcula una vez)
function whiteOf(img) {
  if (img._white) return img._white;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  return (img._white = c);
}

// ============================================================
//  AUDIO — música, efectos y anunciador en assets/audio (ElevenLabs).
//  Tres canales con volumen propio: música (bajita), efectos y voz.
//  Cuando habla el anunciador la música baja sola para que se entienda.
//  Si un archivo no carga (p. ej. abriendo index.html sin servidor)
//  suena un efecto sintetizado o la voz del navegador.
// ============================================================
// letra de grafiti para los nombres de los raperos (Google Fonts, cargada en index.html)
const GRAF_FONT = '"Sedgwick Ave Display", "Bungee", system-ui, sans-serif';
const SND_DIR = 'assets/audio/';
const SFX_FILES = ['punch', 'punchH', 'kick', 'kickH', 'whoosh', 'block', 'jump', 'land', 'fall', 'dizzy',
  'special_note', 'special_vinyl', 'special_wave', 'special_fire', 'special_ice', 'clash',
  'super_start', 'super_beam', 'super_rush', 'super_rain', 'ko', 'crowd', 'timer', 'menu_move', 'menu_select', 'finisher', 'can',
  // poderes de cada rapero
  'pw_wordfall', 'pw_ball', 'pw_bass', 'pw_paper', 'pw_demon', 'pw_ufo', 'pw_launch', 'pw_fall', 'pw_clap',
  'pw_boom', 'pw_sphere', 'pw_beam2', 'pw_books', 'pw_rainbow', 'pw_smoke', 'pw_holy', 'pw_vomit', 'pw_scream', 'ex_start', 'airpunch'];
// el anunciador nombra cada poder especial y super: tramos [inicio, fin] en s de voice/powers.mp3
const POWER_CALLS = { briefcase: [0.05, 1.55], wordfall: [1.95, 2.84], balls: [3.29, 4.19], rasengan: [4.61, 5.4], speakers: [5.78, 6.71], duo: [7.13, 8.07], papers: [8.5, 9.5], books: [10, 10.67], demon: [11.1, 12.9], rainbow: [13.28, 14], ufo: [14.46, 15.26], launch: [15.68, 16.21], smoke: [16.69, 17.65], clap: [18.07, 19.17], bible: [19.64, 20.71], vomit: [21.08, 22.34], scream: [22.85, 23.53] };
// voice/call_<kind>.mp3 reemplaza el tramo de powers.mp3 de ese poder (nombres regrabados)
const CALL_FILES = ['duo', 'speakers', 'beatwords', 'eqdrop', 'completo', 'kettlebells', 'baltiloca', 'quake'];
const VOICE_FILES = ['powers', 'welcome', 'round1', 'round2', 'roundFinal', 'fight', 'vamos', 'combo', 'super', 'ko', 'time', 'next', ...CALL_FILES.map(k => 'call_' + k)];
// temas de pelea: se van turnando para que dos peleas seguidas no tengan la misma música
const FIGHT_TRACKS = ['fight', 'fight2', 'fight3'];
const MUSIC_FILES = ['menu', ...FIGHT_TRACKS, 'boss', 'victory', 'playa'];
const MIX = { music: 0.32, sfx: 0.8, voice: 1.0, duck: 0.35 };

const Audio = {
  ctx: null, muted: store.get('muted') === '1', bufs: {}, track: null, trackName: null, raw: {},
  // descarga un archivo de sonido (sin decodificar: eso necesita el primer toque). Reintenta 3 veces si falla la red.
  fetchRaw(key, url) {
    if (!this.raw[key]) this.raw[key] = (async () => {
      for (let i = 0; i < 3; i++) {
        try { const r = await fetch(url); if (r.ok) return await r.arrayBuffer(); } catch (e) { /* reintenta */ }
        await new Promise(res => setTimeout(res, 900 * (i + 1)));
      }
      return null;
    })();
    return this.raw[key];
  },
  // todos los sonidos: efectos y voces primero (son livianos), después la música
  files() {
    return [...SFX_FILES.map(n => ['sfx:' + n, SND_DIR + 'sfx/' + n + '.mp3']), ...VOICE_FILES.map(n => ['voice:' + n, SND_DIR + 'voice/' + n + '.mp3']),
      ...MUSIC_FILES.map(n => ['music:' + n, SND_DIR + 'music/' + n + '.mp3'])];
  },
  // al abrir la página: empieza a bajar todo. Devuelve las descargas que la pantalla de carga espera
  // (efectos, voces y la música del menú; los temas de pelea siguen bajando de fondo)
  prefetch() {
    const need = [];
    for (const [k, u] of this.files()) { const p = this.fetchRaw(k, u); if (!k.startsWith('music:') || k === 'music:menu') need.push(p); }
    return need;
  },
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().then(soundReady, () => {}); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; return; }
    const c = this.ctx;
    if (c.state === 'running') soundReady(); else c.resume().then(soundReady, () => {});
    c.onstatechange = () => { if (c.state === 'running') soundReady(); };
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(c.destination);
    // compresor suave en la salida: evita que golpes + voz + música saturen
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(this.master);
    for (const bus of ['music', 'sfx', 'voice']) { const g = this[bus + 'Bus'] = c.createGain(); g.gain.value = MIX[bus]; g.connect(comp); }
    // usa lo ya descargado en prefetch (o lo baja ahora) y lo decodifica
    const load = (key, url) => this.fetchRaw(key, url).then(b => b ? new Promise((ok, bad) => c.decodeAudioData(b.slice(0), ok, bad)) : Promise.reject())
      .then(buf => {
        this.bufs[key] = buf;
        if (key === 'music:' + this.wantTrack) this.playMusic(this.wantTrack); // llegó la música pedida
        if (key === 'voice:welcome' && this.wantWelcome) { this.wantWelcome = false; this.voice('welcome'); }
      }).catch(() => { /* sin archivo: se usa el sonido sintetizado */ });
    this.files().forEach(([k, u]) => load(k, u));
    // primera interacción en la portada: bienvenida del anunciador y música del menú
    if (game.phase === 'menu') { this.wantWelcome = true; this.playMusic('menu'); }
  },
  _play(key, bus, vol = 1, rate = 1) {
    const buf = this.bufs[key];
    if (!this.ctx || !buf || this.muted) return null;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
    s.buffer = buf; s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g).connect(this[bus + 'Bus']); s.start();
    return s;
  },
  // efecto: nombre de SFX_FILES; si no cargó, sintetizado de respaldo
  sfx(name, vol = 1) {
    const s = this._play('sfx:' + name, 'sfx', vol, 0.95 + Math.random() * 0.1); if (s) return s;
    const f = this.synth[name]; if (f) f.call(this);
  },
  // anunciador; mientras habla, la música baja (ducking)
  voice(name, fallbackText) {
    const s = this._play('voice:' + name, 'voice');
    if (!s) { if (fallbackText) this.say(fallbackText); return; }
    if (this.voiceSrc) try { this.voiceSrc.stop(); } catch (e) { /* ya terminó */ }
    this.voiceSrc = s;
    const g = this.musicBus.gain, t = this.ctx.currentTime, d = s.buffer.duration;
    g.cancelScheduledValues(t); g.setTargetAtTime(MIX.music * MIX.duck, t, 0.05);
    g.setTargetAtTime(MIX.music, t + d, 0.25);
  },
  // el anunciador dice el nombre del poder (un tramo de voice/powers.mp3), con la música bajita
  callPower(kind, fallbackText) {
    if (this.bufs['voice:call_' + kind]) return this.voice('call_' + kind);
    const seg = POWER_CALLS[kind], buf = this.bufs['voice:powers'];
    if (!seg || !buf || !this.ctx || this.muted) { if (fallbackText && !this.muted) this.say(fallbackText); return; }
    if (this.voiceSrc) try { this.voiceSrc.stop(); } catch (e) { /* ya terminó */ }
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
    s.buffer = buf; g.gain.value = 1.15; s.connect(g).connect(this.voiceBus);
    const d = seg[1] - seg[0] + 0.1; s.start(0, Math.max(0, seg[0] - 0.05), d);
    this.voiceSrc = s;
    const mg = this.musicBus.gain, t = this.ctx.currentTime;
    mg.cancelScheduledValues(t); mg.setTargetAtTime(MIX.music * MIX.duck, t, 0.05); mg.setTargetAtTime(MIX.music, t + d, 0.25);
  },
  playMusic(name) {
    this.wantTrack = name;
    if (!this.ctx || this.trackName === name) return;
    this.stopMusic(); this.wantTrack = name;
    const buf = this.bufs['music:' + name]; if (!buf) return; // se reproducirá al terminar de cargar
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = name !== 'victory';
    s.connect(this.musicBus); s.start();
    this.track = s; this.trackName = name;
  },
  stopMusic() {
    this.wantTrack = null;
    if (this.track) try { this.track.stop(); } catch (e) { /* ya terminó */ }
    this.track = null; this.trackName = null;
  },
  music() { /* compatibilidad: la música ya no se sintetiza por cuadro */ },
  // atajos usados por el motor
  hit(heavy, move) { this.sfx(move && ['punch', 'punchH', 'kick', 'kickH'].includes(move) ? move : heavy ? 'punchH' : 'punch'); },
  block() { this.sfx('block', 0.8); },
  // suena con cada golpe lanzado: muy bajito para que no canse después de jugar mucho rato
  whoosh() { this.sfx('whoosh', 0.2); },
  // el de hielo (Lágrima de Mercurio de Gran Rah) es agudo y se oye mucho más fuerte que los demás: se baja ~9 dB
  special(type) { const has = this.bufs['sfx:special_' + type]; this.sfx(has ? 'special_' + type : 'special_note', has && type === 'ice' ? 0.35 : 1); },
  superFx() { this.sfx('super_start'); },
  ko() { this.sfx('ko'); this.sfx('crowd', 0.7); },
  jump() { this.sfx('jump', 0.25); },
  tone(freq, dur, type = 'square', vol = 0.15, slide = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur);
  },
  noise(dur, vol = 0.2, hp = 800) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    s.buffer = buf; s.connect(f).connect(g).connect(this.ctx.destination); s.start(t);
  },
  // respaldo sintetizado por nombre de efecto
  synth: {
    punch() { this.noise(0.1, 0.25, 1200); this.tone(140, 0.12, 'sine', 0.3, -60); },
    punchH() { this.noise(0.18, 0.35, 300); this.tone(90, 0.12, 'sine', 0.3, -60); },
    kick() { this.noise(0.12, 0.3, 800); this.tone(110, 0.12, 'sine', 0.3, -60); },
    kickH() { this.noise(0.2, 0.35, 300); this.tone(80, 0.15, 'sine', 0.3, -50); },
    block() { this.tone(900, 0.06, 'triangle', 0.12); },
    whoosh() { this.noise(0.08, 0.06, 3000); },
    jump() { this.tone(300, 0.08, 'triangle', 0.06, 200); },
    super_start() { this.tone(110, 0.8, 'sawtooth', 0.12, 660); this.noise(0.5, 0.15, 500); },
    ko() { this.tone(220, 1.2, 'sawtooth', 0.15, -180); },
    menu_move() { this.tone(440, 0.04, 'square', 0.05); },
    menu_select() { this.tone(660, 0.06, 'square', 0.08); },
    timer() { this.tone(1200, 0.05, 'square', 0.06); },
  },
  say(text) {
    if (this.muted || !window.speechSynthesis) return;
    try { const u = new SpeechSynthesisUtterance(text); u.lang = 'es-ES'; u.rate = 1.05; u.pitch = 0.6; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* sin voz */ }
  },
  startMusic() { this.playMusic(this.nextFight()); },
  // el siguiente tema de pelea: al azar, pero nunca el mismo de la pelea anterior (solo entre los ya cargados)
  nextFight() {
    const ok = FIGHT_TRACKS.filter(n => this.bufs['music:' + n] && n !== this.lastFight);
    const pick = ok.length ? ok[Math.floor(Math.random() * ok.length)] : (this.lastFight || 'fight');
    this.lastFight = pick; return pick;
  },
  toggleMute() {
    this.muted = !this.muted; store.set('muted', this.muted ? '1' : '0');
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    if (this.muted && window.speechSynthesis) speechSynthesis.cancel();
  },
};

// ============================================================
//  INPUT
// ============================================================
const KEYMAPS = [
  { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], punch: ['KeyK'], punchH: ['KeyO'], kick: ['KeyL'], kickH: ['Semicolon'], special: ['Digit8'], ex: ['Digit9'], super: ['Digit0'], taunt: ['Digit2'] }, // Semicolon = la tecla Ñ del teclado español
  // J2: K, L y P son del J1, así que usa el teclado numérico o la fila de símbolos
  { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], punch: ['Comma', 'Numpad1'], punchH: ['Numpad4'], kick: ['Period', 'Numpad2'], kickH: ['Quote', 'Numpad5'], special: ['Slash', 'Numpad3'], ex: ['BracketRight', 'Numpad9'], super: ['BracketLeft', 'Numpad6'], taunt: ['Backslash', 'Numpad0'] },
];
const ACTIONS = ['left', 'right', 'up', 'down', 'punch', 'punchH', 'kick', 'kickH', 'special', 'ex', 'super', 'taunt'];
// teclas del J1 elegidas por el jugador (Ajustes → Controles y teclas); se guardan en el navegador
const KEYS_DEFAULT = KEYMAPS.map(m => JSON.parse(JSON.stringify(m)));
const keyLabels = {}; // letra real de cada tecla, tomada al apretarla (depende del teclado)
function applyKeys(map) {
  KEYMAPS[1] = JSON.parse(JSON.stringify(KEYS_DEFAULT[1]));
  for (const a of ACTIONS) {
    KEYMAPS[0][a] = [(map && map[a]) || KEYS_DEFAULT[0][a][0]];
    // una tecla del J1 deja de ser del J2
    for (const b of ACTIONS) KEYMAPS[1][b] = KEYMAPS[1][b].filter(c => c !== KEYMAPS[0][a][0]);
  }
}
try { const sv = JSON.parse(store.get('keys1') || 'null'); if (sv && sv.map) { applyKeys(sv.map); Object.assign(keyLabels, sv.labels || {}); } } catch (e) { /* guardado dañado: quedan las teclas de fábrica */ }
function saveKeys() { const map = {}; for (const a of ACTIONS) map[a] = KEYMAPS[0][a][0]; store.set('keys1', JSON.stringify({ map, labels: keyLabels })); }
// nombre visible de una tecla: el del teclado real si el navegador lo informa; si no, el del teclado latinoamericano
let layoutMap = null;
if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then(m => { layoutMap = m; }).catch(() => {});
const KEY_NAMES = { Semicolon: 'Ñ', Comma: ',', Period: '.', Slash: '-', Quote: '{', BracketLeft: '´', BracketRight: '+', Backslash: '}', Minus: "'", Equal: '¿', Backquote: '|', IntlBackslash: '<',
  Space: 'ESPACIO', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT DER', ControlLeft: 'CTRL', ControlRight: 'CTRL DER', AltLeft: 'ALT', AltRight: 'ALT GR', Backspace: 'BORRAR', CapsLock: 'MAYÚS', NumpadEnter: 'NUM ENTER', NumpadAdd: 'NUM +', NumpadSubtract: 'NUM -', NumpadMultiply: 'NUM *', NumpadDivide: 'NUM /', NumpadDecimal: 'NUM .' };
function keyName(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return 'NUM ' + code.slice(6);
  if (keyLabels[code]) return keyLabels[code];
  const real = layoutMap && layoutMap.get(code);
  if (real && real.length === 1 && real.trim()) return real.toUpperCase();
  return KEY_NAMES[code] || code.toUpperCase();
}
const remap = { wait: null }; // acción que está esperando su tecla nueva
const keysDown = new Set();
const touchDown = new Set();   // acciones del P1 desde botones táctiles
const pressedQueue = [[], []]; // pulsaciones nuevas por jugador

function codeToAction(code) {
  for (let p = 0; p < 2; p++) for (const a of ACTIONS) if (KEYMAPS[p][a].includes(code)) return [p, a];
  return null;
}
addEventListener('keydown', e => {
  Audio.init();
  if (remap.wait) { remapKey(e); return; } // cambiando una tecla: la que se apriete es la nueva
  if (e.code === 'Escape') { if (!$('optScreen').hidden) return; e._done = true; togglePause(); return; }
  if (e.code === 'KeyM') { Audio.toggleMute(); updateMuteBtn(); return; }
  const m = codeToAction(e.code);
  if (m) e.preventDefault();
  if (e.repeat || keysDown.has(e.code)) return;
  keysDown.add(e.code);
  if (m) pressedQueue[m[0]].push(m[1]);
});
addEventListener('keyup', e => keysDown.delete(e.code));
addEventListener('blur', () => { keysDown.clear(); touchDown.clear(); });

// ---------- CONTROL USB / BLUETOOTH (Gamepad API, mapeo estándar tipo Xbox / PlayStation) ----------
// control 1 → J1, control 2 → J2. Botones: X/□ puño · Y/△ puño fuerte · A/✕ patada · B/○ patada fuerte
// LB/L1 poder · RB/R1 especial · LT/RT (L2/R2) super · Select/Share burla · Start/Options pausa.
// En los menús la cruceta o el stick mueven, A/✕ confirma y B/○ vuelve.
const PAD_BUTTONS = { punch: [2], punchH: [3], kick: [0], kickH: [1], special: [4], ex: [5], super: [6, 7], taunt: [8] };
const padDown = [new Set(), new Set()];
const padMenuPrev = {};
function pollPads() {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  if (pads.length && !padTimer) padWatch();
  const inMenu = game.paused || screens.some(s => !$(s).hidden) || !$('optScreen').hidden;
  pads.slice(0, 2).forEach((gp, p) => {
    const b = i => !!gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const now = { left: b(14) || ax < -0.5, right: b(15) || ax > 0.5, up: b(12) || ay < -0.6, down: b(13) || ay > 0.6 };
    for (const [a, list] of Object.entries(PAD_BUTTONS)) now[a] = list.some(b);
    const start = b(9);
    if (inMenu) {
      // en los menús el control se traduce a flechas, Enter y Esc
      const menu = { ArrowLeft: now.left, ArrowRight: now.right, ArrowUp: now.up, ArrowDown: now.down, Enter: b(0), Escape: b(1) || start };
      for (const [code, on] of Object.entries(menu)) {
        const k = p + code;
        if (on && !padMenuPrev[k]) padMenuKey(code);
        padMenuPrev[k] = on;
      }
      padDown[p].clear();
      return;
    }
    for (const k of Object.keys(padMenuPrev)) padMenuPrev[k] = true; // no arrastrar al menú lo que se tenía apretado
    if (start && !padDown[p].has('start')) togglePause();
    for (const a of ACTIONS) {
      if (now[a] && !padDown[p].has(a)) { Audio.init(); pressedQueue[p].push(a); }
      if (now[a]) padDown[p].add(a); else padDown[p].delete(a);
    }
    if (start) padDown[p].add('start'); else padDown[p].delete('start');
  });
}
// una tecla de menú desde el control; los botones de las pantallas que no escuchan teclas se aprietan directo
function padMenuKey(code) {
  Audio.init();
  const visible = id => !$(id).hidden;
  if (code === 'Enter') {
    if (visible('overScreen')) return $('btnRematch').click();
    if (visible('champScreen')) { if (!$('champBtns').hidden) $('btnChampAgain').click(); return; }
  }
  if (code === 'Escape') {
    if (visible('overScreen')) return $('btnMenu').click();
    if (visible('champScreen')) { if (!$('champBtns').hidden) $('btnChampMenu').click(); return; }
  }
  dispatchEvent(new KeyboardEvent('keydown', { code, key: code })); dispatchEvent(new KeyboardEvent('keyup', { code, key: code }));
}
// el control se lee cada 4 ms (no solo una vez por cuadro dibujado): la pulsación entra a la cola apenas se aprieta
// y los toques muy cortos no se pierden
let padTimer = 0;
const padWatch = () => { if (!padTimer && navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)) padTimer = setInterval(pollPads, 4); };
addEventListener('gamepadconnected', padWatch);
addEventListener('gamepadconnected', e => padNote('🎮 Control conectado: ' + (e.gamepad.id.split('(')[0].trim() || 'control')));
addEventListener('gamepaddisconnected', () => padNote('🎮 Control desconectado'));
function padNote(text) { const n = $('padNote'); n.textContent = text; n.hidden = false; clearTimeout(padNote.t); padNote.t = setTimeout(() => { n.hidden = true; }, 2800); }

function humanInput(p) {
  const held = {};
  for (const a of ACTIONS) held[a] = KEYMAPS[p][a].some(c => keysDown.has(c)) || (p === 0 && touchDown.has(a)) || padDown[p].has(a);
  const pressed = pressedQueue[p].splice(0);
  return { held, pressed };
}

// ============================================================
//  POSES — ángulos absolutos desde la vertical (0 = hacia abajo,
//  positivo = hacia adelante). Brazos/piernas: segmento 1 y 2.
// ============================================================
const P = (o) => Object.assign({ lean: 0.08, head: 0, fa1: 0.9, fa2: 2.4, ba1: 0.5, ba2: 2.2, fl1: 0.35, fl2: 0.05, bl1: -0.3, bl2: -0.05, rot: 0 }, o);
const POSES = {
  idle: P({}),
  jump: P({ lean: 0.1, fa1: 1.9, fa2: 2.7, ba1: -1.0, ba2: -0.4, fl1: 1.1, fl2: -0.3, bl1: 0.3, bl2: -0.7 }),
  punchWind: P({ lean: -0.05, fa1: 0.3, fa2: 1.6, ba1: 0.9, ba2: 2.5 }),
  punchExt: P({ lean: 0.28, fa1: 1.57, fa2: 1.57, ba1: 0.3, ba2: 1.9, fl1: 0.55, bl1: -0.5 }),
  kickWind: P({ lean: -0.2, fl1: 1.3, fl2: 0.1, bl1: -0.05, bl2: -0.05 }),
  kickExt: P({ lean: -0.4, head: 0.2, fa1: 1.0, fa2: 2.0, ba1: -0.7, ba2: -0.3, fl1: 1.62, fl2: 1.62, bl1: -0.1, bl2: -0.1 }),
  airKick: P({ lean: -0.2, fa1: 1.4, fa2: 2.4, ba1: -0.9, ba2: -0.5, fl1: 1.2, fl2: 1.4, bl1: 0.6, bl2: -0.6 }),
  specialWind: P({ lean: -0.18, fa1: -0.5, fa2: -0.1, ba1: -0.7, ba2: -0.3, fl1: 0.4, bl1: -0.45 }),
  specialExt: P({ lean: 0.22, fa1: 1.5, fa2: 1.5, ba1: 1.35, ba2: 1.4, fl1: 0.6, bl1: -0.55 }),
  superPose: P({ lean: -0.15, head: -0.2, fa1: 2.5, fa2: 2.9, ba1: -2.5, ba2: -2.9, fl1: 0.45, bl1: -0.45 }),
  rush: P({ lean: 0.55, head: 0.2, fa1: 1.57, fa2: 1.6, ba1: -0.6, ba2: -0.2, fl1: 0.8, fl2: 0.2, bl1: -0.7, bl2: -0.9 }),
  hit: P({ lean: -0.45, head: -0.35, fa1: -0.3, fa2: 0.4, ba1: -0.7, ba2: -0.2, fl1: 0.25, bl1: -0.35 }),
  block: P({ lean: -0.12, head: 0.1, fa1: 1.25, fa2: 2.95, ba1: 1.0, ba2: 2.8, fl1: 0.3, bl1: -0.4 }),
  ko: P({ lean: -0.3, head: -0.4, fa1: -1.6, fa2: -1.8, ba1: -1.9, ba2: -2.2, fl1: 0.4, fl2: 0.3, bl1: 0.1, bl2: 0.2 }),
  win: P({ lean: 0, head: -0.15, fa1: 2.95, fa2: 3.05, ba1: 0.4, ba2: 1.6, fl1: 0.3, bl1: -0.3 }),
};
const lerp = (a, b, t) => a + (b - a) * t;
function mix(a, b, t) { const o = {}; for (const k in a) o[k] = lerp(a[k], b[k], t); return o; }
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

// ============================================================
//  ATAQUES (frames a 60fps)
// ============================================================
const MOVES = {
  punch:   { startup: 4, active: 4, recovery: 9,  dmg: 5,  reach: 78,  y: 140, h: 40, kb: 4,  stun: 14, hitstop: 5, wind: 'punchWind', ext: 'punchExt', meter: 6 },
  // daño: golpes suaves 5-7, fuertes 7.5-9; el poder simple pega 11 y los especiales/supers 25+ (siempre más que un golpe)
  kick:    { startup: 8, active: 5, recovery: 15, dmg: 7,  reach: 108, y: 95,  h: 50, kb: 7,  stun: 18, hitstop: 7, wind: 'kickWind', ext: 'kickExt', meter: 9 },
  // fuertes: más lentos y con más daño; la patada fuerte bota al rival al suelo
  punchH:  { startup: 9, active: 4, recovery: 18, dmg: 7.5, reach: 92,  y: 140, h: 44, kb: 8,  stun: 22, hitstop: 9, wind: 'punchWind', ext: 'punchExt', meter: 10 },
  kickH:   { startup: 13, active: 5, recovery: 22, dmg: 9, reach: 118, y: 60, h: 60, kb: 9,  stun: 26, hitstop: 10, wind: 'kickWind', ext: 'kickExt', meter: 12, knockdown: true },
  airkick: { startup: 5, active: 10, recovery: 6, dmg: 7,  reach: 85,  y: 70,  h: 60, kb: 6,  stun: 16, hitstop: 6, wind: 'jump', ext: 'airKick', meter: 8 },
  // poderes: cuestan barras del medidor (1 = poder, 2 = poder especial, 3 = super)
  airpunch: { startup: 4, active: 9, recovery: 6, dmg: 6, reach: 80, y: 100, h: 90, kb: 5, stun: 15, hitstop: 5, wind: 'jump', ext: 'punchExt', meter: 6 },
  // agachado + puño: puño bajo, rápido. Agachado + patada: barrida a ras del piso que bota al rival;
  // es golpe BAJO (low): parado no se cubre, hay que cubrirse agachado. crouch: se dibuja agachado antes y después del golpe
  crouchPunch: { startup: 4, active: 4, recovery: 9, dmg: 5, reach: 82, y: 72, h: 44, kb: 4, stun: 14, hitstop: 5, wind: 'punchWind', ext: 'punchExt', meter: 6, crouch: true },
  crouchKick:  { startup: 9, active: 5, recovery: 24, dmg: 7.5, reach: 120, y: 18, h: 36, kb: 6, stun: 20, hitstop: 8, wind: 'kickWind', ext: 'kickExt', meter: 10, crouch: true, low: true, knockdown: true },
  // patada voladora: patada durante el impulso hacia adelante. Sale volando y lanza al rival al aire;
  // si la bloquean, la recuperación larga deja al que pateó expuesto
  dashKick: { startup: 5, active: 9, recovery: 22, dmg: 8, reach: 112, y: 85, h: 70, kb: 6, stun: 30, hitstop: 10, wind: 'kickWind', ext: 'airKick', meter: 10, launch: 12 },
  special: { startup: 13, active: 1, recovery: 22, wind: 'specialWind', ext: 'specialExt' }, // el poder simple no gasta barra, solo tiene recarga
  // el poder especial muestra su nombre un rato antes de salir (se aprecia mejor)
  ex:      { startup: 80, active: 1, recovery: 26, wind: 'superPose', ext: 'specialExt', bars: 2 },
  // el arranque del super incluye la escena de la pose de poder máximo (SUPER_CUTIN)
  super:   { startup: 100, active: 40, recovery: 25, wind: 'superPose', ext: 'specialExt', bars: 3 },
};
// los golpes alcanzan y pegan a la altura del luchador ya agrandado
for (const m of Object.values(MOVES)) if (m.reach) { m.reach *= SIZE; m.y *= SIZE; m.h *= SIZE; }
// ---------- COMBOS: golpes seguidos que conectan en este orden rematan con un efecto especial ----------
// seq: golpes que deben entrar uno tras otro (sin que el rival se recupere). bonus: daño extra del remate.
// El nombre del combo de 4 golpes se puede cambiar por rapero en roster.js con  combo: { name: '...' }
const COMBOS = [
  { id: 'lleca', name: 'COMBO DE LA LLECA', seq: ['punch', 'punch', 'kick', 'kickH'], bonus: 10 },
  { id: 'martillo', name: 'MARTILLAZO', seq: ['punch', 'kick', 'punch', 'punchH'], bonus: 10 },
  { id: 'rafaga', name: 'RÁFAGA', seq: ['punch', 'punch', 'punchH'], bonus: 6 },
  { id: 'patadon', name: 'PATADÓN', seq: ['kick', 'kick', 'kickH'], bonus: 6 },
  { id: 'barrio', name: 'BAJADA AL BARRIO', seq: ['crouchPunch', 'crouchPunch', 'crouchKick'], bonus: 6 },
];
const ATTACK_KEYS = ['punch', 'punchH', 'kick', 'kickH'];
const comboName = (ch, c) => (c.seq.length === 4 && c.id === 'lleca' && ch.combo && ch.combo.name) || c.name;
const SPECIAL_COOLDOWN = 40;
const BAR = 100, BARS = 3, METER_MAX = BAR * BARS, SUPER_CUTIN = 75;
const addMeter = (f, n) => { f.meter = Math.min(METER_MAX, f.meter + n); };
const CROUCH_H = 0.55, DASH_TAP = 14, DASH_F = 22, DASH_B = 22, COMBO_BREAK = 6;
const DIZZY_TIME = 210, DIZZY_LIMIT = 32, TAUNT_TIME = 70;

// ============================================================
//  LUCHADOR
// ============================================================
class Fighter {
  constructor(ch, idx, ai) {
    this.ch = ch; this.idx = idx; this.ai = ai ? new AI(this) : null;
    // el jefe solo es superior cuando lo maneja la CPU en lo alto de la torre: pelea mucho mejor,
    // usa ch.bossStats y tiene armadura. Elegido por un jugador es un luchador normal.
    this.boss = !!(ai && ch.boss && tower.on);
    this.stats = this.boss ? ch.bossStats || ch.stats : ch.stats;
    if (this.boss) this.ai.level = Math.min(0.98, 0.95 + DIFF[settings.diff].add * 0.8);
    // HP_SCALE alarga las peleas sin tocar el daño relativo de cada golpe
    this.maxHp = Math.round(100 * HP_SCALE * this.stats.hp);
    this.reset();
  }
  reset() {
    this.x = this.idx === 0 ? 380 : W - 380; this.y = 0; this.vx = 0; this.vy = 0;
    this.facing = this.idx === 0 ? 1 : -1;
    this.hp = this.maxHp; this.hpLag = this.maxHp;
    this.meter = this.meter ?? 0;
    this.state = 'idle'; this.sf = 0; this.move = null; this.hasHit = false;
    this.stun = 0; this.cooldown = 0; this.walkC = 0; this.combo = 0; this.flash = 0;
    this.dizzyDmg = 0; this.pendingDizzy = false; this.matchWin = false;
    this.invuln = 0; this.hidden = false; this.fxPose = null; this.fxImg = null;
    this.pose = Object.assign({}, POSES.idle); this.blocking = false; this.input = { held: {}, pressed: [] };
    this.buffer = []; this.tap = null; this.clock = 0;
  }
  get grounded() { return this.y <= 0; }
  // held: lo maneja un poder (paralizado, en el aire, subiendo libros...)
  get busy() { return ['dash', 'attack', 'hit', 'ko', 'win', 'blockstun', 'land', 'taunt', 'dizzy', 'down', 'getup', 'held'].includes(this.state); }
  get opp() { return game.f[1 - this.idx]; }

  // cuerpo golpeable: con dibujo, casi todo su alto (hasta la cabeza)
  hurtbox() { let h = spriteSet(this.ch) ? spriteH(this.ch) * 0.88 : 175 * SIZE; if (this.state === 'crouch' || (this.state === 'attack' && MOVES[this.move] && MOVES[this.move].crouch)) h *= CROUCH_H; return { x: this.x - 32 * SIZE, y: GROUND - this.y - h, w: 64 * SIZE, h }; }

  setState(s) { this.state = s; this.sf = 0; if (s !== 'held') { this.fxPose = null; this.fxImg = null; } }

  startMove(name) {
    this.move = name; this.hasHit = false; this.setState('attack');
    // golpes suaves seguidos alternan entre sus 2 animaciones (punch / punch2, kick / kick2)
    if (name === 'punch' || name === 'kick') { this.alt = this.lastLight === name ? !this.alt : false; this.lastLight = name; }
    else { this.alt = false; this.lastLight = null; }
    const bars = MOVES[name].bars || 0;
    this.meter -= bars * BAR;
    if (name === 'special') { this.cooldown = SPECIAL_COOLDOWN; Audio.special(this.ch.special.type); }
    else if (name === 'ex') { this.cooldown = SPECIAL_COOLDOWN; game.startEx(this); Audio.sfx('ex_start'); Audio.callPower(this.ch.ex && this.ch.ex.kind, exOf(this.ch).name); }
    else if (name === 'super') { game.startSuper(this); Audio.sfx('finisher'); if (POWER_CALLS[this.ch.super.kind] || CALL_FILES.includes(this.ch.super.kind)) Audio.callPower(this.ch.super.kind, this.ch.super.name); else Audio.voice('super'); }
    else Audio.whoosh();
  }

  update() {
    const inp = this.input;
    const back = this.facing > 0 ? 'left' : 'right';
    const fwd = this.facing > 0 ? 'right' : 'left';
    // cada botón queda guardado 12 cuadros (0,2 s): si se aprieta un poco antes de que termine el golpe anterior, igual sale
    // en medio de un combo (rival aturdido) el golpe queda guardado 22 cuadros: con control USB la pulsación
    // llega algo después y así igual encadena
    const midCombo = game.f.length === 2 && this.opp.state === 'hit';
    for (const a of inp.pressed) this.buffer.push({ a, t: midCombo && ATTACK_KEYS.includes(a) ? 22 : 12 });
    // combo en curso: si el que pega deja de atacar, el rival se suelta al tiro (no queda aturdido de regalo)
    if (game.f.length === 2 && this.opp.chainHold) {
      if (this.state === 'attack') this.chainIdle = 0;
      else if (++this.chainIdle > 9 || this.opp.state !== 'hit') { this.opp.chainHold = false; if (this.opp.state === 'hit') this.opp.stun = Math.min(this.opp.stun, this.opp.sf + 1); }
    }
    this.buffer = this.buffer.filter(b => --b.t > 0);
    const take = (a) => { const i = this.buffer.findIndex(b => b.a === a); if (i < 0) return false; this.buffer.splice(i, 1); return true; };
    this.sf++; this.clock++;
    // doble toque rápido a un lado = impulso (hacia el rival: avance; alejándose: retroceso)
    for (const a of inp.pressed) if (a === 'left' || a === 'right') {
      if (this.tap && this.tap.a === a && this.clock - this.tap.t <= DASH_TAP) { this.buffer.push({ a: a === fwd ? 'dashF' : 'dashB', t: 8 }); this.tap = null; }
      else this.tap = { a, t: this.clock };
    }
    // del avance se puede pegar apenas toma vuelo; con patada sale la patada voladora
    if (this.state === 'dash' && this.dashDir > 0 && this.sf >= 6 && game.phase === 'fight' && (take('kick') || take('kickH'))) { this.startMove('dashKick'); this.vx = this.facing * 11; }
    if (this.state === 'dash' && this.dashDir > 0 && this.sf >= 6 && this.buffer.some(b => ['punch', 'punchH', 'kick', 'kickH', 'special'].includes(b.a))) this.setState('idle');
    if (this.cooldown > 0) this.cooldown--;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    this.blocking = false;

    // los golpes suaves se encadenan: pasada la parte activa (o la mitad de la recuperación si falló) otro golpe la corta
    if (this.state === 'attack' && (this.move === 'punch' || this.move === 'kick' || this.move === 'crouchPunch') && this.grounded) {
      const mv = MOVES[this.move], cancelAt = mv.startup + mv.active + (this.hasHit ? 0 : Math.ceil(mv.recovery / 2));
      if (this.sf >= cancelAt && this.buffer.some(b => ['punch', 'punchH', 'kick', 'kickH', 'special'].includes(b.a))) { this.setState('idle'); this.move = null; }
    }
    const canAct = game.phase === 'fight' && !this.busy;
    if (canAct) {
      // encarar al rival
      this.facing = this.opp.x >= this.x ? 1 : -1;
      if (this.grounded) {
        if (take('super') && this.meter >= 3 * BAR) return this.startMove('super');
        if (take('ex') && this.meter >= 2 * BAR && this.cooldown === 0) return this.startMove('ex');
        if (take('special') && this.cooldown === 0) return this.startMove('special');
        // agachado: el puño sale bajo y la patada es una barrida
        if (inp.held.down && (take('kick') || take('kickH'))) { this.state = 'crouch'; return this.startMove('crouchKick'); }
        if (inp.held.down && (take('punch') || take('punchH'))) { this.state = 'crouch'; return this.startMove('crouchPunch'); }
        if (take('kickH')) return this.startMove('kickH');
        if (take('punchH')) return this.startMove('punchH');
        if (take('kick')) return this.startMove('kick');
        if (take('punch')) return this.startMove('punch');
        if (take('taunt')) { this.vx = 0; this.setState('taunt'); game.taunt(this); return; }
        if (take('dashF')) return this.startDash(1);
        if (take('dashB')) return this.startDash(-1);
        if (inp.held.up) { this.vy = JUMP_V; this.y = 0.1; this.vx = (inp.held[fwd] ? 1 : inp.held[back] ? -1 : 0) * 6 * this.stats.speed * this.facing; this.setState('jump'); Audio.jump(); return; }
        const sp = 5 * this.stats.speed;
        // agachado: se queda quieto, los puños altos y el poder simple le pasan por encima; con atrás también cubre
        if (inp.held.down) { this.vx = 0; this.state = 'crouch'; if (inp.held[back]) this.blocking = true; }
        else if (inp.held[fwd]) { this.vx = sp * this.facing; this.state = 'walk'; this.walkC += 0.2; }
        else if (inp.held[back]) { this.vx = -sp * 0.75 * this.facing; this.state = 'walk'; this.walkC -= 0.16; this.blocking = true; }
        else { this.vx = 0; this.state = 'idle'; }
      } else {
        // en el aire: patada (dibujo de la patada baja) o puño (dibujo del segundo puño)
        const air = take('kick') || take('kickH') ? 'airkick' : take('punch') || take('punchH') ? 'airpunch' : null;
        if (air) { this.move = air; this.alt = false; this.lastLight = null; this.hasHit = false; this.state = 'attack'; this.sf = 0; if (air === 'airpunch') Audio.sfx('airpunch', 0.7); else Audio.whoosh(); }
      }
    }
    // retroceso aguanta bloqueo mientras se esté en blockstun
    if (this.state === 'blockstun') { this.blocking = true; if (this.sf >= this.stun) this.setState('idle'); }
    // mantener atrás (respecto de dónde está el rival ahora, aunque te haya cruzado) siempre cubre
    // en el suelo y sin estar atacando ni aturdido: también al caer de un salto o al levantarse
    if (this.input && this.grounded && ['idle', 'walk', 'crouch', 'land', 'getup', 'blockstun'].includes(this.state)) {
      const away = this.opp.x >= this.x ? 'left' : 'right';
      if (this.input.held[away]) this.blocking = true;
    }
    if (this.state === 'hit' && this.sf >= this.stun && this.grounded) {
      this.combo = 0;
      if (this.pendingDizzy) { this.pendingDizzy = false; this.dizzyDmg = 0; this.setState('dizzy'); Audio.sfx('dizzy'); }
      else this.setState('idle');
    }
    if (this.state === 'land' && this.sf >= 4) this.setState('idle');
    if (this.state === 'dash') { this.vx *= this.dashDir > 0 ? 0.925 : 0.91; if (this.sf >= (this.dashDir > 0 ? DASH_F : DASH_B)) this.setState('idle'); }
    // estela del impulso: copias que se van apagando detrás del luchador
    if (this.ghosts) { if (this.state === 'dash' && this.sf % 2 === 0) this.ghosts.unshift({ x: this.x, y: this.y, a: 0.55 }); this.ghosts.forEach(g => g.a -= 0.045); this.ghosts = this.ghosts.filter(g => g.a > 0).slice(0, 8); }
    if (this.state === 'dizzy' && this.sf >= DIZZY_TIME) this.setState('idle');
    if (this.state === 'taunt' && this.sf >= TAUNT_TIME) { addMeter(this, 15); this.setState('idle'); }
    if (this.state === 'down' && this.grounded && this.sf >= 50) this.setState('getup');
    if (this.state === 'getup' && this.sf >= 16) this.setState('idle');
    // el mareo se acumula con el daño recibido y se va pasando con el tiempo
    if (this.dizzyDmg > 0) this.dizzyDmg = Math.max(0, this.dizzyDmg - 0.06);
    // mientras un poder lo maneja, no hay física propia: el poder mueve x / y
    if (this.state === 'held') { this.updatePose(); return; }

    if (this.state === 'attack') this.updateAttack();

    // física
    if (!this.grounded || this.vy > 0) {
      this.vy -= GRAV; this.y += this.vy;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0;
        if (this.state === 'ko' || this.state === 'down') { this.vx *= 0.5; game.shake(6); Audio.sfx('fall', 0.8); }
        else if (this.state === 'jump' || (this.state === 'attack' && (this.move === 'airkick' || this.move === 'airpunch'))) { this.setState('land'); this.vx = 0; Audio.sfx('land', 0.5); }
      }
    }
    this.x += this.vx;
    if (this.grounded && ['hit', 'blockstun', 'ko', 'land', 'down', 'getup', 'dizzy', 'taunt'].includes(this.state)) this.vx *= 0.82;
    // la patada voladora sigue avanzando mientras patea (se frena suave); el resto de los golpes en el suelo se frenan de golpe
    if (this.state === 'attack' && this.grounded && this.move === 'dashKick') this.vx *= this.sf < MOVES.dashKick.startup + MOVES.dashKick.active ? 0.95 : 0.7;
    else if (this.state === 'attack' && this.grounded && this.move !== 'super') this.vx *= 0.7;
    this.x = Math.max(ARENA_L, Math.min(ARENA_R, this.x));

    // meter visual
    if (this.hpLag > this.hp) this.hpLag -= Math.max(0.25, (this.hpLag - this.hp) * 0.04);
    this.updatePose();
  }

  startDash(dir) {
    this.setState('dash'); this.dashDir = dir; this.move = null;
    this.vx = (dir > 0 ? 20 : -16) * this.stats.speed * this.facing; this.ghosts = [];
    if (dir < 0) this.invuln = Math.max(this.invuln, 8); // el retroceso esquiva lo justo
    Audio.whoosh(); game.sparks(this.x - this.facing * dir * 30, GROUND - 6, '#d8d0c0', 6);
  }

  updateAttack() {
    const mv = MOVES[this.move], f = this.sf;
    const total = mv.startup + mv.active + mv.recovery;
    if (this.move === 'special' && f === mv.startup) game.spawnProjectile(this);
    // poderes con efecto propio (ch.ex.kind / ch.super.kind, ver POWERS)
    const kind = this.move === 'ex' ? this.ch.ex && this.ch.ex.kind : this.move === 'super' ? this.ch.super.kind : null;
    if (kind && POWERS[kind]) { if (f === mv.startup) startPower(this, kind); if (this.state !== 'attack') return; }
    else if (this.move === 'ex' && f === mv.startup) game.spawnProjectile(this, true);
    if (this.move === 'super' && !kind) {
      if (f === mv.startup) Audio.sfx('super_' + this.ch.super.type); // beam / rush / rain
      this.updateSuper(f, mv);
    }
    if (MOVES[this.move].dmg && f >= mv.startup && f < mv.startup + mv.active && !this.hasHit) {
      // el dibujo puede alargar el golpe, pero como máximo un 35 % para no desequilibrar
      const reach = Math.min(mv.reach * 1.35, Math.max(mv.reach, spriteReach(this.ch, this.move === 'dashKick' ? 'airkick' : this.move)));
      const box = { x: this.facing > 0 ? this.x + 10 : this.x - 10 - reach, y: GROUND - this.y - mv.y - mv.h / 2, w: reach, h: mv.h };
      if (overlap(box, this.opp.hurtbox())) {
        this.hasHit = true;
        game.hit(this, this.opp, { dmg: mv.dmg * this.stats.power, kb: mv.kb, stun: mv.stun, hitstop: mv.hitstop, meter: mv.meter, heavy: this.move !== 'punch' && this.move !== 'crouchPunch', knockdown: mv.knockdown, launch: mv.launch, low: mv.low, move: this.move, at: { x: box.x + (this.facing > 0 ? box.w : 0), y: box.y + box.h / 2 } });
      }
    }
    if (this.move === 'airkick' || this.move === 'airpunch') { if (this.grounded && f > 2) this.setState('land'); return; }
    if (f >= total) { this.setState('idle'); this.move = null; }
  }

  updateSuper(f, mv) {
    const type = this.ch.super.type;
    if (f < mv.startup) return;
    const af = f - mv.startup;
    if (type === 'beam') {
      if (af < mv.active && af % 4 === 0) {
        const y = GROUND - this.y - 128;
        const box = { x: this.facing > 0 ? this.x + 40 : 0, y: y - 45, w: this.facing > 0 ? W - this.x : this.x - 40, h: 90 };
        if (overlap(box, this.opp.hurtbox())) game.hit(this, this.opp, { dmg: 4.2 * this.stats.power, kb: af >= mv.active - 4 ? 14 : 2, stun: 22, hitstop: 2, meter: 0, heavy: true, unblockable: false, chip: 0.35, at: { x: this.opp.x, y } });
      }
    } else if (type === 'rain') {
      if (af < mv.active && af % 5 === 0) game.spawnRain(this);
    } else if (type === 'rush') {
      if (af === 0) this.vx = 24 * this.facing;
      if (af < 22 && !this.hasHit) {
        const box = { x: this.facing > 0 ? this.x : this.x - 80, y: GROUND - this.y - 160, w: 80, h: 140 };
        if (overlap(box, this.opp.hurtbox())) {
          this.hasHit = true; this.vx = 0;
          game.hit(this, this.opp, { dmg: 30 * this.stats.power, kb: 16, stun: 50, hitstop: 18, meter: 0, heavy: true, launch: 13, chip: 0.3, at: { x: this.opp.x, y: GROUND - 120 } });
          for (let i = 0; i < 4; i++) setTimeout(() => game.sparks(this.opp.x + (Math.random() - 0.5) * 60, GROUND - 100 - Math.random() * 80, this.ch.super.color, 10), i * 60);
        }
      }
      if (af >= 22) this.vx *= 0.8;
    }
  }

  updatePose() {
    let target, t = 1;
    const s = this.state, f = this.sf;
    if (s === 'attack') {
      const mv = MOVES[this.move];
      if (this.move === 'super' && f >= mv.startup) {
        target = this.ch.super.type === 'rush' ? POSES.rush : this.ch.super.type === 'rain' ? POSES.superPose : POSES.specialExt;
      } else if (f < mv.startup) { target = POSES[mv.wind]; t = 0.45; }
      else if (f < mv.startup + mv.active) { target = POSES[mv.ext]; t = 0.8; }
      else { target = POSES[mv.ext]; t = 0.15; target = mix(POSES.idle, target, 1 - (f - mv.startup - mv.active) / mv.recovery); }
    } else if (s === 'walk') {
      const c = this.walkC, sw = Math.sin(c) * 0.55;
      target = P({ lean: 0.12, fl1: 0.1 + sw, fl2: sw - 0.25 * Math.max(0, Math.cos(c)), bl1: -0.1 - sw, bl2: -sw - 0.25 * Math.max(0, -Math.cos(c)), fa1: 0.9 - sw * 0.3, ba1: 0.5 + sw * 0.3 });
      t = 0.5;
    } else if (s === 'jump') { target = POSES.jump; t = 0.3; }
    else if (s === 'crouch') { target = P({ lean: 0.25, fl1: 1.3, fl2: -0.4, bl1: 0.7, bl2: -1.0 }); t = 0.4; }
    else if (s === 'dash') { target = this.dashDir > 0 ? POSES.rush : P({ lean: -0.3, fl1: 0.5, bl1: -0.6 }); t = 0.4; }
    else if (s === 'land') { target = P({ fl1: 0.9, fl2: -0.5, bl1: 0.2, bl2: -0.9, lean: 0.25 }); t = 0.5; }
    else if (s === 'hit') { target = POSES.hit; t = 0.6; }
    else if (s === 'blockstun' || (this.blocking && this.isThreatened())) { target = POSES.block; t = 0.5; }
    else if (s === 'ko' || s === 'down') { target = Object.assign({}, POSES.ko, { rot: this.grounded ? -1.45 : -0.6 }); t = 0.12; }
    else if (s === 'getup') { target = P({ fl1: 0.9, fl2: -0.5, bl1: 0.2, bl2: -0.9, lean: 0.35 }); t = 0.3; }
    else if (s === 'dizzy') { const b = Math.sin(game.time * 0.12) * 0.25; target = P({ lean: b, head: -b, fa1: 0.2, fa2: 0.4, ba1: -0.2, ba2: 0.2 }); t = 0.2; }
    else if (s === 'taunt' || s === 'win') { const b = Math.sin(game.time * 0.15) * 0.15; target = Object.assign({}, POSES.win, { fa1: 2.95 + b, fa2: 3.05 + b }); t = 0.2; }
    else {
      const b = Math.sin(game.time * 0.08 + this.idx);
      target = P({ lean: 0.08 + b * 0.02, fa1: 0.9 + b * 0.05, fa2: 2.4 + b * 0.06, ba1: 0.5 + b * 0.04, ba2: 2.2 + b * 0.05 });
      t = 0.25;
    }
    this.pose = mix(this.pose, target, t);
  }

  isThreatened() {
    const o = this.opp;
    return (o.state === 'attack' && Math.abs(o.x - this.x) < 220) || game.projectiles.some(p => p.owner !== this && Math.abs(p.x - this.x) < 260);
  }

  // puntos del esqueleto en coordenadas de pantalla
  skeleton() {
    const p = this.pose, fc = this.facing, L = { th: 46, sh: 46, ua: 33, fa: 32, torso: 58, neck: 16 };
    const footY = (a, b) => L.th * Math.cos(a) + L.sh * Math.cos(b);
    const hipH = Math.max(footY(p.fl1, p.fl2), footY(p.bl1, p.bl2), 40);
    const hip = { x: 0, y: -hipH };
    const seg = (o, a, len) => ({ x: o.x + Math.sin(a) * len * fc, y: o.y + Math.cos(a) * len });
    const sh = { x: hip.x + Math.sin(p.lean) * L.torso * fc, y: hip.y - Math.cos(p.lean) * L.torso };
    const head = { x: sh.x + Math.sin(p.lean + p.head) * (L.neck + 26) * fc, y: sh.y - Math.cos(p.lean + p.head) * (L.neck + 26) };
    const fE = seg(sh, p.fa1, L.ua), fH = seg(fE, p.fa2, L.fa);
    const bE = seg(sh, p.ba1, L.ua), bH = seg(bE, p.ba2, L.fa);
    const fK = seg(hip, p.fl1, L.th), fF = seg(fK, p.fl2, L.sh);
    const bK = seg(hip, p.bl1, L.th), bF = seg(bK, p.bl2, L.sh);
    return { hip, sh, head, fE, fH, bE, bH, fK, fF, bK, bF };
  }

  handPos() {
    if (spriteSet(this.ch)) return { x: this.x + this.facing * 70 * SIZE, y: GROUND - this.y - spriteH(this.ch) * 0.62 };
    const s = this.skeleton(); return { x: this.x + s.fH.x, y: GROUND - this.y + s.fH.y };
  }
}

function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

// ============================================================
//  IA
// ============================================================
class AI {
  constructor(f) { this.f = f; this.think = 0; this.plan = null; this.hold = {}; this.level = 0.6; }
  input() {
    const f = this.f, o = f.opp, held = {}, pressed = [];
    const dist = Math.abs(o.x - f.x), fwd = f.facing > 0 ? 'right' : 'left', back = f.facing > 0 ? 'left' : 'right';
    if (--this.think <= 0) {
      this.think = 8 + Math.random() * (18 - this.level * 10);
      const r = Math.random();
      const threatened = (o.state === 'attack' && dist < 200) || game.projectiles.some(p => p.owner === o && Math.abs(p.x - f.x) < 300);
      const canShoot = f.cooldown === 0;
      if (f.meter >= 3 * BAR && r < 0.5) pressed.push('super');
      else if (f.meter >= 2 * BAR && f.cooldown === 0 && dist > 200 && r < 0.25) pressed.push('ex');
      // un poder simple que viene volando se esquiva agachándose (los grandes no)
      else if (game.projectiles.some(p => p.owner === o && !p.big && !p.rain && Math.abs(p.x - f.x) < 320) && r < this.level * 0.6) this.plan = 'duck';
      else if (threatened && r < this.level * 0.75) this.plan = Math.random() < 0.25 ? 'jump' : Math.random() < 0.3 ? 'duck' : 'block';
      else if (dist > 460 && r < 0.12 + this.level * 0.1) pressed.push('dashF');
      else if (dist > 420) this.plan = canShoot && r < 0.3 ? 'special' : 'approach';
      else if (dist > 130) this.plan = r < 0.55 ? 'approach' : r < 0.65 && canShoot ? 'special' : r < 0.85 ? 'jumpin' : 'wait';
      else this.plan = r < 0.45 ? (Math.random() < 0.3 ? 'punchH' : 'punch') : r < 0.75 ? (Math.random() < 0.3 ? 'kickH' : 'kick') : r < 0.88 ? 'retreat' : 'block';
      // burla de vez en cuando si el rival está mareado o lejos
      if ((o.state === 'dizzy' || dist > 500) && Math.random() < 0.04) this.plan = 'taunt';
      // contra un rival agachado los puños pasan por arriba: patea
      if (o.state === 'crouch' && (this.plan === 'punch' || this.plan === 'punchH')) this.plan = this.plan === 'punch' ? 'kick' : 'kickH';
      // a veces barre o pega abajo (agachado + golpe)
      if ((this.plan === 'kick' || this.plan === 'punch') && Math.random() < 0.22) { this.lowAtk = this.plan; this.plan = 'low'; }
      if (this.plan === 'low') { held.down = true; pressed.push(this.lowAtk); this.plan = 'wait'; }
      if (['punch', 'punchH', 'kick', 'kickH', 'special', 'taunt'].includes(this.plan)) { pressed.push(this.plan); this.plan = 'wait'; }
    }
    if (this.plan === 'approach') held[fwd] = dist > 110;
    if (this.plan === 'retreat' || this.plan === 'block') held[back] = true;
    if (this.plan === 'duck') { held.down = true; held[back] = this.level > 0.5; }
    if (this.plan === 'jump' || this.plan === 'jumpin') { held.up = true; if (this.plan === 'jumpin') held[fwd] = true; this.plan = 'airatk'; }
    else if (this.plan === 'airatk' && !f.grounded && dist < 140 && f.vy < 4) { pressed.push('kick'); this.plan = 'wait'; }
    // castigo rápido si el rival falló cerca
    if (dist < 100 && o.state === 'attack' && o.sf > MOVES[o.move].startup + MOVES[o.move].active && Math.random() < this.level * 0.2) pressed.push('punch');
    return { held, pressed };
  }
}

// ============================================================
//  JUEGO
// ============================================================
// ============================================================
//  PODERES DE CADA RAPERO — ch.ex.kind (2 barras) y ch.super.kind (3 barras).
//  Cada poder es un efecto con su propio tiempo: puede tomar el control
//  del que lo lanza o del rival (estado 'held') y se dibuja detrás
//  (back) o delante (front) de los luchadores.
// ============================================================
const rnd = (a, b) => a + Math.random() * (b - a);
// sonido propio del poder (assets/audio/sfx/pw_*.mp3) o, si no cargó, uno genérico
const psfx = (n, fb, v = 1) => Audio.sfx(Audio.bufs && Audio.bufs['sfx:' + n] ? n : fb, v);
// el que está lanzando su propio poder no puede ser tomado ni soltado por el poder del otro
// (antes el poder del rival le cambiaba la pose y lo soltaba, y su animación quedaba cortada a medias)
let curFx = null;
const castingOther = f => game.powers.some(fx => fx.f === f && fx !== curFx && !fx.done && !fx.freed);
function hold(f, pose) { if (f.state === 'ko' || f.state === 'win') return; if (curFx && curFx.f !== f && castingOther(f)) return; if (f.state !== 'held') f.setState('held'); f.vx = 0; f.vy = 0; f.fxPose = pose || null; }
function release(f) {
  if (curFx && curFx.f !== f && castingOther(f)) return;
  if (curFx && curFx.f === f) curFx.freed = true; // el poder suelta a su dueño: desde ahora el otro sí lo puede tomar
  f.hidden = false; f.fxImg = null; if (f.state === 'held') { f.setState(f.y > 0 ? 'jump' : 'idle'); }
}
// golpe de un poder: daño escalado por el poder del personaje, sin cargar barras al que lo lanza.
// Se puede bloquear retrocediendo, pero igual quita el 40 % (un golpe normal bloqueado quita el 12 %).
// Devuelve false si lo bloqueó o si el golpe terminó el round.
function strike(fx, o) {
  const d = fx.o, alive = game.phase === 'fight';
  const r = game.hit(fx.f, d, Object.assign({ kb: 3, stun: 18, hitstop: 4, heavy: true, chip: 0.4, noMeter: true, at: { x: d.x, y: GROUND - d.y - 120 } }, o, { dmg: o.raw ?? o.dmg * fx.f.stats.power }));
  return r !== 'block' && alive && game.phase === 'fight' && d.hp > 0;
}
// el rival se está cubriendo justo cuando sale el poder: los poderes que lo agarran no lo atrapan
const guarding = o => o.blocking && o.grounded && ['idle', 'walk', 'crouch', 'land', 'blockstun'].includes(o.state);
const bodyY = (f, k = 0.5) => GROUND - f.y - spriteH(f.ch) * k;
// punta del cigarro (smoke1) o boca soplando (smoke2) del Bruto, en píxeles de su dibujo; sin dibujo, a la altura de la cara
const SMOKE_MOUTH = { smoke1: [180, 127], smoke2: [152, 121] };
function smokeMouth(f, dir, lighting) {
  const set = spriteSet(f.ch), pose = lighting ? 'smoke1' : 'smoke2', img = set && set[pose];
  if (!img) return { x: f.x + dir * 30, y: bodyY(f, 0.8) };
  const k = spriteH(f.ch) / set.idle.height, [px, py] = SMOKE_MOUTH[pose];
  return { x: f.x + dir * (px - (img._footX ?? 0.5) * img.width) * k, y: GROUND - f.y - (img.height - py) * k };
}
const handOf = f => f.handPos();
const bibleOf = fx => { const f = fx.f, [ox, oy] = f.ch.super.origin || [0.25, 0.55]; return { x: f.x + fx.dir * spriteH(f.ch) * ox, y: GROUND - f.y - spriteH(f.ch) * oy }; };
// brócoli de ChysteMc (s: lo que queda sin morder, 1 = entero)
function drawBroccoli(x, y, s, dir) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.rotate(-0.35); ctx.lineWidth = 4; ctx.strokeStyle = '#10200c';
  ctx.fillStyle = '#9ad46a'; ctx.beginPath(); ctx.roundRect(-8, 0, 16, 38, 5); ctx.fill(); ctx.stroke();
  const tops = [[-18, -6, 15], [0, -16, 17], [18, -6, 15], [-9, 4, 13], [10, 4, 13]].slice(0, Math.max(1, Math.round(5 * s)));
  for (const [cx, cy, r] of tops) { ctx.fillStyle = '#2f8a22'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.stroke(); }
  for (const [cx, cy, r] of tops) { ctx.fillStyle = '#6fd04e'; ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.35, 0, 7); ctx.fill(); }
  ctx.restore();
}
// pesa rusa de Mastamaick
function drawKettlebell(x, y, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.lineWidth = 4; ctx.strokeStyle = '#05050a';
  ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, -16, 15, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); // asa
  ctx.lineWidth = 5; ctx.strokeStyle = '#3a3d44'; ctx.beginPath(); ctx.arc(0, -16, 15, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.fillStyle = '#26282e'; ctx.strokeStyle = '#05050a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 4, 22, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5b606b'; ctx.beginPath(); ctx.arc(-8, -4, 7, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd23f'; ctx.font = '700 11px "Bungee", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('24', 0, 10);
  ctx.restore();
}
// mano levantada de Omega en la pose shake (px del dibujo): ahí va la lata que agita
const SHAKE_HAND = [292, 130];
function poseHand(f, pose, [px, py]) {
  const set = spriteSet(f.ch), img = set && set[pose];
  if (!img) return { x: f.x + f.facing * 40, y: bodyY(f, 0.8) };
  const k = spriteH(f.ch) / set.idle.height;
  return { x: f.x + f.facing * (px - (img._footX ?? 0.5) * img.width) * k, y: GROUND - f.y - (img.height - py) * k };
}
// equilibrio: cada especial queda en ~25 de daño y cada súper en ~35 (antes de la fuerza propia del personaje, stats.power).
// Factor medido con todos los golpes del poder contra un rival quieto (nov 2026). Subir/bajar aquí sin tocar cada poder.
const POWER_SCALE = {
  wordfall: 1.08, balls: 0.88, speakers: 1.14, demon: 0.78, papers: 1.04, ufo: 0.96, vomit: 0.93, beatwords: 1.09,
  completo: 0.91, baltiloca: 1.06, clap: 1.47, launch: 1.09,
  briefcase: 1.03, rasengan: 1.11, duo: 1.03, rainbow: 1.0, books: 1.09, scream: 0.93, eqdrop: 0.97, kettlebells: 1.06,
  quake: 1.3, bible: 1.06, smoke: 0.77,
};
function startPower(f, kind) {
  const fx = { kind, f, o: f.opp, t: 0, dir: f.facing, items: [], done: false };
  game.powers.push(fx);
  curFx = fx; try { POWERS[kind].start(fx); } finally { curFx = null; }
}

const POWERS = {
  // Creabeatbox · BOOM TSS KA: hace beatbox al micrófono y cada sonido sale volando como palabra hacia el rival
  beatwords: {
    start(fx) { hold(fx.f, 'beat'); },
    update(fx) {
      const f = fx.f, o = fx.o, t = fx.t, words = ['BOOM', 'TSS', 'KA', 'PFF', 'BOOM', 'KA!'];
      if (t >= 12 && t <= 12 + 5 * 9 && (t - 12) % 9 === 0) {
        const n = (t - 12) / 9;
        fx.items.push({ text: words[n], n, x: f.x + fx.dir * 70, y0: bodyY(f, 0.78), y: bodyY(f, 0.78), vx: 13 * fx.dir, t: 0, ph: n });
        psfx('pw_bass', 'special_wave', 0.7); fx.pulse = 6;
      }
      fx.pulse = Math.max(0, (fx.pulse || 0) - 1);
      if (t === 70) release(f);
      for (const w of fx.items) {
        if (w.gone) continue;
        w.t++; w.x += w.vx; w.y = w.y0 + Math.sin(w.t * 0.35 + w.ph) * 18 + (bodyY(o, 0.6) - w.y0) * Math.min(1, w.t / 25);
        if (overlap({ x: w.x - 50, y: w.y - 28, w: 100, h: 56 }, o.hurtbox())) {
          w.gone = true; const last = w.n === 5;
          game.sparks(w.x, w.y, f.ch.accent, 14);
          strike(fx, { dmg: last ? 6 : 3.4, stun: 16, kb: last ? 9 : 1.5, knockdown: last, hitstop: last ? 12 : 3, heavy: last, at: { x: w.x, y: w.y } });
        }
        if (w.x < -100 || w.x > W + 100) w.gone = true;
      }
      return t > 70 && fx.items.every(w => w.gone);
    },
    front(fx) {
      const f = fx.f, col = f.ch.accent;
      // ondas que salen del micrófono con cada sonido
      if (fx.t < 70) {
        const mx = f.x + fx.dir * 55, my = bodyY(f, 0.78);
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 4;
        for (let i = 0; i < 3; i++) {
          const r = 20 + ((fx.t * 3 + i * 18) % 54); ctx.globalAlpha = 1 - r / 74;
          ctx.beginPath(); ctx.arc(mx, my, r + (fx.pulse || 0) * 2, fx.dir > 0 ? -0.8 : Math.PI - 0.8, fx.dir > 0 ? 0.8 : Math.PI + 0.8); ctx.stroke();
        }
        ctx.restore();
      }
      for (const w of fx.items) {
        if (w.gone) continue;
        const s = 1 + Math.max(0, 1 - w.t / 6) * 0.6 + Math.sin(w.t * 0.5) * 0.06;
        ctx.save(); ctx.translate(w.x, w.y); ctx.scale(s, s); ctx.rotate(Math.sin(w.t * 0.3 + w.ph) * 0.12);
        ctx.font = '400 54px ' + GRAF_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        ctx.lineWidth = 10; ctx.strokeStyle = '#14061c'; ctx.strokeText(w.text, 4, 4); ctx.fillStyle = col; ctx.fillText(w.text, 4, 4);
        ctx.strokeText(w.text, 0, 0); ctx.fillStyle = w.n % 2 ? '#fff' : '#ffe14d'; ctx.fillText(w.text, 0, 0);
        ctx.restore();
      }
    },
  },
  // Creabeatbox · EL DROP: arma el beat (el rival queda hipnotizado) y en el drop salen del suelo
  // barras de ecualizador gigantes bajo el rival, al ritmo del bajo, y la última lo manda a volar
  eqdrop: {
    start(fx) { hold(fx.f, 'beat'); fx.guard = guarding(fx.o); fx.cx = fx.o.x; fx.bars = Array.from({ length: 32 }, () => 0); },
    update(fx) {
      const f = fx.f, o = fx.o, t = fx.t;
      if (t < 90 && o.state !== 'held' && !fx.guard && t > 6) hold(o, 'dizzy');
      if (t < 50 && t % 10 === 0) { psfx('pw_bass', 'special_wave', 0.4 + t / 100); game.shake(2 + t / 12); }
      if (t === 50) { game.shake(26); Audio.sfx('super_beam', 0.9); psfx('pw_boom', 'super_rush'); fx.drop = t; fx.cx = o.x; }
      const hits = [52, 60, 68, 76];
      if (hits.includes(t)) { fx.kick = 8; game.shake(12); if (!strike(fx, { dmg: 5, stun: 30, kb: 0, hitstop: 4, at: { x: o.x, y: GROUND - 60 } }) && game.phase !== 'fight') return true; if (!fx.guard) hold(o, 'dizzy'); }
      if (t === 88) { fx.kick = 14; game.shake(28); if (strike(fx, { dmg: 16, stun: 40, kb: 6, knockdown: true, hitstop: 18, at: { x: o.x, y: GROUND - 80 } })) { o.vy = 15; o.vx = fx.dir * 6; } }
      fx.kick = Math.max(0, (fx.kick || 0) - 1);
      // alturas del ecualizador del piso: suben con el armado y saltan con cada golpe de bajo
      const energy = t < 50 ? t / 50 * 0.5 : t < 100 ? 0.6 + fx.kick / 14 * 0.4 : Math.max(0, 1 - (t - 100) / 20);
      fx.bars = fx.bars.map((h, i) => h + ((0.25 + Math.random() * 0.75) * energy - h) * 0.35);
      if (t === 100) release(f);
      return t > 120;
    },
    back(fx) {
      const t = fx.t, n = fx.bars.length, bw = W / n, seg = 14;
      ctx.save();
      // pantalla oscura que late con el beat
      ctx.fillStyle = `rgba(10,0,20,${Math.min(0.45, t / 60) * (t > 100 ? Math.max(0, 1 - (t - 100) / 20) : 1)})`; ctx.fillRect(0, 0, W, H);
      // ecualizador por todo el piso, barras de leds de verde a rojo
      for (let i = 0; i < n; i++) {
        const near = fx.drop ? Math.max(0, 1 - Math.abs(i * bw + bw / 2 - fx.cx) / 170) : 0;
        const h = (fx.bars[i] * 160 + near * (200 + (fx.kick || 0) * 40) * (fx.bars[i] + 0.6)), cells = Math.floor(h / seg);
        for (let c = 0; c < cells; c++) {
          const k = c / 26; ctx.fillStyle = k < 0.45 ? '#39ff6a' : k < 0.75 ? '#ffe14d' : '#ff3030';
          ctx.globalAlpha = 0.85; ctx.fillRect(i * bw + 3, GROUND - 4 - (c + 1) * seg, bw - 6, seg - 4);
        }
      }
      ctx.restore();
    },
    front(fx) {
      const t = fx.t;
      if (fx.drop && t - fx.drop < 8) { ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - (t - fx.drop) / 8)})`; ctx.fillRect(0, 0, W, H); }
      if (t < 50) { // ondas del armado saliendo del micrófono
        const f = fx.f, mx = f.x + fx.dir * 55, my = bodyY(f, 0.78);
        ctx.save(); ctx.strokeStyle = f.ch.accent; ctx.lineWidth = 5;
        for (let i = 0; i < 4; i++) { const r = (t * 4 + i * 40) % 160; ctx.globalAlpha = 1 - r / 160; ctx.beginPath(); ctx.arc(mx, my, r, 0, 7); ctx.stroke(); }
        ctx.restore();
      }
    },
  },
  // Mastamaick · EL COMPLETO: se come un completo con calma (no recibe daño mientras come), le da
  // fuerza y agarra al rival donde esté para meterle 2 combos que no se pueden bloquear ni esquivar
  completo: {
    start(fx) { hold(fx.f, 'eat'); fx.f.invuln = 115; fx.crumbs = []; },
    update(fx) {
      const f = fx.f, o = fx.o, t = fx.t;
      // 4 mordiscos: muerde (eat) y mastica feliz (eat2)
      if ([12, 34, 56, 78].includes(t)) {
        f.fxPose = 'eat'; Audio.sfx('punch', 0.3);
        const m = { x: f.x + fx.dir * 40, y: bodyY(f, 0.74) };
        for (let i = 0; i < 9; i++) fx.crumbs.push({ x: m.x, y: m.y, vx: fx.dir * rnd(-1, 3), vy: rnd(-4, -1), life: 26, color: ['#7cc95a', '#e8402e', '#fff6d8', '#d9a35a'][i % 4] });
      }
      if ([20, 42, 64, 86].includes(t)) f.fxPose = 'eat2';
      // le pega el poder del completo
      if (t === 96) { f.fxPose = 'powerup'; psfx('ex_start', 'super_start'); game.shake(14); game.sparks(f.x, bodyY(f), '#ff8a1f', 30); }
      // lo agarra donde esté: aparece frente a él y el rival queda tomado (sin bloqueo ni escape)
      if (t === 116) {
        game.sparks(f.x, bodyY(f), '#ff8a1f', 16); Audio.whoosh();
        const dir = Math.sign(o.x - f.x) || fx.dir; fx.dir = dir;
        o.y = 0; hold(o, 'hit');
        f.x = Math.max(ARENA_L, Math.min(ARENA_R, o.x - dir * 95)); f.facing = dir;
        game.sparks(f.x, bodyY(f), '#ff8a1f', 16);
      }
      const combo = { 124: ['punch', 3.5], 132: ['punch2', 3.5], 140: ['kick', 4], 156: ['punchH', 4], 164: ['kickH', 4.5], 176: ['punchH', 8] };
      if (t > 116 && t < 176 && o.state !== 'held') hold(o, 'hit');
      if (combo[t]) {
        const [pose, dmg] = combo[t], last = t === 176;
        f.fxPose = pose; Audio.whoosh();
        game.sparks(o.x - fx.dir * 30, bodyY(o, 0.6), '#ff8a1f', last ? 24 : 10);
        if (strike(fx, { dmg, stun: 40, kb: last ? 12 : 0, knockdown: last, hitstop: last ? 18 : 5, unblockable: true, at: { x: o.x - fx.dir * 30, y: bodyY(o, 0.6) } }) && !last) hold(o, 'hit');
        if (last) game.shake(22);
      }
      for (const c of fx.crumbs) { c.x += c.vx; c.y += c.vy; c.vy += 0.4; c.life--; }
      fx.crumbs = fx.crumbs.filter(c => c.life > 0);
      if (t === 190) release(f);
      return t > 190;
    },
    back(fx) {
      // aura de fuego desde que le pega el completo
      const t = fx.t; if (t < 96 || t > 190) return;
      const f = fx.f, y = bodyY(f, 0.5), a = Math.min(1, (t - 96) / 6) * Math.min(1, (190 - t) / 10);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(f.x, y, 30, f.x, y, 200); g.addColorStop(0, 'rgba(255,150,40,0.55)'); g.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - 210, y - 210, 420, 420); ctx.restore();
    },
    front(fx) {
      for (const c of fx.crumbs) { ctx.fillStyle = c.color; ctx.fillRect(c.x - 3, c.y - 3, 7, 7); }
    },
  },
  // Mastamaick · ONE HIT WONDER: lanza 4 pesas rusas alternando las manos, todas directo al rival
  // Omega · LA BALTILOCA (su tema): apunta al cielo y le llueven latas rojas de Baltica al rival, cada una revienta en espuma;
  // al final agita una lata y se la lanza de frente. Dibujos: can_fly / can_red / foam (assets/powers)
  baltiloca: {
    start(fx) { hold(fx.f, 'summon'); fx.dir = Math.sign(fx.o.x - fx.f.x) || fx.dir; fx.f.facing = fx.dir; fx.cans = []; fx.foams = []; },
    update(fx) {
      const f = fx.f, o = fx.o, t = fx.t;
      const burst = (c, big) => { c.gone = true; fx.foams.push({ x: c.x, y: Math.min(c.y, GROUND - 40), t: 0, big }); psfx('pw_splash', 'punch', big ? 1 : 0.6); };
      // lluvia: 6 latas que caen desde arriba de la pantalla sobre el rival
      if (t >= 8 && t <= 48 && (t - 8) % 8 === 0) fx.cans.push({ x: o.x + rnd(-50, 50), y: -80 - rnd(0, 40), vx: 0, vy: 6, rot: rnd(0, 6), spin: rnd(-0.25, 0.25), n: (t - 8) / 8, rain: true });
      if (t === 52) { f.fxPose = 'shake'; psfx('pw_shake', 'menu_move', 0.6); }
      if (t === 70) { // se la lanza
        f.fxPose = 'throwCan'; Audio.whoosh();
        const h = poseHand(f, 'shake', SHAKE_HAND);
        fx.cans.push({ x: h.x + fx.dir * 30, y: bodyY(f, 0.62), vx: fx.dir * 19, vy: 0, rot: 0, spin: 0.3 * fx.dir, n: 6 });
      }
      if (t === 86) release(f);
      for (const c of fx.cans) {
        if (c.gone) continue;
        if (c.rain) c.vy += 0.6; c.x += c.vx; c.y += c.vy; c.rot += c.spin;
        if (overlap({ x: c.x - 26, y: c.y - 26, w: 52, h: 52 }, o.hurtbox())) {
          const last = !c.rain; burst(c, last); game.shake(last ? 16 : 7);
          if (strike(fx, { dmg: last ? 7 : 3, stun: last ? 26 : 16, kb: last ? 9 : 1, knockdown: last, hitstop: last ? 12 : 4, at: { x: c.x, y: c.y } }) && c.n === 5) { hold(o, 'dizzy'); fx.dizzy = 26; }
        } else if (c.y > GROUND - 30) { c.y = GROUND - 30; burst(c, false); }
        if (c.x < -100 || c.x > W + 100) c.gone = true;
      }
      if (fx.dizzy > 0 && --fx.dizzy === 0 && o.state === 'held') release(o);
      for (const p of fx.foams) p.t++;
      fx.foams = fx.foams.filter(p => p.t < 26);
      return t > 86 && fx.cans.every(c => c.gone) && !fx.foams.length && !(fx.dizzy > 0);
    },
    front(fx) {
      const f = fx.f, t = fx.t;
      // la lata en la mano mientras la agita
      if (t >= 52 && t < 70) { const h = poseHand(f, 'shake', SHAKE_HAND); art('can_red', h.x, h.y - 30, 34, { rot: Math.sin(t * 1.6) * 0.45 * fx.dir, flipX: fx.dir < 0 }); }
      for (const c of fx.cans) if (!c.gone) art('can_fly', c.x, c.y, c.rain ? 64 : 80, { rot: c.rot, flipX: fx.dir < 0 });
      // espuma: crece rápido y se desvanece
      for (const p of fx.foams) { const k = Math.min(1, p.t / 5), w = (p.big ? 190 : 120) * (0.6 + 0.4 * k); art('foam', p.x, p.y - w * 0.15, w, { alpha: p.t < 14 ? 1 : 1 - (p.t - 14) / 12 }); }
    },
  },
  // Omega · EL SUR ES HARDCORE: salta, golpea el piso con los dos puños y salen columnas de roca del suelo, en fila hasta el rival,
  // con piedras volando. Son 3 golpes: el primero (el golpe al piso si está cerca, o la columna que lo alcanza) lo deja atrapado
  // y salen 2 columnas más bajo sus pies; la última lo lanza al aire. Se esquiva saltando. Dibujos: rock_tall / rock_wide / rock1-4
  quake: {
    start(fx) { hold(fx.f, 'slamJump'); fx.dir = Math.sign(fx.o.x - fx.f.x) || fx.dir; fx.f.facing = fx.dir; fx.rocks = []; fx.bits = []; fx.hits = 0; },
    update(fx) {
      const f = fx.f, o = fx.o, t = fx.t;
      const debris = (x, k) => { for (let i = 0; i < k; i++) fx.bits.push({ img: 'rock' + (1 + Math.floor(rnd(0, 4))), x: x + rnd(-20, 20), y: GROUND - 30, vx: rnd(-3, 3) + fx.dir * 1.5, vy: rnd(-13, -8), rot: rnd(0, 6), spin: rnd(-0.3, 0.3), w: rnd(22, 38) }); };
      // golpe n.º 1 a 3: los dos primeros lo dejan atrapado, el último lo lanza
      const blow = () => {
        fx.hits++; const last = fx.hits === 3;
        const ok = strike(fx, { dmg: last ? 11 : 8, stun: 44, kb: last ? 4 : 0, knockdown: last, hitstop: last ? 16 : 8, at: { x: o.x, y: GROUND - 60 } });
        if (!ok) { fx.hits = 3; return; } // lo bloqueó o terminó el round
        if (last) { o.vy = 17; o.vx = fx.dir * 5; game.shake(26); } else { hold(o, 'hit'); fx.trapT = 0; game.shake(14); }
      };
      if (t <= 20) f.y = Math.sin(t / 20 * Math.PI) * 150;
      if (t === 20) {
        f.y = 0; f.fxPose = 'slam'; game.shake(32); psfx('pw_boom', 'super_rush'); Audio.sfx('fall', 0.9);
        // el rival pudo pasar por debajo durante el salto: las rocas van hacia donde está
        fx.dir = Math.sign(o.x - f.x) || fx.dir; f.facing = fx.dir;
        // el golpe al piso alcanza al que esté pegado, por cualquier lado
        if (Math.abs(o.x - f.x) < 150 && o.y < 40) { debris(o.x, 3); blow(); }
      }
      // columnas extra bajo el rival atrapado
      if (fx.hits > 0 && fx.hits < 3 && ++fx.trapT === 12) {
        fx.rocks.push({ x: o.x, t: 0, img: fx.hits === 1 ? 'rock_wide' : 'rock_tall', w: fx.hits === 1 ? 116 : 150, flip: fx.hits === 2, trap: true });
        debris(o.x, 3); blow();
      }
      if (t > 20 && t <= 20 + 14 * 4 && (t - 20) % 4 === 0) {
        const n = (t - 20) / 4, x = f.x + fx.dir * (90 + n * 62);
        if (x > -80 && x < W + 80) {
          const tall = n % 2 === 0;
          fx.rocks.push({ x, t: 0, img: tall ? 'rock_tall' : 'rock_wide', w: tall ? 150 : 116, flip: n % 3 === 0 });
          debris(x, 2);
          if (n % 2 === 0) game.shake(10);
        }
      }
      for (const r of fx.rocks) {
        r.t++;
        if (!fx.hits && !r.trap && r.t < 14 && Math.abs(r.x - o.x) < 60 && o.y < 40) blow();
      }
      for (const b of fx.bits) { b.vy += 0.6; b.x += b.vx; b.y += b.vy; b.rot += b.spin; }
      fx.bits = fx.bits.filter(b => b.y < GROUND + 40);
      if (t === 80) release(f);
      return t > 130 && (!fx.hits || fx.hits >= 3);
    },
    front(fx) {
      // cada columna sube desde el piso (solo se ve sobre el suelo), se queda un momento y se vuelve a hundir
      for (const r of fx.rocks) {
        const k = r.t < 6 ? r.t / 6 : r.t < 26 ? 1 : Math.max(0, 1 - (r.t - 26) / 16); if (k <= 0) continue;
        const img = powerImgs[r.img]; if (!img) continue;
        const h = r.w * img.height / img.width, sink = h * (1 - k);
        ctx.save(); ctx.beginPath(); ctx.rect(r.x - r.w, 0, r.w * 2, GROUND + 6); ctx.clip();
        art(r.img, r.x, GROUND + 6 - h / 2 + sink, r.w, { flipX: r.flip });
        ctx.restore();
      }
      for (const b of fx.bits) art(b.img, b.x, b.y, b.w, { rot: b.rot });
    },
  },
  kettlebells: {
    start(fx) { hold(fx.f, 'throw1'); fx.dir = Math.sign(fx.o.x - fx.f.x) || fx.dir; fx.f.facing = fx.dir; },
    update(fx) {
      const f = fx.f, o = fx.o, t = fx.t, G = 0.5;
      const throws = [10, 28, 46, 64];
      if (throws.includes(t)) {
        const n = throws.indexOf(t); f.fxPose = n % 2 ? 'throw2' : 'throw1'; Audio.whoosh();
        const x = f.x + fx.dir * 90, y = bodyY(f, 0.58), tx = o.x, ty = bodyY(o, 0.55), T = Math.max(14, Math.abs(tx - x) / 17);
        fx.items.push({ x, y, vx: (tx - x) / T, vy: (ty - y - 0.5 * G * T * T) / T, rot: 0, n, trail: [] });
      }
      if (t === 84) release(f);
      for (const b of fx.items) {
        if (b.gone) continue;
        b.trail.unshift({ x: b.x, y: b.y }); b.trail.length = Math.min(b.trail.length, 6);
        b.vy += G; b.x += b.vx; b.y += b.vy; b.rot += 0.25 * fx.dir;
        if (overlap({ x: b.x - 26, y: b.y - 26, w: 52, h: 52 }, o.hurtbox())) {
          b.gone = true; const last = b.n === 3;
          game.sparks(b.x, b.y, '#ffffff', 14); game.shake(last ? 24 : 12); psfx('pw_boom', 'punchH', last ? 1 : 0.6);
          strike(fx, { dmg: last ? 12 : 7, stun: 24, kb: last ? 12 : 3, knockdown: last, hitstop: last ? 18 : 8, at: { x: b.x, y: b.y } });
        }
        if (b.y > GROUND - 20) { b.gone = true; game.sparks(b.x, GROUND - 20, '#9aa0a8', 10); game.shake(8); Audio.sfx('land', 0.6); }
        if (b.x < -60 || b.x > W + 60) b.gone = true;
      }
      return t > 84 && fx.items.every(b => b.gone);
    },
    front(fx) {
      for (const b of fx.items) {
        if (b.gone) continue;
        b.trail.forEach((p, i) => { ctx.save(); ctx.globalAlpha = 0.18 - i * 0.025; ctx.fillStyle = '#ffb35a'; ctx.beginPath(); ctx.arc(p.x, p.y, 24 - i * 2, 0, 7); ctx.fill(); ctx.restore(); });
        drawKettlebell(b.x, b.y, b.rot);
      }
    },
  },
  // ---------- ESPECIALES (2 barras) ----------
  // Jonas · DAKNOWLEDGE: un derrumbe de frases cae del cielo sobre el rival
  wordfall: {
    start(fx) { const w = ['RIMA', 'FLOW', 'BARRA', 'VERSO', 'LÍRICA', 'CALLE', 'MÉTRICA', 'BEAT']; fx.items = w.map((text, i) => ({ text, delay: 4 + i * 7, y: -60, vy: 3, rot: rnd(-0.2, 0.2), on: false })); hold(fx.f, 'taunt'); psfx('pw_wordfall', 'super_rain'); },
    update(fx) {
      if (fx.t === 30) release(fx.f);
      let left = 0;
      fx.items.forEach((b, i) => {
        if (b.gone) return; left++;
        if (fx.t < b.delay) return;
        if (!b.on) { b.on = true; b.x = fx.o.x + rnd(-90, 90); }
        b.vy += 0.9; b.y += b.vy;
        if (!b.hit && overlap({ x: b.x - 55, y: b.y - 22, w: 110, h: 44 }, fx.o.hurtbox())) {
          b.hit = true; const last = i === fx.items.length - 1;
          strike(fx, { dmg: last ? 5 : 2.6, stun: 16, kb: last ? 6 : 1, knockdown: last, hitstop: 3 });
        }
        if (b.y > GROUND - 22) { b.gone = true; game.sparks(b.x, GROUND - 20, '#bfae8f', 8); game.shake(5); Audio.sfx('land', 0.35); }
      });
      return !left;
    },
    front(fx) {
      for (const b of fx.items) {
        if (!b.on || b.gone) continue;
        // bloque de piedra con la palabra tallada
        art('slab', b.x, b.y, 140, { rot: b.rot, h: 64 });
        ctx.save(); ctx.translate(b.x, b.y - 6); ctx.rotate(b.rot);
        ctx.font = '400 22px "Bungee", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 5; ctx.strokeStyle = '#120c14'; ctx.strokeText(b.text, 0, 0);
        ctx.fillStyle = fx.f.ch.special.color; ctx.fillText(b.text, 0, 0);
        ctx.restore();
      }
    },
  },
  // ChysteMc · TECHYFUTBOL: se come un brócoli que le da poder (como la espinaca) y de su cuerpo
  // salen 8 balones en distintas direcciones que rebotan y van buscando al rival
  balls: {
    // pose propia comiendo (sprite eat); sin ella, la burla con un brócoli dibujado en la mano
    start(fx) { const set = spriteSet(fx.f.ch); fx.drawn = !(set && set.eat); hold(fx.f, fx.drawn ? 'taunt' : 'eat'); fx.bites = 0; fx.crumbs = []; },
    update(fx) {
      const f = fx.f, o = fx.o, t = fx.t, mouth = { x: f.x + fx.dir * 34, y: bodyY(f, 0.78) };
      // 3 mordiscos al brócoli
      if (t === 10 || t === 22 || t === 34) {
        fx.bites++; Audio.sfx('punch', 0.35);
        for (let i = 0; i < 6; i++) fx.crumbs.push({ x: mouth.x, y: mouth.y, vx: rnd(-2.5, 2.5), vy: rnd(-3, 0), life: 22 });
      }
      // se infla de poder: aura verde y puño arriba
      if (t === 42) { f.fxPose = 'winRound'; psfx('ex_start', 'super_start', 0.9); game.sparks(f.x, bodyY(f), '#5bd94a', 24); game.shake(8); }
      if (t === 56) {
        f.fxPose = 'kick';
        // abanico de salida: hacia adelante, arriba y algunos hacia atrás (después vuelven)
        [-150, -120, -80, -55, -32, -12, 8, 160].forEach((deg, n) => {
          const a = deg * Math.PI / 180, sp = rnd(12, 15);
          fx.items.push({ x: f.x + fx.dir * 30, y: bodyY(f, 0.5), vx: Math.cos(a) * sp * fx.dir, vy: Math.sin(a) * sp, spin: 0, n, t: 0, delay: n * 3 });
        });
        psfx('pw_ball', 'kick', 1); game.shake(10);
      }
      if (t === 78) release(f);
      for (const c of fx.crumbs) { c.x += c.vx; c.y += c.vy; c.vy += 0.4; c.life--; }
      fx.crumbs = fx.crumbs.filter(c => c.life > 0);
      for (const b of fx.items) {
        if (b.gone) continue;
        if (b.delay > 0) { b.delay--; continue; }
        b.t++;
        // después de salir, cada balón se curva hacia el rival
        if (b.t > 10) {
          const tx = o.x - b.x, ty = bodyY(o, 0.55) - b.y, d = Math.hypot(tx, ty) || 1;
          b.vx += tx / d * 1.25; b.vy += ty / d * 1.25;
          const sp = Math.hypot(b.vx, b.vy), mx = 16; if (sp > mx) { b.vx *= mx / sp; b.vy *= mx / sp; }
        } else b.vy += 0.4;
        b.x += b.vx; b.y += b.vy; b.spin += b.vx * 0.03;
        // rebota en el piso, el techo y los bordes
        if (b.y > GROUND - 30) { b.y = GROUND - 30; b.vy = -Math.abs(b.vy) * 0.8; }
        if (b.y < 30) { b.y = 30; b.vy = Math.abs(b.vy); }
        if (b.x < 30 || b.x > W - 30) { b.x = Math.max(30, Math.min(W - 30, b.x)); b.vx *= -0.8; }
        if (overlap({ x: b.x - 30, y: b.y - 30, w: 60, h: 60 }, o.hurtbox())) {
          b.gone = true; const last = fx.items.every(q => q === b || q.gone);
          game.sparks(b.x, b.y, '#ffffff', 12); psfx('pw_ball', 'kick', 0.6);
          strike(fx, { dmg: last ? 6 : 3.2, stun: 18, kb: last ? 9 : 1.5, knockdown: last, hitstop: last ? 12 : 3, at: { x: b.x, y: b.y } });
        }
        if (b.t > 150) b.gone = true;
      }
      return t > 78 && fx.items.every(b => b.gone);
    },
    front(fx) {
      const f = fx.f, t = fx.t;
      // brócoli en la mano, cada vez más mordido
      if (t < 40 && fx.drawn) {
        const x = f.x + fx.dir * (40 - Math.min(1, t / 8) * 6), y = bodyY(f, 0.72), s = 1 - fx.bites * 0.22;
        drawBroccoli(x, y, s, fx.dir);
      }
      for (const c of fx.crumbs) { ctx.fillStyle = '#3f9e2c'; ctx.fillRect(c.x - 3, c.y - 3, 6, 6); }
      // aura verde de poder
      if (t >= 40 && t < 80) {
        const a = Math.min(1, (t - 40) / 6) * Math.max(0, (80 - t) / 20), y = bodyY(f, 0.5);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
        const g = ctx.createRadialGradient(f.x, y, 20, f.x, y, 190); g.addColorStop(0, 'rgba(120,255,90,0.6)'); g.addColorStop(1, 'rgba(120,255,90,0)');
        ctx.fillStyle = g; ctx.fillRect(f.x - 200, y - 200, 400, 400); ctx.restore();
      }
      for (const b of fx.items) {
        if (b.gone || b.delay > 0) continue;
        ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(b.x - b.vx * 1.4, b.y - b.vy * 1.4, 22, 0, 7); ctx.fill(); ctx.restore();
        art('ball', b.x, b.y, 62, { rot: b.spin });
      }
    },
  },
  // Macrodee · MACRODEE EN EL BEAT: 2 parlantes gigantes (más altos que él) disparan bolas de energía con el golpe del bajo
  speakers: {
    start(fx) {
      const f = fx.f; fx.sh = spriteH(f.ch) * 1.4; hold(f, 'taunt'); fx.pulse = [0, 0]; fx.rings = [];
      // detrás de él, pero las dos torres siempre dentro de la pantalla
      const m = fx.sh * 131 / 210 / 2 + 95; fx.sx = Math.max(m, Math.min(W - m, f.x - fx.dir * 120));
    },
    update(fx) {
      if (fx.t === 30) release(fx.f);
      if (fx.t >= 24 && fx.t <= 24 + 12 * 5 && (fx.t - 24) % 12 === 0) {
        const k = ((fx.t - 24) / 12) % 2, n = (fx.t - 24) / 12, y = k ? GROUND - 175 : GROUND - 70;
        fx.pulse[k] = 10; psfx('pw_bass', 'special_wave', 0.8); game.shake(6);
        fx.items.push({ x: fx.sx + fx.dir * 50, y, vx: 12 * fx.dir, n, t: 0, trail: [] });
        fx.rings.push({ x: fx.sx - fx.dir * k * 95 + fx.dir * 30, y, t: 0 }); // onda del bajo saliendo del cono
      }
      fx.pulse = fx.pulse.map(p => Math.max(0, p - 1));
      for (const r of fx.rings) r.t++;
      fx.rings = fx.rings.filter(r => r.t < 18);
      for (const b of fx.items) {
        if (b.gone) continue;
        b.trail.unshift({ x: b.x, y: b.y }); b.trail.length = Math.min(b.trail.length, 7);
        b.x += b.vx; b.t++;
        if (b.t % 3 === 0) game.particles.push({ x: b.x - fx.dir * 30, y: b.y + rnd(-18, 18), vx: -fx.dir * rnd(1, 3), vy: rnd(-1.5, 1.5), life: 16, max: 16, color: fx.f.ch.special.color, size: rnd(3, 6), kind: 'spark' });
        if (!b.hit && overlap({ x: b.x - 30, y: b.y - 30, w: 60, h: 60 }, fx.o.hurtbox())) {
          b.hit = b.gone = true; const last = b.n === 5;
          strike(fx, { dmg: last ? 6 : 3.2, stun: 15, kb: last ? 9 : 2, knockdown: last, at: { x: b.x, y: b.y } });
          game.sparks(b.x, b.y, fx.f.ch.special.color, 18); game.sparks(b.x, b.y, '#fff', 8);
        }
        if (b.x < -80 || b.x > W + 80) b.gone = true;
      }
      return fx.t > 100 && fx.items.every(b => b.gone);
    },
    back(fx) {
      const a = Math.min(1, fx.t / 12, Math.max(0, (130 - fx.t) / 15));
      // dos torres de parlantes detrás de él, en diagonal apuntando al rival; laten con cada golpe de bajo
      const img = powerImgs.speaker_side, ar = img ? img.width / img.height : 131 / 210;
      [1, 0].forEach(k => {
        const p = 1 + fx.pulse[k] * 0.025, h = fx.sh * p, x = fx.sx - fx.dir * k * 95;
        art(img ? 'speaker_side' : 'speaker', x, GROUND - h / 2, h * ar, { alpha: a, h, flipX: fx.dir < 0 });
      });
      for (const r of fx.rings) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - r.t / 18;
        ctx.strokeStyle = fx.f.ch.special.color; ctx.lineWidth = 8 - r.t * 0.35;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, 20 + r.t * 6, 30 + r.t * 9, 0, 0, 7); ctx.stroke(); ctx.restore();
      }
    },
    front(fx) {
      for (const b of fx.items) {
        if (b.gone) continue;
        // estela que se desvanece + resplandor + bola que late
        b.trail.forEach((p, i) => art('orb_pink', p.x, p.y, 96 - i * 11, { alpha: 0.35 - i * 0.045 }));
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 95);
        g.addColorStop(0, hexA(fx.f.ch.special.color, 0.75)); g.addColorStop(1, hexA(fx.f.ch.special.color, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, 95, 0, 7); ctx.fill(); ctx.restore();
        art('orb_pink', b.x, b.y, 112 + Math.sin(b.t * 0.8) * 12);
        art('orb_pink', b.x, b.y, 60, { rot: b.t * 0.3 });
      }
    },
  },
  // Gran Rah · LENGUAJE VIVO: 10 hojas con sus letras cruzan la pantalla; cada una pega 1 vez
  papers: {
    start(fx) { hold(fx.f, 'taunt'); psfx('pw_paper', 'whoosh'); for (let i = 0; i < 10; i++) fx.items.push({ delay: i * 6, x: fx.dir > 0 ? -40 : W + 40, y: GROUND - rnd(50, 230), vx: rnd(15, 19) * fx.dir, rot: rnd(-0.5, 0.5), ph: rnd(0, 6) }); },
    update(fx) {
      if (fx.t === 26) release(fx.f);
      let left = 0;
      for (const p of fx.items) {
        if (p.gone) continue; left++;
        if (fx.t < p.delay) continue;
        p.x += p.vx; p.y += Math.sin(fx.t * 0.3 + p.ph) * 2.2; p.rot += 0.08;
        if (!p.hit && overlap({ x: p.x - 24, y: p.y - 30, w: 48, h: 60 }, fx.o.hurtbox())) {
          p.hit = true; strike(fx, { dmg: 2.4, stun: 12, kb: 1.5, hitstop: 2, heavy: false, at: { x: p.x, y: p.y } });
        }
        if (p.x < -80 || p.x > W + 80) p.gone = true;
      }
      return !left;
    },
    front(fx) {
      for (const p of fx.items) {
        if (p.gone || fx.t < p.delay) continue;
        // la hoja aletea: se angosta y ensancha mientras vuela
        const sx = Math.cos(fx.t * 0.25 + p.ph) * 0.3 + 0.8;
        art('paper', p.x, p.y, 54 * sx, { rot: p.rot, h: 64 });
      }
    },
  },
  // Ceaese · DEMONIO CON AROS DE CRUCES: paraliza al rival, los aros de cruces lo queman 5 veces
  // y una patada lo manda a la otra esquina (si se estaba cubriendo no queda paralizado)
  demon: {
    start(fx) { fx.guard = guarding(fx.o); if (!fx.guard) hold(fx.o, 'dizzy'); hold(fx.f, 'taunt'); psfx('pw_demon', 'dizzy'); },
    update(fx) {
      const f = fx.f, o = fx.o;
      if (fx.t < 100 && o.state !== 'held' && !fx.guard) hold(o, 'dizzy');
      if (fx.t >= 30 && fx.t <= 90 && fx.t % 15 === 0) {
        game.sparks(o.x, bodyY(o, 0.55), '#be5aff', 12);
        if (!strike(fx, { dmg: 3.6, stun: 30, kb: 0, hitstop: 3, heavy: false }) && game.phase !== 'fight') return true;
        if (!fx.guard) hold(o, 'dizzy');
      }
      if (fx.t === 100) {
        const dir = Math.sign(o.x - f.x) || fx.dir; fx.dir = dir;
        game.sparks(f.x, bodyY(f), '#5a0f0f', 14);
        f.x = Math.max(ARENA_L, Math.min(ARENA_R, o.x - dir * 80)); f.facing = dir; f.fxPose = 'kickH';
        game.sparks(f.x, bodyY(f), '#ff3b3b', 14); Audio.whoosh();
      }
      if (fx.t === 108) {
        if (strike(fx, { dmg: 14, stun: 30, kb: 12, knockdown: true, hitstop: 14 })) { o.vx = fx.dir * 26; o.vy = 12; }
        game.shake(16);
      }
      if (fx.t === 126) release(f);
      return fx.t > 126;
    },
    back(fx) {
      if (fx.t > 112) return;
      const o = fx.o, a = Math.min(1, fx.t / 20), x = o.x, y = bodyY(o, 1.25) + (1 - a) * 60;
      ctx.save(); ctx.globalAlpha = a * 0.9;
      const g = ctx.createRadialGradient(x, y, 10, x, y, 170); g.addColorStop(0, 'rgba(255,40,40,0.55)'); g.addColorStop(1, 'rgba(255,40,40,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 180, y - 180, 360, 360);
      ctx.restore();
      art('demon', x, y - 10 + Math.sin(fx.t * 0.1) * 4, 230, { alpha: a });
    },
    front(fx) {
      if (fx.t >= 100) return;
      const o = fx.o; ctx.save(); ctx.strokeStyle = 'rgba(190,90,255,0.75)'; ctx.lineWidth = 4;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(o.x, bodyY(o, 0.3 + i * 0.25), 60, 14, 0, (fx.t * 0.1 + i) % 6, ((fx.t * 0.1 + i) % 6) + 4.5); ctx.stroke(); }
      ctx.restore();
    },
  },
  // Veiderr · MARS PEOPLE: entra una nave nodriza enorme que persigue al rival y le dispara bolas de energía desde su cañón,
  // mientras un marciano verde baja en un rayo, le pega un puñetazo y una patada voladora y vuelve a subir.
  // Dibujos: mothership / alien_drop / alien_punch / alien_kick / orb_green (assets/powers)
  ufo: {
    start(fx) {
      fx.u = { x: fx.dir > 0 ? -340 : W + 340, y: 70 }; hold(fx.f, 'taunt'); psfx('pw_ufo', 'special_ice'); game.shake(8);
      fx.al = null; // el marciano
    },
    update(fx) {
      const u = fx.u, o = fx.o, t = fx.t;
      if (t === 30) release(fx.f);
      const leaving = t > 200;
      if (leaving) u.y -= 7; else { u.x += (o.x - u.x) * 0.05; u.y += (175 - u.y) * 0.06; }
      if (t % 40 === 0 && !leaving) game.shake(3); // la nave hace temblar todo
      // bolas de energía desde el cañón de abajo
      if (!leaving && t >= 40 && (t - 40) % 26 === 0 && t <= 40 + 5 * 26) { fx.items.push({ x: u.x, y: u.y + 70, vy: 6, n: (t - 40) / 26 }); Audio.sfx('special_ice', 0.4); }
      for (const b of fx.items) {
        if (b.gone) continue;
        b.vy += 0.35; b.y += b.vy;
        if (!b.hit && overlap({ x: b.x - 22, y: b.y - 22, w: 44, h: 44 }, o.hurtbox())) { b.hit = b.gone = true; strike(fx, { dmg: b.n === 5 ? 5 : 3, stun: 18, kb: 2, knockdown: b.n === 5, at: { x: b.x, y: b.y } }); }
        if (b.y > GROUND - 10) { b.gone = true; game.sparks(b.x, GROUND - 10, '#7dff9a', 8); }
      }
      // el marciano: baja en el rayo junto al rival, le pega y se va
      if (t === 70) { const side = Math.sign(o.x - fx.f.x) || 1; // cae entre los dos: del lado del que lanzó el poder
        fx.al = { x: o.x - side * 90, y: u.y + 40, vy: 0, face: side, step: 'drop', k: 0 }; psfx('pw_whoosh', 'whoosh', 0.6); }
      const a = fx.al;
      if (a) {
        a.k++;
        if (a.step === 'drop') { a.vy += 0.9; a.y += a.vy; a.x += (o.x - a.face * 105 - a.x) * 0.1; if (a.y >= GROUND) { a.y = GROUND; a.step = 'punch'; a.k = 0; game.shake(6); } }
        else if (a.step === 'punch') {
          a.x += (o.x - a.face * 100 - a.x) * 0.25;
          if (a.k === 6) strike(fx, { dmg: 4, stun: 22, kb: 1, hitstop: 8, at: { x: a.x + a.face * 70, y: GROUND - 150 } });
          if (a.k === 22) { a.step = 'kick'; a.k = 0; Audio.whoosh(); }
        } else if (a.step === 'kick') {
          a.y = GROUND - Math.sin(Math.min(1, a.k / 18) * Math.PI) * 40; a.x += a.face * (a.k < 8 ? 6 : 0);
          if (a.k === 7) { if (strike(fx, { dmg: 5, stun: 26, kb: 9, hitstop: 10, at: { x: a.x + a.face * 80, y: GROUND - 120 } })) game.shake(10); }
          if (a.k === 24) { a.step = 'up'; a.k = 0; }
        } else if (a.step === 'up') { a.x += (u.x - a.x) * 0.12; a.y -= 9 + a.k * 0.6; if (a.y < u.y + 30) { fx.al = null; } }
      }
      return leaving && u.y < -220 && fx.items.every(b => b.gone) && !fx.al;
    },
    front(fx) {
      const u = fx.u, t = fx.t, a = fx.al;
      ctx.save();
      // rayo de luz verde bajo la nave (más fuerte mientras baja o sube el marciano)
      if (t > 30 && u.y > 60) {
        const strong = a && (a.step === 'drop' || a.step === 'up');
        const bx = strong ? a.x : u.x;
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = strong ? 'rgba(125,255,154,0.28)' : 'rgba(125,255,154,0.10)';
        ctx.beginPath(); ctx.moveTo(u.x - 40, u.y + 60); ctx.lineTo(u.x + 40, u.y + 60); ctx.lineTo(bx + 110, GROUND); ctx.lineTo(bx - 110, GROUND); ctx.fill();
      }
      ctx.restore();
      art('mothership', u.x, u.y + Math.sin(t * 0.12) * 6, 480, { rot: Math.sin(t * 0.08) * 0.03 });
      for (const b of fx.items) if (!b.gone) art('orb_green', b.x, b.y, 70);
      if (a) {
        const img = a.step === 'punch' && a.k >= 3 && a.k < 18 ? 'alien_punch' : a.step === 'kick' ? 'alien_kick' : 'alien_drop';
        const pimg = powerImgs[img]; if (pimg) { const h = 230 * (pimg.height / 216), w = h * pimg.width / pimg.height; art(img, a.x, a.y - h / 2, w, { flipX: a.face < 0 }); }
      }
    },
  },
  // El Bruto · CHAITO: de un golpe manda al rival al cielo; desaparece 2 s y vuelve a caer
  launch: {
    start(fx) { fx.dir = Math.sign(fx.o.x - fx.f.x) || fx.dir; fx.f.facing = fx.dir; hold(fx.f, 'punchH'); fx.step = 'dash'; },
    update(fx) {
      const f = fx.f, o = fx.o;
      if (fx.step === 'dash') {
        f.x = Math.max(ARENA_L, Math.min(ARENA_R, f.x + 15 * fx.dir));
        const box = { x: fx.dir > 0 ? f.x : f.x - 110, y: bodyY(f, 0.9), w: 110, h: 140 };
        // pegado al rival (o encima de él) el golpe entra sí o sí
        const close = Math.abs(o.x - f.x) < 150 && o.y < 120;
        if (o.state !== 'held' && (close || overlap(box, o.hurtbox()))) {
          if (strike(fx, { dmg: 7, stun: 40, kb: 0, hitstop: 16 })) {
            hold(o, 'hit'); fx.step = 'up'; fx.t0 = fx.t; fx.sx = o.x;
            game.popText(o.x, bodyY(o, 1.2), '¡CHAITO!', '#ffe14d'); game.shake(16); psfx('pw_launch', 'super_rush');
            hold(f, 'drink'); // se queda tomándose una lata mientras el otro vuela
          } else { fx.step = 'end'; release(f); }
        } else if (fx.t >= 26) { release(f); fx.step = 'end'; }
      } else if (fx.step === 'up') {
        if (o.state !== 'held') { release(f); return true; } // otro golpe lo soltó
        o.y += 34;
        if (o.y > GROUND + 300) { o.hidden = true; fx.step = 'away'; }
      } else if (fx.step === 'away') {
        if (fx.t - fx.t0 >= 120) { o.hidden = false; fx.step = 'fall'; o.x = fx.sx; o.fxPose = 'fall'; psfx('pw_fall', 'whoosh'); }
      } else if (fx.step === 'fall') {
        o.y -= 26;
        if (o.y <= 0) { o.y = 0; game.shake(22); if (!Audio.bufs['sfx:pw_fall']) Audio.sfx('fall'); strike(fx, { dmg: 16, stun: 30, kb: 2, knockdown: true, hitstop: 12 }); release(f); return true; }
      }
      return fx.step === 'end';
    },
    front(fx) {
      // destello donde se perdió en el cielo
      if (fx.step !== 'away') return;
      const k = fx.t - fx.t0;
      if (k > 30) return;
      const x = fx.sx, y = 40, r = 6 + Math.sin(k * 0.4) * 10 + 10;
      ctx.save(); ctx.fillStyle = '#fff'; ctx.translate(x, y); ctx.rotate(k * 0.2); ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.fill(); ctx.restore();
    },
  },
  // Jack Dee · UN APLAUSO PAL WEON: 2 manos gigantes aplastan al rival aplaudiendo
  clap: {
    start(fx) { fx.guard = guarding(fx.o); if (!fx.guard) hold(fx.o, 'hit'); hold(fx.f, 'taunt'); fx.cx = fx.o.x; },
    update(fx) {
      const t = fx.t, o = fx.o;
      fx.gap = t < 16 ? 300 - 245 * ease(t / 16) : t < 34 ? 55 + 160 * ease((t - 16) / 18) : t < 46 ? 215 - 160 * ease((t - 34) / 12) : 55 + 400 * ease((t - 46) / 24);
      if (t < 46 && o.state !== 'held' && !fx.guard) hold(o, 'hit');
      if (t === 16 || t === 46) {
        game.popText(fx.cx, bodyY(o, 1.15), '¡PLAP!', '#fff'); game.shake(14); psfx('pw_clap', 'clash');
        const ok = strike(fx, t === 16 ? { dmg: 7, stun: 30, kb: 0, hitstop: 10 } : { dmg: 10, stun: 30, kb: 6, knockdown: true, hitstop: 14 });
        if (t === 16 && ok) hold(o, 'hit');
        if (t === 16 && !ok && (!fx.guard || game.phase !== 'fight')) return true; // cubriéndose recibe los dos aplausos bloqueados
      }
      if (t === 50) release(fx.f);
      return t > 70;
    },
    front(fx) {
      const o = fx.o, y = bodyY(o, 0.5), a = Math.min(1, fx.t / 6, Math.max(0, (70 - fx.t) / 10));
      ctx.save(); ctx.globalAlpha = a;
      for (const s of [-1, 1]) {
        // mano abierta gigante; la de la izquierda es la misma volteada
        art('hand', fx.cx + s * (fx.gap + 50), y - 10, 175, { flipX: s < 0 });
      }
      ctx.restore();
    },
  },

  // ---------- SUPERS (3 barras) ----------
  // Jonas · UNDERGROUND BUSINESS: deja un maletín que se desliza hasta el rival y explota
  briefcase: {
    start(fx) { const f = fx.f; fx.b = { x: f.x + fx.dir * 50 }; hold(f, 'taunt'); },
    update(fx) {
      const b = fx.b, o = fx.o;
      if (!fx.armed) {
        b.x += 22 * fx.dir;
        if ((fx.dir > 0 ? b.x >= o.x : b.x <= o.x) || b.x < ARENA_L || b.x > ARENA_R) { fx.armed = fx.t; b.x = o.x; fx.guard = guarding(o); if (!fx.guard) hold(o, 'dizzy'); release(fx.f); }
      } else {
        const k = fx.t - fx.armed;
        if (k < 60 && o.state !== 'held' && !fx.guard) hold(o, 'dizzy');
        if (k % 15 === 0 && k < 60) Audio.sfx('timer', 0.8);
        if (k === 62) { fx.boom = 0; game.shake(28); psfx('pw_boom', 'super_rush'); Audio.hit(true); strike(fx, { dmg: 34, stun: 40, kb: 10, knockdown: true, hitstop: 20, at: { x: b.x, y: GROUND - 80 } }); }
        if (fx.boom != null) fx.boom++;
      }
      return fx.boom > 40;
    },
    front(fx) {
      const b = fx.b, k = fx.armed ? fx.t - fx.armed : 0;
      if (fx.boom == null) {
        art('briefcase', b.x, GROUND - 32, 76);
        // la lucecita de la bomba parpadea cada vez más
        if (fx.armed && k % 15 < 7) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,40,40,0.9)'; ctx.beginPath(); ctx.arc(b.x + 14, GROUND - 38, 7, 0, 7); ctx.fill(); ctx.restore(); }
      } else {
        const p = fx.boom / 40, s = 160 + p * 380;
        art('explosion', b.x, GROUND - s * 0.4, s, { alpha: 1.4 - p * 1.4, rot: p * 0.3 });
      }
    },
  },
  // ChysteMc · SUN JOKE: carga una esfera de energía en la mano y se lanza contra el rival
  rasengan: {
    start(fx) { hold(fx.f, 'punchH'); fx.step = 'charge'; psfx('pw_sphere', 'super_start'); },
    update(fx) {
      const f = fx.f, o = fx.o;
      if (fx.step === 'charge' && fx.t >= 20) fx.step = 'dash';
      if (fx.step === 'dash') {
        f.x = Math.max(ARENA_L, Math.min(ARENA_R, f.x + 20 * fx.dir));
        if (Math.abs(o.x - f.x) < 95 && Math.abs(o.y - f.y) < 120) { fx.step = 'grind'; fx.t0 = fx.t; hold(o, 'hit'); }
        else if (fx.t > 50) { release(f); return true; }
      }
      if (fx.step === 'grind') {
        const k = fx.t - fx.t0;
        if (o.state !== 'held' && k < 30) hold(o, 'hit');
        if (k % 6 === 0 && k < 30) { if (!strike(fx, { dmg: 3.5, stun: 30, kb: 0, hitstop: 2 })) { release(f); return true; } hold(o, 'hit'); game.sparks(o.x, bodyY(o, 0.6), '#9fd0ff', 8); }
        if (k === 32) { game.shake(22); Audio.sfx('super_beam', 0.8); if (strike(fx, { dmg: 14, stun: 30, kb: 8, knockdown: true, hitstop: 18 })) { o.vx = fx.dir * 20; o.vy = 13; } release(f); return true; }
      }
      return false;
    },
    front(fx) {
      const f = fx.f, h = handOf(f), r = Math.min(46, 16 + fx.t * 1.6), t = fx.t;
      art('orb_blue', h.x, h.y, r * 3.2, { rot: -t * 0.35 * fx.dir });
    },
  },
  // Macrodee y Veiderr · 20KILLA: aparece su compañero de LEY 20MIL y lanzan juntos un rayo verde
  duo: {
    start(fx) {
      const f = fx.f; fx.partner = ROSTER.find(c => c.id === f.ch.super.partner);
      // si el rival es su propio compañero, aparece una copia con otra ropa
      if (fx.partner && fx.partner.id === (fx.o.ch.altOf || fx.o.ch.id)) fx.partner = altOf(fx.partner);
      // el compañero aparece detrás; si no cabe (de espaldas a la esquina) los dos se corren hacia adelante para verse enteros
      const m = 130, gap = 130;
      fx.px = Math.max(m, Math.min(W - m, f.x - fx.dir * gap));
      if (Math.abs(f.x - fx.px) < gap) f.x = Math.max(ARENA_L, Math.min(ARENA_R, fx.px + fx.dir * gap));
      hold(f, 'punchH');
      game.sparks(fx.px, bodyY(f), '#39ff6a', 16);
    },
    update(fx) {
      const t = fx.t;
      if (t === 18) { game.popText((fx.f.x + fx.px) / 2, bodyY(fx.f, 1.3), 'LEY 20MIL', '#39ff6a'); psfx('pw_beam2', 'super_beam'); }
      if (t >= 22 && t <= 72 && t % 5 === 2) {
        const y = bodyY(fx.f, 0.6), box = { x: fx.dir > 0 ? fx.f.x : 0, y: y - 70, w: fx.dir > 0 ? W - fx.f.x : fx.f.x, h: 120 };
        if (overlap(box, fx.o.hurtbox())) strike(fx, t >= 72 ? { dmg: 7, stun: 30, kb: 12, knockdown: true, hitstop: 14 } : { dmg: 2.7, stun: 22, kb: 1.5, hitstop: 2 });
      }
      // mientras dura el rayo: chispas eléctricas sobre el rival y temblor
      if (t >= 22 && t <= 74) {
        if (t % 3 === 0) game.sparks(fx.o.x - fx.dir * 20, bodyY(fx.o, 0.6) + rnd(-40, 40), t % 2 ? '#ffffff' : '#39ff6a', 5);
        if (t % 4 === 0) game.shake(5);
      }
      if (t === 76) release(fx.f);
      return t > 94;
    },
    back(fx) {
      const p = fx.partner, set = p && spriteSet(p); if (!set) return;
      const img = set.punchH || set.idle, k = spriteH(p) / set.idle.height, w = img.width * k, h = img.height * k;
      const a = Math.min(1, fx.t / 12, Math.max(0, (94 - fx.t) / 14));
      ctx.save(); ctx.globalAlpha = a; ctx.translate(fx.px, GROUND); ctx.scale(fx.dir, 1); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -w * (img._footX ?? 0.5), -h, w, h); ctx.restore();
    },
    front(fx) {
      if (fx.t < 22 || fx.t > 74) return;
      const t = fx.t - 22, end = fx.dir > 0 ? W + 40 : -40;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      // al encender: destello verde en toda la pantalla
      if (t < 6) { ctx.fillStyle = `rgba(120,255,160,${0.35 * (1 - t / 6)})`; ctx.fillRect(0, 0, W, H); }
      for (const [x0, y0] of [[fx.f.x + fx.dir * 60, bodyY(fx.f, 0.62)], [fx.px + fx.dir * 60, bodyY(fx.f, 0.66)]]) {
        // rayo grueso con halo y núcleo blanco
        const th = 78 + Math.sin(t * 0.9 + x0) * 14, g = ctx.createLinearGradient(0, y0 - th, 0, y0 + th);
        g.addColorStop(0, 'rgba(57,255,106,0)'); g.addColorStop(0.3, 'rgba(57,255,106,0.55)'); g.addColorStop(0.42, 'rgba(160,255,190,0.95)'); g.addColorStop(0.5, '#ffffff');
        g.addColorStop(0.58, 'rgba(160,255,190,0.95)'); g.addColorStop(0.7, 'rgba(57,255,106,0.55)'); g.addColorStop(1, 'rgba(57,255,106,0)');
        ctx.fillStyle = g; ctx.fillRect(Math.min(x0, end), y0 - th, Math.abs(end - x0), th * 2);
        // electricidad: relámpagos que saltan alrededor del rayo, nuevos en cada cuadro
        for (let n = 0; n < 4; n++) {
          ctx.strokeStyle = n % 2 ? '#eaffef' : '#7dff9e'; ctx.lineWidth = n % 2 ? 2 : 4; ctx.globalAlpha = 0.9;
          ctx.beginPath(); ctx.moveTo(x0, y0);
          for (let x = x0, s = 0; fx.dir > 0 ? x < end : x > end; s++) { x += fx.dir * rnd(26, 50); ctx.lineTo(x, y0 + rnd(-1, 1) * th * (0.5 + 0.6 * Math.random())); }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      // la bola de energía verde en las manos de los dos
      art('orb_green', fx.f.x + fx.dir * 60, bodyY(fx.f, 0.62), 110 + Math.sin(t) * 10);
      art('orb_green', fx.px + fx.dir * 60, bodyY(fx.f, 0.66), 110 + Math.cos(t) * 10);
    },
  },
  // Gran Rah · CÚSPIDE: el rival queda inmóvil, Rah sube una escalera de libros y se lanza desde la cima
  books: {
    start(fx) { const f = fx.f; fx.x0 = f.x; hold(f, 'jumpUp'); fx.guard = guarding(fx.o); if (!fx.guard) hold(fx.o, 'dizzy'); fx.steps = 6; psfx('pw_books', 'land'); },
    update(fx) {
      const f = fx.f, o = fx.o, t = fx.t, S = 34;
      if (t < 104 && o.state !== 'held' && !fx.guard) hold(o, 'dizzy');
      // destello al aparecer cada libro
      if (t % 9 === 1 && t < fx.steps * 9) { const i = (t - 1) / 9; game.sparks(fx.x0 + fx.dir * (48 + i * 30), GROUND - (i + 0.5) * S + 4, '#ffd65a', 10); }
      if (t < 56) {
        const i = Math.min(fx.steps - 1, Math.floor(t / 9)), u = (t % 9) / 9;
        f.x = fx.x0 + fx.dir * (34 + i * 30 + u * 30) * (t > 4 ? 1 : 0); f.y = (i + u) * S;
      } else if (t < 72) { f.fxPose = 'idle'; f.y = fx.steps * S; } // parado firme en el último libro
      else if (t < 104) {
        if (t === 72) { fx.lx = f.x; fx.tx = Math.max(ARENA_L, Math.min(ARENA_R, o.x - fx.dir * 30)); Audio.whoosh(); }
        const u = (t - 72) / 32; f.fxPose = u < 0.5 ? 'jumpFwd' : 'kickH';
        f.x = lerp(fx.lx, fx.tx, u); f.y = fx.steps * S * (1 - u) + Math.sin(u * Math.PI) * 140;
        fx.trail = fx.trail || []; fx.trail.unshift({ x: f.x, y: GROUND - f.y - spriteH(f.ch) * 0.5 }); fx.trail.length = Math.min(fx.trail.length, 10);
      } else if (t === 104) {
        f.y = 0; game.shake(24); Audio.sfx('fall');
        if (strike(fx, { dmg: 32, stun: 40, kb: 9, knockdown: true, hitstop: 20 })) { o.vx = fx.dir * 14; o.vy = 12; }
        release(f);
      }
      return t > 130;
    },
    back(fx) {
      const S = 34, t = fx.t, a = Math.min(1, Math.max(0, (112 - t) / 14));
      // escalera mágica: un libro dorado flotando por escalón, aparece con un destello y brilla
      for (let i = 0; i < fx.steps; i++) {
        const k = t - i * 9; if (k < 0) break;
        const x = fx.x0 + fx.dir * (34 + i * 30) + fx.dir * 14, y = GROUND - (i + 0.5) * S + 4 + Math.sin(t * 0.15 + i) * 2;
        const pop = Math.min(1, k / 5) * (1 + Math.max(0, 1 - k / 8) * 0.4);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.7;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 60 * pop);
        g.addColorStop(0, 'rgba(255,214,90,0.9)'); g.addColorStop(1, 'rgba(255,140,30,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 62 * pop, 30 * pop, 0, 0, 7); ctx.fill(); ctx.restore();
        art('book', x, y, (S + 4) * pop, { rot: Math.PI / 2, h: 74 * pop, alpha: a, flipX: i % 2 === 1 });
      }
      // en la cima: columna de luz sobre él antes de lanzarse
      if (t >= 56 && t < 76) {
        const f = fx.f, p = (t - 56) / 20, x = f.x;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.sin(p * Math.PI);
        const g = ctx.createLinearGradient(x - 70, 0, x + 70, 0);
        g.addColorStop(0, 'rgba(255,200,60,0)'); g.addColorStop(0.5, 'rgba(255,240,180,0.85)'); g.addColorStop(1, 'rgba(255,200,60,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 70, 0, 140, GROUND - f.y); ctx.restore();
      }
      // la caída: estela de cometa dorado detrás de él (sin el punto actual, que lo taparía)
      if (t >= 72 && t < 104 && fx.trail) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        fx.trail.forEach((p, i) => { if (i < 2) return; ctx.globalAlpha = 0.6 - i * 0.05; ctx.fillStyle = i < 4 ? '#fff4c2' : '#ffb02e'; ctx.beginPath(); ctx.arc(p.x, p.y, 50 - i * 4, 0, 7); ctx.fill(); });
        ctx.restore();
      }
    },
    front(fx) {
      const t = fx.t;
      // el impacto: onda expansiva, explosión dorada y hojas volando
      if (t >= 104 && t < 130) {
        const k = (t - 104) / 26, x = fx.tx;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#ffd65a'; ctx.lineWidth = 14 * (1 - k);
        ctx.beginPath(); ctx.ellipse(x, GROUND - 6, 40 + k * 320, 10 + k * 50, 0, 0, 7); ctx.stroke(); ctx.restore();
        art('explosion', x, GROUND - 90 - k * 30, 200 + k * 220, { alpha: 1.2 - k * 1.2 });
        for (let i = 0; i < 8; i++) { const a = i * 0.8 + 0.3; art('paper', x + Math.cos(a) * k * 260, GROUND - 60 - Math.abs(Math.sin(a)) * k * 220, 40, { rot: k * 6 + i, alpha: 1 - k }); }
      }
    },
  },
  // Ceaese · UTOPÍA: ráfaga de rayos de todos los colores desde sus manos
  rainbow: {
    start(fx) { hold(fx.f, 'punchH'); psfx('pw_rainbow', 'super_beam'); },
    update(fx) {
      const t = fx.t;
      if (t >= 6 && t <= 66 && t % 5 === 1) {
        const y = bodyY(fx.f, 0.62), box = { x: fx.dir > 0 ? fx.f.x : 0, y: y - 80, w: fx.dir > 0 ? W - fx.f.x : fx.f.x, h: 160 };
        if (overlap(box, fx.o.hurtbox())) strike(fx, t >= 66 ? { dmg: 6, stun: 30, kb: 12, knockdown: true, hitstop: 14 } : { dmg: 2.4, stun: 20, kb: 1.2, hitstop: 2, heavy: false });
      }
      if (t === 70) release(fx.f);
      return t > 72;
    },
    front(fx) {
      if (fx.t < 6 || fx.t > 68) return;
      const h = handOf(fx.f), end = fx.dir > 0 ? W + 40 : -40;
      ctx.save(); ctx.lineCap = 'round';
      for (let k = 0; k < 7; k++) {
        const hue = (fx.t * 14 + k * 51) % 360, off = Math.sin(fx.t * 0.5 + k * 1.7) * 60;
        ctx.strokeStyle = `hsla(${hue},100%,55%,0.9)`; ctx.lineWidth = 8 + (k % 3) * 5;
        ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.quadraticCurveTo((h.x + end) / 2, h.y + off, end, h.y + off * 0.6); ctx.stroke();
      }
      ctx.restore();
      art('holy', h.x, h.y, 120 + Math.sin(fx.t * 0.8) * 20, { rot: fx.t * 0.1 });
    },
  },
  // El Bruto · LA EJECUCIÓN: prende un cigarro (no recibe daño) y sopla; si el humo lo atrapa,
  // lo muele con 12 golpes rápidos dentro de la nube y lo manda volando a la otra esquina
  smoke: {
    // durante todo el poder (prender, fumar, soplar y la paliza de humo) no recibe daño
    start(fx) { fx.dir = Math.sign(fx.o.x - fx.f.x) || fx.dir; fx.f.facing = fx.dir; hold(fx.f, 'smoke1'); fx.f.invuln = 130; fx.puffs = []; fx.hits = 0; },
    update(fx) {
      const f = fx.f, o = fx.o, t = fx.t, m = smokeMouth(f, fx.dir, t < 80);
      if (t < 80 && t % 6 === 0) fx.puffs.push({ x: m.x, y: m.y, vx: rnd(-0.4, 0.4), vy: -1.2, r: 6, life: 50 });
      if (t >= 80 && t < 92 && t % 3 === 0) fx.puffs.push({ x: m.x, y: m.y, vx: fx.dir * rnd(12, 13.5), vy: (bodyY(o, 0.6) - m.y) / 25 + rnd(-0.5, 0.5), r: 16, life: 70, blow: true });
      if (t === 30) psfx('pw_smoke', 'whoosh'); if (t === 80) { Audio.sfx('whoosh', 0.8); f.fxPose = 'smoke2'; }
      // el primer golpe de humo se puede bloquear; si entra, queda atrapado en la nube
      const catchHim = () => {
        fx.hit = true;
        if (strike(fx, { dmg: 3.2, stun: 40, kb: 0, hitstop: 4, at: { x: o.x, y: bodyY(o, 0.6) } })) { fx.caught = t; fx.hits = 1; hold(o, 'hit'); f.invuln = 140; }
      };
      for (const p of fx.puffs) {
        p.x += p.vx; p.y += p.vy; p.r += p.blow ? 1.1 : 0.25; p.life--;
        // el humo que ya pasó de largo (saltó por encima) ya no lo atrapa
        if (p.blow && (fx.dir > 0 ? p.x - p.r > o.x + 30 : p.x + p.r < o.x - 30)) p.spent = true;
        if (p.blow && !p.spent && !fx.hit && o.invuln <= 0 && o.y < 15 && overlap({ x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 }, o.hurtbox())) catchHim();
      }
      // pegado a él (o detrás de la bocanada) el humo igual lo alcanza
      if (!fx.hit && t >= 84 && Math.abs(o.x - f.x) < 120 && o.y < 40 && o.invuln <= 0) catchHim();
      if (fx.caught !== undefined && fx.hits < 12) {
        const k = t - fx.caught;
        if (o.state !== 'held' && fx.hits < 12) hold(o, 'hit');
        // la nube lo envuelve mientras le llueven los golpes
        if (k % 2 === 0) fx.puffs.push({ x: o.x + rnd(-50, 50), y: bodyY(o, rnd(0.2, 0.9)), vx: rnd(-1.5, 1.5), vy: rnd(-1.5, 0.5), r: rnd(14, 22), life: 26 });
        if (k > 0 && k % 4 === 0) {
          fx.hits++; const last = fx.hits === 12, at = { x: o.x + rnd(-30, 30), y: bodyY(o, rnd(0.3, 0.8)) };
          o.x += fx.dir * (last ? 0 : 2);
          game.sparks(at.x, at.y, '#d9a92b', last ? 30 : 8);
          if (!strike(fx, last ? { dmg: 10, stun: 40, kb: 12, knockdown: true, hitstop: 18, unblockable: true, at }
                               : { dmg: 3.2, stun: 40, kb: 0, hitstop: 2, unblockable: true, at })) fx.hits = 12;
          else if (last) {
            // a la otra esquina: vuelo de ~31 cuadros y lo que resbala al caer
            const wall = fx.dir > 0 ? ARENA_R : ARENA_L;
            o.vy = 14; o.vx = fx.dir * Math.max(12, Math.abs(wall - o.x) / 33);
            game.shake(26); game.popText(o.x, bodyY(o, 1.2), '¡EJECUTADO!', '#d9a92b');
          } else hold(o, 'hit');
        }
      }
      fx.puffs = fx.puffs.filter(p => p.life > 0);
      const end = fx.caught !== undefined ? Math.max(112, fx.caught + 60) : 112;
      if (t === end) release(f);
      return t > end && !fx.puffs.length;
    },
    front(fx) {
      const f = fx.f;
      // brasa del cigarro (solo si no hay dibujo de él fumando)
      const set = spriteSet(f.ch);
      if (fx.t < 80 && !(set && set.smoke1)) { const m = smokeMouth(f, fx.dir, true); ctx.fillStyle = fx.t % 10 < 5 ? '#ff7a1a' : '#ffd23f'; ctx.beginPath(); ctx.arc(m.x + fx.dir * 12, m.y, 5, 0, 7); ctx.fill(); }
      for (const p of fx.puffs) art('smoke', p.x, p.y, p.r * 2.6, { alpha: Math.min(0.8, p.life / 50), rot: p.x * 0.01 });
    },
  },
  // Claudio Bastardo · RÁFAGA DE VÓMITO: vomita una ráfaga de bolas que caen al suelo en charcos
  vomit: {
    start(fx) { hold(fx.f, 'vomit'); psfx('pw_vomit', 'special_wave'); fx.puddles = []; fx.splats = []; },
    update(fx) {
      const f = fx.f, o = fx.o, t = fx.t;
      if (t >= 6 && t <= 6 + 7 * 6 && (t - 6) % 6 === 0) {
        const n = (t - 6) / 6;
        fx.items.push({ x: f.x + fx.dir * spriteH(f.ch) * 0.3, y: bodyY(f, 0.72), vx: fx.dir * rnd(12, 15), vy: rnd(-3, -1), rot: rnd(0, 6), n });
      }
      if (t === 56) release(f);
      for (const b of fx.items) {
        if (b.gone) continue;
        b.vy += 0.28; b.x += b.vx; b.y += b.vy; b.rot += 0.2 * fx.dir;
        if (!b.hit && overlap({ x: b.x - 40, y: b.y - 26, w: 80, h: 52 }, o.hurtbox())) {
          b.hit = b.gone = true; const last = b.n === 7;
          strike(fx, { dmg: last ? 6 : 3, stun: 18, kb: last ? 9 : 1.5, knockdown: last, hitstop: 3, at: { x: b.x, y: b.y } });
          fx.splats.push({ x: b.x, y: b.y, t: 0 });
        }
        if (b.y > GROUND - 14) { b.gone = true; fx.puddles.push({ x: b.x, t: 0 }); fx.splats.push({ x: b.x, y: GROUND - 30, t: 0 }); }
        if (b.x < -60 || b.x > W + 60) b.gone = true;
      }
      fx.splats.forEach(s => s.t++); fx.splats = fx.splats.filter(s => s.t < 14);
      fx.puddles.forEach(p => p.t++);
      return t > 150 && fx.items.every(b => b.gone);
    },
    back(fx) {
      for (const p of fx.puddles) art('vomit_puddle', p.x, GROUND - 8, 170, { alpha: Math.min(1, (150 - fx.t) / 20 + 0.0) });
    },
    front(fx) {
      for (const b of fx.items) if (!b.gone) art('vomit_ball', b.x, b.y, 115, { rot: Math.atan2(b.vy, Math.abs(b.vx)) * fx.dir, flipX: fx.dir < 0 });
      for (const s of fx.splats) art('vomit_splash', s.x, s.y, 90 + s.t * 9, { alpha: 1 - s.t / 14 });
    },
  },

  // Claudio Bastardo · ÑAAAAA: grita con todo su poder y el grito viaja en letras gigantes que golpean al rival
  scream: {
    start(fx) { hold(fx.f, 'scream'); psfx('pw_scream', 'super_beam');
      // la primera letra que sale queda adelante: el orden se arma para que siempre se lea ÑAAAAA
      fx.letters = fx.dir > 0 ? 'AAAAAÑ'.split('') : 'ÑAAAAA'.split(''); },
    update(fx) {
      const f = fx.f, o = fx.o, t = fx.t;
      if (t < 80) game.shake(5);
      if (t >= 8 && t <= 8 + 5 * 11 && (t - 8) % 11 === 0) {
        const n = (t - 8) / 11;
        fx.items.push({ ch: fx.letters[n], n, x: f.x + fx.dir * spriteH(f.ch) * 0.3, y: bodyY(f, 0.78), vx: fx.dir * 13, t: 0 });
      }
      if (t === 90) release(f);
      for (const L of fx.items) {
        if (L.gone) continue;
        L.t++; L.x += L.vx; L.y += Math.sin(L.t * 0.35 + L.n) * 1.5;
        const s = Math.min(170, 70 + L.t * 6);
        if (!L.hit && overlap({ x: L.x - s * 0.3, y: L.y - s * 0.4, w: s * 0.6, h: s * 0.8 }, o.hurtbox())) {
          L.hit = true; const last = L.n === 5;
          strike(fx, { dmg: last ? 10 : 5.5, stun: 26, kb: last ? 14 : 2, knockdown: last, hitstop: last ? 16 : 5, at: { x: L.x, y: L.y } });
          game.sparks(L.x, L.y, '#ffb300', 12);
          if (last) { o.vx = fx.dir * 18; o.vy = 12; }
        }
        if (L.x < -200 || L.x > W + 200) L.gone = true;
      }
      return t > 90 && fx.items.every(L => L.gone);
    },
    front(fx) {
      const f = fx.f;
      // ondas del grito saliendo de la boca
      if (fx.t < 80) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,220,120,0.6)'; ctx.lineWidth = 6;
        const mx = f.x + fx.dir * spriteH(f.ch) * 0.3, my = bodyY(f, 0.78);
        for (let i = 0; i < 3; i++) { const r = ((fx.t * 6 + i * 40) % 120) + 20; ctx.globalAlpha = 1 - r / 140; ctx.beginPath(); ctx.arc(mx, my, r, fx.dir > 0 ? -0.8 : Math.PI - 0.8, fx.dir > 0 ? 0.8 : Math.PI + 0.8); ctx.stroke(); }
        ctx.restore();
      }
      for (const L of fx.items) {
        if (L.gone) continue;
        const s = Math.min(170, 70 + L.t * 6);
        ctx.save(); ctx.translate(L.x, L.y); ctx.rotate(Math.sin(L.t * 0.3 + L.n) * 0.12);
        ctx.font = `400 ${s}px "Bungee Shade", "Bungee", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        // estela de velocidad
        for (let k = 3; k >= 1; k--) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#ff7a1a'; ctx.fillText(L.ch, -fx.dir * k * 16, 0); }
        ctx.globalAlpha = 1; ctx.lineWidth = s * 0.08; ctx.strokeStyle = '#120c14'; ctx.strokeText(L.ch, 0, 0);
        const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2); g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ffb300'); g.addColorStop(1, '#ff5a1a');
        ctx.fillStyle = g; ctx.fillText(L.ch, 0, 0);
        ctx.restore();
      }
    },
  },

  // Jack Dee · DÉJENME EN PAZ: vestido de pastor lanza la prédica desde la Biblia
  bible: {
    // pose de pastor de perfil (sprite preach) y la prédica sale desde la Biblia: ch.super.origin = [adelante, alto] en fracciones del alto del dibujo
    start(fx) { hold(fx.f, 'preach'); psfx('pw_holy', 'super_beam'); },
    update(fx) {
      const t = fx.t;
      if (t === 14) game.popText(fx.f.x, bodyY(fx.f, 1.25), '¡ARREPIÉNTETE!', '#ffe9a0');
      if (t >= 16 && t <= 70 && t % 5 === 1) {
        const y = bibleOf(fx).y, box = { x: fx.dir > 0 ? fx.f.x : 0, y: y - 70, w: fx.dir > 0 ? W - fx.f.x : fx.f.x, h: 140 };
        if (overlap(box, fx.o.hurtbox())) strike(fx, t >= 66 ? { dmg: 7, stun: 30, kb: 12, knockdown: true, hitstop: 14 } : { dmg: 2.6, stun: 20, kb: 1.2, hitstop: 2 });
      }
      if (t === 74) { game.popText(fx.f.x, bodyY(fx.f, 1.25), '¡AMÉN!', '#ffe9a0'); release(fx.f); }
      return t > 76;
    },
    front(fx) {
      if (fx.t < 16 || fx.t > 72) return;
      const { x: x0, y: y0 } = bibleOf(fx), end = fx.dir > 0 ? W + 40 : -40, t = fx.t;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const th = 90 + Math.sin(t * 0.7) * 14, g = ctx.createLinearGradient(0, y0 - th / 2, 0, y0 + th / 2);
      g.addColorStop(0, 'rgba(255,233,160,0)'); g.addColorStop(0.3, 'rgba(255,215,106,0.8)'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.7, 'rgba(255,215,106,0.8)'); g.addColorStop(1, 'rgba(255,233,160,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, y0 - 12); ctx.lineTo(end, y0 - th / 2); ctx.lineTo(end, y0 + th / 2); ctx.lineTo(x0, y0 + 12); ctx.fill();
      ctx.restore();
      art('holy', x0, y0, 150 + Math.sin(t * 0.5) * 20, { rot: t * 0.05 });
      for (let i = 0; i < 5; i++) { const x = x0 + fx.dir * (((t * 14 + i * 170) % 1000)), y = y0 + Math.sin(i * 2 + t * 0.2) * 20; art('cross', x, y, 54); }
    },
  },
};

const game = {
  f: [], projectiles: [], particles: [], texts: [], powers: [], phase: 'menu', time: 0, timer: ROUND_TIME,
  round: 1, wins: [0, 0], shakeAmt: 0, hitstop: 0, superActor: null, superT: 0, paused: false,
  stage: STAGES[0], nextStage: null, banner: null, slowmo: 0, crowdHype: 0,
  cam: { z: 1, tz: 1, fx: W / 2, fy: H / 2, rot: 0, hold: 0, flash: 0 },

  // opts: { level: nivel de la CPU (0 a 1), practice: sin reloj, vida y barra infinitas }
  start(c1, c2, vsCpu, opts = {}) {
    this.cfg = { c1, c2, vsCpu, opts }; // para "reiniciar pelea"
    this.practice = !!opts.practice;
    // el mismo rapero en los dos lados: el segundo sale con otra ropa
    if (c2.id === c1.id) c2 = altOf(c2);
    // 20KILLA contra su propio compañero: se prepara la copia con otra ropa
    for (const [a, b] of [[c1, c2], [c2, c1]]) if (a.super.kind === 'duo' && a.super.partner === b.id) altOf(b);
    this.f = [new Fighter(c1, 0, false), new Fighter(c2, 1, vsCpu)];
    this.f.forEach(f => f.meter = 0);
    if (opts.level != null && this.f[1].ai && !this.f[1].boss) this.f[1].ai.level = opts.level;
    this.wins = [0, 0]; this.round = 1; this.vsCpu = vsCpu;
    // contra un rival con escenario propio (el jefe) se pelea en su casa; si lo juegas tú, el escenario es al azar
    this.stage = this.nextStage || pickStage(c1, c2, vsCpu, true); this.nextStage = null;
    this.startRound();
    // jefe y retador secreto tienen su propia música
    Audio.playMusic((vsCpu ? [c2] : [c1, c2]).some(c => c.boss || c.secret) ? 'boss' : this.stage.music || Audio.nextFight());
  },
  startRound() {
    this.f.forEach(f => f.reset());
    this.projectiles = []; this.particles = []; this.texts = []; this.powers = [];
    this.timer = ROUND_TIME; this.phaseT = 0; this.phase = 'intro';
    this.superActor = null; this.hitstop = 0; this.slowmo = 0;
    this.cam = { z: 1, tz: 1, fx: W / 2, fy: H / 2, rot: 0, hold: 0, flash: 0 }; this.comboBanner = null; this.finalKo = null;
    // el round decisivo (los dos a una victoria) es el "round final"
    const final = this.wins.every(w => w === ROUNDS_TO_WIN - 1) && this.round > 1;
    this.banner = { text: final ? 'ROUND FINAL' : 'ROUND ' + this.round, img: 'round' + Math.min(3, this.round), sub: this.stage.name, t: 0 };
    this.saidVamos = false;
    Audio.voice(final ? 'roundFinal' : this.round === 1 ? 'round1' : 'round2', 'Round ' + this.round);
  },
  shake(n) {
    this.shakeAmt = Math.max(this.shakeAmt, n);
    // los golpes de poder mueven toda la pantalla: un tirón de cámara (zoom y giro leve) además del temblor
    const c = this.cam; if (!c || n < 14) return;
    c.rot = (Math.random() < 0.5 ? -1 : 1) * Math.min(0.035, n * 0.0011);
    c.z = Math.max(c.z, 1 + Math.min(0.12, n * 0.0035));
  },
  // cámara: acerca la imagen a un punto (k = zoom) durante "hold" cuadros
  focus(x, y, k, hold) { const c = this.cam; if (!c) return; c.fx = x; c.fy = y; c.tz = k; c.hold = hold; },
  // líneas de impacto que salen del punto del golpe
  burst(x, y, color, n = 12, len = 90) { this.particles.push({ x, y, life: 12, max: 12, color, size: len, n, rot: Math.random(), kind: 'burst' }); },

  hit(att, def, o) {
    // tras un K.O. ya no cuenta nada (antes un proyectil en vuelo podía dar el round a los dos);
    // en el suelo o levantándose no se recibe daño
    if (this.phase !== 'fight' || ['ko', 'down', 'getup'].includes(def.state)) return;
    // práctica: nadie cae por K.O.; la vida se rellena justo antes del golpe que lo botaría
    if (this.practice) { def.lastHit = this.time; if (def.hp < (o.dmg || 0) * 1.6 + 4) { def.hp = def.maxHp; def.hpLag = def.maxHp; } }
    if (curFx && curFx.f === att && POWER_SCALE[curFx.kind] && o.dmg) o = { ...o, dmg: o.dmg * POWER_SCALE[curFx.kind] };
    // invulnerable (el Bruto prendiendo el cigarro): el golpe no le hace nada
    if (def.invuln > 0) { this.sparks(def.x, GROUND - def.y - 120, '#c9d0c9', 6); Audio.block(); return; }
    // un golpe bajo (barrida) solo se cubre agachado
    const blocked = !o.unblockable && def.grounded && def.blocking && !['hit', 'attack', 'held', 'dizzy'].includes(def.state) && (!o.low || def.state === 'crouch' || (def.state === 'blockstun' && def.lowGuard));
    if (blocked) def.lowGuard = def.state === 'crouch' || (def.state === 'blockstun' && def.lowGuard);
    const at = o.at || { x: def.x, y: GROUND - def.y - 120 };
    if (blocked) {
      def.hp -= o.dmg * (o.chip ?? 0.12);
      def.setState('blockstun'); def.stun = Math.round(o.stun * 0.6); def.vx = -def.facing * o.kb * 0.8;
      addMeter(def, 4);
      this.hitstop = Math.max(this.hitstop, 3);
      this.sparks(at.x, at.y, '#9fd8ff', 6); Audio.block();
      if (def.hp <= 0) this.ko(att, def);
      return 'block';
    } else if (def.state === 'held' && this.powers.some(fx => fx.f === def)) {
      // lanzando su propio poder (Jack Dee predicando, etc.): recibe el daño pero no pierde la pose ni corta el poder
      def.hp -= o.dmg; def.flash = 6;
      this.hitstop = Math.max(this.hitstop, 3); this.sparks(at.x, at.y, att.ch.accent, 10); Audio.hit(o.heavy, o.move);
      if (!o.noMeter) addMeter(att, ((o.meter ?? 0) * 1.2 + o.dmg * 0.6) * 1.5);
    } else if (def.boss && def.state === 'attack' && o.move && !MOVES[o.move].knockdown && o.move !== 'punchH') {
      // armadura del jefe: los golpes suaves le hacen daño pero no le cortan el ataque
      def.hp -= o.dmg * 0.8; def.flash = 6;
      this.hitstop = Math.max(this.hitstop, 3); this.sparks(at.x, at.y, '#d9a92b', 8); Audio.block();
      this.popText(at.x, at.y - 40, '¡NI LO SINTIÓ!', '#d9a92b');
    } else {
      def.hp -= o.dmg * (def.boss ? 0.85 : 1); def.flash = 6;
      const wasDizzy = def.state === 'dizzy', wasHit = def.state === 'hit' || (!def.grounded && def.combo > 0);
      def.setState('hit'); def.stun = o.stun; def.move = null;
      def.vx = att.facing * o.kb;
      if (o.launch || !def.grounded) { def.vy = o.launch || 8; def.y = Math.max(def.y, 1); }
      // mucho daño seguido marea (pajaritos); un golpe al mareado lo despierta
      def.dizzyDmg += o.dmg;
      if (!wasDizzy && def.dizzyDmg >= DIZZY_LIMIT) def.pendingDizzy = true;
      // la patada fuerte bota al rival: cae al suelo y se levanta
      if (o.knockdown) { def.setState('down'); def.vy = 9; def.y = Math.max(def.y, 1); def.pendingDizzy = false; this.popText(at.x, at.y - 50, '¡AL SUELO!', '#fff'); }
      // el combo sigue solo si el rival todavía no se recuperaba del golpe anterior (antes contaba también después de botarlo)
      att.combo = wasHit ? att.combo + 1 : 1; def.combo = 1;
      // golpes de este combo, en orden; si calzan con una secuencia de COMBOS, remate
      att.chain = att.combo === 1 || !att.chain ? [] : att.chain;
      if (o.move) att.chain.push(o.move);
      const cmb = o.move && COMBOS.find(c => c.seq.length <= att.chain.length && c.seq.every((m, i) => att.chain[att.chain.length - c.seq.length + i] === m));
      if (cmb) { att.chain = []; this.comboFinish(att, def, cmb, at); }
      if (o.move) {
        // contra la pared el rival no puede retroceder: el que pega sale empujado hacia atrás
        const cornered = att.facing > 0 ? ARENA_R - def.x < 70 : def.x - ARENA_L < 70;
        if (cornered) att.vx = -att.facing * Math.max(5, o.kb * 1.2);
        // cada golpe extra del combo aturde menos, así hay una ventana para cubrirse
        if (att.combo >= 3 && def.state === 'hit') def.stun = Math.round(def.stun * Math.max(0.45, 1 - (att.combo - 2) * 0.15));
        // con 6 golpes seguidos se libera: queda un instante intocable y el atacante sale despedido
        if (att.combo >= COMBO_BREAK && def.state === 'hit') { def.invuln = 28; def.stun = Math.min(def.stun, 8); att.vx = -att.facing * 13; this.popText(def.x, GROUND - 260, '¡ZAFÓ!', '#9fd8ff'); }
        // si los golpes van armando un combo de COMBOS, el rival queda aturdido mientras el que pega siga atacando
        // (se suelta si deja de pegar; ver chainHold en update). Así el combo sale aunque el control llegue con retraso.
        else if (def.state === 'hit' && !cmb && COMBOS.some(c => { for (let k = Math.min(att.chain.length, c.seq.length - 1); k >= 1; k--) if (c.seq.slice(0, k).every((m, i) => att.chain[att.chain.length - k + i] === m)) return true; return false; })) { def.stun = Math.max(def.stun, 44); def.chainHold = true; att.chainIdle = 0; def.vx *= 0.35; } // empuje corto: que el golpe siguiente alcance
        else def.chainHold = false;
      }
      // las barras se llenan pegando y también recibiendo (y se guardan entre rounds)
      if (!o.noMeter) addMeter(att, ((o.meter ?? 0) * 1.2 + o.dmg * 0.6) * 1.5);
      addMeter(def, o.dmg * 0.9);
      this.hitstop = Math.max(this.hitstop, o.hitstop);
      this.shake(o.heavy ? 10 : 5);
      this.sparks(at.x, at.y, att.ch.accent, o.heavy ? 24 : 10, o.heavy ? 1.6 : 1);
      // golpe fuerte: líneas de impacto y un cuadro blanco cortito
      if (o.heavy || o.knockdown) { this.burst(at.x, at.y, att.ch.accent, 14, o.knockdown ? 150 : 110); this.cam.flash = Math.max(this.cam.flash, 3); }
      else if (att.combo >= 3) this.burst(at.x, at.y, '#ffffff', 8, 70);
      Audio.hit(o.heavy, o.move);
      // anunciador: "¡VAMOS!" con el primer golpe del round y "¡COMBO!" al tercer golpe seguido
      if (att.combo === 3 && !cmb) Audio.voice('combo');
      else if (!this.saidVamos) { this.saidVamos = true; Audio.voice('vamos'); }
      this.crowdHype = Math.min(1, this.crowdHype + 0.15);
      if (att.combo >= 2) this.popText(att.idx === 0 ? 210 : W - 210, 260, att.combo + ' HITS', att.ch.accent);
      else if (o.heavy && Math.random() < 0.35) this.popText(at.x, at.y - 40, ['¡PAM!', '¡PUM!', '¡ZAS!', '¡TOMA!'][Math.floor(Math.random() * 4)], '#fff');
    }
    if (def.hp <= 0) this.ko(att, def);
  },
  // remate de combo: daño extra, el rival sale volando, cámara encima y el nombre del combo en grande
  comboFinish(att, def, c, at) {
    const col = att.ch.accent;
    def.hp -= c.bonus * att.stats.power * (def.boss ? 0.85 : 1);
    def.setState('down'); def.vy = 13; def.vx = att.facing * 11; def.y = Math.max(def.y, 1); def.pendingDizzy = false;
    addMeter(att, 25);
    this.hitstop = Math.max(this.hitstop, 16); this.shake(22);
    this.focus((att.x + def.x) / 2, at.y, 1.22, 26); this.cam.flash = 6;
    this.burst(at.x, at.y, '#ffffff', 20, 210); this.burst(at.x, at.y, col, 14, 150);
    this.sparks(at.x, at.y, col, 30, 1.8);
    this.comboBanner = { text: comboName(att.ch, c), n: c.seq.length, color: col, side: att.idx, t: 0 };
    Audio.voice('combo'); Audio.sfx('super_start', 0.6);
  },
  ko(att, def) {
    def.hp = 0; def.setState('ko'); def.vy = 11; def.y = Math.max(def.y, 1); def.vx = att.facing * 9;
    this.phase = 'ko'; this.phaseT = 0; this.hitstop = 20; this.shake(18);
    this.wins[att.idx]++;
    att.matchWin = this.wins[att.idx] >= ROUNDS_TO_WIN;
    // el K.O. va arriba para no tapar a los luchadores
    this.banner = { text: 'K.O.', t: 0, big: true, y: 130 };
    this.cam.flash = 8; this.burst(def.x, bodyY(def, 0.6), '#ffffff', 22, 260); this.burst(def.x, bodyY(def, 0.6), att.ch.accent, 16, 180);
    if (att.matchWin) {
      // K.O. que gana la pelea: cámara lenta larga, fondo oscuro con rayos del color del ganador
      // y un acercamiento suave que deja a los dos de cuerpo entero bajo el cartel
      this.slowmo = 120;
      this.finalKo = { t: 0, color: att.ch.accent, x: def.x, y: bodyY(def, 0.55) };
      this.focus((att.x + def.x) / 2, GROUND - spriteH(def.ch) * 0.5 - 40, 1.12, 120);
      this.banner.sub = '¡' + att.ch.name + ' GANA LA PELEA!';
    } else this.slowmo = 60; // round normal: cámara lenta corta, sin zoom
    Audio.ko(); Audio.voice('ko', 'K O');
  },
  timeUp() {
    const [a, b] = this.f, ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
    this.phase = 'ko'; this.phaseT = 0;
    if (Math.abs(ra - rb) < 0.001) { this.banner = { text: 'EMPATE', t: 0, big: true }; }
    else { const w = ra > rb ? a : b; this.wins[w.idx]++; w.matchWin = this.wins[w.idx] >= ROUNDS_TO_WIN; this.banner = { text: 'TIEMPO', t: 0, big: true }; }
    Audio.voice('time', 'Tiempo');
  },
  // burla: sin texto ni voz sintética; solo suena el audio propio si el personaje lo tiene (ch.taunt.audio)
  taunt(f) {
    if (f.ch.taunt && f.ch.taunt.audio && !Audio.muted) { try { new window.Audio(f.ch.taunt.audio).play(); } catch (e) { /* sin audio */ } }
  },
  // super (3 barras): se congela todo y entra la pose de poder máximo con el nombre del super
  startSuper(f) {
    this.superActor = f; this.superT = 0; this.banner = null;
    this.shake(8);
  },
  // poder especial (2 barras): destello corto con su nombre y un proyectil gigante que bota
  startEx(f) {
    this.superActor = f; this.superT = 0;
    this.banner = { text: exOf(f.ch).name, sub: f.ch.name + ' · PODER ESPECIAL', t: 0, superBanner: true, color: exOf(f.ch).color, dur: MOVES.ex.startup };
    this.shake(6);
  },
  spawnProjectile(f, big) {
    const h = f.handPos(), sp = f.ch.special, k = big ? 1.9 : 1;
    this.projectiles.push({ owner: f, x: h.x + 20 * f.facing * k, y: big ? GROUND - f.y - 120 : h.y, vx: sp.speed * f.facing * (big ? 1.25 : 1), vy: 0, type: sp.type, color: big ? exOf(f.ch).color : sp.color, dmg: (big ? 20 : 11) * f.stats.power, life: 150, r: 26 * k, scale: k, big, t: 0 });
  },
  spawnRain(f) {
    const o = f.opp, sp = f.ch.super;
    this.projectiles.push({ owner: f, x: o.x + (Math.random() - 0.5) * 140, y: -40, vx: 0, vy: 14, type: f.ch.special.type, color: sp.color, dmg: 3.2 * f.stats.power, life: 100, r: 22, t: 0, rain: true });
  },
  sparks(x, y, color, n, big = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (3 + Math.random() * 9) * big;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 18 + Math.random() * 12, max: 30, color, size: (3 + Math.random() * 4) * big, kind: 'spark' });
    }
    this.particles.push({ x, y, life: 10, max: 10, color: '#fff', size: 50 * big, kind: 'ring' });
  },
  popText(x, y, text, color) { this.texts.push({ x, y, text, color, t: 0 }); },

  update() {
    this.time++;
    if (this.paused) return;
    Audio.music();
    if (this.phase === 'menu' || this.phase === 'over') return;
    if (this.banner) this.banner.t++;
    if (this.banner && this.banner.t > (this.banner.dur || (this.banner.superBanner ? 55 : 95))) this.banner = null;
    this.shakeAmt *= 0.85;
    this.crowdHype *= 0.995;

    if (this.phase === 'intro') {
      this.phaseT++;
      if (this.phaseT === 70) { this.banner = { text: '¡PELEA!', img: 'pelea', t: 0, big: true }; Audio.voice('fight', 'Pelea'); }
      if (this.phaseT >= 100) this.phase = 'fight';
    }
    if (this.hitstop > 0) { this.hitstop--; this.updateFx(); return; }
    if (this.slowmo > 0) { this.slowmo--; if (this.slowmo % 3) { this.updateFx(); return; } }

    // poder especial / super: congela al rival durante la pose
    const sa = this.superActor;
    if (sa) {
      this.superT++;
      if (sa.move === 'super' && this.superT === 16) { Audio.hit(true); this.shake(14); }
      // al salir de la pose de poder la cámara se acerca al que lanza el super (y al especial, un poco menos)
      if (sa.move === 'super' && this.superT === SUPER_CUTIN) { this.focus(sa.x, bodyY(sa, 0.55), 1.28, 34); this.cam.flash = 5; }
      if (sa.move === 'ex' && this.superT === 1) this.focus(sa.x, bodyY(sa, 0.55), 1.16, 26);
      if (sa.state !== 'attack' || this.superT > MOVES[sa.move].startup) this.superActor = null;
    }

    for (const f of this.f) f.input = f.ai && this.phase === 'fight' ? f.ai.input() : (this.phase === 'fight' ? humanInput(f.idx) : { held: {}, pressed: [] });
    if (this.phase !== 'fight') { pressedQueue[0].length = 0; pressedQueue[1].length = 0; }
    for (const f of this.f) { if (sa && f !== sa) continue; f.update(); }

    // separación de cuerpos
    // (el que va saltando por arriba no empuja: así se puede cruzar al otro lado y salir de la esquina)
    const [a, b] = this.f, dx = b.x - a.x, minD = 58 * SIZE;
    if (Math.abs(dx) < minD && Math.abs(a.y - b.y) < 50 && a.state !== 'ko' && b.state !== 'ko' && a.state !== 'held' && b.state !== 'held') {
      const s = Math.sign(dx || (b.vx - a.vx) || 1), push = (minD - Math.abs(dx)) / 2 * s;
      a.x = Math.max(ARENA_L, Math.min(ARENA_R, a.x - push)); b.x = Math.max(ARENA_L, Math.min(ARENA_R, b.x + push));
      // contra la pared, lo que no se pudo correr uno lo corre el otro
      if (Math.abs(b.x - a.x) < minD) { if (a.x === ARENA_L || a.x === ARENA_R) b.x = a.x + minD * s; else a.x = b.x - minD * s; }
    }

    if (!sa) { this.updateProjectiles(); this.updatePowers(); }
    this.updateFx();

    if (this.phase === 'fight') {
      // práctica: sin reloj, barra siempre llena y la vida vuelve sola a los 2 segundos sin recibir golpes
      if (this.practice) for (const f of this.f) { f.meter = METER_MAX; if (this.time - (f.lastHit || 0) > 120 && f.hp < f.maxHp) { f.hp = f.maxHp; f.hpLag = f.maxHp; } }
      if (this.time % 60 === 0 && this.timer > 0 && !this.practice) {
        this.timer--;
        if (this.timer > 0 && this.timer <= 5) Audio.sfx('timer', 0.7); // cuenta regresiva final
        if (this.timer === 0) this.timeUp();
      }
    }
    if (this.phase === 'ko') {
      this.phaseT++;
      if (this.phaseT === 120) {
        const loser = this.f.find(f => f.state === 'ko'), winner = loser ? loser.opp : null;
        if (winner) { winner.setState('win'); if (winner.matchWin && winner.ch.winSfx) Audio.sfx(winner.ch.winSfx); }
      }
      if (this.phaseT >= 230) {
        const champ = this.wins.findIndex(w => w >= ROUNDS_TO_WIN);
        if (champ >= 0) this.endMatch(champ);
        else { this.round++; this.startRound(); }
      }
    }
  },
  updatePowers() {
    // tras un K.O. el poder termina su animación (ya no hace daño); solo el Chaito se corta para que el rival no quede en el cielo
    if (this.phase !== 'fight') {
      this.f.forEach(f => { if (f.hidden) { f.hidden = false; f.y = 0; } });
      this.powers = this.powers.filter(fx => fx.kind !== 'launch');
    }
    for (const fx of this.powers) { fx.t++; curFx = fx; try { if (POWERS[fx.kind].update(fx)) fx.done = true; } finally { curFx = null; } }
    this.powers = this.powers.filter(fx => !fx.done);
    // nadie queda tomado por un poder que ya terminó
    if (!this.powers.length) this.f.forEach(f => { if (f.state === 'held') { if (f.hidden) f.y = 0; release(f); } });
  },
  updateProjectiles() {
    for (const p of this.projectiles) {
      p.x += p.vx; p.y += p.vy; p.t++; p.life--;
      const tgt = p.owner.opp, hb = tgt.hurtbox();
      if (p.rain && p.y > GROUND - 10) { p.life = 0; this.sparks(p.x, GROUND - 10, p.color, 5); }
      if (p.life > 0 && overlap({ x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 }, hb)) {
        p.life = 0;
        this.hit(p.owner, tgt, { dmg: p.dmg, kb: p.rain ? 1.5 : p.big ? 10 : 6, stun: p.rain ? 20 : 18, hitstop: p.rain ? 3 : p.big ? 14 : 7, meter: p.big ? 0 : 4, heavy: !p.rain, knockdown: p.big, chip: p.big ? 0.35 : 0.25, at: { x: p.x, y: p.y } });
        if (p.big) this.sparks(p.x, p.y, p.color, 24);
      }
      if (p.x < -60 || p.x > W + 60) p.life = 0;
    }
    // proyectiles que chocan entre sí se anulan
    for (const p of this.projectiles) for (const q of this.projectiles) {
      if (p !== q && p.owner !== q.owner && p.life > 0 && q.life > 0 && !p.rain && !q.rain && Math.abs(p.x - q.x) < p.r + q.r && Math.abs(p.y - q.y) < 50) {
        // el proyectil gigante se come al normal y sigue de largo
        if (p.big === q.big) p.life = q.life = 0; else (p.big ? q : p).life = 0;
        this.sparks((p.x + q.x) / 2, p.y, '#fff', 14); Audio.sfx('clash');
      }
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0);
  },
  updateFx() {
    // cámara: vuelve sola al plano general
    const c = this.cam;
    if (c) {
      if (c.hold > 0) c.hold--; else { c.tz = 1; c.fx += (W / 2 - c.fx) * 0.08; c.fy += (H / 2 - c.fy) * 0.08; }
      c.z += (c.tz - c.z) * (c.tz > c.z ? 0.18 : 0.08); c.rot *= 0.86; if (c.flash > 0) c.flash--;
    }
    if (this.comboBanner && ++this.comboBanner.t > 90) this.comboBanner = null;
    if (this.finalKo) this.finalKo.t++;
    for (const p of this.particles) { p.life--; if (p.kind === 'spark') { p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy = p.vy * 0.9 + 0.3; } }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const t of this.texts) t.t++;
    this.texts = this.texts.filter(t => t.t < 70);
  },
  endMatch(champIdx) {
    this.phase = 'over';
    Audio.playMusic('victory');
    const w = this.f[champIdx];
    const unlocked = unlockAfterBoss(w, w.opp);
    const note = unlocked ? '¡NUEVO LUCHADOR DESBLOQUEADO: ' + unlocked.map(c => c.name).join(', ') + '!' : '';
    // torre ganada: sin pantalla intermedia, se tacha al rival y se sube solo al siguiente piso (o se corona)
    if (tower.on && champIdx === 0) {
      tower.i++;
      if (tower.i >= tower.list.length) { tower.on = false; return champion(tower.player, note); }
      return showTower(true, note);
    }
    $('overTitle').textContent = w.ch.name + ' GANA';
    $('overScreen').style.setProperty('--accent', w.ch.accent);
    $('overSub').textContent = tower.on ? 'Caíste en el piso ' + (tower.i + 1) + ' de la torre' : '';
    if (note) $('overSub').textContent = note + ($('overSub').textContent ? ' · ' + $('overSub').textContent : '');
    $('btnRematch').textContent = tower.on ? 'REINTENTAR' : 'REVANCHA';
    show('overScreen');
  },
};

// ============================================================
//  RENDER
// ============================================================
function drawStage() {
  const st = game.stage, t = game.time, bg = st.bg && stageImgs[st.bg];
  if (st.bg && !bg) { ctx.fillStyle = '#0c0614'; ctx.fillRect(0, 0, W, H); return; } // aún cargando
  if (bg) { // fondo dibujado: cubre todo el canvas sin deformarse
    const k = Math.max(W / bg.width, H / bg.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg, (W - bg.width * k) / 2, (H - bg.height * k) / 2, bg.width * k, bg.height * k);
    ctx.imageSmoothingEnabled = true;
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, st.sky[0]); g.addColorStop(1, st.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // truss superior
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(W, 60); ctx.moveTo(0, 85); ctx.lineTo(W, 85); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath();
  for (let x = 0; x < W; x += 25) { ctx.moveTo(x, 60); ctx.lineTo(x + 25, 85); }
  ctx.stroke();

  // focos giratorios
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  st.lights.forEach((c, i) => {
    for (let k = 0; k < 2; k++) {
      const x = 160 + (i * 2 + k) * 190, ang = Math.sin(t * 0.012 + i * 1.7 + k * 2) * 0.5 + (k ? 0.12 : -0.12);
      const len = 640, spread = 0.13;
      const grd = ctx.createLinearGradient(x, 85, x + Math.sin(ang) * len, 85 + Math.cos(ang) * len);
      grd.addColorStop(0, hexA(c, 0.35 + game.crowdHype * 0.25)); grd.addColorStop(1, hexA(c, 0));
      ctx.fillStyle = grd; ctx.beginPath(); ctx.moveTo(x, 85);
      ctx.lineTo(x + Math.sin(ang - spread) * len, 85 + Math.cos(ang - spread) * len);
      ctx.lineTo(x + Math.sin(ang + spread) * len, 85 + Math.cos(ang + spread) * len);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, 88, 6, 0, 7); ctx.fill();
    }
  });
  ctx.restore();

  // pantallas LED del fondo con ecualizador
  for (let s = 0; s < 2; s++) {
    const sx = s ? W - 330 : 90, sy = 170, sw = 240, sh = 150;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(sx, sy, sw, sh);
    for (let i = 0; i < 16; i++) {
      const v = (Math.sin(t * 0.13 + i * 0.7 + s) * 0.5 + 0.5) * (0.4 + game.crowdHype * 0.6) + Math.random() * 0.1;
      const bh = v * (sh - 20);
      ctx.fillStyle = st.lights[i % st.lights.length];
      ctx.globalAlpha = 0.75; ctx.fillRect(sx + 8 + i * 14.5, sy + sh - 10 - bh, 10, bh); ctx.globalAlpha = 1;
    }
  }
  // parlantes
  for (const sx of [20, W - 110]) {
    ctx.fillStyle = '#0b0b10'; ctx.fillRect(sx, GROUND - 260, 90, 260);
    for (let k = 0; k < 3; k++) {
      const pulse = 1 + (game.time % 19 < 3 ? 0.08 : 0);
      ctx.fillStyle = '#1d1d26'; ctx.beginPath(); ctx.arc(sx + 45, GROUND - 215 + k * 80, 30 * pulse, 0, 7); ctx.fill();
      ctx.fillStyle = '#2c2c38'; ctx.beginPath(); ctx.arc(sx + 45, GROUND - 215 + k * 80, 11, 0, 7); ctx.fill();
    }
  }
  // piso del escenario
  const fg = ctx.createLinearGradient(0, GROUND, 0, H);
  fg.addColorStop(0, st.floor); fg.addColorStop(1, '#000');
  ctx.fillStyle = fg; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 60, GROUND); ctx.lineTo(W / 2 + i * 160, H); ctx.stroke(); }
  ctx.strokeStyle = st.lights[0]; ctx.globalAlpha = 0.5; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke(); ctx.globalAlpha = 1;
}

function drawCrowd() {
  const st = game.stage, t = game.time, hype = game.crowdHype;
  if (st.bg && stageImgs[st.bg]) return; // el fondo dibujado ya trae su público
  ctx.fillStyle = st.crowd;
  for (let i = 0; i < 34; i++) {
    const x = i * 40 - 10 + (i % 2) * 14, bob = Math.abs(Math.sin(t * (0.1 + hype * 0.08) + i * 1.3)) * (6 + hype * 16);
    const y = H - 30 - bob - (i % 3) * 6;
    ctx.beginPath(); ctx.arc(x, y, 17, 0, 7); ctx.fill();
    ctx.fillRect(x - 22, y + 12, 44, 60);
    if ((i + Math.floor(t / 40)) % 5 === 0) { // brazos arriba
      ctx.save(); ctx.strokeStyle = st.crowd; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 14, y + 16); ctx.lineTo(x - 26, y - 30 - bob * 0.5); ctx.moveTo(x + 14, y + 16); ctx.lineTo(x + 26, y - 30 - bob * 0.5); ctx.stroke(); ctx.restore();
      if (i % 10 === 0) { ctx.fillStyle = hexA('#fff8c0', 0.8 * (0.5 + 0.5 * Math.sin(t * 0.3 + i))); ctx.beginPath(); ctx.arc(x + 26, y - 36 - bob * 0.5, 4, 0, 7); ctx.fill(); ctx.fillStyle = st.crowd; }
    }
  }
}

function darker(hex, k = 0.55) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgb(${r * k | 0},${g * k | 0},${b * k | 0})`;
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function limb(a, b, w, color) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#120c14'; ctx.lineWidth = w + 6;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}
function ball(p, r, color) {
  ctx.fillStyle = '#120c14'; ctx.beginPath(); ctx.arc(p.x, p.y, r + 3, 0, 7); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
}

// pose de sprite según el estado del luchador (nombres estándar, ver roster.js)
function spritePose(f) {
  const s = f.state;
  if (s === 'held') return f.fxPose || 'idle';
  // la segunda animación (punch2 / kick2) es solo de los golpes suaves en el suelo; en el aire siempre va el dibujo aéreo
  if (s === 'attack') return f.alt && (f.move === 'punch' || f.move === 'kick') ? f.move + '2' : f.move;
  // agachado: si viene un golpe o un poder (o se cubre) esquiva; si no, agachado tranquilo
  if (s === 'crouch') return f.blocking || f.isThreatened() ? 'crouchDodge' : 'crouch';
  if (s === 'blockstun' || (f.blocking && f.isThreatened())) return 'block';
  // caminar: dos pasos que se alternan (también al retroceder)
  if (s === 'walk') return Math.floor(Math.abs(f.walkC) / 1.4) % 2 ? 'walk2' : 'walk1';
  if (s === 'dash') return f.dashDir > 0 ? 'dashFwd' : 'dashBack';
  if (s === 'jump') return Math.abs(f.vx) > 0.5 ? 'jumpFwd' : 'jumpUp';
  if (s === 'ko' || s === 'down') return 'fall';
  if (s === 'getup') return 'land';
  if (s === 'win') return f.matchWin ? 'winMatch' : 'winRound';
  return s; // idle, walk, land, hit, dizzy, taunt
}
// si falta el dibujo de una pose se usa el más parecido; si no hay ninguno, idle animada
const POSE_FALLBACK = {
  punchH: ['punch'], kickH: ['kick'], airkick: ['kickH', 'kick'], dashKick: ['airkick', 'kickH', 'kick'], crouchPunch: ['crouch'], crouchKick: ['crouch'], airpunch: ['punch', 'punchH'], // en el aire, los dibujos con el golpe más estirado
  jumpUp: ['jump'], jumpFwd: ['jump', 'jumpUp'],
  // movimiento: pasos, agacharse e impulso
  walk1: ['walk'], walk2: ['walk1', 'walk'], crouchDodge: ['crouch'], dashFwd: ['walk2', 'walk1'], dashBack: ['walk1', 'block'],
  fall: ['ko', 'hit'], dizzy: ['hit'], taunt: ['winRound', 'win'],
  winRound: ['win'], winMatch: ['win', 'winRound'],
  // poderes: se lanzan con el brazo estirado
  special: ['punch'], ex: ['punchH', 'punch'], super: ['punchH', 'punch'],
  // segunda animación de los golpes suaves; poses propias de algunos poderes
  punch2: ['punch'], kick2: ['kick'], drink: ['finisher', 'taunt'], smoke1: ['taunt'], smoke2: ['taunt'], preach: ['punchH'], eat: ['taunt'], eat2: ['eat', 'taunt'], beat: ['taunt'], powerup: ['winRound'], throw1: ['punchH'], throw2: ['punch'], vomit: ['punchH'], scream: ['punchH'],
};
function pickSprite(set, pose) {
  if (set[pose]) return [set[pose], pose];
  for (const alt of POSE_FALLBACK[pose] || []) if (set[alt]) return [set[alt], alt];
  return [set.idle, 'idle'];
}

function drawSpriteFighter(f, set) {
  const ch = f.ch, fc = f.facing, t = game.time;
  if (f.hidden) return;
  if (f.ghosts && f.ghosts.length) drawDashTrail(f, set);
  // un poder puede vestirlo distinto (Jack Dee de pastor): dibujo de frente, sin voltear
  if (f.fxImg) {
    const img = f.fxImg, h = spriteH(ch) * 1.1, w = img.width * h / img.height;
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(img, f.x - w / 2, GROUND - f.y - h, w, h); ctx.restore();
    return;
  }
  const mv = f.move && MOVES[f.move];
  let pose = spritePose(f);
  // el dibujo del ataque aparece al golpear; antes y al final del ataque se ve la guardia
  // (en el aire el golpe se ve completo: no hay guardia a la que volver)
  if (f.state === 'attack' && mv && !f.move.startsWith('air') && pickSprite(set, pose)[1] !== 'idle') {
    const s = f.sf, endAct = mv.startup + mv.active;
    if (s < mv.startup || s > endAct + mv.recovery * 0.6) pose = mv.crouch ? 'crouch' : 'idle';
  }
  let [img, got] = pickSprite(set, pose);
  if (fc < 0 && img._L) img = img._L; // mirando a la izquierda: su dibujo propio (las letras de la ropa se leen al derecho)
  const fallback = (got === 'idle' && pose !== 'idle') || (pose === 'idle' && f.state === 'attack');
  // una caída dibujada de pie (golpe o mareo) se tumba; una ya acostada se dibuja tal cual
  const koLying = pose === 'fall' && img.width > img.height;
  // todas las poses usan la escala de idle (vienen del mismo tamaño de cuadro)
  // ch.poseScale corrige un dibujo que salió más chico que el resto (Jack Dee de pastor)
  const H0 = spriteH(ch), k = H0 / set.idle.height * ((ch.poseScale || {})[got] || 1);
  const w = img.width * k, h = img.height * k;
  const ax = pose === 'fall' ? 0.5 : (img._footX ?? 0.5);
  let tx = 0, ty = 0, rot = 0, sx = 1, sy = 1, streak = null;
  // animación a partir de idle cuando falta el dibujo de la pose
  if (pose === 'walk1' || pose === 'walk2') { ty = -Math.abs(Math.sin(f.walkC)) * 5; rot = Math.sin(f.walkC) * 0.04; }
  else if (pose === 'crouch' || pose === 'crouchDodge') { sy = 0.62; sx = 1.08; rot = pose === 'crouchDodge' ? -0.12 : 0.05; }
  else if (pose === 'dashFwd' || pose === 'dashBack') { rot = pose === 'dashFwd' ? 0.22 : -0.18; }
  else if (pose === 'jumpUp' || pose === 'jumpFwd') { rot = pose === 'jumpFwd' ? 0.25 : -0.1; sy = 0.97; }
  else if (pose === 'land') { sx = 1.06; sy = 0.92; }
  else if (pose === 'hit') { rot = -0.2; tx = -12; }
  else if (pose === 'block') { rot = -0.07; sx = 0.94; }
  else if (pose === 'dizzy') { rot = Math.sin(t * 0.12) * 0.12; }
  else if (pose === 'taunt') { ty = -Math.abs(Math.sin(t * 0.25)) * 8; }
  else if (pose === 'winRound' || pose === 'winMatch') { ty = -Math.abs(Math.sin(t * 0.15)) * 14; }
  else if (pose === 'idle' && f.state !== 'attack') { sy = 1 + Math.sin(t * 0.08 + f.idx) * 0.012; }
  else if (f.state === 'attack' && mv) {
    const s = f.sf, wind = Math.min(1, s / Math.max(1, mv.startup));
    const act = s >= mv.startup && s < mv.startup + mv.active;
    const rec = s >= mv.startup + mv.active ? 1 - (s - mv.startup - mv.active) / mv.recovery : 1;
    const lean = { punch: 0.14, punchH: 0.2, kick: -0.22, kickH: -0.3, airkick: 0.4, special: 0.12, super: ch.super.type === 'rush' ? 0.3 : -0.06 }[f.move] || 0.1;
    const push = { punch: 24, punchH: 32, kick: 18, kickH: 22, airkick: 10, special: 16, super: 20 }[f.move] || 16;
    if (s < mv.startup) { rot = -0.08 * wind; tx = -8 * wind; if (f.move === 'super') sy = 1 + 0.06 * wind; }
    else { rot = lean * Math.max(0, rec); tx = push * Math.max(0, rec); }
    if (act && mv.reach) streak = { y: mv.y, reach: mv.reach };
  }
  if (!fallback) { tx = 0; rot = 0; sx = 1; sy = 1; } // con dibujo propio no se deforma
  // caída: se tumba según el ángulo del esqueleto (también al levantarse, que vuelve a 0 suave)
  if ((pose === 'fall' && !koLying) || (pose !== 'fall' && Math.abs(f.pose.rot) > 0.02)) rot = f.pose.rot;

  ctx.save();
  ctx.translate(f.x, GROUND - f.y);
  // sombra: el dibujo trae la suya bajo los pies, así que solo se agrega en el aire
  if (f.y > 2) {
    ctx.save(); ctx.scale(1, 0.25); ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.arc(0, f.y * 4, Math.max(20, 60 - f.y * 0.15), 0, 7); ctx.fill(); ctx.restore();
  }
  // aura con súper lista
  if (f.meter >= METER_MAX && f.state !== 'ko') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const r = 120 + Math.sin(t * 0.3) * 8, grd = ctx.createRadialGradient(0, -h / 2, 10, 0, -h / 2, r);
    grd.addColorStop(0, hexA(ch.super.color, 0.35)); grd.addColorStop(1, hexA(ch.super.color, 0));
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, -h / 2, r, 0, 7); ctx.fill(); ctx.restore();
  }
  ctx.scale(fc, 1);
  ctx.translate(tx, ty);
  // al caer de espaldas se gira sobre los pies y se levanta lo justo para no hundirse en el piso
  if (rot) { ctx.translate(0, -Math.abs(Math.sin(rot)) * w * 0.4); ctx.rotate(rot); }
  ctx.scale(sx, sy);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -w * ax, -h, w, h);
  if (f.flash > 0) { ctx.globalAlpha = 0.35 * f.flash / 6; ctx.drawImage(whiteOf(img), -w * ax, -h, w, h); ctx.globalAlpha = 1; }
  if (pose === 'block' && fallback) {
    ctx.strokeStyle = 'rgba(159,216,255,0.8)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(w * 0.25, -h * 0.55, h * 0.35, -0.9, 0.9); ctx.stroke();
  }
  ctx.restore();
  if (f.state === 'dizzy') drawDizzyBirds(f.x, GROUND - f.y - H0 * 1.1);
  // estela del golpe: marca el alcance real del ataque
  if (streak && fallback) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineCap = 'round';
    const y = GROUND - f.y - streak.y;
    for (let i = -1; i <= 1; i++) {
      ctx.lineWidth = 4 - Math.abs(i) * 1.5; ctx.beginPath();
      ctx.moveTo(f.x + fc * 30, y + i * 10); ctx.lineTo(f.x + fc * (streak.reach + 10), y + i * 6); ctx.stroke();
    }
    ctx.fillStyle = ch.accent; ctx.beginPath(); ctx.arc(f.x + fc * (streak.reach + 4), y, 9, 0, 7); ctx.fill();
    ctx.restore();
  }
}

// estela del impulso: siluetas del color del personaje que se apagan, con un aura detrás
function drawDashTrail(f, set) {
  const pose = f.dashDir > 0 ? 'dashFwd' : 'dashBack', [img] = pickSprite(set, f.state === 'dash' ? pose : 'idle');
  const k = spriteH(f.ch) / set.idle.height, w = img.width * k, h = img.height * k, ax = img._footX ?? 0.5;
  const tint = tintOf(img, f.ch.accent);
  ctx.save(); ctx.imageSmoothingEnabled = false;
  for (const g of f.ghosts) {
    ctx.save(); ctx.translate(g.x, GROUND - g.y); ctx.scale(f.facing, 1);
    ctx.globalAlpha = g.a; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(tint, -w * ax, -h, w, h);
    ctx.restore();
  }
  if (f.state === 'dash') {
    ctx.globalCompositeOperation = 'lighter';
    const r = spriteH(f.ch) * 0.75, gr = ctx.createRadialGradient(f.x, GROUND - f.y - h / 2, 10, f.x, GROUND - f.y - h / 2, r);
    gr.addColorStop(0, hexA(f.ch.accent, 0.45)); gr.addColorStop(1, hexA(f.ch.accent, 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(f.x - f.facing * f.dashDir * 30, GROUND - f.y - h / 2, r * 1.3, r, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function tintOf(img, color) {
  const key = '_tint' + color; if (img[key]) return img[key];
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return (img[key] = c);
}

// pajaritos y estrellas girando sobre la cabeza del mareado
function drawDizzyBirds(x, y) {
  const t = game.time * 0.09;
  for (let i = 0; i < 4; i++) {
    const a = t + i * Math.PI / 2, px = x + Math.cos(a) * 52, py = y + Math.sin(a) * 14;
    ctx.save(); ctx.translate(px, py);
    if (i % 2) { // estrella
      ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = '#120c14'; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k < 10; k++) { const r = k % 2 ? 5 : 11, b = k * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(b) * r, Math.sin(b) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else { // pajarito
      const flap = Math.sin(game.time * 0.5 + i) * 5;
      ctx.fillStyle = '#7fd3ff'; ctx.strokeStyle = '#120c14'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 7, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(-10, -9 - flap); ctx.lineTo(4, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffb000'; ctx.beginPath(); ctx.moveTo(9, -1); ctx.lineTo(15, 1); ctx.lineTo(9, 3); ctx.fill();
      ctx.fillStyle = '#120c14'; ctx.fillRect(4, -3, 2, 2);
    }
    ctx.restore();
  }
}

function drawFighter(f) {
  const set = spriteSet(f.ch);
  if (set) return drawSpriteFighter(f, set);
  if (f.state === 'dizzy') { const s0 = f.skeleton(); drawDizzyBirds(f.x + s0.head.x, GROUND - f.y + s0.head.y - 40); }
  const ch = f.ch, s = f.skeleton(), fc = f.facing;
  ctx.save();
  ctx.translate(f.x, GROUND - f.y);
  // sombra
  ctx.save(); ctx.scale(1, 0.25); ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.arc(0, (f.y) * 4, Math.max(20, 60 - f.y * 0.15), 0, 7); ctx.fill(); ctx.restore();
  if (f.pose.rot) { ctx.translate(0, -20); ctx.rotate(f.pose.rot * fc); ctx.translate(0, 20); }

  // aura de super / meter lleno
  if (f.meter >= METER_MAX && f.state !== 'ko') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const r = 110 + Math.sin(game.time * 0.3) * 8;
    const grd = ctx.createRadialGradient(0, -110, 10, 0, -110, r);
    grd.addColorStop(0, hexA(ch.super.color, 0.35)); grd.addColorStop(1, hexA(ch.super.color, 0));
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, -110, r, 0, 7); ctx.fill(); ctx.restore();
  }

  const skin = ch.skin, shirt = ch.shirt, pants = ch.pants;
  // atrás
  limb(s.sh, s.bE, 17, darker(shirt, 0.8)); limb(s.bE, s.bH, 14, darker(skin, 0.85)); ball(s.bH, 10, darker(skin, 0.85));
  limb(s.hip, s.bK, 22, darker(pants, 0.8)); limb(s.bK, s.bF, 19, darker(pants, 0.8));
  shoe(s.bK, s.bF, darker(ch.shoes, 0.8), fc);
  // torso
  limb(s.hip, s.sh, 40, shirt);
  ctx.fillStyle = ch.accent; ctx.globalAlpha = 0.9;
  const mid = { x: lerp(s.hip.x, s.sh.x, 0.55), y: lerp(s.hip.y, s.sh.y, 0.55) };
  ctx.beginPath(); ctx.arc(mid.x + 4 * fc, mid.y, 7, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  if (ch.extras.includes('chain')) {
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s.sh.x + 3 * fc, s.sh.y + 4, 14, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(s.sh.x + 3 * fc, s.sh.y + 19, 4, 0, 7); ctx.fill();
  }
  // adelante
  limb(s.hip, s.fK, 22, pants); limb(s.fK, s.fF, 19, pants);
  shoe(s.fK, s.fF, ch.shoes, fc);
  drawHead(f, s.head, f.pose.lean + f.pose.head);
  limb(s.sh, s.fE, 17, shirt); limb(s.fE, s.fH, 14, skin); ball(s.fH, 11, skin);

  if (f.flash > 0) { // destello al recibir golpe
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(0, -100, 50, 110, 0, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

function shoe(knee, foot, color, fc) {
  ctx.fillStyle = '#120c14'; ctx.beginPath(); ctx.ellipse(foot.x + 7 * fc, foot.y + 2, 18, 11, 0, 0, 7); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(foot.x + 7 * fc, foot.y + 1, 15, 8, 0, 0, 7); ctx.fill();
}

function drawHead(f, p, tilt) {
  const ch = f.ch, fc = f.facing, R = 30, img = faceImgs[ch.id];
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(tilt * 0.5 * fc); ctx.scale(fc, 1);
  // pelo de atrás
  if (!img) {
    ctx.fillStyle = ch.hairColor;
    if (ch.hair === 'afro') { ball({ x: -4, y: -8 }, R + 16, ch.hairColor); }
    if (ch.hair === 'long') { ctx.fillStyle = '#120c14'; ctx.fillRect(-R - 5, -12, R + 8, 62); ctx.fillStyle = ch.hairColor; ctx.fillRect(-R - 2, -12, R + 4, 58); }
    if (ch.hair === 'bun') ball({ x: -18, y: -R - 6 }, 13, ch.hairColor);
  }
  // cabeza
  ball({ x: 0, y: 0 }, R, ch.skin);
  if (img) {
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R + 4, 0, 7); ctx.clip();
    const sc = Math.max((R + 4) * 2 / img.width, (R + 4) * 2 / img.height);
    ctx.drawImage(img, -img.width * sc / 2, -img.height * sc / 2, img.width * sc, img.height * sc);
    ctx.restore();
    ctx.strokeStyle = '#120c14'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R + 4, 0, 7); ctx.stroke();
  } else {
    // cara caricatura
    const st = f.state, hurt = st === 'hit' || st === 'ko', angry = st === 'attack';
    ctx.fillStyle = '#fff';
    if (st === 'ko') {
      ctx.strokeStyle = '#120c14'; ctx.lineWidth = 3;
      for (const ex of [6, 20]) { ctx.beginPath(); ctx.moveTo(ex - 5, -9); ctx.lineTo(ex + 5, 1); ctx.moveTo(ex + 5, -9); ctx.lineTo(ex - 5, 1); ctx.stroke(); }
    } else {
      for (const ex of [7, 21]) {
        ctx.beginPath(); ctx.ellipse(ex, -4, 5.5, hurt ? 2 : 6.5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#120c14'; ctx.beginPath(); ctx.arc(ex + 2, -3, 2.6, 0, 7); ctx.fill(); ctx.fillStyle = '#fff';
      }
      ctx.strokeStyle = '#120c14'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(1, angry ? -15 : -14); ctx.lineTo(13, angry ? -11 : -15); ctx.moveTo(16, angry ? -11 : -15); ctx.lineTo(27, angry ? -15 : -14); ctx.stroke();
    }
    ctx.fillStyle = '#3a0d12';
    if (hurt || angry) { ctx.beginPath(); ctx.ellipse(16, 14, 6, hurt ? 7 : 5, 0, 0, 7); ctx.fill(); }
    else if (st === 'win') { ctx.beginPath(); ctx.arc(15, 10, 9, 0, Math.PI); ctx.fill(); }
    else { ctx.strokeStyle = '#3a0d12'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(9, 14); ctx.lineTo(22, 13); ctx.stroke(); }
    // nariz
    ctx.strokeStyle = darker(ch.skin, 0.7); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(27, 0); ctx.lineTo(31, 6); ctx.lineTo(26, 7); ctx.stroke();
  }
  // pelo / gorros encima
  const hc = ch.hairColor;
  ctx.fillStyle = hc; ctx.strokeStyle = '#120c14'; ctx.lineWidth = 3;
  const hasPhoto = !!img;
  switch (ch.hair) {
    case 'cap':
      ctx.fillStyle = ch.accent; ctx.beginPath(); ctx.arc(0, -6, R + 2, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(R + 6, -7, 20, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
      break;
    case 'beanie':
      ctx.fillStyle = ch.accent; ctx.beginPath(); ctx.arc(0, -8, R + 2, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = darker(ch.accent, 0.8); ctx.fillRect(-R - 3, -14, (R + 3) * 2, 10); ctx.strokeRect(-R - 3, -14, (R + 3) * 2, 10);
      ball({ x: 0, y: -R - 10 }, 7, ch.accent);
      break;
    case 'mohawk':
      if (hasPhoto) break;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-18 + i * 9, -R + 6); ctx.lineTo(-14 + i * 9, -R - 22 + Math.abs(i - 2) * 4); ctx.lineTo(-10 + i * 9, -R + 6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      break;
    case 'long': case 'buzz': case 'bun':
      if (hasPhoto) break;
      ctx.beginPath(); ctx.arc(0, -2, R + 1, Math.PI * 1.02, -0.15); ctx.lineTo(4, -14); ctx.closePath(); ctx.fill();
      break;
    case 'afro':
      if (hasPhoto) break;
      ctx.beginPath(); ctx.arc(-4, -10, R + 4, Math.PI * 0.95, -0.05); ctx.closePath(); ctx.fill();
      break;
  }
  if (ch.extras.includes('glasses') && !hasPhoto) {
    ctx.fillStyle = '#120c14'; ctx.fillRect(1, -9, 12, 9); ctx.fillRect(15, -9, 13, 9); ctx.fillRect(-14, -7, 16, 3);
    ctx.fillStyle = hexA(ch.accent, 0.5); ctx.fillRect(3, -8, 4, 3);
  }
  if (ch.extras.includes('headphones')) {
    ctx.strokeStyle = '#120c14'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, -2, R + 5, Math.PI * 1.1, -0.1 * Math.PI); ctx.stroke();
    ctx.strokeStyle = ch.accent; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#120c14'; ctx.fillRect(-R - 8, -10, 14, 24);
    ctx.fillStyle = ch.accent; ctx.fillRect(-R - 6, -8, 10, 20);
  }
  ctx.restore();
}

function drawProjectile(p) {
  ctx.save(); ctx.translate(p.x, p.y);
  const dir = Math.sign(p.vx) || 1;
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, p.r * 2);
  glow.addColorStop(0, hexA(p.color, 0.6)); glow.addColorStop(1, hexA(p.color, 0));
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, p.r * 2, 0, 7); ctx.fill();
  // todos los poderes simples son una bola de energía; solo cambia el color de cada personaje
  // (el proyectil gigante del poder especial es la misma bola a mayor escala)
  const r = p.r, pulse = 1 + Math.sin(p.t * 0.7) * 0.08;
  // cola de cometa
  for (let i = 1; i <= 6; i++) {
    ctx.globalAlpha = 0.5 - i * 0.07; ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(-dir * i * r * 0.45, Math.sin(p.t * 0.5 + i) * 3, r * (1 - i * 0.12), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // cuerpo: degradado del color al centro blanco
  const body = ctx.createRadialGradient(0, 0, 0, 0, 0, r * pulse);
  body.addColorStop(0, '#ffffff'); body.addColorStop(0.35, hexA(p.color, 1)); body.addColorStop(1, hexA(p.color, 0.15));
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, r * pulse, 0, 7); ctx.fill();
  // anillo eléctrico que gira y chispas
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * (p.scale || 1); ctx.globalAlpha = 0.85;
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2 + p.t * 0.25 * dir, rr = r * (1.05 + (i % 2 ? 0.18 : -0.05) * Math.sin(p.t + i)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.stroke();
  ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) { const a = p.t * 0.4 + i * 1.57; ctx.fillRect(Math.cos(a) * r * 1.3 - 2, Math.sin(a) * r * 1.3 - 2, 4, 4); }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

function drawBeam(f) {
  if (f.state !== 'attack' || f.move !== 'super' || f.ch.super.type !== 'beam' || f.ch.super.kind) return;
  const af = f.sf - MOVES.super.startup;
  if (af < 0 || af > MOVES.super.active) return;
  const h = f.handPos(), end = f.facing > 0 ? W + 40 : -40;
  const thick = 70 + Math.sin(af * 0.8) * 12;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, h.y - thick / 2, 0, h.y + thick / 2);
  g.addColorStop(0, hexA(f.ch.super.color, 0)); g.addColorStop(0.3, hexA(f.ch.super.color, 0.8)); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.7, hexA(f.ch.super.color, 0.8)); g.addColorStop(1, hexA(f.ch.super.color, 0));
  ctx.fillStyle = g; ctx.fillRect(Math.min(h.x, end), h.y - thick / 2, Math.abs(end - h.x), thick);
  // ondas
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) { const x = h.x + f.facing * ((af * 30 + i * 180) % 1200); ctx.beginPath(); ctx.ellipse(x, h.y, 10, thick * 0.6, 0, 0, 7); ctx.stroke(); }
  ctx.restore();
}

function drawHUD() {
  const [a, b] = game.f;
  const bw = 480, bh = 30, top = 34;
  for (const f of game.f) {
    const left = f.idx === 0, x = left ? 40 : W - 40 - bw;
    // barra de vida
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - 4, top - 4, bw + 8, bh + 8);
    ctx.fillStyle = '#4a0d18'; ctx.fillRect(x, top, bw, bh);
    const lag = Math.max(0, f.hpLag / f.maxHp) * bw, hp = Math.max(0, f.hp / f.maxHp) * bw;
    ctx.fillStyle = '#ff4d4d'; ctx.fillRect(left ? x + bw - lag : x, top, lag, bh);
    const g = ctx.createLinearGradient(0, top, 0, top + bh);
    const low = f.hp / f.maxHp < 0.25;
    g.addColorStop(0, low ? '#ffb347' : '#ffe14d'); g.addColorStop(1, low ? '#ff6a00' : '#f0a500');
    ctx.fillStyle = g; ctx.fillRect(left ? x + bw - hp : x, top, hp, bh);
    // nombre en grafiti: contorno oscuro, sombra del color del personaje y relleno blanco
    ctx.font = '400 30px ' + GRAF_FONT; ctx.textBaseline = 'top'; ctx.textAlign = left ? 'left' : 'right';
    const nx = left ? x + 4 : x + bw - 4, ny = top + bh + 4;
    ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = '#14061c';
    ctx.strokeText(f.ch.name, nx + 3, ny + 3); ctx.fillStyle = f.ch.accent; ctx.fillText(f.ch.name, nx + 3, ny + 3);
    ctx.strokeText(f.ch.name, nx, ny); ctx.fillStyle = '#fff'; ctx.fillText(f.ch.name, nx, ny);
    // rounds ganados
    for (let i = 0; i < ROUNDS_TO_WIN; i++) {
      const cx = left ? x + bw - 14 - i * 26 : x + 14 + i * 26;
      ctx.fillStyle = i < game.wins[f.idx] ? '#ffe14d' : 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(cx, top + bh + 20, 8, 0, 7); ctx.fill();
    }
    // medidor de poder: 3 barras (1 poder, 2 poder especial, 3 super)
    const sw = 110, gap = 6, mw = sw * BARS + gap * (BARS - 1), mx = left ? 40 : W - 40 - mw, my = H - 46;
    const bars = Math.floor(f.meter / BAR), blink = game.time % 20 < 10;
    for (let i = 0; i < BARS; i++) {
      const sx = left ? mx + i * (sw + gap) : mx + mw - sw - i * (sw + gap);
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(sx - 3, my - 3, sw + 6, 22);
      const fill = Math.max(0, Math.min(1, f.meter / BAR - i));
      ctx.fillStyle = fill >= 1 ? (bars === BARS && blink ? '#fff' : f.ch.super.color) : hexA(f.ch.super.color, 0.55);
      ctx.fillRect(left ? sx : sx + sw - sw * fill, my, sw * fill, 16);
    }
    ctx.font = '700 22px "Bungee", system-ui, sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillStyle = bars ? '#fff' : 'rgba(255,255,255,0.35)'; ctx.textAlign = left ? 'left' : 'right';
    ctx.fillText(String(bars), left ? mx + mw + 14 : mx - 14, my + 8);
    const label = ['', '', 'ESPECIAL · ' + powerKeys(f.idx)[1], 'SUPER LISTO · ' + powerKeys(f.idx)[2]][bars];
    ctx.font = '700 14px "Bungee", system-ui, sans-serif'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = bars ? '#fff' : 'rgba(255,255,255,0.6)';
    ctx.fillText(f.ai ? label.split(' · ')[0] : label, left ? mx : mx + mw, my - 6);
  }
  // reloj
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.beginPath(); ctx.roundRect(W / 2 - 46, 20, 92, 64, 8); ctx.fill();
  ctx.font = '400 46px "Bungee", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = game.timer <= 10 ? '#ff4d4d' : '#fff'; ctx.fillText(game.practice ? '∞' : String(game.timer).padStart(2, '0'), W / 2, 54);
  if (game.practice) { ctx.font = '400 16px "Bungee", system-ui, sans-serif'; ctx.fillStyle = '#7dff9a'; ctx.fillText('PRÁCTICA', W / 2, 100); }
}
// teclas de poder, poder especial y super de cada jugador
function powerKeys(i) { return ['special', 'ex', 'super'].map(a => keyName(KEYMAPS[i][a][0])); }
// poder especial (2 barras): ch.ex = { name, color } o, si falta, se arma con el poder simple
function exOf(ch) { return { name: (ch.ex && ch.ex.name) || ch.special.name.toUpperCase() + ' MAX', color: (ch.ex && ch.ex.color) || ch.special.color }; }

// ---------- pose de poder máximo (entra antes del super, estilo arcade) ----------
// imagen: ch.sprite.finisher (si falta, la victoria o la burla); texto: ch.super.name
function superPoseImg(ch) {
  const set = spriteSet(ch);
  return set && (set.finisher || set.winMatch || set.taunt || set.idle);
}
function drawSuperCutin(f, t) {
  const ch = f.ch, img = superPoseImg(ch), col = ch.super.color, left = f.idx === 0;
  const fin = { img, text: ch.super.name };
  if (!img) return;
  // sale con un fundido al final
  ctx.save(); ctx.globalAlpha = Math.min(1, (SUPER_CUTIN - t) / 10);
  // rayos que giran desde el centro, en el color del personaje
  ctx.fillStyle = '#0b0710'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(left ? W * 0.32 : W * 0.68, H * 0.55); ctx.rotate(t * 0.004);
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = i % 2 ? hexA(col, 0.55) : 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1500, i * Math.PI / 12, (i + 1) * Math.PI / 12); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // franjas de cómic arriba y abajo
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 54); ctx.fillRect(0, H - 54, W, 54);
  // pose de término: entra deslizándose con un rebote
  const inT = ease(Math.min(1, t / 16)), h = H * 0.9 * (ch.finisherScale || 1), w = fin.img.width * h / fin.img.height;
  const x = (left ? W * 0.32 : W * 0.68) - w / 2 + (1 - inT) * (left ? -W : W);
  const bob = Math.sin(t * 0.08) * 4;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(x + w / 2, H * 0.55, 20, x + w / 2, H * 0.55, h * 0.6);
  glow.addColorStop(0, hexA(col, 0.45)); glow.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H); ctx.restore();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(fin.img, x, H - h - 20 + bob, w, h);
  ctx.imageSmoothingEnabled = true;
  // destello blanco al aparecer
  if (t > 14 && t < 26) { ctx.fillStyle = `rgba(255,255,255,${(26 - t) / 14})`; ctx.fillRect(0, 0, W, H); }
  // texto grande: entra del lado contrario, con contorno grueso
  if (t > 20) {
    const k = ease(Math.min(1, (t - 20) / 14)), tx = left ? W * 0.74 : W * 0.26;
    const words = fin.text.split(' ');
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.translate(tx + (1 - k) * (left ? W : -W) * 0.6, H * 0.42); ctx.rotate(-0.06);
    // el texto se achica hasta caber en la mitad libre de la pantalla
    let size = 110;
    const fit = () => { ctx.font = `400 ${size}px "Bungee Shade", "Bungee", system-ui, sans-serif`; return Math.max(...words.map(s => ctx.measureText(s).width)); };
    while (size > 30 && fit() > W * 0.46) size -= 4;
    words.forEach((wd, i) => {
      const y = (i - (words.length - 1) / 2) * size * 1.05;
      ctx.lineWidth = 14; ctx.strokeStyle = '#000'; ctx.strokeText(wd, 0, y);
      ctx.fillStyle = i % 2 ? '#fff' : col; ctx.fillText(wd, 0, y);
    });
    ctx.font = '400 28px "Bungee", system-ui, sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText(ch.name + ' · SUPER', 0, (words.length / 2) * size * 1.05 + 30);
    ctx.restore();
  }
  ctx.restore();
}

const BANNER_IMGS = Object.fromEntries(['round1', 'round2', 'round3', 'pelea'].map(n => { const i = new Image(); i.src = 'assets/ui/' + n + '.png'; return [n, i]; }));
function drawBanner() {
  const b = game.banner; if (!b) return;
  const t = b.t;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (b.superBanner) {
    const slide = Math.min(1, t / 8);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = b.color; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(0, 290); ctx.lineTo(W * slide, 260); ctx.lineTo(W * slide, 400); ctx.lineTo(0, 430); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = '400 26px "Bungee", system-ui, sans-serif'; ctx.fillStyle = '#120c14'; ctx.fillText(b.sub, W / 2, 300);
    ctx.font = '400 64px "Bungee Shade", "Bungee", system-ui, sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText(b.text, W / 2 + (1 - slide) * -300, 355);
  } else {
    const sc = b.big ? 1 + Math.max(0, 1 - t / 10) * 1.5 : 1;
    const alpha = t > 80 ? Math.max(0, 1 - (t - 80) / 15) : 1;
    ctx.globalAlpha = alpha; ctx.translate(W / 2, b.y ?? H / 2 - 40); ctx.scale(sc, sc);
    // rounds y ¡PELEA! en grafiti (mismo estilo del título); si la imagen no cargó, texto
    const img = b.img && BANNER_IMGS[b.img];
    if (img && img.complete && img.naturalWidth) {
      const w = b.big ? 760 : 620, h = w * img.naturalHeight / img.naturalWidth;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      if (b.sub) { ctx.font = '400 28px "Bungee", system-ui, sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#120c14'; ctx.strokeText(b.sub, 0, h / 2 + 24); ctx.fillStyle = '#fff'; ctx.fillText(b.sub, 0, h / 2 + 24); }
      ctx.restore(); return;
    }
    ctx.font = `400 ${b.big ? 120 : 84}px "Bungee Shade", "Bungee", system-ui, sans-serif`;
    ctx.lineWidth = 10; ctx.strokeStyle = '#120c14'; ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.text === 'K.O.' ? '#ff3b3b' : '#ffe14d'; ctx.fillText(b.text, 0, 0);
    if (b.sub) { ctx.font = '400 28px "Bungee", system-ui, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(b.sub, 0, 80); }
  }
  ctx.restore();
}

// cartel del remate de combo: franja inclinada que entra por el lado del que lo hizo
function drawComboBanner() {
  const b = game.comboBanner; if (!b) return;
  const t = b.t, left = b.side === 0, inK = ease(Math.min(1, t / 10)), out = t > 70 ? (t - 70) / 20 : 0;
  ctx.save(); ctx.globalAlpha = 1 - out;
  const cx = left ? W * 0.3 : W * 0.7, y = 205, dx = (1 - inK) * (left ? -W * 0.7 : W * 0.7);
  ctx.translate(cx + dx, y); ctx.rotate(-0.07);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = 54; ctx.font = `400 ${size}px "Bungee Shade", "Bungee", system-ui, sans-serif`;
  while (size > 26 && ctx.measureText(b.text).width > W * 0.5) { size -= 3; ctx.font = `400 ${size}px "Bungee Shade", "Bungee", system-ui, sans-serif`; }
  const w = ctx.measureText(b.text).width + 80;
  ctx.fillStyle = '#000'; ctx.fillRect(-w / 2 - 6, -size * 0.75 - 26, w + 12, size * 1.5 + 34);
  ctx.fillStyle = b.color; ctx.fillRect(-w / 2, -size * 0.75 - 20, w, size * 1.5 + 22);
  ctx.font = '400 22px "Bungee", system-ui, sans-serif'; ctx.fillStyle = '#120c14';
  ctx.fillText(b.n + ' GOLPES · COMBO', 0, -size * 0.5 - 4);
  ctx.font = `400 ${size}px "Bungee Shade", "Bungee", system-ui, sans-serif`;
  ctx.lineWidth = 8; ctx.strokeStyle = '#120c14'; ctx.strokeText(b.text, 0, size * 0.32);
  ctx.fillStyle = '#fff'; ctx.fillText(b.text, 0, size * 0.32);
  ctx.restore();
}

function render() {
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (game.phase === 'menu' || !game.f.length) { drawStage(); drawCrowd(); return; }
  const sh = game.shakeAmt;
  ctx.save(); ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  // cámara: zoom hacia un punto y giro leve; el encuadre no se sale del escenario
  const cam = game.cam;
  if (cam && (Math.abs(cam.z - 1) > 0.002 || Math.abs(cam.rot) > 0.0005)) {
    const z = cam.z * (1 + Math.abs(cam.rot) * 1.6), hw = W / (2 * z), hh = H / (2 * z);
    const cx = Math.max(hw, Math.min(W - hw, cam.fx)), cy = Math.max(hh, Math.min(H - hh, cam.fy));
    const k = Math.min(1, (cam.z - 1) / 0.25); // con poco zoom se queda casi al centro
    ctx.translate(W / 2, H / 2); ctx.rotate(cam.rot); ctx.scale(z, z);
    ctx.translate(-(W / 2 + (cx - W / 2) * k), -(H / 2 + (cy - H / 2) * k));
  }
  drawStage();
  // super: oscurecer fondo
  if (game.superActor) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); }
  // K.O. final: el escenario se oscurece y salen rayos girando desde el caído, en el color del ganador
  const fk = game.finalKo;
  if (fk) {
    const a = Math.min(1, fk.t / 20);
    ctx.fillStyle = `rgba(8,4,14,${0.62 * a})`; ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.save(); ctx.translate(fk.x, fk.y); ctx.rotate(fk.t * 0.006); ctx.globalAlpha = 0.5 * a;
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = i % 2 ? fk.color : 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1600, i * Math.PI / 9, (i + 0.5) * Math.PI / 9); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  for (const fx of game.powers) if (POWERS[fx.kind].back) POWERS[fx.kind].back(fx);
  const order = [...game.f].sort((x, y) => (x.state === 'attack' || x.state === 'held') - (y.state === 'attack' || y.state === 'held'));
  order.forEach(drawFighter);
  game.f.forEach(drawBeam);
  game.projectiles.forEach(drawProjectile);
  for (const fx of game.powers) if (POWERS[fx.kind].front) { ctx.save(); POWERS[fx.kind].front(fx); ctx.restore(); }
  // partículas
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of game.particles) {
    const a = p.life / p.max;
    if (p.kind === 'ring') { ctx.strokeStyle = hexA('#ffffff', a); ctx.lineWidth = 5 * a; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - a) + 10, 0, 7); ctx.stroke(); }
    else if (p.kind === 'burst') {
      // rayos de impacto: salen del centro y se van afinando
      const r0 = p.size * 0.25 + p.size * 0.6 * (1 - a), r1 = r0 + p.size * 0.55 * a + 10;
      ctx.strokeStyle = hexA(p.color.startsWith('#') ? p.color : '#ffffff', Math.min(1, a * 1.4)); ctx.lineCap = 'round';
      for (let i = 0; i < p.n; i++) {
        const ang = (i / p.n + p.rot) * Math.PI * 2, wv = i % 2 ? 1 : 0.6;
        ctx.lineWidth = (3 + 6 * a) * wv; ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(ang) * r0, p.y + Math.sin(ang) * r0); ctx.lineTo(p.x + Math.cos(ang) * r1 * wv, p.y + Math.sin(ang) * r1 * wv); ctx.stroke();
      }
    }
    else { ctx.fillStyle = hexA(p.color.startsWith('#') ? p.color : '#ffffff', a); ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 1, 0, 7); ctx.fill(); }
  }
  ctx.restore();
  drawCrowd();
  ctx.restore();
  // cuadro blanco de impacto (golpes fuertes, K.O.)
  if (cam && cam.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.55, cam.flash * 0.09)})`; ctx.fillRect(0, 0, W, H); }
  // textos flotantes
  for (const t of game.texts) {
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t.t / 70); ctx.textAlign = 'center';
    ctx.font = '400 30px "Bungee", system-ui, sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#120c14';
    const y = t.y - t.t * 0.8; ctx.strokeText(t.text, t.x, y); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, y); ctx.restore();
  }
  drawHUD();
  drawComboBanner();
  drawBanner();
  // super: la pose de poder máximo tapa la pantalla antes de soltar el poder
  const sa = game.superActor;
  if (sa && sa.move === 'super' && game.superT < SUPER_CUTIN) {
    ctx.save(); ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    drawSuperCutin(sa, game.superT); ctx.restore();
  }
  if (game.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.font = '400 96px ' + GRAF_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.lineWidth = 14; ctx.strokeStyle = '#14061c'; ctx.strokeText('PAUSA', W / 2, 215); ctx.fillStyle = '#ffd23f'; ctx.fillText('PAUSA', W / 2, 215);
  }
}

// ============================================================
//  LOOP fijo 60 Hz
// ============================================================
let last = performance.now(), acc = 0;
fitCanvas();
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  if (!padTimer) pollPads(); // sin control conectado basta con revisar una vez por cuadro
  while (acc >= 1000 / 60) { game.update(); acc -= 1000 / 60; }
  render();
  if (!$('titleScreen').hidden) menuTick(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// menú de pausa: continuar, reiniciar la pelea, ver los controles o salir (flechas + Enter, control o toque)
let pauseIdx = 0;
const pauseBtns = () => [...$('pauseMenu').querySelectorAll('.btn')];
function paintPause() { pauseBtns().forEach((b, i) => b.classList.toggle('on', i === pauseIdx)); }
function togglePause() {
  if (game.phase === 'menu' || game.phase === 'over' || !game.f.length) return;
  game.paused = !game.paused;
  $('pauseMenu').hidden = !game.paused;
  if (game.paused) { pauseIdx = 0; paintPause(); }
  else { pressedQueue[0].length = 0; pressedQueue[1].length = 0; } // lo apretado en el menú no cuenta como golpe
  if (screens.every(s => $(s).hidden)) show(null); // en táctil los botones se esconden en pausa y vuelven al seguir
}
function pauseKey(e) {
  const btns = pauseBtns(), n = btns.length, c = e.code;
  if (c === 'ArrowUp' || c === 'KeyW') pauseIdx = (pauseIdx + n - 1) % n;
  else if (c === 'ArrowDown' || c === 'KeyS') pauseIdx = (pauseIdx + 1) % n;
  else if (c === 'Enter' || c === 'Space') { e.preventDefault(); return btns[pauseIdx].click(); }
  else return;
  e.preventDefault(); paintPause(); Audio.sfx('menu_move', 0.6);
}
// misma pelea desde el round 1, en el mismo escenario
function restartFight() {
  const c = game.cfg; if (!c) return;
  game.paused = false; $('pauseMenu').hidden = true;
  game.nextStage = game.stage; show(null); Audio.voice('next');
  game.start(c.c1, c.c2, c.vsCpu, c.opts);
}

// ============================================================
//  MENÚS (DOM)
// ============================================================
const screens = ['titleScreen', 'selectScreen', 'towerScreen', 'vsScreen', 'overScreen', 'champScreen', 'optScreen'];
function show(id) { screens.forEach(s => { $(s).hidden = s !== id; }); if (id === 'titleScreen') menuEnter(); document.body.classList.toggle('fighting', id === null); $('touch').hidden = !(id === null && isTouch && !game.paused); }
const isTouch = matchMedia('(pointer: coarse)').matches;

// modos: cpu = historia (torre) · arcade = una pelea contra la CPU · pvp = 1 vs 1 · practice = práctica
const sel = { mode: 'cpu', p: [0, 1], locked: [false, false] };
const twoPick = () => sel.mode !== 'cpu'; // se elige también al rival

function portrait(ch, size = 120) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const set = spriteSet(ch);
  if (set) { // recorte de la cabeza: ch.spriteFace = [x, y, ancho, alto] en fracciones de la imagen
    const img = set.idle, [fx, fy, fw, fh] = ch.spriteFace || [0.2, 0, 0.6, 0.36];
    const sw = img.width * fw, sh = img.height * fh, k = Math.min(size / sw, size / sh);
    g.imageSmoothingEnabled = false;
    g.drawImage(img, img.width * fx, img.height * fy, sw, sh, (size - sw * k) / 2, size - sh * k, sw * k, sh * k);
    return c;
  }
  const fake = { ch, facing: 1, state: 'idle' };
  g.save(); g.translate(size / 2, size / 2 + 6); g.scale(size / 100, size / 100);
  swapCtx(g, () => drawHead(fake, { x: 0, y: 0 }, 0));
  g.restore();
  return c;
}
// reutiliza drawHead sobre otro contexto (retratos del menú)
function swapCtx(g, fn) { const old = ctx; ctx = g; try { fn(); } finally { ctx = old; } }

// personajes bloqueados (ch.locked) quedan elegibles cuando un jugador les gana una partida; se recuerda en este navegador
// el jefe suplente (ch.standIn) nunca se elige: solo reemplaza al jefe cuando lo juegas tú
const isUnlocked = ch => !ch.standIn && (!ch.locked || store.get('unlock2:' + ch.id) === '1');
let PLAYABLE = ROSTER.filter(isUnlocked);
function unlockAfterBoss(winner, loser) {
  if (winner.ai || loser.ch.standIn || isUnlocked(loser.ch)) return null;
  store.set('unlock2:' + loser.ch.id, '1');
  PLAYABLE = ROSTER.filter(isUnlocked);
  return [loser.ch];
}
// silueta negra para el retador secreto
function silhouette(c) {
  const g = c.getContext('2d'); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#0b0b10'; g.fillRect(0, 0, c.width, c.height);
  return c;
}

// casilla "al azar": va justo después de los disponibles (índice PLAYABLE.length)
const isRnd = i => i === PLAYABLE.length;
function rndPortrait(size = 120) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), font = getComputedStyle(document.body).getPropertyValue('--display') || 'sans-serif';
  g.font = `${Math.round(size * 0.78)}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = size * 0.08; g.strokeStyle = '#000'; g.strokeText('?', size / 2, size * 0.56);
  g.fillStyle = '#fff'; g.fillText('?', size / 2, size * 0.56);
  return c;
}
const selName = i => isRnd(i) ? 'AL AZAR' : (PLAYABLE[i] ? PLAYABLE[i].name : '');

function renderSelect() {
  const grid = $('roster'); if (!grid) return;
  grid.innerHTML = '';
  const LOCKED = ROSTER.filter(c => !c.standIn && !isUnlocked(c));
  PLAYABLE.forEach((ch, i) => {
    const card = document.createElement('button');
    card.className = 'card'; card.type = 'button';
    card.style.setProperty('--c', ch.accent);
    if (sel.p[0] === i) card.classList.add('p1');
    if (sel.p[1] === i && twoPick()) card.classList.add('p2');
    card.appendChild(portrait(ch));
    const nm = document.createElement('span'); nm.className = 'cname'; nm.textContent = ch.name; card.appendChild(nm);
    const up = document.createElement('label'); up.className = 'face-up'; up.title = 'Subir foto de la cara';
    up.innerHTML = '<span>📷 cara</span>';
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'face-' + ch.id;
    inp.addEventListener('click', e => e.stopPropagation());
    inp.addEventListener('change', () => uploadFace(ch, inp.files[0]));
    up.appendChild(inp); up.addEventListener('click', e => e.stopPropagation());
    if (!ch.sprite) card.appendChild(up); // los personajes con dibujo propio no usan foto
    // en pantalla táctil el primer toque muestra al personaje y el segundo lo confirma
    card.addEventListener('click', () => {
      const who = twoPick() && sel.locked[0] ? 1 : 0;
      if (isTouch && sel.p[who] !== i) { sel.p[who] = i; Audio.init(); Audio.sfx('menu_move', 0.8); renderSelect(); return; }
      pickCard(i);
    });
    grid.appendChild(card);
  });
  // al azar: se elige como cualquier personaje y al confirmar sale uno de los disponibles
  const ri = PLAYABLE.length, rc = document.createElement('button');
  rc.className = 'card rnd'; rc.type = 'button'; rc.style.setProperty('--c', '#ffd23f');
  if (sel.p[0] === ri) rc.classList.add('p1');
  if (sel.p[1] === ri && twoPick()) rc.classList.add('p2');
  rc.appendChild(rndPortrait());
  const rn = document.createElement('span'); rn.className = 'cname'; rn.textContent = 'AL AZAR'; rc.appendChild(rn);
  rc.addEventListener('click', () => {
    const who = twoPick() && sel.locked[0] ? 1 : 0;
    if (isTouch && sel.p[who] !== ri) { sel.p[who] = ri; Audio.init(); Audio.sfx('menu_move', 0.8); renderSelect(); return; }
    pickCard(ri);
  });
  grid.appendChild(rc);
  // por desbloquear: solo la silueta negra, sin nombre, y no se pueden elegir
  LOCKED.forEach(ch => {
    const card = document.createElement('button');
    card.className = 'card lock'; card.type = 'button'; card.title = 'Por desbloquear: gánale en la torre';
    card.appendChild(silhouette(portrait(ch)));
    const nm = document.createElement('span'); nm.className = 'cname'; nm.textContent = '???'; card.appendChild(nm);
    card.addEventListener('click', () => { Audio.init(); Audio.sfx('menu_move', 0.5); });
    grid.appendChild(card);
  });
  const cur = (k) => sel.locked[k] ? 'LISTO' : 'eligiendo…';
  $('p1info').innerHTML = `<b>J1</b> ${selName(sel.p[0])} <small>${cur(0)}</small>`;
  $('p2info').innerHTML = `<b>${{ arcade: 'CPU', practice: 'SPARRING' }[sel.mode] || 'J2'}</b> ${selName(sel.p[1])} <small>${cur(1)}</small>`;
  $('selectScreen').querySelector('.sel-title').textContent = !twoPick() || !sel.locked[0] ? 'ELIGE TU RAPERO' : sel.mode === 'pvp' ? 'JUGADOR 2: ELIGE' : 'ELIGE AL RIVAL';
  const hi = sel.p[sel.locked[0] && twoPick() ? 1 : 0];
  $('moveList').innerHTML = isRnd(hi) ? '<b>AL AZAR</b> · te toca uno de los luchadores disponibles'
    : `<b>${PLAYABLE[hi].name}</b> · Poder: <i>${PLAYABLE[hi].special.name}</i> · Especial (2): <i>${exOf(PLAYABLE[hi]).name}</i> · Super (3): <i>${PLAYABLE[hi].super.name}</i>`;
  // panel izquierdo: J1 · panel derecho: el rival (en historia, la torre)
  [0, 1].forEach(k => {
    if (k === 1 && !twoPick()) return setHero(1, null, { tower: true });
    const i = sel.p[k];
    if (isRnd(i)) setHero(k, null, { rnd: true, locked: sel.locked[k] });
    else setHero(k, PLAYABLE[i], { locked: sel.locked[k] });
  });
  $('selectScreen').classList.toggle('p2turn', twoPick() && sel.locked[0] && !sel.locked[1]);
  if (sel.mode === 'cpu') $('p2info').innerHTML = `<b>TORRE</b> <small>${towerSize()} rivales hasta el jefe</small>`;
}

// paneles grandes de la selección: J1 a la izquierda y el rival (J2 / CPU / torre) a la derecha, en espejo.
// El dibujo respira; al confirmar hace su burla con un destello.
const heroes = [{}, {}];
const HERO_IDS = [['heroCanvas', 'heroName', 'heroTag', 'heroPowers', '--hc'], ['heroCanvas2', 'heroName2', 'heroTag2', 'heroPowers2', '--hc2']];
function setHero(k, ch, opts = {}) {
  const h = heroes[k], [, nm, tg, pw, cv] = HERO_IDS[k];
  if (!$(HERO_IDS[k][0])) return;
  const key = opts.tower ? 'tower' : opts.rnd ? 'rnd' : ch.id;
  if (h.key !== key) { h.key = key; h.t0 = performance.now(); h.lockT = 0; }
  if (opts.locked && !h.locked) h.lockT = performance.now();
  h.locked = !!opts.locked; h.ch = ch; h.rnd = opts.rnd; h.tower = opts.tower;
  if (ch && ch.sprite) loadSprites(ch, ['idle', 'taunt', 'winRound']);
  const color = opts.tower ? '#ff3fa4' : opts.rnd ? '#ffd23f' : ch.accent;
  $('selectScreen').style.setProperty(cv, color);
  if (opts.tower) {
    $(nm).textContent = 'LA TORRE'; $(tg).textContent = towerSize() + ' RIVALES';
    $(pw).innerHTML = '<li>Rivales cada vez más duros</li><li>y al final, <b class="pwc3">EL JEFE</b></li>';
  } else if (opts.rnd) {
    $(nm).textContent = '¿QUIÉN SERÁ?'; $(tg).textContent = 'AL AZAR';
    $(pw).innerHTML = '<li><b class="pwc1">PODER</b>???</li><li><b class="pwc2">ESPECIAL</b>???</li><li><b class="pwc3">SUPER</b>???</li>';
  } else {
    $(nm).textContent = ch.name; $(tg).textContent = ch.boss ? 'JEFE FINAL' : h.locked ? '¡LISTO!' : '';
    $(pw).innerHTML = `<li><b class="pwc1">PODER</b>${ch.special.name}</li><li><b class="pwc2">ESPECIAL</b>${exOf(ch).name}</li><li><b class="pwc3">SUPER</b>${ch.super.name}</li>`;
  }
  heroLoop();
}
function drawHero(k, now) {
  const h = heroes[k], cv = $(HERO_IDS[k][0]); if (!cv) return;
  const g = cv.getContext('2d'), W2 = cv.width, H2 = cv.height, t = (now - (h.t0 || now)) / 1000;
  g.clearRect(0, 0, W2, H2);
  const lockA = h.lockT ? (now - h.lockT) / 1000 : -1; // segundos desde que se confirmó
  if (h.tower || h.rnd) {
    const q = rndPortrait(Math.min(W2, H2) * 0.8), s = 1 + Math.sin(t * 3) * 0.04;
    g.save(); g.translate(W2 / 2, H2 / 2); g.scale(s, s);
    if (h.tower) { g.globalAlpha = 0.9; g.filter = 'drop-shadow(0 0 18px #ff3fa4)'; }
    g.drawImage(q, -q.width / 2, -q.height / 2); g.restore();
    return;
  }
  const set = h.ch && spriteSet(h.ch); if (!set || !set.idle) return;
  // burla al confirmar (si no tiene, la victoria); si no está cargada todavía, la guardia
  const pose = h.locked ? (set.taunt || set.winRound || set.idle) : set.idle;
  const base = set.idle, img = k === 1 && pose._L ? pose._L : pose;
  // misma escala que la guardia, salvo que la pose no quepa (brazos arriba)
  const kk = Math.min(W2 / base.width * 0.94, H2 / base.height * 0.94, W2 * 0.98 / img.width, H2 * 0.98 / img.height);
  const pop = lockA >= 0 && lockA < 0.25 ? 1 + 0.08 * Math.sin(lockA / 0.25 * Math.PI) : 1;
  const breath = Math.sin(t * 2.4), sy = (1 + breath * 0.012) * pop, sx = (1 - breath * 0.006) * pop;
  const w = img.width * kk, hh = img.height * kk;
  g.save(); g.imageSmoothingEnabled = false;
  g.translate(W2 / 2, H2); g.scale(k === 1 ? -sx : sx, sy);
  g.drawImage(img, -w / 2, -hh, w, hh);
  g.restore();
  // destello blanco al confirmar
  if (lockA >= 0 && lockA < 0.35) {
    g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 1 - lockA / 0.35; g.fillStyle = '#fff'; g.fillRect(0, 0, W2, H2); g.restore();
  }
}
let heroRaf = 0;
function heroLoop() {
  if (heroRaf) return;
  const step = now => {
    if ($('selectScreen').hidden) { heroRaf = 0; return; }
    drawHero(0, now); drawHero(1, now);
    heroRaf = requestAnimationFrame(step);
  };
  heroRaf = requestAnimationFrame(step);
}

// ---------- MODO TORRE: rivales en orden creciente de dificultad hasta el jefe ----------
const tower = { on: false, player: null, list: [], i: 0 };
const towerSize = () => Math.min(6, PLAYABLE.filter(c => !c.boss && !c.secret).length - 1) + 1;
// nivel de la CPU: el primer rival es fácil y sube piso a piso (el jefe usa el suyo, máximo)
const towerLevel = i => { const n = tower.list.filter(c => !c.secret).length; return Math.max(0.2, Math.min(0.97, 0.4 + 0.52 * (n > 1 ? i / (n - 1) : 1) + DIFF[settings.diff].add)); };
// pisos que se ven: el retador secreto solo aparece cuando ya le ganaste al jefe
const towerShown = () => tower.list.filter((c, i) => !c.secret || i <= tower.i);
function startTower(player) {
  const pool = PLAYABLE.filter(c => c !== player && !c.boss && !c.secret).sort(() => Math.random() - 0.5).slice(0, 6);
  // jefe y después el retador secreto; si juegas con el jefe, lo reemplaza su suplente
  const bosses = ROSTER.filter(c => c.boss && !c.standIn).map(b => b === player ? ROSTER.find(s => s.standIn === b.id) : b).filter(Boolean);
  const extra = [...bosses, ...ROSTER.filter(c => c.secret && c !== player)];
  tower.on = true; tower.player = player; tower.i = 0;
  tower.list = [...pool, ...extra];
  showTower();
}
// la torre se muestra unos segundos y sigue sola a la pelea (Enter o clic la adelantan).
// climbed: recién ganó; el rival vencido se tacha y el marcador sube al piso siguiente.
let towerTimer = 0, towerAt = 0;
function showTower(climbed, note) {
  const ol = $('towerList'); ol.innerHTML = '';
  const shown = towerShown();
  shown.forEach((c, i) => {
    // los bloqueados (jefe y retador secreto) van de incógnito hasta que les ganes
    const li = document.createElement('li'), hidden = c.secret || (i >= tower.i && !isUnlocked(c));
    li.style.setProperty('--c', c.accent);
    if (i < tower.i) li.classList.add('done'); if (i === tower.i) li.classList.add('now'); if (c.boss || c.secret) li.classList.add('boss');
    if (climbed && i === tower.i - 1) li.classList.add('beaten');
    if (climbed && i === tower.i) li.classList.add('arrive');
    li.appendChild(hidden ? silhouette(portrait(c, 96)) : portrait(c, 96));
    const nm = document.createElement('span'); nm.className = hidden ? 'nm unknown' : 'nm'; nm.textContent = hidden ? (c.boss ? '👑 ???' : '❓ ???') : (c.boss ? '👑 ' : '') + c.name; li.appendChild(nm);
    if (i >= tower.i) { const lv = document.createElement('span'); lv.className = 'lv'; lv.textContent = c.secret ? 'RETADOR SECRETO' : c.boss ? 'JEFE FINAL' : 'NIVEL ' + (i + 1); li.appendChild(lv); }
    ol.appendChild(li);
  });
  $('towerSub').textContent = `${tower.player.name} · PISO ${tower.i + 1} DE ${shown.length}`;
  $('towerNote').textContent = note || '';
  if (!climbed) Audio.playMusic('menu'); // tras ganar sigue sonando la música de victoria
  else setTimeout(() => Audio.hit(true), 450); // golpe del sello de DERROTADO
  show('towerScreen');
  towerAt = performance.now(); clearTimeout(towerTimer);
  towerTimer = setTimeout(towerGo, climbed ? (note ? 4200 : 3200) : 2400);
}
function towerGo() { clearTimeout(towerTimer); if (!$('towerScreen').hidden) towerFight(); }
const towerSkip = () => { if (performance.now() - towerAt > 700) towerGo(); };
function towerFight() {
  const opp = tower.list[tower.i];
  versus(tower.player, opp, () => {
    show(null); Audio.voice('next');
    game.start(tower.player, opp, true, { level: opp.secret ? 0.95 : towerLevel(tower.i) });
  }, true);
}

// escenario de la pelea: el propio del rival (el jefe) o de quien lo tenga siempre (homeAlways); si no, al azar.
// loadedOnly: en la revancha, sin pantalla VS, se elige entre los que ya cargaron
function pickStage(c1, c2, vsCpu, loadedOnly) {
  const home = (vsCpu ? [c2, ...(c1.homeAlways ? [c1] : [])] : [c1, c2]).map(c => c.home && STAGES.find(s => s.name === c.home)).find(Boolean);
  if (home) return home;
  let stages = STAGES.filter(s => !s.off);
  if (loadedOnly) { const ready = stages.filter(s => !s.bg || stageImgs[s.bg]); if (ready.length) stages = ready; }
  return stages[Math.floor(Math.random() * stages.length)];
}

// ---------- VERSUS: los dos frente a frente antes de pelear (se salta con Enter / clic) ----------
let vsThen = null, vsTimer = 0, vsAt = 0, vsReady = true, vsWaiting = false;
const vsBar = k => { $('vsLoad').querySelector('i').style.width = Math.round(k * 100) + '%'; $('vsLoad').querySelector('span').textContent = 'CARGANDO ' + Math.round(k * 100) + '%'; };
function versus(c1, c2, then, vsCpu) {
  // se elige el escenario ya y se cargan escenario y poses de los dos; la pelea no parte hasta que esté todo
  const a = c1, b = c2.id === c1.id ? altOf(c2) : c2;
  const extra = [a, b].filter(c => c.super && c.super.kind === 'duo').map(c => ROSTER.find(r => r.id === c.super.partner)).filter(Boolean);
  game.nextStage = pickStage(c1, c2, vsCpu);
  vsReady = false; vsBar(0);
  const loadT = setTimeout(() => $('vsLoad').hidden = false, 900); // si tarda, se muestra la barra
  Promise.all([a, b].map(c => loadSprites(c, ['idle'], true))).then(() => { if (!$('vsScreen').hidden) vsSides(c1, c2); });
  preloadFight([a, b, ...extra], game.nextStage, vsBar).then(() => { clearTimeout(loadT); vsBar(1); vsReady = true; $('vsLoad').hidden = true; if (vsWaiting) vsGo(); });
  vsSides(c1, c2);
  show('vsScreen');
  // reinicia las animaciones de entrada
  $('vsScreen').querySelectorAll('*').forEach(e => { e.style.animation = 'none'; void e.offsetWidth; e.style.animation = ''; });
  Audio.sfx('menu_select', 0.8); setTimeout(() => Audio.hit(true), 560);
  vsThen = then; vsAt = performance.now(); clearTimeout(vsTimer); vsTimer = setTimeout(vsGo, 2800);
}
// los dos luchadores en grande (se redibuja si la guardia llega tarde)
function vsSides(c1, c2) {
  [['L', c1], ['R', c2]].forEach(([s, ch]) => {
    const cv = $('vsCan' + s), g = cv.getContext('2d'), set = spriteSet(ch);
    g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false;
    const img = set ? (s === 'R' && set.idle._L) || set.idle : portrait(ch, 400), k = Math.min(cv.width / img.width, cv.height / img.height);
    g.drawImage(img, (cv.width - img.width * k) / 2, cv.height - img.height * k, img.width * k, img.height * k);
    cv.parentElement.style.setProperty('--c', ch.accent);
    $('vsName' + s).textContent = ch.name;
    $('vsTag' + s).textContent = ch.secret ? 'RETADOR SECRETO' : ch.boss ? 'JEFE FINAL' : '';
  });
}
function vsGo() {
  if (!vsThen) return;
  if (!vsReady) { vsWaiting = true; $('vsLoad').hidden = false; return; } // todavía cargando: espera en la pantalla VS
  vsWaiting = false; const f = vsThen; vsThen = null; clearTimeout(vsTimer); f();
}
const vsSkip = () => { if (performance.now() - vsAt > 600) vsGo(); };
$('vsScreen').addEventListener('click', vsSkip);
addEventListener('keydown', e => { if (!$('vsScreen').hidden && ['Enter', 'Space', 'Escape'].includes(e.code)) { e.preventDefault(); vsSkip(); } });
// ---------- CAMPEÓN: le ganó a toda la torre ----------
// su pose de victoria en grande, el logo y los rivales vencidos tachados
let champAt = 0;
function champion(ch, note) {
  const cv = $('champCan'), g = cv.getContext('2d'), set = spriteSet(ch);
  g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false;
  const img = set ? set.winMatch || set.winRound || set.idle : portrait(ch, 400), k = Math.min(cv.width / img.width, (cv.height - 90) / img.height);
  g.drawImage(img, (cv.width - img.width * k) / 2, cv.height - img.height * k, img.width * k, img.height * k);
  $('champScreen').style.setProperty('--c', ch.accent);
  $('champName').textContent = ch.name;
  $('champNote').textContent = note || '';
  const row = $('champRivals'); row.innerHTML = '';
  tower.list.forEach((c, i) => { const p = portrait(c, 96); p.style.animationDelay = (1.6 + i * 0.12) + 's'; row.appendChild(p); });
  // papel picado del color de cada rival vencido
  const conf = $('champConfetti'); conf.innerHTML = '';
  for (let i = 0; i < 70; i++) {
    const s = document.createElement('i'), c = tower.list[i % tower.list.length];
    s.style.cssText = `left:${Math.random() * 100}%;background:${i % 3 ? c.accent : '#ffe14d'};animation-delay:${(0.9 + Math.random() * 2.5).toFixed(2)}s;animation-duration:${(2.6 + Math.random() * 2).toFixed(2)}s;--r:${Math.round(Math.random() * 720 - 360)}deg`;
    conf.appendChild(s);
  }
  $('champBtns').hidden = true; setTimeout(() => { $('champBtns').hidden = false; }, 3500);
  show('champScreen');
  $('champScreen').querySelectorAll('*').forEach(e => { e.style.animationName = 'none'; void e.offsetWidth; e.style.animationName = ''; });
  champAt = performance.now();
  Audio.playMusic('victory'); setTimeout(() => Audio.sfx('crowd', 0.9), 1150);
}

function uploadFace(ch, file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    // reducir a 256px para no reventar el storage
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'), s = 256, sc = s / Math.min(img.width, img.height);
      c.width = c.height = s;
      c.getContext('2d').drawImage(img, (s - img.width * sc) / 2, (s - img.height * sc) / 2, img.width * sc, img.height * sc);
      const url = c.toDataURL('image/png');
      store.set('face:' + ch.id, url);
      faceImgs[ch.id] = c; renderSelect();
    };
    img.src = r.result;
  };
  r.readAsDataURL(file);
}

function pickCard(i) {
  Audio.init(); Audio.sfx('menu_select', 0.8);
  const who = twoPick() && sel.locked[0] ? 1 : 0;
  if (isRnd(i)) i = Math.floor(Math.random() * PLAYABLE.length);
  sel.p[who] = i;
  sel.locked[who] = true;
  Audio.sfx('super_start', 0.45);
  // se espera a que termine la burla del panel antes de seguir
  // 1 jugador: se arma la torre de rivales
  if (sel.mode === 'cpu') { renderSelect(); setTimeout(() => startTower(PLAYABLE[i]), 900); return; }
  renderSelect();
  if (sel.locked[0] && sel.locked[1]) setTimeout(beginFight, 1000);
}

function beginFight() {
  const [c1, c2] = [PLAYABLE[sel.p[0]], PLAYABLE[sel.p[1]]];
  const cpu = sel.mode === 'arcade';
  const opts = sel.mode === 'practice' ? { practice: true } : cpu ? { level: DIFF[settings.diff].lv } : {};
  versus(c1, c2, () => { show(null); Audio.voice('next'); game.start(c1, c2, cpu, opts); }, cpu);
}

function openSelect(mode) {
  Audio.init();
  sel.mode = mode; sel.locked = [false, false];
  sel.p = sel.p.map(p => Math.min(p, PLAYABLE.length - 1));
  Audio.playMusic('menu');
  show('selectScreen'); renderSelect();
}

// navegación por teclado en selección
let moveSnd = null;
addEventListener('keydown', e => {
  if ($('selectScreen').hidden) return;
  const who = twoPick() && sel.locked[0] ? 1 : 0;
  const n = PLAYABLE.length + 1; // + la casilla al azar
  const cols = parseInt(getComputedStyle($('roster')).getPropertyValue('--cols')) || 5; // las mismas columnas que la grilla
  const mv = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1, ArrowUp: -cols, KeyW: -cols, ArrowDown: cols, KeyS: cols }[e.code];
  if (mv) {
    sel.p[who] = (sel.p[who] + mv + n) % n; renderSelect();
    // scratch de DJ: corta el anterior para que no se amontonen al mover rápido
    if (moveSnd) try { moveSnd.stop(); } catch (err) { /* ya terminó */ }
    moveSnd = Audio.sfx('menu_move', 0.8); e.preventDefault();
  }
  if (['Enter', 'Space', 'KeyK'].includes(e.code)) { pickCard(sel.p[who]); e.preventDefault(); }
  if (e.code === 'Backspace' || e.code === 'Escape') { if (sel.locked[0] && !sel.locked[1]) { sel.locked[0] = false; renderSelect(); } else show('titleScreen'); }
});

$('btnRematch').addEventListener('click', () => { Audio.init(); if (tower.on) return towerFight(); restartFight(); });
$('towerScreen').addEventListener('click', towerSkip);
addEventListener('keydown', e => { if (!$('towerScreen').hidden && ['Enter', 'Space', 'KeyK'].includes(e.code)) { e.preventDefault(); towerSkip(); } });
const toMenu = () => { tower.on = false; clearTimeout(towerTimer); game.phase = 'menu'; game.f = []; Audio.playMusic('menu'); show('titleScreen'); };
$('btnMenu').addEventListener('click', toMenu);
$('btnChampMenu').addEventListener('click', toMenu);
$('btnChampAgain').addEventListener('click', () => { game.phase = 'menu'; game.f = []; openSelect('cpu'); });
$('btnResume').addEventListener('click', togglePause);
$('btnTouchPause').addEventListener('click', togglePause);
$('btnQuit').addEventListener('click', () => { game.paused = false; $('pauseMenu').hidden = true; toMenu(); });
$('btnRestart').addEventListener('click', restartFight);
$('btnPauseCtl').addEventListener('click', () => openOpt('teclas', () => { show(null); $('pauseMenu').hidden = false; paintPause(); }));
function updateMuteBtn() { $('btnMute').textContent = Audio.muted ? '🔇' : '🔊'; }
$('btnMute').addEventListener('click', () => { Audio.init(); Audio.toggleMute(); updateMuteBtn(); });

// ---------- PANTALLA COMPLETA: botón ⛶; en celular se activa sola con el primer toque y se fija apaisada ----------
const fullOK = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
function enterFull() {
  const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || document.fullscreenElement || document.webkitFullscreenElement) return;
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
  } catch (e) { /* el navegador no lo permite (iPhone): se juega igual */ }
}
function toggleFull() {
  if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else enterFull();
}
// iPhone no tiene pantalla completa en Safari: el botón explica cómo agregarlo a inicio (abierto desde ahí ya va sin barras)
const isIOS = /iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !fullOK);
const standalone = navigator.standalone || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
$('btnFull').hidden = standalone || !(fullOK || isIOS);
$('btnFull').addEventListener('click', () => { if (fullOK) toggleFull(); else $('iosHelp').hidden = false; });
$('btnIosOk').addEventListener('click', () => { $('iosHelp').hidden = true; });
// Safari de iPhone ignora user-scalable=no: se cortan a mano el pellizco y el doble toque que hacen zoom
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
let lastTouchEnd = 0;
document.addEventListener('touchend', e => { const now = e.timeStamp; if (now - lastTouchEnd < 350) e.preventDefault(); lastTouchEnd = now; }, { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
if (isTouch && fullOK) addEventListener('pointerdown', function first() { removeEventListener('pointerdown', first); enterFull(); });
updateMuteBtn();

// controles táctiles (J1)
document.querySelectorAll('#touch [data-a]').forEach(btn => {
  const a = btn.dataset.a;
  const down = e => { e.preventDefault(); Audio.init(); if (!touchDown.has(a)) pressedQueue[0].push(a); touchDown.add(a); btn.classList.add('on'); };
  const up = e => { e.preventDefault(); touchDown.delete(a); btn.classList.remove('on'); };
  btn.addEventListener('pointerdown', down); btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up); btn.addEventListener('pointerleave', up);
});

// joystick táctil (J1): la base aparece donde se apoya el dedo y la bolita lo sigue.
// Inclinado a un lado = caminar (hacia atrás también cubre); hacia arriba = saltar (en diagonal, salto con avance).
(function stickSetup() {
  const zone = $('stick'), base = zone.querySelector('.stick-base'), knob = zone.querySelector('.stick-knob'), R = 48;
  let id = null, cx = 0, cy = 0;
  const set = (a, on) => { if (on && !touchDown.has(a)) { pressedQueue[0].push(a); touchDown.add(a); } else if (!on) touchDown.delete(a); };
  const move = (x, y) => {
    let dx = x - cx, dy = y - cy; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    set('left', dx < -R * 0.35); set('right', dx > R * 0.35); set('up', dy < -R * 0.55); set('down', dy > R * 0.55);
  };
  const end = e => {
    if (e.pointerId !== id) return;
    id = null; zone.classList.remove('on'); knob.style.transform = ''; base.style.left = base.style.top = '';
    ['left', 'right', 'up', 'down'].forEach(a => touchDown.delete(a));
  };
  zone.addEventListener('pointerdown', e => {
    e.preventDefault(); Audio.init(); if (id !== null) return;
    id = e.pointerId; try { zone.setPointerCapture(id); } catch (err) { /* sin captura igual funciona dentro de la zona */ }
    zone.classList.add('on');
    const r = zone.getBoundingClientRect(); cx = e.clientX; cy = e.clientY;
    base.style.left = (cx - r.left) + 'px'; base.style.top = (cy - r.top) + 'px';
    move(e.clientX, e.clientY);
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId === id) move(e.clientX, e.clientY); });
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
})();

// navegador interno de Instagram, Facebook, TikTok, etc.: avisa y ofrece abrir el juego en el navegador del teléfono.
// En Android se puede abrir Chrome directo; en iPhone hay que hacerlo desde el menú ⋯ de la app.
(function inAppBrowser() {
  const ua = navigator.userAgent || '';
  // ?ig fuerza el aviso para probarlo desde un navegador normal
  if (!(/Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|musical_ly|Snapchat|Twitter/i.test(ua) || /[?&]ig\b/.test(location.search))) return;
  const android = /Android/i.test(ua), url = location.href.split('#')[0];
  $('inApp').hidden = false;
  if (android) $('inAppOpen').onclick = () => { location.href = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end'; };
  else {
    $('inAppOpen').hidden = true;
    $('inAppMsg').innerHTML = 'Instagram abre el juego en su propio navegador, que corta el sonido y la pantalla completa.<br><br>Toca <b>⋯</b> arriba a la derecha y elige <b>Abrir en el navegador externo</b> (o copia el link y pégalo en Safari).';
  }
  $('inAppCopy').onclick = () => {
    const ok = () => { $('inAppCopy').textContent = '¡LINK COPIADO!'; };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, () => prompt('Copia este link:', url)); else prompt('Copia este link:', url);
  };
  $('inAppSkip').onclick = () => { $('inApp').hidden = true; };
})();
// ============================================================
//  MENÚ PRINCIPAL: lista de modos + imagen animada del modo elegido.
//  Si nadie toca nada unos segundos, el menú va pasando solo por los modos.
// ============================================================
const MENU = [
  { id: 'cpu', name: 'HISTORIA', ic: '👑', c: '#ffd23f', desc: 'Sube la torre: 6 rivales, el jefe final y un retador secreto.', go: () => openSelect('cpu') },
  { id: 'arcade', name: 'ARCADE', ic: '🕹️', c: '#ff3fa4', desc: 'Una pelea contra la CPU. Tú eliges a tu rapero y a tu rival.', go: () => openSelect('arcade') },
  { id: 'pvp', name: '1 VS 1', ic: '⚔️', c: '#3fd0ff', desc: 'Dos jugadores en el mismo teclado o con dos controles.', go: () => openSelect('pvp') },
  { id: 'practice', name: 'PRÁCTICA', ic: '🥊', c: '#7dff9a', desc: 'Entrena sin reloj: vida y barra infinitas, y el rival no ataca.', go: () => openSelect('practice') },
  { id: 'movs', name: 'MOVIMIENTOS', ic: '📖', c: '#b06bff', desc: 'Los golpes y poderes de cada rapero.', go: () => openOpt('movs', toTitle) },
  { id: 'ajustes', name: 'AJUSTES', ic: '⚙️', c: '#ff8a1f', desc: 'Dificultad, sonido, calidad de imagen y teclas.', go: () => openOpt('ajustes', toTitle) },
];
const menu = { i: 0, t0: 0, idleAt: 0, autoAt: 0, cast: {}, ready: false };
const toTitle = () => show('titleScreen');
let vsArt = null; Loader.img('assets/ui/vs.png').then(img => { vsArt = img; });
(function buildMenu() {
  const nav = $('mainMenu');
  MENU.forEach((it, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mrow'; b.style.setProperty('--c', it.c);
    b.innerHTML = `<span class="ic">${it.ic}</span><span>${it.name}</span><span class="n">${String(i + 1).padStart(2, '0')}</span>`;
    b.addEventListener('mouseenter', () => { if (!isTouch && menu.i !== i) setMenu(i); });
    b.addEventListener('click', () => { Audio.init(); if (!menu.ready) return; if (menu.i !== i) setMenu(i); menuGo(); });
    nav.appendChild(b);
  });
})();
// reparto de la imagen: raperos y escenario al azar entre los que ya cargaron (cambia cada vez)
function menuCast() {
  const pool = ROSTER.filter(c => !c.boss && !c.secret && !c.standIn && isUnlocked(c) && spriteSet(c)).sort(() => Math.random() - 0.5);
  const stages = STAGES.filter(s => !s.off && s.bg && stageImgs[s.bg] && !ROSTER.some(c => c.boss && c.home === s.name));
  const boss = ROSTER.find(c => c.boss && !c.standIn);
  pool.slice(0, 3).forEach(c => loadSprites(c, ['punch', 'punchH', 'kick', 'kickH', 'hit', 'taunt', 'finisher', 'winMatch']));
  return { a: pool[0], b: pool[1], c: pool[2], boss, stage: stages[Math.floor(Math.random() * stages.length)] };
}
function setMenu(i, auto) {
  const now = performance.now();
  menu.i = (i + MENU.length) % MENU.length; menu.t0 = now; menu.cast = menuCast();
  if (!auto) { menu.idleAt = now; Audio.sfx('menu_move', 0.6); }
  [...$('mainMenu').children].forEach((b, k) => b.classList.toggle('on', k === menu.i));
  const it = MENU[menu.i];
  $('menuTitle').textContent = it.name; $('menuTitle').style.color = it.c; $('menuDesc').textContent = it.desc;
  // el fondo de la portada cambia con cada modo
  if (game.phase === 'menu' && menu.cast.stage) game.stage = menu.cast.stage;
}
function menuGo() { if (!menu.ready) return; Audio.sfx('menu_select', 0.8); MENU[menu.i].go(); }
function menuEnter() { const now = performance.now(); menu.idleAt = now; menu.autoAt = now; setMenu(menu.i, true); }
function menuKey(e) {
  const c = e.code;
  menu.idleAt = performance.now();
  if (c === 'ArrowUp' || c === 'KeyW') setMenu(menu.i - 1);
  else if (c === 'ArrowDown' || c === 'KeyS') setMenu(menu.i + 1);
  else if (c === 'Enter' || c === 'Space') menuGo();
  else return;
  e.preventDefault();
}
$('titleScreen').addEventListener('pointerdown', () => { menu.idleAt = performance.now(); });
// un dibujo de un rapero en la imagen del menú (misma escala que en la pelea: todo relativo a su guardia)
function artPose(g, ch, pose, x, footY, h, flip, o = {}) {
  const set = ch && spriteSet(ch); if (!set) return;
  let img = set[pose] || set.idle; if (flip && img._L) img = img._L;
  const k = h / set.idle.height, w = img.width * k, hh = img.height * k, fx = img._footX ?? 0.5;
  g.save(); g.translate(x, footY); if (flip) g.scale(-1, 1); g.globalAlpha = o.a ?? 1;
  g.drawImage(o.sil ? tintOf(img, o.sil) : img, -w * fx, -hh, w, hh); g.restore();
}
function artText(g, text, x, y, size, fill, align = 'center') {
  g.font = '400 ' + size + 'px "Bungee", system-ui, sans-serif'; g.textAlign = align; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  g.lineWidth = size * 0.22; g.strokeStyle = '#14061c'; g.strokeText(text, x, y); g.fillStyle = fill; g.fillText(text, x, y);
}
function artStar(g, x, y, r, color) {
  g.save(); g.translate(x, y); g.fillStyle = color; g.strokeStyle = '#14061c'; g.lineWidth = 5; g.beginPath();
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? r * 0.5 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath(); g.stroke(); g.fill(); g.restore();
}
// una escena por modo. t = segundos desde que se eligió; c = reparto; el piso de la imagen está en y = 520
const ART = {
  cpu(g, t, c) { // la torre: tres peldaños que suben hasta el jefe en sombra
    [[130, 520, 230, c.a], [300, 440, 205, c.b], [455, 365, 180, c.c]].forEach(([x, y, h, ch], i) => {
      g.fillStyle = 'rgba(12,6,20,0.82)'; g.fillRect(x - 85, y, 170, 560 - y); g.fillStyle = '#ffd23f'; g.fillRect(x - 85, y, 170, 6);
      artText(g, 'PISO ' + (i + 1), x, y + 34, 18, 'rgba(255,255,255,0.7)');
      artPose(g, ch, 'idle', x, y + Math.sin(t * 3 + i) * 2, h);
    });
    g.fillStyle = 'rgba(12,6,20,0.9)'; g.fillRect(560, 320, 240, 240); g.fillStyle = '#ff3b3b'; g.fillRect(560, 320, 240, 6);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    g.save(); g.shadowColor = '#ff3b3b'; g.shadowBlur = 20 + pulse * 26; artPose(g, c.boss, 'idle', 680, 320, 225, true, { sil: '#07070b' }); g.restore();
    artText(g, '👑 ???', 680, 62 + pulse * 4, 32, '#ffd23f'); artText(g, 'JEFE FINAL', 680, 360, 20, '#ff3b3b');
  },
  arcade(g, t, c) { // un golpe cada 1,6 segundos
    const k = t % 1.6, hit = k > 0.8 && k < 1.35, sh = hit && k < 1 ? (Math.random() - 0.5) * 10 : 0;
    g.save(); g.translate(sh, sh * 0.5);
    artPose(g, c.b, hit ? 'hit' : 'idle', hit ? 575 : 545, 520, 300, true);
    artPose(g, c.a, hit ? 'punchH' : 'idle', hit ? 300 : 255, 520, 300);
    if (hit) { artStar(g, 445, 285, 62 + Math.sin(t * 40) * 8, '#ffd23f'); artText(g, ['¡PAM!', '¡PUM!', '¡ZAS!'][Math.floor(t / 1.6) % 3], 445, 298, 30, '#fff'); }
    g.restore();
    artText(g, 'TÚ', 150, 70, 34, '#3fd0ff'); artText(g, 'CPU', 650, 70, 34, '#ff3fa4');
  },
  pvp(g, t, c) { // dos jugadores frente a frente
    g.save(); g.globalAlpha = 0.35; g.fillStyle = '#3fd0ff'; g.beginPath(); g.moveTo(0, 0); g.lineTo(460, 0); g.lineTo(340, 560); g.lineTo(0, 560); g.fill();
    g.fillStyle = '#ff3fa4'; g.beginPath(); g.moveTo(460, 0); g.lineTo(800, 0); g.lineTo(800, 560); g.lineTo(340, 560); g.fill(); g.restore();
    const inK = 1 - Math.pow(1 - Math.min(1, t / 0.4), 3);
    artPose(g, c.a, 'idle', -80 + inK * 300, 520 + Math.sin(t * 3) * 2, 320);
    artPose(g, c.b, 'idle', 880 - inK * 300, 520 + Math.sin(t * 3 + 1) * 2, 320, true);
    if (vsArt && t > 0.3) { const s = 190 * (1 + 0.05 * Math.sin(t * 5)); g.drawImage(vsArt, 400 - s / 2, 250 - s * vsArt.height / vsArt.width / 2, s, s * vsArt.height / vsArt.width); }
    artText(g, 'J1', 120, 70, 40, '#3fd0ff'); artText(g, 'J2', 680, 70, 40, '#ff3fa4');
  },
  practice(g, t, c) { // golpes en cadena contra un sparring gris
    const seq = ['punch', 'kick', 'punchH', 'kickH'], n = Math.floor(t / 0.55) % seq.length, k = (t % 0.55) / 0.55, hit = k < 0.6;
    g.save(); g.strokeStyle = 'rgba(125,255,154,0.25)'; g.lineWidth = 2;
    for (let x = 0; x <= 800; x += 80) { g.beginPath(); g.moveTo(x, 380); g.lineTo(400 + (x - 400) * 1.8, 560); g.stroke(); }
    for (let y = 380; y <= 560; y += 36) { g.beginPath(); g.moveTo(0, y); g.lineTo(800, y); g.stroke(); }
    g.restore();
    artPose(g, c.b, 'idle', 560 + (hit ? 10 : 0), 520, 300, true, { sil: hit && k < 0.2 ? '#ffffff' : '#5a5f73' });
    artPose(g, c.a, hit ? seq[n] : 'idle', 290, 520, 300);
    if (hit) artStar(g, 455, n % 2 ? 380 : 300, 36 * (1 - k), '#7dff9a');
    artText(g, '∞', 400, 110, 110, '#7dff9a'); artText(g, 'SIN RELOJ · VIDA Y BARRA INFINITAS', 400, 150, 20, '#fff');
  },
  movs(g, t, c) { // un rapero en su pose de poder y sus tres poderes
    const ch = c.a; if (!ch) return;
    g.save(); g.translate(250, 330); g.rotate(t * 0.4); g.globalAlpha = 0.3; g.fillStyle = ch.accent;
    for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(700, -70); g.lineTo(700, 70); g.fill(); }
    g.restore();
    artPose(g, ch, 'finisher', 250, 525, 330);
    [['PODER', ch.special.name, '#3fd0ff'], ['ESPECIAL', exOf(ch).name, '#b06bff'], ['SÚPER', ch.super.name, '#ffd23f']].forEach(([tag, name, col], i) => {
      const y = 170 + i * 110, a = Math.min(1, Math.max(0, (t - 0.15 * i) / 0.25)), x = 470 + (1 - a) * 80;
      g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(12,6,20,0.88)'; g.fillRect(x, y, 310, 84); g.fillStyle = col; g.fillRect(x, y, 8, 84);
      artText(g, tag, x + 22, y + 32, 20, col, 'left');
      let size = 24; g.font = '400 24px "Bungee", system-ui, sans-serif'; while (g.measureText(name).width > 276 && size > 12) { size--; g.font = '400 ' + size + 'px "Bungee", system-ui, sans-serif'; }
      artText(g, name, x + 22, y + 66, size, '#fff', 'left'); g.restore();
    });
  },
  ajustes(g, t, c) { // las teclas de ahora y tres perillas
    const cap = (x, y, label, col) => { const w = Math.max(64, 30 + label.length * 22); g.fillStyle = '#14061c'; g.fillRect(x - 4, y - 4, w + 8, 72); g.fillStyle = col; g.fillRect(x, y, w, 58); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + 48, w, 10);
      g.font = '400 30px "Bungee", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#14061c'; g.fillText(label, x + w / 2, y + 40); return w + 14; };
    const K = a => keyName(KEYMAPS[0][a][0]), bob = i => Math.sin(t * 4 + i) * 4;
    cap(150, 110 + bob(0), K('up'), '#fff'); let x = 72; ['left', 'down', 'right'].forEach((a, i) => { x += cap(x, 190 + bob(i + 1), K(a), '#fff'); });
    x = 400; ['punch', 'punchH'].forEach((a, i) => { x += cap(x, 110 + bob(i + 4), K(a), '#ffd23f'); });
    x = 400; ['kick', 'kickH'].forEach((a, i) => { x += cap(x, 190 + bob(i + 6), K(a), '#ff3fa4'); });
    x = 580; ['special', 'ex', 'super'].forEach((a, i) => { x += cap(x, 150 + bob(i + 8), K(a), ['#3fd0ff', '#b06bff', '#ffd23f'][i]) - 6; });
    [['DIFICULTAD', DIFF[settings.diff].name, { facil: 0.2, normal: 0.55, dificil: 0.9 }[settings.diff]], ['SONIDO', Audio.muted ? 'NO' : 'SÍ', Audio.muted ? 0.05 : 0.8], ['IMAGEN', settings.quality === 'alta' ? 'ALTA' : 'NORMAL', settings.quality === 'alta' ? 0.9 : 0.5]].forEach(([name, val, k], i) => {
      const y = 330 + i * 66; artText(g, name, 80, y + 8, 22, '#fff', 'left'); artText(g, val, 730, y + 8, 22, '#ff8a1f', 'right');
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(290, y - 8, 300, 14); g.fillStyle = '#ff8a1f'; g.fillRect(290, y - 8, 300 * k, 14); g.fillStyle = '#fff'; g.fillRect(286 + 300 * k, y - 16, 10, 30);
    });
  },
};
function drawMenuArt(now) {
  const cv = $('menuArt'), g = cv.getContext('2d'), it = MENU[menu.i], t = (now - menu.t0) / 1000, c = menu.cast;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false;
  const bg = c.stage && stageImgs[c.stage.bg];
  if (bg) { const k = Math.max(cv.width / bg.width, cv.height / bg.height) * (1.1 + Math.min(0.08, t * 0.006)); g.drawImage(bg, (cv.width - bg.width * k) / 2, (cv.height - bg.height * k) * 0.8, bg.width * k, bg.height * k); }
  else { g.fillStyle = '#1a0b2e'; g.fillRect(0, 0, cv.width, cv.height); }
  const tint = g.createLinearGradient(0, 0, 0, cv.height); tint.addColorStop(0, hexA(it.c, 0.3)); tint.addColorStop(1, 'rgba(12,6,20,0.72)');
  g.fillStyle = tint; g.fillRect(0, 0, cv.width, cv.height);
  g.save(); ART[it.id](g, t, c); g.restore();
  // destello de entrada al cambiar de modo
  if (t < 0.22) { g.fillStyle = 'rgba(255,255,255,' + (0.7 * (1 - t / 0.22)) + ')'; g.fillRect(0, 0, cv.width, cv.height); }
}
function menuTick(now) {
  // nadie toca nada: a los 7 segundos el menú empieza a pasar solo por los modos
  if (menu.ready && now - menu.idleAt > 7000 && now - menu.autoAt > 3800) { menu.autoAt = now; setMenu(menu.i + 1, true); }
  drawMenuArt(now);
}

// ============================================================
//  AJUSTES · CONTROLES Y TECLAS · MOVIMIENTOS (pantalla #optScreen)
// ============================================================
const opt = { page: 'ajustes', i: 0, ch: 0, back: toTitle, rows: [] };
const KEY_ROWS = [['left', 'IZQUIERDA', 'cruceta'], ['right', 'DERECHA', 'cruceta'], ['up', 'SALTAR', 'arriba'], ['down', 'AGACHARSE', 'abajo'], ['punch', 'GOLPE', 'X / □'], ['punchH', 'GOLPE FUERTE', 'Y / △'],
  ['kick', 'PATADA', 'A / ✕'], ['kickH', 'PATADA FUERTE', 'B / ○'], ['special', 'PODER', 'LB / L1'], ['ex', 'ESPECIAL', 'RB / R1'], ['super', 'SÚPER', 'LT / RT'], ['taunt', 'BURLA', 'Select']];
function openOpt(page, back, i = 0) {
  Audio.init(); remap.wait = null;
  opt.page = page; opt.i = i; if (back) opt.back = back;
  $('pauseMenu').hidden = true;
  show('optScreen'); renderOpt();
}
function optRows() {
  if (opt.page === 'ajustes') return [
    { label: 'DIFICULTAD', sub: 'de la CPU en Historia y Arcade', value: '◄ ' + DIFF[settings.diff].name + ' ►', act: d => { const k = Object.keys(DIFF); settings.diff = k[(k.indexOf(settings.diff) + (d || 1) + k.length) % k.length]; store.set('set:diff', settings.diff); } },
    { label: 'SONIDO', value: Audio.muted ? 'NO' : 'SÍ', act: () => { Audio.toggleMute(); updateMuteBtn(); } },
    { label: 'CALIDAD DE IMAGEN', sub: 'NORMAL si el juego va lento', value: settings.quality === 'alta' ? 'ALTA' : 'NORMAL', act: () => { settings.quality = settings.quality === 'alta' ? 'normal' : 'alta'; store.set('set:quality', settings.quality); fitCanvas(); } },
    { label: 'CONTROLES Y TECLAS', value: '►', act: d => { if (!d) { const b = opt.back; openOpt('teclas', () => openOpt('ajustes', b, 3)); } } },
    { label: 'VOLVER', value: '', back: true },
  ];
  return [
    ...KEY_ROWS.map(([a, name, pad]) => ({ label: name, sub: '🎮 ' + pad, wait: remap.wait === a, value: remap.wait === a ? 'APRIETA UNA TECLA…' : keyName(KEYMAPS[0][a][0]), act: d => { if (!d) remap.wait = a; } })),
    { label: 'TECLAS DE FÁBRICA', value: '↺', act: d => { if (!d) { applyKeys(null); for (const k of Object.keys(keyLabels)) delete keyLabels[k]; saveKeys(); } } },
    { label: 'VOLVER', value: '', back: true },
  ];
}
function renderOpt() {
  const body = $('optBody'); body.innerHTML = '';
  if (opt.page === 'movs') return renderMovs(body);
  $('optTitle').textContent = opt.page === 'ajustes' ? 'AJUSTES' : 'CONTROLES Y TECLAS';
  body.className = 'opt-body' + (opt.page === 'teclas' ? ' cols' : '');
  opt.rows = optRows(); opt.i = Math.min(opt.i, opt.rows.length - 1);
  opt.rows.forEach((r, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'orow' + (i === opt.i ? ' on' : '') + (r.wait ? ' wait' : '');
    b.innerHTML = `<span>${r.label}${r.sub ? ` <small>${r.sub}</small>` : ''}</span><span class="v">${r.value}</span>`;
    b.addEventListener('click', () => { opt.i = i; optAct(0); });
    body.appendChild(b);
  });
  $('optHint').innerHTML = opt.page === 'teclas'
    ? 'Elige una acción, aprieta <kbd>Enter</kbd> y después la tecla nueva · Teclas del jugador 1 · <kbd>Esc</kbd> volver'
    : '<kbd>↑</kbd><kbd>↓</kbd> elegir · <kbd>←</kbd><kbd>→</kbd> o <kbd>Enter</kbd> cambiar · <kbd>Esc</kbd> volver';
}
function optAct(d) {
  const r = opt.rows[opt.i]; if (!r) return;
  Audio.sfx(d ? 'menu_move' : 'menu_select', 0.7);
  if (r.back) return opt.back();
  if (r.act) r.act(d);
  if (!$('optScreen').hidden) renderOpt();
}
// la tecla nueva de una acción. Si ya era de otra acción del J1, se intercambian
function remapKey(e) {
  e.preventDefault(); e._done = true;
  if (e.repeat) return;
  const a = remap.wait; remap.wait = null;
  if (e.code && !['Escape', 'Enter', 'Tab', 'KeyM', 'MetaLeft', 'MetaRight'].includes(e.code)) {
    const old = KEYMAPS[0][a][0], map = {};
    for (const b of ACTIONS) map[b] = b === a ? e.code : KEYMAPS[0][b][0] === e.code ? old : KEYMAPS[0][b][0];
    applyKeys(map);
    if (e.key && e.key.length === 1 && e.key.trim()) keyLabels[e.code] = e.key.toUpperCase();
    saveKeys(); Audio.sfx('menu_select', 0.7);
  }
  renderOpt();
}
// movimientos: lo que hace cada tecla y los tres poderes del rapero elegido (← → cambian de rapero)
function renderMovs(body) {
  const list = PLAYABLE; opt.ch = (opt.ch + list.length) % list.length; const ch = list[opt.ch];
  const K = a => `<kbd>${keyName(KEYMAPS[0][a][0])}</kbd>`;
  $('optTitle').textContent = 'MOVIMIENTOS'; body.className = 'opt-body movs'; $('optScreen').style.setProperty('--hc', ch.accent);
  const cv = document.createElement('canvas'); cv.width = 300; cv.height = 420; body.appendChild(cv);
  const set = spriteSet(ch), g = cv.getContext('2d');
  if (set) { const img = set.finisher || set.idle, k = Math.min(cv.width / img.width, cv.height / img.height); g.imageSmoothingEnabled = false; g.drawImage(img, (cv.width - img.width * k) / 2, cv.height - img.height * k, img.width * k, img.height * k); }
  const head = document.createElement('div'); head.className = 'orow head';
  head.innerHTML = `<button type="button" aria-label="Anterior">◄</button><span>${ch.name}</span><button type="button" aria-label="Siguiente">►</button>`;
  head.children[0].addEventListener('click', () => { opt.ch--; Audio.sfx('menu_move', 0.6); renderOpt(); });
  head.children[2].addEventListener('click', () => { opt.ch++; Audio.sfx('menu_move', 0.6); renderOpt(); });
  body.appendChild(head);
  [[K('special'), `PODER · <b style="color:#3fd0ff">${ch.special.name}</b>`, 'sin barra'],
    [K('ex'), `ESPECIAL · <b style="color:#b06bff">${exOf(ch).name}</b>`, '2 barras'],
    [K('super'), `SÚPER · <b style="color:#ffd23f">${ch.super.name}</b>`, '3 barras'],
    [K('punch') + ' ' + K('punchH'), 'GOLPE · GOLPE FUERTE', ''],
    [K('kick') + ' ' + K('kickH'), 'PATADA · PATADA FUERTE', 'la fuerte bota al rival'],
    [K('down') + ' + ' + K('punch') + ' / ' + K('kick'), 'PUÑO BAJO · BARRIDA', 'la barrida solo se cubre agachado'],
    [K('right') + K('right'), 'IMPULSO', '+ patada = patada voladora'],
    ['atrás', 'CUBRIRSE', K('up') + ' saltar · en el aire también se pega'],
    [K('taunt'), 'BURLA', ''],
    // combos (los golpes tienen que entrar seguidos): una fila para los de 4 golpes y otra para los de 3
    ...[4, 3].map(n => ['COMBOS ' + n, COMBOS.filter(c => c.seq.length === n).map(c => `<b style="color:${ch.accent}">${comboName(ch, c)}</b> <small>${c.seq.map(m => m === 'crouchPunch' ? '↓' + keyName(KEYMAPS[0].punch[0]) : m === 'crouchKick' ? '↓' + keyName(KEYMAPS[0].kick[0]) : keyName(KEYMAPS[0][m][0])).join(' ')}</small>`).join(' · '), '']),
  ].forEach(([keys, what, note]) => {
    const d = document.createElement('div'); d.className = 'orow info';
    d.innerHTML = `<span>${keys}</span><span class="v" style="color:#fff">${what}${note ? ` <small>${note}</small>` : ''}</span>`; body.appendChild(d);
  });
  const b = document.createElement('button'); b.type = 'button'; b.className = 'orow on'; b.innerHTML = '<span>VOLVER</span><span class="v"></span>';
  b.addEventListener('click', () => { Audio.sfx('menu_select', 0.7); opt.back(); }); body.appendChild(b);
  $('optHint').innerHTML = '<kbd>←</kbd><kbd>→</kbd> cambiar de rapero · <kbd>Enter</kbd> o <kbd>Esc</kbd> volver';
}
function optKey(e) {
  const c = e.code, n = opt.rows.length, grid = opt.page === 'teclas';
  const L = c === 'ArrowLeft' || c === 'KeyA', R = c === 'ArrowRight' || c === 'KeyD', U = c === 'ArrowUp' || c === 'KeyW', D = c === 'ArrowDown' || c === 'KeyS', OK = c === 'Enter' || c === 'Space';
  if (c === 'Escape' || c === 'Backspace') { Audio.sfx('menu_select', 0.6); opt.back(); }
  else if (opt.page === 'movs') { if (L || R) { opt.ch += R ? 1 : -1; Audio.sfx('menu_move', 0.6); renderOpt(); } else if (OK) { Audio.sfx('menu_select', 0.7); opt.back(); } else return; }
  else if (U || D || (grid && (L || R))) { const step = grid && (U || D) ? 2 : 1; opt.i = (opt.i + ((D || R) ? step : -step) + n) % n; Audio.sfx('menu_move', 0.6); renderOpt(); }
  else if (L || R) optAct(R ? 1 : -1);
  else if (OK) optAct(0);
  else return;
  e.preventDefault();
}
// teclas de los menús nuevos: una sola pantalla atiende cada tecla
addEventListener('keydown', e => {
  if (e._done || e.repeat && (e.code === 'Enter' || e.code === 'Space')) return;
  if (!$('optScreen').hidden) optKey(e);
  else if (!$('titleScreen').hidden) menuKey(e);
  else if (game.paused && !$('pauseMenu').hidden) pauseKey(e);
});

// pantalla de carga de la portada: antes de dejar jugar espera las caras, los dibujos de los poderes,
// los efectos, las voces y la música del menú (los temas de pelea y las demás poses siguen bajando de fondo)
(function boot() {
  const jobs = [...ROSTER.map(ch => loadSprites(ch, ['idle'])), ...POWER_ART.map(n => Loader.img('assets/powers/' + n + '.png')), ...Audio.prefetch()];
  const btns = $('mainMenu'), box = $('bootLoad'), bar = box.querySelector('i'), txt = box.querySelector('span');
  btns.style.visibility = 'hidden';
  let n = 0, done = false;
  const finish = () => { if (done) return; done = true; box.hidden = true; btns.style.visibility = ''; menu.ready = true; menuEnter(); };
  jobs.forEach(j => Promise.resolve(j).catch(() => {}).then(() => {
    n++; const k = n / jobs.length;
    bar.style.width = (k * 100) + '%'; txt.textContent = 'CARGANDO ' + Math.round(k * 100) + '%';
    if (n === jobs.length) finish();
  }));
  setTimeout(finish, 45000); // internet muy lento: a los 45 s deja jugar igual
})();
// el sonido se activa con el primer toque, clic o tecla en cualquier parte (también sobre la barra de carga):
// así la música del menú ya suena mientras termina de cargar
for (const ev of ['pointerdown', 'touchend', 'click']) addEventListener(ev, () => Audio.init(), { capture: true, passive: true });
window.__game = game; window.__audio = Audio; window.__menu = { menu, setMenu, openOpt, opt, settings, fitCanvas, KEYMAPS }; window.__tower = { tower, showTower, champion, startTower }; window.__spr = { spriteImgs, altOf, render }; // depuración desde la consola
show('titleScreen');
})();
