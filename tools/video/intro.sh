#!/bin/sh
# Une la intro vertical para historias (1080x1920, ~16 s):
#   clip IA (5 s) + VS (2,5 s, de tools/video/intro.js) + cortes de poderes (5,6 s) + cierre (3 s)
# con música del jefe, voz del anunciador y golpes del juego, a -14 LUFS.
# Uso: sh tools/video/intro.sh clip_ia.mp4 vs.mp4 cortes.mp4 fin.mp4 salida.mp4
CLIP="$1"; VS="$2"; CUT="$3"; FIN="$4"; OUT="$5"
A=assets/audio
# momentos (en ms) de cada sonido
ffmpeg -hide_banner -loglevel error -y -i "$CLIP" -i "$VS" -i "$CUT" -i "$FIN" \
  -i $A/music/boss.mp3 -i $A/voice/welcome.mp3 -i $A/sfx/super_start.mp3 -i $A/sfx/clash.mp3 -i $A/sfx/finisher.mp3 -i $A/voice/fight.mp3 \
  -i $A/sfx/pw_ufo.mp3 -i $A/sfx/super_beam.mp3 -i $A/sfx/pw_demon.mp3 -i $A/sfx/pw_books.mp3 -i $A/sfx/pw_sphere.mp3 -i $A/sfx/pw_bass.mp3 -i $A/sfx/pw_boom.mp3 \
  -i $A/sfx/ko.mp3 -i $A/sfx/crowd.mp3 -filter_complex "
[0:v]fps=30,scale=1080:1920:flags=lanczos,setsar=1,trim=duration=5,setpts=PTS-STARTPTS,fade=in:st=0:d=0.4,fade=out:st=4.85:d=0.15:color=white[c0];
[1:v]fps=30,setsar=1[c1];[2:v]fps=30,setsar=1[c2];[3:v]fps=30,setsar=1[c3];
[c0][c1][c2][c3]concat=n=4:v=1:a=0,format=yuv420p[v];
[4:a]atrim=0:16.1,volume=0.55,afade=in:st=0:d=0.5,afade=out:st=15.1:d=1[m];
[5:a]adelay=400|400,volume=1.3[s1];
[6:a]adelay=100|100,volume=0.8[s2];
[7:a]adelay=5000|5000[s3];
[8:a]adelay=5750|5750[s4];
[9:a]adelay=6600|6600,volume=1.3[s5];
[10:a]adelay=7500|7500[p1];[11:a]adelay=8300|8300[p2];[12:a]adelay=9100|9100[p3];[13:a]adelay=9900|9900[p4];
[14:a]adelay=10700|10700[p5];[15:a]adelay=11500|11500[p6];[16:a]adelay=12300|12300[p7];
[17:a]adelay=13100|13100[s6];[18:a]adelay=13300|13300,volume=0.7[s7];
[m][s1][s2][s3][s4][s5][p1][p2][p3][p4][p5][p6][p7][s6][s7]amix=inputs=15:normalize=0:duration=first,loudnorm=I=-14:TP=-1[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT"
echo "listo: $OUT"
