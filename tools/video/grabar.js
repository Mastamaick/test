// Herramientas para grabar reels del juego. NO es parte del juego: se carga a mano en la consola de la página
// (servida con tools/video/serve.js) con:  await import('/tools/video/grabar.js')
// Después:
//   await __recClip('veiderr', 'jonas', 'veiderr.webm', [[300, go('ex')], [7000, go('super')], [7000, () => {}]])
//   await __overlay('veiderr', 'MARS PEOPLE  +  20KILLA', 'PODER ESPECIAL Y SÚPER', 'veiderr-marco.png')
// y en la terminal:  sh tools/video/vertical.sh revision/videos/veiderr.webm revision/videos/veiderr-marco.png salida.mp4
const wait = ms => new Promise(r => setTimeout(r, ms));
const upload = async (name, blob) => (await fetch('/__upload/' + name, { method: 'POST', body: blob })).text();

// pasos: [[esperaMs, fn(a, b, game)], ...] desde que empieza el round (a = J1, b = J2 quieto)
window.go = mv => a => { a.meter = 300; a.cooldown = 0; a.state = 'idle'; a.startMove(mv); };
window.__recClip = async (p1, p2, name, steps) => {
  dispatchEvent(new Event('blur')); // suelta cualquier tecla que haya quedado apretada (si no, el J1 sale agachado o caminando todo el video)
  const A = __audio; A.init(); await wait(300); if (A.ctx.state !== 'running') await A.ctx.resume();
  if (!window.__dest) { window.__dest = A.ctx.createMediaStreamDestination(); A.master.connect(window.__dest); }
  ['titleScreen', 'selectScreen', 'towerScreen', 'vsScreen', 'overScreen', 'champScreen'].forEach(s => { document.getElementById(s).hidden = true; });
  const cv = document.getElementById('game');
  const st = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...window.__dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(st, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 10e6 }); const chunks = [];
  rec.ondataavailable = e => chunks.push(e.data);
  const G = __game, c1 = ROSTER.find(c => c.id === p1), c2 = ROSTER.find(c => c.id === p2);
  // con la pestaña oculta el navegador no dibuja cuadros y el juego se congela: entonces se mueve con un temporizador (60 Hz fijo, 30 cuadros/s)
  let raf = false; requestAnimationFrame(() => { raf = true; }); await wait(250);
  let drv = null;
  if (!raf) { let acc = 0, last = performance.now(); drv = setInterval(() => { const now = performance.now(); acc += Math.min(100, now - last); last = now; while (acc >= 1000 / 60) { G.update(); acc -= 1000 / 60; } __spr.render(); }, 1000 / 30); }
  // primero una pasada sin grabar para que carguen los dibujos y el escenario (si no, el video parte en negro)
  // escenario fijo opcional: window.__recStage = 'Valparaíso' (nombre de STAGES)
  if (window.__recStage) G.nextStage = STAGES.find(s => s.name === window.__recStage) || null;
  G.start(c1, c2, false); while (G.phase !== 'fight') await wait(50); await wait(500);
  const stage = G.stage; G.nextStage = stage; G.start(c1, c2, false);
  rec.start();
  while (G.phase !== 'fight') await wait(50);
  const [a, b] = G.f; a.meter = 300; // ojo: más de 300 hace que el HUD muestre "undefined"
  // más a la izquierda: así el rival no se sale del recorte vertical cuando sale volando
  a.x = 430; b.x = 660;
  for (const [ms, fn] of steps) { await wait(ms); fn(a, b, G); }
  rec.stop(); await new Promise(r => { rec.onstop = r; }); if (drv) clearInterval(drv);
  const blob = new Blob(chunks, { type: 'video/webm' });
  return [blob.size, await upload(name, blob)];
};

// marco vertical 1080x1920 con hueco transparente en y=600..1410 (donde vertical.sh pone la pelea)
window.__overlay = async (id, l1, l2, name) => {
  await document.fonts.load('400 40px "Sedgwick Ave Display"'); await document.fonts.load('400 40px Bungee');
  const ch = ROSTER.find(c => c.id === id); const W = 1080, H = 1920, VY = 600, VH = 810;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  // fondo morado con rayas, como la pantalla de selección
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#2a0f44'); bg.addColorStop(1, '#0c0614'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const rg = g.createRadialGradient(W * 0.3, H * 0.25, 0, W * 0.3, H * 0.25, 900); rg.addColorStop(0, 'rgba(255,63,164,0.35)'); rg.addColorStop(1, 'rgba(255,63,164,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = 0.05; g.fillStyle = '#fff'; g.translate(W / 2, H / 2); g.rotate(-0.6); for (let x = -2000; x < 2000; x += 90) g.fillRect(x, -2000, 36, 4000); g.restore();
  const logo = await load('assets/ui/title.png'); const lw = 600, lh = logo.height * lw / logo.width; g.drawImage(logo, (W - lw) / 2, 30, lw, lh);
  const graf = (t, x, y, size, fill, shadow) => { g.font = '400 ' + size + 'px "Sedgwick Ave Display", Bungee, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = '#14061c'; g.strokeText(t, x + 6, y + 6); g.fillStyle = shadow; g.fillText(t, x + 6, y + 6); g.strokeText(t, x, y); g.fillStyle = fill; g.fillText(t, x, y); };
  const bung = (t, x, y, size, fill) => {
    g.font = '400 ' + size + 'px Bungee, sans-serif';
    while (g.measureText(t).width > W - 70 && size > 20) { size -= 2; g.font = '400 ' + size + 'px Bungee, sans-serif'; } // los textos largos se achican hasta caber
    g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = size * 0.22; g.strokeStyle = '#14061c'; g.strokeText(t, x, y); g.fillStyle = fill; g.fillText(t, x, y); };
  graf(ch.name, W / 2, VY - 45, 110, '#fff', ch.accent);
  // hueco para la pelea y bordes del color del rapero
  g.clearRect(0, VY, W, VH); g.fillStyle = ch.accent; g.fillRect(0, VY - 10, W, 10); g.fillRect(0, VY + VH, W, 10);
  // franja amarilla con los poderes
  g.save(); g.translate(0, VY + VH + 30); g.rotate(-0.03); g.fillStyle = '#ffd23f'; g.fillRect(-20, 0, W + 40, 140); g.restore();
  bung(l1, W / 2, VY + VH + 98, 52, '#fff'); bung(l2, W / 2, VY + VH + 148, 34, '#fff');
  // llamado a jugar
  bung(window.__finTop || '¿TE LA PUEDES?', W / 2, H - 215, 72, '#ffd23f');
  bung('JUEGA GRATIS · LINK EN LA BIO', W / 2, H - 150, 40, '#fff');
  bung('@ELREYDELALLECA.CL', W / 2, H - 85, 46, '#3fd0ff');
  bung('12 RAPEROS · PODERES · SÚPER', W / 2, H - 32, 26, 'rgba(255,255,255,0.75)');
  return upload(name, await new Promise(r => c.toBlob(r, 'image/png')));
};
