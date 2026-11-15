// Promo "EARLY → juego" (vertical 1080x1920, ~30 s): Chyste real en el videoclip EARLY se transforma en el
// personaje del juego (clip de IA), intro con todos los raperos, cortes de súper al ritmo de Puerto (con la
// revelación de Chyste real con capa después de SUN JOKE), Bruto CHR, Hordatoj y DJ Transe, y cierre "YA DISPONIBLES".
// Uso: node tools/video/promo-early.js salida.mp4
// Material (carpetas ignoradas por git): revision/promo-early/ (EARLY, clips de IA) y revision/videos/ (grabaciones del juego,
// marcos trm*/pe-label*, cuadros ti_* del intro y yd_* del cierre).
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'revision/promo-early/promo-early.mp4';
const PE = 'revision/promo-early', RV = 'revision/videos', TMP = path.join(PE, 'parts');
fs.mkdirSync(TMP, { recursive: true });
const ff = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const enc = ['-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-an'];

const beat = 60 / 93.5, cutDur = +(beat * 3).toFixed(4), introDur = +(beat * 6).toFixed(4), finDur = introDur;
const plan = JSON.parse(fs.readFileSync(path.join(RV, 'tr-plan.json'), 'utf8'));
const base = id => plan.cuts.find(c => c.id === id);
// orden de los cortes; 'reveal' es la transformación inversa (Chyste del juego → Chyste real con capa)
const cuts = [
  base('chystemc'), { id: 'reveal' },
  base('macrodee'), base('ceaese'), base('omega'), base('granrah'),
  { id: 'bruto', clip: `${RV}/tr-bruto.webm`, frame: `${RV}/trm2-bruto.png`, start: 4.7, punch: [0.45, 1.15] },
  Object.assign({}, base('hordatoj'), { frame: `${RV}/trm2-hordatoj.png` }),
  Object.assign({}, base('djtranse'), { frame: `${RV}/trm2-djtranse.png` }),
];
// pixelado por pasos: bloque de k píxeles
const pix = k => k > 1 ? `scale=iw/${k}:ih/${k}:flags=area,scale=1080:1920:flags=neighbor` : 'null';
const parts = [];
const part = (name, args) => { const f = path.join(TMP, name + '.mp4'); ff([...args, ...enc, f]); parts.push(f); };

// 1) Chyste real (0 – 2,4 s): normal y al final se pixela en 3 pasos
const T1 = 2.4, T2 = 2.4; // T2: duración del clip de IA
part('a1', ['-ss', '0', '-t', String(T1 - 0.3), '-i', `${PE}/early-vertical-1080.mp4`, '-i', `${RV}/pe-label-early.png`,
  '-filter_complex', `[0:v]fps=30,scale=1080:1920,zoompan=z='1+0.02*on/63':d=1:s=1080x1920:fps=30[v];[v][1:v]overlay=0:0,format=yuv420p`]);
[12, 30, 60].forEach((k, i) => part('a2_' + i, ['-ss', String(T1 - 0.3 + i * 0.1), '-t', '0.1', '-i', `${PE}/early-vertical-1080.mp4`,
  '-vf', `fps=30,scale=1080:1920,${pix(k)},format=yuv420p`]));
// 2) Chyste del juego (clip de IA, mismos pasos desde 2,4 s): se despixela y aparece "¡ENTRA AL JUEGO!"
const g1 = `${PE}/genjutsu-1.mp4`;
[60, 30, 12].forEach((k, i) => part('b1_' + i, ['-ss', String(T1 + i * 0.1), '-t', '0.1', '-i', g1,
  '-vf', `fps=30,scale=1080:1920:flags=lanczos,${pix(k)},${i === 0 ? 'fade=in:st=0:d=0.1:color=white,' : ''}format=yuv420p`]));
part('b2', ['-ss', String(T1 + 0.3), '-t', String(T2 - 0.3), '-i', g1, '-loop', '1', '-i', `${RV}/pe-label-juego.png`,
  '-filter_complex', `[0:v]fps=30,scale=1080:1920:flags=lanczos,zoompan=z='1.02+0.06*on/63':d=1:s=1080x1920:fps=30[v];[1:v]format=rgba,fade=in:st=0.15:d=0.2:alpha=1[l];[v][l]overlay=0:0:shortest=1,format=yuv420p`]);
const preDur = T1 + T2;

// 3) intro del tráiler (SEAN BIENVENIDOS + raperos)
part('c_intro', ['-framerate', '30', '-i', `${RV}/ti_%04d.jpg`, '-vf', `fps=30,setsar=1,trim=duration=${introDur},setpts=PTS-STARTPTS,format=yuv420p`]);

// 4) cortes de súper (misma cámara que trailer.js: acercamiento lento + golpes de zoom con sacudida)
const gameAudio = [];
let t = preDur + introDur;
cuts.forEach((c, k) => {
  if (c.id === 'reveal') {
    // 0,55 s el Chyste del juego con capa (pixel), se pixela y aparece Chyste real con la capa (clip de IA 2)
    part(`d${k}_a`, ['-t', '0.55', '-i', `${PE}/referencia-capa2.mp4`, '-loop', '1', '-i', `${RV}/pe-label-sunjoke.png`,
      '-filter_complex', `[0:v]fps=30,scale=1080:1920:flags=neighbor,zoompan=z='1.05+0.05*on/16':d=1:s=1080x1920:fps=30,fade=in:st=0:d=0.12:color=white[v];[v][1:v]overlay=0:0:shortest=1,format=yuv420p`]);
    [24, 60].forEach((p, i) => part(`d${k}_b${i}`, ['-ss', String(0.55 + i * 0.1), '-t', '0.1', '-i', `${PE}/referencia-capa2.mp4`, '-vf', `fps=30,scale=1080:1920:flags=neighbor,${pix(p)},format=yuv420p`]));
    const rest = +(cutDur - 0.75).toFixed(3);
    part(`d${k}_c`, ['-ss', '1.2', '-t', String(rest), '-i', `${PE}/genjutsu-2.mp4`, '-loop', '1', '-i', `${RV}/pe-label-sunjoke.png`,
      '-filter_complex', `[0:v]fps=30,scale=1080:1920:flags=lanczos,zoompan=z='1.0+0.10*on/${Math.round(rest * 30)}':d=1:s=1080x1920:fps=30,fade=in:st=0:d=0.15:color=white[v];[v][1:v]overlay=0:0:shortest=1,format=yuv420p`]);
    gameAudio.push({ sfx: 'assets/audio/sfx/super_start.mp3', at: t }, { sfx: 'assets/audio/sfx/pw_sphere.mp3', at: t + 0.6 });
  } else {
    const T = '(on/30)', P = c.punch || [];
    const zp = P.map(p => `if(gte(${T},${p}),0.14*exp(-(${T}-${p})*7),0)`).join('+') || '0';
    const sh = P.map(p => `if(gte(${T},${p}),20*exp(-(${T}-${p})*6),0)`).join('+') || '0';
    const z = `1.05+0.12*${T}/${cutDur}+${zp}`;
    const x = `clip(iw/2-iw/zoom/2+(${sh})*sin(${T}*71),0,iw-iw/zoom)`, y = `clip(ih/2-ih/zoom/2+(${sh})*cos(${T}*53),0,ih-ih/zoom)`;
    part(`d${k}`, ['-i', c.clip, '-i', c.frame, '-f', 'lavfi', '-i', `color=c=black:s=1080x1920:r=30:d=${cutDur}`, '-filter_complex',
      `[0:v]trim=${c.start}:${(c.start + cutDur).toFixed(3)},setpts=PTS-STARTPTS,fps=30,scale=1280:720,crop=960:720:${c.cx ?? 160}:0,zoompan=z='${z}':x='${x}':y='${y}':d=1:s=960x720:fps=30,scale=1080:810:flags=neighbor[g];` +
      `[2:v][g]overlay=0:600:shortest=1[o];[o][1:v]overlay=0:0,fade=in:st=0:d=0.12:color=white,setsar=1,format=yuv420p`, '-t', String(cutDur)]);
    gameAudio.push({ clip: c.clip, start: c.start, at: t });
  }
  t += cutDur;
});

// 5) cierre YA DISPONIBLES
part('e_fin', ['-framerate', '30', '-i', `${RV}/yd_%04d.jpg`, '-vf', `fps=30,setsar=1,tpad=stop_mode=clone:stop_duration=2,trim=duration=${finDur},setpts=PTS-STARTPTS,format=yuv420p`]);
const total = t + finDur;

// unir video
const list = path.join(TMP, 'list.txt');
fs.writeFileSync(list, parts.map(p => `file '${path.resolve(p).replace(/\\/g, '/')}'`).join('\n'));
const vid = path.join(TMP, 'video.mp4');
// filtro concat con cada parte normalizada (el demuxer concat se cortaba o desordenaba los tiempos)
ff([...parts.flatMap(p => ['-i', p]), '-filter_complex',
  parts.map((p, i) => `[${i}:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p,setpts=PTS-STARTPTS[p${i}]`).join(';') + ';' +
  parts.map((p, i) => `[p${i}]`).join('') + `concat=n=${parts.length}:v=1:a=0[v]`, '-map', '[v]', ...enc, vid]);

// audio: canción EARLY al inicio, golpe de transformación, luego música Puerto + voz de bienvenida + sonido del juego + público
const AF = 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo';
const a = ['-i', vid, '-i', `${PE}/early-vertical-1080.mp4`, '-ss', String(plan.musicStart), '-i', plan.music, '-i', plan.voice,
  '-i', 'assets/audio/sfx/super_start.mp3', '-i', 'assets/audio/sfx/whoosh.mp3', '-i', 'assets/audio/sfx/crowd.mp3'];
const f = [], mix = [];
const ms = s => Math.round(s * 1000);
f.push(`[1:a]${AF},atrim=duration=${preDur + 0.4},afade=out:st=${preDur - 0.5}:d=0.9,volume=1.0[early]`); mix.push('[early]');
f.push(`[5:a]${AF},adelay=${ms(T1 - 0.35)}|${ms(T1 - 0.35)},volume=1.2[wh]`); mix.push('[wh]');
f.push(`[4:a]${AF},adelay=${ms(T1)}|${ms(T1)},volume=1.3[ss]`); mix.push('[ss]');
const mDur = total - preDur;
f.push(`[2:a]${AF},atrim=duration=${mDur},afade=in:st=0:d=0.3,afade=out:st=${(mDur - 1.2).toFixed(2)}:d=1.2,volume=${plan.musicVol},adelay=${ms(preDur)}|${ms(preDur)}[mus]`); mix.push('[mus]');
f.push(`[3:a]${AF},adelay=${ms(preDur + 0.06)}|${ms(preDur + 0.06)},volume=1.6[voz]`); mix.push('[voz]');
let n = 7;
gameAudio.forEach((g, i) => {
  if (g.clip) { a.push('-i', g.clip); f.push(`[${n}:a]${AF},atrim=${g.start}:${(g.start + cutDur).toFixed(3)},asetpts=PTS-STARTPTS,volume=${plan.gameVol},adelay=${ms(g.at)}|${ms(g.at)}[g${i}]`); }
  else { a.push('-i', g.sfx); f.push(`[${n}:a]${AF},volume=1.1,adelay=${ms(g.at)}|${ms(g.at)}[g${i}]`); }
  mix.push(`[g${i}]`); n++;
});
f.push(`[6:a]${AF},atrim=duration=${finDur},afade=out:st=${finDur - 0.8}:d=0.8,volume=0.7,adelay=${ms(total - finDur)}|${ms(total - finDur)}[cr]`); mix.push('[cr]');
f.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=longest,atrim=duration=${total.toFixed(3)},loudnorm=I=-14:TP=-1[a]`);
ff([...a, '-filter_complex', f.join(';\n'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', total.toFixed(3), OUT]);
console.log('listo:', OUT, 'duración', total.toFixed(2), 's');
