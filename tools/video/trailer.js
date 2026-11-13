// Arma el tráiler vertical (1080x1920): intro + un corte por rapero al ritmo de la música + cierre.
// Uso: node tools/video/trailer.js plan.json salida.mp4
// plan.json: { music, musicStart, beat, intro: "carpeta/ti_%04d.jpg", introDur, fin: "carpeta/fin_%04d.jpg", finDur,
//              voice, cuts: [{ clip, frame, start, cx }], cutBeats }
// Cada corte dura cutBeats tiempos de la música, parte con un destello blanco y lleva el sonido del juego debajo de la música.
const { execFileSync } = require('child_process');
const fs = require('fs');
const P = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), OUT = process.argv[3];
const cutDur = +(P.beat * P.cutBeats).toFixed(4);
const total = P.introDur + cutDur * P.cuts.length + P.finDur;
const args = ['-hide_banner', '-loglevel', 'error', '-y'];
const inp = f => { args.push(...f); return inpN++; }; let inpN = 0;
const iIntro = inp(['-framerate', '30', '-i', P.intro]);
const iFin = inp(['-framerate', '30', '-i', P.fin]);
const iMusic = inp(['-ss', String(P.musicStart), '-i', P.music]);
const iVoice = inp(['-i', P.voice]);
const iCrowd = inp(['-i', 'assets/audio/sfx/crowd.mp3']);
const AF = 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo';
const f = [];
f.push(`[${iIntro}:v]fps=30,setsar=1,trim=duration=${P.introDur},setpts=PTS-STARTPTS,format=yuv420p[vi]`);
f.push(`[${iFin}:v]fps=30,setsar=1,tpad=stop_mode=clone:stop_duration=2,trim=duration=${P.finDur},setpts=PTS-STARTPTS,format=yuv420p[vf]`);
const vs = ['[vi]'], as = [];
f.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${P.introDur}[ai]`); as.push('[ai]');
P.cuts.forEach((c, k) => {
  const iv = inp(['-i', c.clip]), im = inp(['-i', c.frame]);
  // cámara del montaje: acercamiento lento durante todo el corte y, en cada impacto (c.punch, segundos dentro del corte),
  // un golpe de zoom con sacudida que se apaga rápido
  const T = '(on/30)', P = c.punch || [];
  const zp = P.map(p => `if(gte(${T},${p}),0.14*exp(-(${T}-${p})*7),0)`).join('+') || '0';
  const sh = P.map(p => `if(gte(${T},${p}),20*exp(-(${T}-${p})*6),0)`).join('+') || '0';
  const z = `1.05+0.12*${T}/${cutDur}+${zp}`;
  const x = `clip(iw/2-iw/zoom/2+(${sh})*sin(${T}*71),0,iw-iw/zoom)`, y = `clip(ih/2-ih/zoom/2+(${sh})*cos(${T}*53),0,ih-ih/zoom)`;
  f.push(`[${iv}:v]trim=${c.start}:${(c.start + cutDur).toFixed(3)},setpts=PTS-STARTPTS,fps=30,scale=1280:720,crop=960:720:${c.cx ?? 160}:0,zoompan=z='${z}':x='${x}':y='${y}':d=1:s=960x720:fps=30,scale=1080:810:flags=neighbor[g${k}]`);
  f.push(`color=c=black:s=1080x1920:r=30:d=${cutDur}[bg${k}];[bg${k}][g${k}]overlay=0:600:shortest=1[o${k}];[o${k}][${im}:v]overlay=0:0,fade=in:st=0:d=0.12:color=white,setsar=1,format=yuv420p[v${k}]`);
  f.push(`[${iv}:a]${AF},atrim=${c.start}:${(c.start + cutDur).toFixed(3)},asetpts=PTS-STARTPTS,apad,atrim=duration=${cutDur},volume=${P.gameVol ?? 0.6}[a${k}]`);
  vs.push(`[v${k}]`); as.push(`[a${k}]`);
});
vs.push('[vf]');
f.push(`[${iCrowd}:a]${AF},atrim=duration=${P.finDur},afade=out:st=${P.finDur - 0.8}:d=0.8,volume=0.7[af]`); as.push('[af]');
f.push(`${vs.join('')}concat=n=${vs.length}:v=1:a=0[v]`);
f.push(`${as.join('')}concat=n=${as.length}:v=0:a=1[game]`);
f.push(`[${iMusic}:a]${AF},atrim=duration=${total},afade=in:st=0:d=0.3,afade=out:st=${(total - 1.2).toFixed(2)}:d=1.2,volume=${P.musicVol ?? 0.85}[mus]`);
f.push(`[${iVoice}:a]${AF},adelay=${P.voiceDelay ?? 60}|${P.voiceDelay ?? 60},volume=1.6[voz]`);
f.push(`[mus][game][voz]amix=inputs=3:normalize=0:duration=first,loudnorm=I=-14:TP=-1[a]`);
args.push('-filter_complex', f.join(';\n'), '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', OUT);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
console.log('listo:', OUT, 'duración', total.toFixed(2), 's');
