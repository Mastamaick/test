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
const ROUND_TIME = 60, ROUNDS_TO_WIN = 2;
const GRAV = 0.9, JUMP_V = 17.5;

const canvas = document.getElementById('game');
let ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);

// ---------- storage seguro ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin storage */ } },
};

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

// ============================================================
//  AUDIO (sintetizado, nada que descargar)
// ============================================================
const Audio = {
  ctx: null, muted: store.get('muted') === '1', musicOn: false, nextBeat: 0, step: 0,
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
  },
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
  hit(heavy) { this.noise(heavy ? 0.18 : 0.1, heavy ? 0.35 : 0.25, heavy ? 300 : 1200); this.tone(heavy ? 90 : 140, 0.12, 'sine', 0.3, -60); },
  block() { this.tone(900, 0.06, 'triangle', 0.12); },
  whoosh() { this.noise(0.08, 0.06, 3000); },
  special() { this.tone(440, 0.25, 'sawtooth', 0.08, 440); },
  superFx() { this.tone(110, 0.8, 'sawtooth', 0.12, 660); this.noise(0.5, 0.15, 500); },
  ko() { this.tone(220, 1.2, 'sawtooth', 0.15, -180); },
  jump() { this.tone(300, 0.08, 'triangle', 0.06, 200); },
  say(text) {
    if (this.muted || !window.speechSynthesis) return;
    try { const u = new SpeechSynthesisUtterance(text); u.lang = 'es-ES'; u.rate = 1.05; u.pitch = 0.6; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* sin voz */ }
  },
  // beat de fondo: 96 bpm, bombo + caja + hat + bajo
  music() {
    if (!this.ctx || this.muted || !this.musicOn) return;
    const spb = 60 / 96 / 2;
    while (this.nextBeat < this.ctx.currentTime + 0.2) {
      const t = this.nextBeat, s = this.step % 16;
      const play = (fn) => fn(t);
      if (s % 4 === 0 || s === 10) play(t => this._kick(t));
      if (s === 4 || s === 12) play(t => this._snare(t));
      play(t => this._hat(t, s % 2 ? 0.02 : 0.04));
      const bass = [55, 0, 55, 0, 0, 0, 65.4, 0, 49, 0, 49, 0, 0, 73.4, 0, 65.4][s];
      if (bass) play(t => this._bass(t, bass));
      this.nextBeat += spb; this.step++;
    }
  },
  _env(t, node, vol, dur) { const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); node.connect(g).connect(this.ctx.destination); return g; },
  _kick(t) { const o = this.ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); this._env(t, o, 0.35, 0.2); o.start(t); o.stop(t + 0.2); },
  _snare(t) { const n = this.ctx.sampleRate * 0.12, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; const s = this.ctx.createBufferSource(); s.buffer = b; this._env(t, s, 0.12, 0.12); s.start(t); },
  _hat(t, v) { const n = this.ctx.sampleRate * 0.03, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; s.buffer = b; s.connect(f); this._env(t, f, v, 0.03); s.start(t); },
  _bass(t, fq) { const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fq; this._env(t, o, 0.22, 0.28); o.start(t); o.stop(t + 0.3); },
  startMusic() { if (!this.ctx) return; this.musicOn = true; this.nextBeat = this.ctx.currentTime + 0.1; },
  stopMusic() { this.musicOn = false; },
  toggleMute() { this.muted = !this.muted; store.set('muted', this.muted ? '1' : '0'); if (this.muted && window.speechSynthesis) speechSynthesis.cancel(); },
};

// ============================================================
//  INPUT
// ============================================================
const KEYMAPS = [
  { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], punch: ['KeyF'], kick: ['KeyG'], special: ['KeyH'], super: ['KeyT'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], punch: ['KeyK', 'Numpad1'], kick: ['KeyL', 'Numpad2'], special: ['Semicolon', 'Numpad3'], super: ['KeyO', 'Numpad4'] },
];
const ACTIONS = ['left', 'right', 'up', 'punch', 'kick', 'special', 'super'];
const keysDown = new Set();
const touchDown = new Set();   // acciones del P1 desde botones táctiles
const pressedQueue = [[], []]; // pulsaciones nuevas por jugador

function codeToAction(code) {
  for (let p = 0; p < 2; p++) for (const a of ACTIONS) if (KEYMAPS[p][a].includes(code)) return [p, a];
  return null;
}
addEventListener('keydown', e => {
  Audio.init();
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyM') { Audio.toggleMute(); updateMuteBtn(); return; }
  const m = codeToAction(e.code);
  if (m) e.preventDefault();
  if (e.repeat || keysDown.has(e.code)) return;
  keysDown.add(e.code);
  if (m) pressedQueue[m[0]].push(m[1]);
});
addEventListener('keyup', e => keysDown.delete(e.code));
addEventListener('blur', () => { keysDown.clear(); touchDown.clear(); });

function humanInput(p) {
  const held = {};
  for (const a of ACTIONS) held[a] = KEYMAPS[p][a].some(c => keysDown.has(c)) || (p === 0 && touchDown.has(a));
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
  kick:    { startup: 8, active: 5, recovery: 15, dmg: 9,  reach: 108, y: 95,  h: 50, kb: 7,  stun: 18, hitstop: 7, wind: 'kickWind', ext: 'kickExt', meter: 9 },
  airkick: { startup: 5, active: 10, recovery: 6, dmg: 8,  reach: 85,  y: 70,  h: 60, kb: 6,  stun: 16, hitstop: 6, wind: 'jump', ext: 'airKick', meter: 8 },
  special: { startup: 13, active: 1, recovery: 22, wind: 'specialWind', ext: 'specialExt' },
  super:   { startup: 50, active: 40, recovery: 25, wind: 'superPose', ext: 'specialExt' },
};
const SPECIAL_COOLDOWN = 75;

// ============================================================
//  LUCHADOR
// ============================================================
class Fighter {
  constructor(ch, idx, ai) {
    this.ch = ch; this.idx = idx; this.ai = ai ? new AI(this) : null;
    this.maxHp = Math.round(100 * ch.stats.hp);
    this.reset();
  }
  reset() {
    this.x = this.idx === 0 ? 380 : W - 380; this.y = 0; this.vx = 0; this.vy = 0;
    this.facing = this.idx === 0 ? 1 : -1;
    this.hp = this.maxHp; this.hpLag = this.maxHp;
    this.meter = this.meter ?? 0;
    this.state = 'idle'; this.sf = 0; this.move = null; this.hasHit = false;
    this.stun = 0; this.cooldown = 0; this.walkC = 0; this.combo = 0; this.flash = 0;
    this.pose = Object.assign({}, POSES.idle); this.blocking = false; this.input = { held: {}, pressed: [] };
    this.buffer = [];
  }
  get grounded() { return this.y <= 0; }
  get busy() { return ['attack', 'hit', 'ko', 'win', 'blockstun', 'land'].includes(this.state); }
  get opp() { return game.f[1 - this.idx]; }

  hurtbox() { return { x: this.x - 32, y: GROUND - this.y - 175, w: 64, h: 175 }; }

  setState(s) { this.state = s; this.sf = 0; }

  startMove(name) {
    this.move = name; this.hasHit = false; this.setState('attack');
    if (name === 'special') { this.cooldown = SPECIAL_COOLDOWN; Audio.special(); }
    else if (name === 'super') { this.meter = 0; game.startSuper(this); Audio.superFx(); }
    else Audio.whoosh();
  }

  update() {
    const inp = this.input;
    const back = this.facing > 0 ? 'left' : 'right';
    const fwd = this.facing > 0 ? 'right' : 'left';
    for (const a of inp.pressed) this.buffer.push({ a, t: 6 });
    this.buffer = this.buffer.filter(b => --b.t > 0);
    const take = (a) => { const i = this.buffer.findIndex(b => b.a === a); if (i < 0) return false; this.buffer.splice(i, 1); return true; };
    this.sf++;
    if (this.cooldown > 0) this.cooldown--;
    if (this.flash > 0) this.flash--;
    this.blocking = false;

    const canAct = game.phase === 'fight' && !this.busy;
    if (canAct) {
      // encarar al rival
      this.facing = this.opp.x >= this.x ? 1 : -1;
      if (this.grounded) {
        if (take('super') && this.meter >= 100) return this.startMove('super');
        if (take('special') && this.cooldown === 0) return this.startMove('special');
        if (take('kick')) return this.startMove('kick');
        if (take('punch')) return this.startMove('punch');
        if (inp.held.up) { this.vy = JUMP_V; this.y = 0.1; this.vx = (inp.held[fwd] ? 1 : inp.held[back] ? -1 : 0) * 6 * this.ch.stats.speed * this.facing; this.setState('jump'); Audio.jump(); return; }
        const sp = 5 * this.ch.stats.speed;
        if (inp.held[fwd]) { this.vx = sp * this.facing; this.state = 'walk'; this.walkC += 0.2; }
        else if (inp.held[back]) { this.vx = -sp * 0.75 * this.facing; this.state = 'walk'; this.walkC -= 0.16; this.blocking = true; }
        else { this.vx = 0; this.state = 'idle'; }
      } else if ((take('kick') || take('punch'))) {
        this.move = 'airkick'; this.hasHit = false; this.state = 'attack'; this.sf = 0; Audio.whoosh();
      }
    }
    // retroceso aguanta bloqueo mientras se esté en blockstun
    if (this.state === 'blockstun') { this.blocking = true; if (this.sf >= this.stun) this.setState('idle'); }
    if (this.state === 'hit' && this.sf >= this.stun && this.grounded) { this.setState('idle'); this.combo = 0; }
    if (this.state === 'land' && this.sf >= 4) this.setState('idle');

    if (this.state === 'attack') this.updateAttack();

    // física
    if (!this.grounded || this.vy > 0) {
      this.vy -= GRAV; this.y += this.vy;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0;
        if (this.state === 'ko') { this.vx *= 0.5; game.shake(6); }
        else if (this.state === 'jump' || (this.state === 'attack' && this.move === 'airkick')) { this.setState('land'); this.vx = 0; }
      }
    }
    this.x += this.vx;
    if (this.grounded && ['hit', 'blockstun', 'ko', 'land'].includes(this.state)) this.vx *= 0.82;
    if (this.state === 'attack' && this.grounded && this.move !== 'super') this.vx *= 0.7;
    this.x = Math.max(ARENA_L, Math.min(ARENA_R, this.x));

    // meter visual
    if (this.hpLag > this.hp) this.hpLag -= Math.max(0.25, (this.hpLag - this.hp) * 0.04);
    this.updatePose();
  }

  updateAttack() {
    const mv = MOVES[this.move], f = this.sf;
    const total = mv.startup + mv.active + mv.recovery;
    if (this.move === 'special' && f === mv.startup) game.spawnProjectile(this);
    if (this.move === 'super') this.updateSuper(f, mv);
    if (MOVES[this.move].dmg && f >= mv.startup && f < mv.startup + mv.active && !this.hasHit) {
      const box = { x: this.facing > 0 ? this.x + 10 : this.x - 10 - mv.reach, y: GROUND - this.y - mv.y - mv.h / 2, w: mv.reach, h: mv.h };
      if (overlap(box, this.opp.hurtbox())) {
        this.hasHit = true;
        game.hit(this, this.opp, { dmg: mv.dmg * this.ch.stats.power, kb: mv.kb, stun: mv.stun, hitstop: mv.hitstop, meter: mv.meter, heavy: this.move !== 'punch', at: { x: box.x + (this.facing > 0 ? box.w : 0), y: box.y + box.h / 2 } });
      }
    }
    if (this.move === 'airkick') { if (this.grounded && f > 2) this.setState('land'); return; }
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
        if (overlap(box, this.opp.hurtbox())) game.hit(this, this.opp, { dmg: 4.2 * this.ch.stats.power, kb: af >= mv.active - 4 ? 14 : 2, stun: 22, hitstop: 2, meter: 0, heavy: true, unblockable: false, chip: 0.35, at: { x: this.opp.x, y } });
      }
    } else if (type === 'rain') {
      if (af < mv.active && af % 5 === 0) game.spawnRain(this);
    } else if (type === 'rush') {
      if (af === 0) this.vx = 24 * this.facing;
      if (af < 22 && !this.hasHit) {
        const box = { x: this.facing > 0 ? this.x : this.x - 80, y: GROUND - this.y - 160, w: 80, h: 140 };
        if (overlap(box, this.opp.hurtbox())) {
          this.hasHit = true; this.vx = 0;
          game.hit(this, this.opp, { dmg: 30 * this.ch.stats.power, kb: 16, stun: 50, hitstop: 18, meter: 0, heavy: true, launch: 13, chip: 0.3, at: { x: this.opp.x, y: GROUND - 120 } });
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
    else if (s === 'land') { target = P({ fl1: 0.9, fl2: -0.5, bl1: 0.2, bl2: -0.9, lean: 0.25 }); t = 0.5; }
    else if (s === 'hit') { target = POSES.hit; t = 0.6; }
    else if (s === 'blockstun' || (this.blocking && this.isThreatened())) { target = POSES.block; t = 0.5; }
    else if (s === 'ko') { target = Object.assign({}, POSES.ko, { rot: this.grounded ? -1.45 : -0.6 }); t = 0.12; }
    else if (s === 'win') { const b = Math.sin(game.time * 0.15) * 0.15; target = Object.assign({}, POSES.win, { fa1: 2.95 + b, fa2: 3.05 + b }); t = 0.2; }
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

  handPos() { const s = this.skeleton(); return { x: this.x + s.fH.x, y: GROUND - this.y + s.fH.y }; }
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
      if (f.meter >= 100 && r < 0.5) pressed.push('super');
      else if (threatened && r < this.level * 0.75) this.plan = Math.random() < 0.25 ? 'jump' : 'block';
      else if (dist > 420) this.plan = f.cooldown === 0 && r < 0.4 ? 'special' : 'approach';
      else if (dist > 130) this.plan = r < 0.55 ? 'approach' : r < 0.7 && f.cooldown === 0 ? 'special' : r < 0.85 ? 'jumpin' : 'wait';
      else this.plan = r < 0.45 ? 'punch' : r < 0.75 ? 'kick' : r < 0.88 ? 'retreat' : 'block';
      if (this.plan === 'punch' || this.plan === 'kick' || this.plan === 'special') { pressed.push(this.plan); this.plan = 'wait'; }
    }
    if (this.plan === 'approach') held[fwd] = dist > 110;
    if (this.plan === 'retreat' || this.plan === 'block') held[back] = true;
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
const game = {
  f: [], projectiles: [], particles: [], texts: [], phase: 'menu', time: 0, timer: ROUND_TIME,
  round: 1, wins: [0, 0], shakeAmt: 0, hitstop: 0, superActor: null, superT: 0, paused: false,
  stage: STAGES[0], banner: null, slowmo: 0, crowdHype: 0,

  start(c1, c2, vsCpu) {
    this.f = [new Fighter(c1, 0, false), new Fighter(c2, 1, vsCpu)];
    this.f.forEach(f => f.meter = 0);
    this.wins = [0, 0]; this.round = 1; this.vsCpu = vsCpu;
    this.stage = STAGES[Math.floor(Math.random() * STAGES.length)];
    this.startRound();
    Audio.startMusic();
  },
  startRound() {
    this.f.forEach(f => f.reset());
    this.projectiles = []; this.particles = []; this.texts = [];
    this.timer = ROUND_TIME; this.phaseT = 0; this.phase = 'intro';
    this.superActor = null; this.hitstop = 0; this.slowmo = 0;
    this.banner = { text: 'ROUND ' + this.round, sub: this.stage.name, t: 0 };
    Audio.say('Round ' + this.round);
  },
  shake(n) { this.shakeAmt = Math.max(this.shakeAmt, n); },

  hit(att, def, o) {
    if (def.state === 'ko') return;
    const blocked = !o.unblockable && def.grounded && def.blocking && def.state !== 'hit' && def.state !== 'attack';
    const at = o.at || { x: def.x, y: GROUND - def.y - 120 };
    if (blocked) {
      def.hp -= o.dmg * (o.chip ?? 0.12);
      def.setState('blockstun'); def.stun = Math.round(o.stun * 0.6); def.vx = -def.facing * o.kb * 0.8;
      def.meter = Math.min(100, def.meter + 3);
      this.hitstop = Math.max(this.hitstop, 3);
      this.sparks(at.x, at.y, '#9fd8ff', 6); Audio.block();
    } else {
      def.hp -= o.dmg; def.flash = 6;
      def.setState('hit'); def.stun = o.stun; def.move = null;
      def.vx = att.facing * o.kb;
      if (o.launch || !def.grounded) { def.vy = o.launch || 8; def.y = Math.max(def.y, 1); }
      att.combo = (def.combo > 0 || def.state === 'hit') ? att.combo + 1 : 1; def.combo = 1;
      att.meter = Math.min(100, att.meter + (o.meter ?? 0) * 1.2 + o.dmg * 0.6);
      def.meter = Math.min(100, def.meter + o.dmg * 0.7);
      this.hitstop = Math.max(this.hitstop, o.hitstop);
      this.shake(o.heavy ? 10 : 5);
      this.sparks(at.x, at.y, att.ch.accent, o.heavy ? 16 : 10);
      Audio.hit(o.heavy);
      this.crowdHype = Math.min(1, this.crowdHype + 0.15);
      if (att.combo >= 2) this.popText(att.idx === 0 ? 210 : W - 210, 260, att.combo + ' HITS', att.ch.accent);
      else if (o.heavy && Math.random() < 0.35) this.popText(at.x, at.y - 40, ['¡PAM!', '¡PUM!', '¡ZAS!', '¡TOMA!'][Math.floor(Math.random() * 4)], '#fff');
    }
    if (def.hp <= 0) this.ko(att, def);
  },
  ko(att, def) {
    def.hp = 0; def.setState('ko'); def.vy = 11; def.y = Math.max(def.y, 1); def.vx = att.facing * 9;
    this.phase = 'ko'; this.phaseT = 0; this.slowmo = 70; this.hitstop = 20; this.shake(18);
    this.wins[att.idx]++;
    this.banner = { text: 'K.O.', t: 0, big: true };
    Audio.ko(); Audio.say('K O');
  },
  timeUp() {
    const [a, b] = this.f, ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
    this.phase = 'ko'; this.phaseT = 0;
    if (Math.abs(ra - rb) < 0.001) { this.banner = { text: 'EMPATE', t: 0, big: true }; }
    else { const w = ra > rb ? a : b; this.wins[w.idx]++; this.banner = { text: 'TIEMPO', t: 0, big: true }; }
    Audio.say('Tiempo');
  },
  startSuper(f) {
    this.superActor = f; this.superT = 0;
    this.banner = { text: f.ch.super.name, sub: f.ch.name, t: 0, superBanner: true, color: f.ch.super.color };
    this.shake(8);
  },
  spawnProjectile(f) {
    const h = f.handPos(), sp = f.ch.special;
    this.projectiles.push({ owner: f, x: h.x + 20 * f.facing, y: h.y, vx: sp.speed * f.facing, vy: 0, type: sp.type, color: sp.color, dmg: 8 * f.ch.stats.power, life: 150, r: 26, t: 0 });
  },
  spawnRain(f) {
    const o = f.opp, sp = f.ch.super;
    this.projectiles.push({ owner: f, x: o.x + (Math.random() - 0.5) * 140, y: -40, vx: 0, vy: 14, type: f.ch.special.type, color: sp.color, dmg: 3.2 * f.ch.stats.power, life: 100, r: 22, t: 0, rain: true });
  },
  sparks(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 9;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 18 + Math.random() * 12, max: 30, color, size: 3 + Math.random() * 4, kind: 'spark' });
    }
    this.particles.push({ x, y, life: 10, max: 10, color: '#fff', size: 50, kind: 'ring' });
  },
  popText(x, y, text, color) { this.texts.push({ x, y, text, color, t: 0 }); },

  update() {
    this.time++;
    if (this.paused) return;
    Audio.music();
    if (this.phase === 'menu' || this.phase === 'over') return;
    if (this.banner) this.banner.t++;
    if (this.banner && this.banner.t > (this.banner.superBanner ? 55 : 95)) this.banner = null;
    this.shakeAmt *= 0.85;
    this.crowdHype *= 0.995;

    if (this.phase === 'intro') {
      this.phaseT++;
      if (this.phaseT === 70) { this.banner = { text: '¡PELEA!', t: 0, big: true }; Audio.say('Pelea'); }
      if (this.phaseT >= 100) this.phase = 'fight';
    }
    if (this.hitstop > 0) { this.hitstop--; this.updateFx(); return; }
    if (this.slowmo > 0) { this.slowmo--; if (this.slowmo % 3) { this.updateFx(); return; } }

    // super: congela al rival durante la pose
    const sa = this.superActor;
    if (sa) { this.superT++; if (this.superT > MOVES.super.startup || sa.state !== 'attack') this.superActor = null; }

    for (const f of this.f) f.input = f.ai && this.phase === 'fight' ? f.ai.input() : (this.phase === 'fight' ? humanInput(f.idx) : { held: {}, pressed: [] });
    if (this.phase !== 'fight') { pressedQueue[0].length = 0; pressedQueue[1].length = 0; }
    for (const f of this.f) { if (sa && f !== sa) continue; f.update(); }

    // separación de cuerpos
    const [a, b] = this.f, dx = b.x - a.x, minD = 58;
    if (Math.abs(dx) < minD && Math.abs(a.y - b.y) < 150 && a.state !== 'ko' && b.state !== 'ko') {
      const push = (minD - Math.abs(dx)) / 2 * Math.sign(dx || 1);
      a.x -= push; b.x += push;
      a.x = Math.max(ARENA_L, Math.min(ARENA_R, a.x)); b.x = Math.max(ARENA_L, Math.min(ARENA_R, b.x));
    }

    if (!sa) this.updateProjectiles();
    this.updateFx();

    if (this.phase === 'fight') {
      if (this.time % 60 === 0 && this.timer > 0) { this.timer--; if (this.timer === 0) this.timeUp(); }
    }
    if (this.phase === 'ko') {
      this.phaseT++;
      if (this.phaseT === 120) {
        const loser = this.f.find(f => f.state === 'ko'), winner = loser ? loser.opp : null;
        if (winner) { winner.setState('win'); this.popText(winner.x, GROUND - 260, winner.ch.quotes[Math.floor(Math.random() * winner.ch.quotes.length)], '#fff'); }
      }
      if (this.phaseT >= 230) {
        const champ = this.wins.findIndex(w => w >= ROUNDS_TO_WIN);
        if (champ >= 0) this.endMatch(champ);
        else { this.round++; this.startRound(); }
      }
    }
  },
  updateProjectiles() {
    for (const p of this.projectiles) {
      p.x += p.vx; p.y += p.vy; p.t++; p.life--;
      const tgt = p.owner.opp, hb = tgt.hurtbox();
      if (p.rain && p.y > GROUND - 10) { p.life = 0; this.sparks(p.x, GROUND - 10, p.color, 5); }
      if (p.life > 0 && overlap({ x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 }, hb)) {
        p.life = 0;
        this.hit(p.owner, tgt, { dmg: p.dmg, kb: p.rain ? 1.5 : 6, stun: p.rain ? 20 : 18, hitstop: p.rain ? 3 : 7, meter: 6, heavy: !p.rain, chip: 0.25, at: { x: p.x, y: p.y } });
      }
      if (p.x < -60 || p.x > W + 60) p.life = 0;
    }
    // proyectiles que chocan entre sí se anulan
    for (const p of this.projectiles) for (const q of this.projectiles) {
      if (p !== q && p.owner !== q.owner && p.life > 0 && q.life > 0 && !p.rain && !q.rain && Math.abs(p.x - q.x) < p.r + q.r && Math.abs(p.y - q.y) < 50) {
        p.life = q.life = 0; this.sparks((p.x + q.x) / 2, p.y, '#fff', 14); Audio.hit(false);
      }
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0);
  },
  updateFx() {
    for (const p of this.particles) { p.life--; if (p.kind === 'spark') { p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy = p.vy * 0.9 + 0.3; } }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const t of this.texts) t.t++;
    this.texts = this.texts.filter(t => t.t < 70);
  },
  endMatch(champIdx) {
    this.phase = 'over';
    Audio.stopMusic();
    const w = this.f[champIdx];
    $('overTitle').textContent = w.ch.name + ' GANA';
    $('overSub').textContent = w.ch.quotes[0];
    $('overScreen').style.setProperty('--accent', w.ch.accent);
    show('overScreen');
  },
};

// ============================================================
//  RENDER
// ============================================================
function drawStage() {
  const st = game.stage, t = game.time;
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

function drawFighter(f) {
  const ch = f.ch, s = f.skeleton(), fc = f.facing;
  ctx.save();
  ctx.translate(f.x, GROUND - f.y);
  // sombra
  ctx.save(); ctx.scale(1, 0.25); ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.arc(0, (f.y) * 4, Math.max(20, 60 - f.y * 0.15), 0, 7); ctx.fill(); ctx.restore();
  if (f.pose.rot) { ctx.translate(0, -20); ctx.rotate(f.pose.rot * fc); ctx.translate(0, 20); }

  // aura de super / meter lleno
  if (f.meter >= 100 && f.state !== 'ko') {
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
  ctx.globalCompositeOperation = 'source-over';
  switch (p.type) {
    case 'note': {
      ctx.rotate(Math.sin(p.t * 0.3) * 0.3);
      ctx.fillStyle = p.color; ctx.strokeStyle = '#120c14'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(-6, 10, 11, 8, -0.4, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillRect(3, -22, 5, 32); ctx.strokeRect(3, -22, 5, 32);
      ctx.beginPath(); ctx.moveTo(8, -22); ctx.quadraticCurveTo(22, -14, 16, -2); ctx.stroke();
      break;
    }
    case 'vinyl': {
      ctx.rotate(p.t * 0.5 * dir);
      ctx.fillStyle = '#0d0d12'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
      for (let r = 8; r < p.r; r += 4) { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); }
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-1, -p.r, 2, p.r * 0.6);
      break;
    }
    case 'wave': {
      ctx.strokeStyle = p.color; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { ctx.lineWidth = 6 - i * 1.5; ctx.beginPath(); ctx.arc(-dir * i * 12, 0, 20 + i * 4, dir > 0 ? -1 : Math.PI - 1, dir > 0 ? 1 : Math.PI + 1); ctx.stroke(); }
      break;
    }
    case 'fire': {
      for (let i = 0; i < 6; i++) {
        const ox = -dir * i * 7 + (Math.random() - 0.5) * 6, oy = (Math.random() - 0.5) * 10, r = p.r * (1 - i * 0.13);
        ctx.fillStyle = i < 2 ? '#fff6c0' : p.color; ctx.globalAlpha = 1 - i * 0.14;
        ctx.beginPath(); ctx.arc(ox, oy, r * 0.6, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'ice': {
      ctx.rotate(p.t * 0.15);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.fillStyle = p.color;
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(Math.cos(a) * p.r, Math.sin(a) * p.r); ctx.lineTo(Math.cos(a + 0.52) * p.r * 0.45, Math.sin(a + 0.52) * p.r * 0.45); } ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function drawBeam(f) {
  if (f.state !== 'attack' || f.move !== 'super' || f.ch.super.type !== 'beam') return;
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
    // nombre
    ctx.font = '700 22px "Bungee", system-ui, sans-serif'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff'; ctx.textAlign = left ? 'left' : 'right';
    ctx.fillText(f.ch.name, left ? x : x + bw, top + bh + 8);
    // rounds ganados
    for (let i = 0; i < ROUNDS_TO_WIN; i++) {
      const cx = left ? x + bw - 14 - i * 26 : x + 14 + i * 26;
      ctx.fillStyle = i < game.wins[f.idx] ? '#ffe14d' : 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(cx, top + bh + 20, 8, 0, 7); ctx.fill();
    }
    // barra de super
    const mw = 300, mx = left ? 40 : W - 40 - mw, my = H - 46;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(mx - 3, my - 3, mw + 6, 22);
    const full = f.meter >= 100;
    ctx.fillStyle = full ? (game.time % 20 < 10 ? '#fff' : f.ch.super.color) : f.ch.super.color;
    const mwid = mw * f.meter / 100;
    ctx.fillRect(left ? mx : mx + mw - mwid, my, mwid, 16);
    ctx.font = '700 14px "Bungee", system-ui, sans-serif'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = full ? '#fff' : 'rgba(255,255,255,0.6)';
    ctx.fillText(full ? 'SUPER LISTO · ' + (f.ai ? '' : superKeyName(f.idx)) : 'SUPER', left ? mx : mx + mw, my - 6);
    // cooldown especial
    if (f.cooldown > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      const cw = 120 * (1 - f.cooldown / SPECIAL_COOLDOWN);
      ctx.fillRect(left ? mx : mx + mw - cw, my + 20, cw, 4);
    }
  }
  // reloj
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.beginPath(); ctx.roundRect(W / 2 - 46, 20, 92, 64, 8); ctx.fill();
  ctx.font = '400 46px "Bungee", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = game.timer <= 10 ? '#ff4d4d' : '#fff'; ctx.fillText(String(game.timer).padStart(2, '0'), W / 2, 54);
}
function superKeyName(i) { return i === 0 ? 'T' : 'O'; }

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
    ctx.globalAlpha = alpha; ctx.translate(W / 2, H / 2 - 40); ctx.scale(sc, sc);
    ctx.font = `400 ${b.big ? 120 : 84}px "Bungee Shade", "Bungee", system-ui, sans-serif`;
    ctx.lineWidth = 10; ctx.strokeStyle = '#120c14'; ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.text === 'K.O.' ? '#ff3b3b' : '#ffe14d'; ctx.fillText(b.text, 0, 0);
    if (b.sub) { ctx.font = '400 28px "Bungee", system-ui, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(b.sub, 0, 80); }
  }
  ctx.restore();
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (game.phase === 'menu' || !game.f.length) { drawStage(); drawCrowd(); return; }
  const sh = game.shakeAmt;
  ctx.save(); ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  drawStage();
  // super: oscurecer fondo
  if (game.superActor) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); }
  const order = [...game.f].sort((x, y) => (x.state === 'attack') - (y.state === 'attack'));
  order.forEach(drawFighter);
  game.f.forEach(drawBeam);
  game.projectiles.forEach(drawProjectile);
  // partículas
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of game.particles) {
    const a = p.life / p.max;
    if (p.kind === 'ring') { ctx.strokeStyle = hexA('#ffffff', a); ctx.lineWidth = 5 * a; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - a) + 10, 0, 7); ctx.stroke(); }
    else { ctx.fillStyle = hexA(p.color.startsWith('#') ? p.color : '#ffffff', a); ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 1, 0, 7); ctx.fill(); }
  }
  ctx.restore();
  drawCrowd();
  ctx.restore();
  // textos flotantes
  for (const t of game.texts) {
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t.t / 70); ctx.textAlign = 'center';
    ctx.font = '400 30px "Bungee", system-ui, sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#120c14';
    const y = t.y - t.t * 0.8; ctx.strokeText(t.text, t.x, y); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, y); ctx.restore();
  }
  drawHUD();
  drawBanner();
  if (game.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.font = '400 72px "Bungee", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('PAUSA', W / 2, H / 2);
    ctx.font = '400 20px "Bungee", system-ui, sans-serif'; ctx.fillText('ESC para seguir', W / 2, H / 2 + 60);
  }
}

// ============================================================
//  LOOP fijo 60 Hz
// ============================================================
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { game.update(); acc -= 1000 / 60; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function togglePause() {
  if (game.phase === 'menu' || game.phase === 'over') return;
  game.paused = !game.paused;
  $('pauseMenu').hidden = !game.paused;
}

// ============================================================
//  MENÚS (DOM)
// ============================================================
const screens = ['titleScreen', 'selectScreen', 'overScreen'];
function show(id) { screens.forEach(s => { $(s).hidden = s !== id; }); $('touch').hidden = !(id === null && isTouch && !game.paused); }
const isTouch = matchMedia('(pointer: coarse)').matches;

const sel = { mode: 'cpu', p: [0, 1], locked: [false, false] };

function portrait(ch, size = 120) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const fake = { ch, facing: 1, state: 'idle' };
  g.save(); g.translate(size / 2, size / 2 + 6); g.scale(size / 100, size / 100);
  swapCtx(g, () => drawHead(fake, { x: 0, y: 0 }, 0));
  g.restore();
  return c;
}
// reutiliza drawHead sobre otro contexto (retratos del menú)
function swapCtx(g, fn) { const old = ctx; ctx = g; try { fn(); } finally { ctx = old; } }

function renderSelect() {
  const grid = $('roster'); if (!grid) return;
  grid.innerHTML = '';
  ROSTER.forEach((ch, i) => {
    const card = document.createElement('button');
    card.className = 'card'; card.type = 'button';
    card.style.setProperty('--c', ch.accent);
    if (sel.p[0] === i) card.classList.add('p1');
    if (sel.p[1] === i) card.classList.add('p2');
    card.appendChild(portrait(ch));
    const nm = document.createElement('span'); nm.className = 'cname'; nm.textContent = ch.name; card.appendChild(nm);
    const tg = document.createElement('span'); tg.className = 'ctag'; tg.textContent = ch.tagline; card.appendChild(tg);
    const up = document.createElement('label'); up.className = 'face-up'; up.title = 'Subir foto de la cara';
    up.innerHTML = '<span>📷 cara</span>';
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'face-' + ch.id;
    inp.addEventListener('click', e => e.stopPropagation());
    inp.addEventListener('change', () => uploadFace(ch, inp.files[0]));
    up.appendChild(inp); up.addEventListener('click', e => e.stopPropagation());
    card.appendChild(up);
    card.addEventListener('click', () => pickCard(i));
    grid.appendChild(card);
  });
  const cur = (k) => sel.locked[k] ? 'LISTO' : 'eligiendo…';
  $('p1info').innerHTML = `<b>J1</b> ${ROSTER[sel.p[0]].name} <small>${cur(0)}</small>`;
  $('p2info').innerHTML = `<b>${sel.mode === 'cpu' ? 'CPU' : 'J2'}</b> ${ROSTER[sel.p[1]].name} <small>${sel.mode === 'cpu' ? 'al azar' : cur(1)}</small>`;
  const ch = ROSTER[sel.p[sel.locked[0] && sel.mode === 'pvp' ? 1 : 0]];
  $('moveList').innerHTML = `<b>${ch.name}</b> · Especial: <i>${ch.special.name}</i> · Super: <i>${ch.super.name}</i>`;
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
  Audio.init(); Audio.tone(660, 0.06, 'square', 0.08);
  const who = sel.mode === 'pvp' && sel.locked[0] ? 1 : 0;
  sel.p[who] = i;
  sel.locked[who] = true;
  if (sel.mode === 'cpu') {
    let r; do { r = Math.floor(Math.random() * ROSTER.length); } while (r === i && ROSTER.length > 1);
    sel.p[1] = r; sel.locked[1] = true;
  }
  renderSelect();
  if (sel.locked[0] && sel.locked[1]) setTimeout(beginFight, 350);
}

function beginFight() {
  show(null);
  game.start(ROSTER[sel.p[0]], ROSTER[sel.p[1]], sel.mode === 'cpu');
}

function openSelect(mode) {
  Audio.init();
  sel.mode = mode; sel.locked = [false, false];
  show('selectScreen'); renderSelect();
}

// navegación por teclado en selección
addEventListener('keydown', e => {
  if ($('selectScreen').hidden) return;
  const who = sel.mode === 'pvp' && sel.locked[0] ? 1 : 0;
  const n = ROSTER.length, cols = 3;
  const mv = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1, ArrowUp: -cols, KeyW: -cols, ArrowDown: cols, KeyS: cols }[e.code];
  if (mv) { sel.p[who] = (sel.p[who] + mv + n) % n; renderSelect(); Audio.tone(440, 0.04, 'square', 0.05); e.preventDefault(); }
  if (['Enter', 'Space', 'KeyF', 'KeyK'].includes(e.code)) { pickCard(sel.p[who]); e.preventDefault(); }
  if (e.code === 'Backspace' || e.code === 'Escape') { if (sel.locked[0] && !sel.locked[1]) { sel.locked[0] = false; renderSelect(); } else show('titleScreen'); }
});

$('btnCpu').addEventListener('click', () => openSelect('cpu'));
$('btnPvp').addEventListener('click', () => openSelect('pvp'));
$('btnRematch').addEventListener('click', () => { show(null); game.start(ROSTER[sel.p[0]], ROSTER[sel.p[1]], sel.mode === 'cpu'); });
$('btnMenu').addEventListener('click', () => { game.phase = 'menu'; game.f = []; Audio.stopMusic(); show('titleScreen'); });
$('btnResume').addEventListener('click', togglePause);
$('btnQuit').addEventListener('click', () => { togglePause(); game.phase = 'menu'; game.f = []; Audio.stopMusic(); show('titleScreen'); });
function updateMuteBtn() { $('btnMute').textContent = Audio.muted ? '🔇' : '🔊'; }
$('btnMute').addEventListener('click', () => { Audio.init(); Audio.toggleMute(); updateMuteBtn(); });
updateMuteBtn();

// controles táctiles (J1)
document.querySelectorAll('#touch [data-a]').forEach(btn => {
  const a = btn.dataset.a;
  const down = e => { e.preventDefault(); Audio.init(); if (!touchDown.has(a)) pressedQueue[0].push(a); touchDown.add(a); btn.classList.add('on'); };
  const up = e => { e.preventDefault(); touchDown.delete(a); btn.classList.remove('on'); };
  btn.addEventListener('pointerdown', down); btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up); btn.addEventListener('pointerleave', up);
});

window.__game = game; // depuración desde la consola
show('titleScreen');
})();
