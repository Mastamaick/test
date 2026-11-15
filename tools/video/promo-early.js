// Promo "EARLY → juego" (vertical 1080x1920, ~30 s). El inicio es UNA sola secuencia sin cortes:
//   Chyste real en el videoclip EARLY → se pixela y pasa al clip de IA (mismos pasos, ya dibujado) → la cámara se mete
//   en él y sale dentro de la pelea del juego (¡PELEA!) → lanza SUN JOKE → la pose de Hokage del juego se pixela y aparece
//   el Hokage "real" (clip de IA) a contraluz, con la cara en sombra y la esfera brillando → vuelve al golpe del juego.
// Después: intro con todos los raperos, cortes de súper al ritmo de Puerto (Bruto CHR, Hordatoj y DJ Transe "¡YA DISPONIBLE!")
// y cierre "YA DISPONIBLES".
// Uso: node tools/video/promo-early.js salida.mp4
// Material (carpetas ignoradas por git): revision/promo-early/ (EARLY, clips de IA, velo-hokage.png) y revision/videos/
// (chyste-sunjoke2.webm, grabaciones tr-*, marcos trm*/pe-label*, cuadros ti_* del intro y yd_* del cierre).
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'revision/promo-early/promo-early.mp4';
const PE = 'revision/promo-early', RV = 'revision/videos', TMP = path.join(PE, 'parts');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
const ff = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const enc = ['-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-an'];

const beat = 60 / 93.5, cutDur = +(beat * 3).toFixed(4), introDur = +(beat * 6).toFixed(4), finDur = introDur;
const plan = JSON.parse(fs.readFileSync(path.join(RV, 'tr-plan.json'), 'utf8'));
const base = id => plan.cuts.find(c => c.id === id);
const cuts = [
  base('macrodee'), base('ceaese'), base('omega'),
  { id: 'bruto', clip: `${RV}/tr-bruto.webm`, frame: `${RV}/trm2-bruto.png`, start: 4.7, punch: [0.45, 1.15] },
  Object.assign({}, base('hordatoj'), { frame: `${RV}/trm2-hordatoj.png` }),
  Object.assign({}, base('djtranse'), { frame: `${RV}/trm2-djtranse.png` }),
];
const pix = k => k > 1 ? `scale=iw/${k}:ih/${k}:flags=area,scale=1080:1920:flags=neighbor` : 'null';
const parts = []; let T = 0; const marks = {};
const part = (name, dur, args) => { const f = path.join(TMP, name + '.mp4'); ff([...args, '-t', String(dur), ...enc, f]); parts.push(f); marks[name] = T; T += dur; };
// acercamiento/alejamiento hacia un punto (cx, cy en fracciones) de un video ya en 1080x1920: z0 → z1 en n cuadros
const zoomTo = (cx, cy, z0, z1, n) => `zoompan=z='${z0}+(${z1 - z0})*on/${n}':x='clip(iw*${cx}-iw/zoom/2,0,iw-iw/zoom)':y='clip(ih*${cy}-ih/zoom/2,0,ih-ih/zoom)':d=1:s=1080x1920:fps=30`;

// ---------- 1) Chyste real en EARLY ----------
const EARLY = `${PE}/early-vertical-1080.mp4`, G1 = `${PE}/genjutsu-1.mp4`, G2 = `${PE}/genjutsu-2.mp4`, GAME = `${RV}/chyste-sunjoke2.webm`;
const T1 = 2.4; // el clip de IA va sincronizado con EARLY: el segundo t de EARLY = el segundo t del clip de IA
part('a1', T1 - 0.3, ['-ss', '0', '-i', EARLY, '-i', `${RV}/pe-label-early.png`,
  '-filter_complex', `[0:v]fps=30,scale=1080:1920,zoompan=z='1+0.02*on/63':d=1:s=1080x1920:fps=30[v];[v][1:v]overlay=0:0,format=yuv420p`]);
[12, 30, 60].forEach((k, i) => part('a2_' + i, 0.1, ['-ss', String(T1 - 0.3 + i * 0.1), '-i', EARLY, '-vf', `fps=30,scale=1080:1920,${pix(k)},format=yuv420p`]));
// ---------- 2) el clip de IA: aparece despixelándose ----------
[60, 30, 12].forEach((k, i) => part('b1_' + i, 0.1, ['-ss', String(T1 + i * 0.1), '-i', G1,
  '-vf', `fps=30,scale=1080:1920:flags=lanczos,${pix(k)},${i === 0 ? 'fade=in:st=0:d=0.1:color=white,' : ''}format=yuv420p`]));
const B2 = 1.6;
part('b2', B2, ['-ss', String(T1 + 0.3), '-i', G1, '-loop', '1', '-i', `${RV}/pe-label-juego.png`,
  '-filter_complex', `[0:v]fps=30,scale=1080:1920:flags=lanczos,zoompan=z='1.02+0.05*on/48':d=1:s=1080x1920:fps=30[v];[1:v]format=rgba,fade=in:st=0.15:d=0.2:alpha=1[l];[v][l]overlay=0:0:shortest=1,format=yuv420p`]);
// ---------- 3) la cámara se mete en Chyste (callejón) y sale dentro de la pelea del juego ----------
// Chyste en el clip de IA al final: ~ (0,48 ; 0,62). En el juego (recorte vertical x=340): ~ (0,21 ; 0,72)
const gEnd = T1 + 0.3 + B2;
part('c1', 0.4, ['-ss', String(gEnd), '-i', G1, '-vf',
  `fps=30,scale=1080:1920:flags=lanczos,${zoomTo(0.48, 0.62, 1.07, 3.2, 12)},scale=iw/8:ih/8:flags=area,scale=1080:1920:flags=neighbor,fade=out:st=0.25:d=0.15:color=white,format=yuv420p`]);
const gameV = (x, extra) => `fps=30,crop=405:720:${x}:0,scale=1080:1920:flags=neighbor${extra ? ',' + extra : ''},format=yuv420p`;
part('c2', 0.5, ['-ss', '2.55', '-i', GAME, '-vf', gameV(340, `${zoomTo(0.21, 0.72, 3.0, 1.0, 15)},fade=in:st=0:d=0.15:color=white`)]);
part('c3', 0.55, ['-ss', '3.05', '-i', GAME, '-vf', gameV(340)]);
// ---------- 4) SUN JOKE: la pose del juego se vuelve el Hokage "real" ----------
part('d1', 0.45, ['-ss', '3.6', '-i', GAME, '-vf', gameV(215, `zoompan=z='1+0.06*on/18':d=1:s=1080x1920:fps=30`)]);
[16, 40].forEach((k, i) => part('d2_' + i, 0.1, ['-ss', String(4.05 + i * 0.1), '-i', GAME, '-vf', gameV(215, `zoompan=z='1.06':d=1:s=1080x1920:fps=30,${pix(k)}`)]));
// el Hokage: contraste y tono azul, velo oscuro sobre la cara (contraluz), brillo de la esfera y pixelado leve (estilo juego)
const hok = (k, zA, zB, n) => `[0:v]fps=30,format=gbrp,eq=contrast=1.15:saturation=1.2,colorbalance=bs=0.15:bm=0.08,scale=1080:1920:flags=lanczos[v];` +
  `[1:v]scale=1080:1920[velo];[v][velo]overlay=0:0:format=gbrp,format=gbrp,split[a][b];[b]curves=all='0/0 0.7/0 1/1',gblur=sigma=36[g];` +
  `[a][g]blend=all_mode=screen,${zoomTo(0.5, 0.45, zA, zB, n)},${pix(k)}`;
const HK = `${PE}/velo-hokage.png`;
[[24, 0], [12, 1], [8, 2]].forEach(([k, i]) => part('d3_' + i, 0.1, ['-ss', String(1.0 + i * 0.1), '-i', G2, '-loop', '1', '-i', HK,
  '-filter_complex', hok(k, 1.0, 1.0, 3) + (i === 0 ? ',fade=in:st=0:d=0.1:color=white' : '') + ',format=yuv420p']));
part('d4', 1.1, ['-ss', '1.3', '-i', G2, '-loop', '1', '-i', HK, '-i', `${RV}/pe-label-sunjoke.png`,
  '-filter_complex', hok(5, 1.0, 1.3, 33) + `[h];[h][2:v]overlay=0:0,format=yuv420p`]);
part('d5', 0.2, ['-ss', '2.4', '-i', G2, '-loop', '1', '-i', HK,
  '-filter_complex', hok(30, 1.3, 1.6, 6) + ',fade=out:st=0.08:d=0.12:color=white,format=yuv420p']);
// ---------- 5) vuelve al juego: el golpe ----------
part('e1', 1.4, ['-ss', '5.2', '-i', GAME, '-vf', gameV(420, 'fade=in:st=0:d=0.15:color=white')]);
const preDur = T;

// ---------- 6) intro, cortes de súper y cierre ----------
part('f_intro', introDur, ['-framerate', '30', '-i', `${RV}/ti_%04d.jpg`, '-vf', 'fps=30,setsar=1,format=yuv420p,fade=in:st=0:d=0.15:color=white']);
const gameAudio = [];
cuts.forEach((c, k) => {
  const Tq = '(on/30)', P = c.punch || [];
  const zp = P.map(p => `if(gte(${Tq},${p}),0.14*exp(-(${Tq}-${p})*7),0)`).join('+') || '0';
  const sh = P.map(p => `if(gte(${Tq},${p}),20*exp(-(${Tq}-${p})*6),0)`).join('+') || '0';
  const z = `1.05+0.12*${Tq}/${cutDur}+${zp}`;
  const x = `clip(iw/2-iw/zoom/2+(${sh})*sin(${Tq}*71),0,iw-iw/zoom)`, y = `clip(ih/2-ih/zoom/2+(${sh})*cos(${Tq}*53),0,ih-ih/zoom)`;
  gameAudio.push({ clip: c.clip, start: c.start, at: T });
  part(`g${k}`, cutDur, ['-i', c.clip, '-i', c.frame, '-f', 'lavfi', '-i', `color=c=black:s=1080x1920:r=30:d=${cutDur}`, '-filter_complex',
    `[0:v]trim=${c.start}:${(c.start + cutDur).toFixed(3)},setpts=PTS-STARTPTS,fps=30,scale=1280:720,crop=960:720:${c.cx ?? 160}:0,zoompan=z='${z}':x='${x}':y='${y}':d=1:s=960x720:fps=30,scale=1080:810:flags=neighbor[g];` +
    `[2:v][g]overlay=0:600:shortest=1[o];[o][1:v]overlay=0:0,fade=in:st=0:d=0.12:color=white,setsar=1,format=yuv420p`]);
});
part('h_fin', finDur, ['-framerate', '30', '-i', `${RV}/yd_%04d.jpg`, '-vf', `fps=30,setsar=1,tpad=stop_mode=clone:stop_duration=2,format=yuv420p`]);
const total = T;

// ---------- unir el video (filtro concat: cada parte normalizada) ----------
const vid = path.join(TMP, 'video.mp4');
ff([...parts.flatMap(p => ['-i', p]), '-filter_complex',
  parts.map((p, i) => `[${i}:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p,setpts=PTS-STARTPTS[p${i}]`).join(';') + ';' +
  parts.map((p, i) => `[p${i}]`).join('') + `concat=n=${parts.length}:v=1:a=0[v]`, '-map', '[v]', ...enc, vid]);

// ---------- audio ----------
// EARLY suena hasta que entramos al juego; ahí el sonido de la pelea; Puerto entra suave bajo el SUN JOKE y queda
// al ritmo de los cortes desde el intro (con la voz de bienvenida); público al final
const AF = 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo';
const ms = s => Math.max(0, Math.round(s * 1000));
const inputs = [], f = [], mix = [];
const add = (args, chain) => { inputs.push(...args); const n = inputs.filter(a => a === '-i').length - 1; const lbl = `[x${n}]`; f.push(`[${n}:a]${AF},${chain}${lbl}`); mix.push(lbl); };
const at = s => `adelay=${ms(s)}|${ms(s)}`;
add(['-i', EARLY], `atrim=duration=${marks.c2 + 0.3},afade=out:st=${marks.c1 - 0.2}:d=0.7,volume=1.0`);
add(['-i', 'assets/audio/sfx/whoosh.mp3'], `volume=1.2,${at(T1 - 0.35)}`);
add(['-i', 'assets/audio/sfx/super_start.mp3'], `volume=1.2,${at(T1)}`);
add(['-i', 'assets/audio/sfx/whoosh.mp3'], `volume=1.3,${at(marks.c1)}`);
add(['-i', GAME], `atrim=2.55:4.3,asetpts=PTS-STARTPTS,volume=0.9,${at(marks.c2)}`); // ¡PELEA! y el inicio del súper
add(['-i', 'assets/audio/sfx/pw_sphere.mp3'], `volume=1.2,${at(marks.d3_0)}`);
add(['-i', GAME], `atrim=5.2:6.6,asetpts=PTS-STARTPTS,volume=1.0,${at(marks.e1)}`);
const introAt = marks.f_intro, musAt = introAt - plan.musicStart;
add(['-i', plan.music], `atrim=duration=${total - musAt},afade=in:st=0:d=0.8,afade=out:st=${(total - musAt - 1.2).toFixed(2)}:d=1.2,volume=${plan.musicVol},${at(musAt)}`);
add(['-i', plan.voice], `volume=1.6,${at(introAt + 0.06)}`);
gameAudio.forEach(g => add(['-i', g.clip], `atrim=${g.start}:${(g.start + cutDur).toFixed(3)},asetpts=PTS-STARTPTS,volume=${plan.gameVol},${at(g.at)}`));
add(['-i', 'assets/audio/sfx/crowd.mp3'], `atrim=duration=${finDur},afade=out:st=${finDur - 0.8}:d=0.8,volume=0.7,${at(total - finDur)}`);
f.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=longest,atrim=duration=${total.toFixed(3)},loudnorm=I=-14:TP=-1[a]`);
ff(['-i', vid, ...inputs.map(a => a), '-filter_complex', f.join(';\n').replace(/\[(\d+):a\]/g, (m, n) => `[${+n + 1}:a]`), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', total.toFixed(3), OUT]);
console.log('listo:', OUT, 'duración', total.toFixed(2), 's · inicio continuo', preDur.toFixed(2), 's');
