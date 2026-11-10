// Partes animadas de la intro vertical para historias (no es parte del juego). En la consola de la página:
//   await import('/tools/video/intro.js'); await __introFrames('veiderr', 'omega')
// Dibuja cuadro a cuadro (30 por segundo, 1080x1920) y guarda JPG en revision/videos/:
//   vs_0000.jpg…  pantalla VS con los dos raperos (2,5 s)
//   fin_0000.jpg… cierre "¿TE LA PUEDES? · JUEGA GRATIS" (3 s)
// Después se arma con ffmpeg (ver redes/PLAN-REDES.md, "Intro para historias").
const W = 1080, H = 1920, FPS = 30;
const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
const upload = async (name, blob) => (await fetch('/__upload/' + name, { method: 'POST', body: blob })).text();
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const backOut = t => { const s = 1.9; t -= 1; return t * t * ((s + 1) * t + s) + 1; };
// azar repetible: cada cuadro sale igual si se vuelve a generar
const rnd = seed => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

window.__introFrames = async (p1, p2) => {
  await document.fonts.load('400 40px "Sedgwick Ave Display"'); await document.fonts.load('400 40px Bungee');
  const c1 = ROSTER.find(c => c.id === p1), c2 = ROSTER.find(c => c.id === p2);
  const [bg, vs, logo, s1, s2, crown] = await Promise.all([load('assets/ui/vs_bg.jpg'), load('assets/ui/vs.png'), load('assets/ui/title.png'),
    load(c1.sprite.winRound || c1.sprite.idle), load(c2.sprite.winRound || c2.sprite.idle), load('assets/ui/crown.png')]);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const graf = (t, x, y, size, fill, shadow) => { g.font = '400 ' + size + 'px "Sedgwick Ave Display", Bungee, sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = '#14061c'; g.strokeText(t, x + 6, y + 6); g.fillStyle = shadow; g.fillText(t, x + 6, y + 6); g.strokeText(t, x, y); g.fillStyle = fill; g.fillText(t, x, y); };
  const bung = (t, x, y, size, fill) => { g.font = '400 ' + size + 'px Bungee, sans-serif'; while (g.measureText(t).width > W - 70 && size > 20) { size -= 2; g.font = '400 ' + size + 'px Bungee, sans-serif'; } g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = size * 0.22; g.strokeStyle = '#14061c'; g.strokeText(t, x, y); g.fillStyle = fill; g.fillText(t, x, y); };
  const cover = (img, zoom = 1) => { const s = Math.max(W / img.width, H / img.height) * zoom; const w = img.width * s, h = img.height * s; g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h); };
  const sprite = (img, cx, footY, h, flip) => { const w = img.width * h / img.height; g.save(); g.imageSmoothingEnabled = false; g.translate(cx, footY); if (flip) g.scale(-1, 1); g.drawImage(img, -w / 2, -h, w, h); g.restore(); };
  const flash = a => { if (a > 0) { g.fillStyle = 'rgba(255,255,255,' + clamp(a) + ')'; g.fillRect(0, 0, W, H); } };
  const save = async name => upload(name, await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.93)));
  const pad = n => String(n).padStart(4, '0');

  // ---------- VS (2,5 s) ----------
  const nVs = Math.round(2.5 * FPS);
  for (let f = 0; f < nVs; f++) {
    const t = f / FPS, R = rnd(f + 7);
    const shake = t > 0.75 && t < 1.15 ? (1.15 - t) * 40 : 0;
    g.save(); g.translate((R() - 0.5) * shake, (R() - 0.5) * shake);
    g.fillStyle = '#000'; g.fillRect(-50, -50, W + 100, H + 100);
    cover(bg, 1.05 + t * 0.04);
    // mitades de color: rojo para el 1, azul para el 2, cortadas en diagonal
    g.globalAlpha = 0.45; g.fillStyle = c1.accent; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(0, H * 0.62); g.fill();
    g.fillStyle = c2.accent; g.beginPath(); g.moveTo(W, H * 0.38); g.lineTo(W, H); g.lineTo(0, H); g.fill(); g.globalAlpha = 1;
    // los raperos entran desde los costados
    const k = backOut(clamp(t / 0.45));
    sprite(s1, -300 + k * 640, 1000, 860, false);
    sprite(s2, W + 300 - k * 640, 1720, 860, true);
    graf(c1.name, 330, 1130 - (1 - k) * 60, 92, '#fff', c1.accent);
    graf(c2.name, W - 330, 1850 - (1 - k) * 60, 92, '#fff', c2.accent);
    // el VS cae con golpe a los 0,75 s
    if (t >= 0.75) { const v = backOut(clamp((t - 0.75) / 0.2)); const s = 3 - 2 * v, w = 520 * s; g.globalAlpha = clamp((t - 0.75) / 0.08); g.drawImage(vs, (W - w) / 2, H * 0.46 - w * vs.height / vs.width / 2, w, w * vs.height / vs.width); g.globalAlpha = 1; }
    // chispas doradas al caer el VS
    if (t > 0.8) { const Rp = rnd(99); for (let i = 0; i < 70; i++) { const a = Rp() * Math.PI * 2, sp = 500 + Rp() * 1400, dt = t - 0.8, x = W / 2 + Math.cos(a) * sp * dt, y = H * 0.46 + Math.sin(a) * sp * dt + 900 * dt * dt; g.fillStyle = Rp() > 0.5 ? '#ffd23f' : '#ff7a00'; g.globalAlpha = clamp(1 - dt / 1.1); const sz = 6 + Rp() * 10; g.fillRect(x, y, sz, sz); } g.globalAlpha = 1; }
    g.restore();
    flash(t < 0.12 ? 1 - t / 0.12 : t >= 0.75 && t < 0.95 ? 0.9 - (t - 0.75) * 4.5 : 0);
    await save('vs_' + pad(f) + '.jpg');
  }

  // ---------- cierre (3 s) ----------
  const nFin = 3 * FPS;
  for (let f = 0; f < nFin; f++) {
    const t = f / FPS;
    const bgr = g.createLinearGradient(0, 0, W, H); bgr.addColorStop(0, '#2a0f44'); bgr.addColorStop(1, '#0c0614'); g.fillStyle = bgr; g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(W / 2, H * 0.36, 0, W / 2, H * 0.36, 900); rg.addColorStop(0, 'rgba(255,63,164,0.45)'); rg.addColorStop(1, 'rgba(255,63,164,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
    // rayos que giran detrás del logo
    g.save(); g.translate(W / 2, H * 0.36); g.rotate(t * 0.35); g.globalAlpha = 0.08; g.fillStyle = '#ffd23f';
    for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(1400, -110); g.lineTo(1400, 110); g.fill(); } g.restore(); g.globalAlpha = 1;
    // logo que cae y late
    const k = backOut(clamp(t / 0.3)), beat = 1 + 0.025 * Math.sin(t * Math.PI * 4), lw = 980 * (2.2 - 1.2 * k) * beat, lh = lw * logo.height / logo.width;
    g.globalAlpha = clamp(t / 0.1); g.drawImage(logo, (W - lw) / 2, H * 0.36 - lh / 2, lw, lh); g.globalAlpha = 1;
    // textos que entran uno tras otro
    const line = (t0, fn) => { if (t < t0) return; const a = backOut(clamp((t - t0) / 0.18)); g.save(); g.translate(W / 2, 0); g.scale(a, a); g.translate(-W / 2, 0); fn(); g.restore(); };
    line(0.45, () => bung('¿TE LA PUEDES?', W / 2, 1290, 96, '#ffd23f'));
    line(0.75, () => bung('JUEGA GRATIS', W / 2, 1420, 78, '#fff'));
    line(0.95, () => bung('LINK EN LA BIO', W / 2, 1510, 56, '#fff'));
    line(1.2, () => bung('@ELREYDELALLECA.CL', W / 2, 1650, 58, '#3fd0ff'));
    line(1.4, () => bung('12 RAPEROS · PODERES · SÚPER', W / 2, 1750, 32, 'rgba(255,255,255,0.8)'));
    flash(t < 0.15 ? 1 - t / 0.15 : 0);
    await save('fin_' + pad(f) + '.jpg');
  }
  return [nVs, nFin];
};
