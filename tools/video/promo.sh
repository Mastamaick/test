#!/bin/sh
# Reel promocional vertical 1080x1920: VS en grande (2,5 s) + pelea grabada con marco + cierre (3 s), a -14 LUFS.
# Los cuadros de VS y cierre salen de tools/video/intro.js (__introFrames), copiados a una carpeta con vs_*.jpg y fin_*.jpg.
# Uso: sh tools/video/promo.sh carpeta_cuadros grabacion.webm marco.png duracion_pelea salida.mp4 [recorte_x=160]
FR="$1"; CLIP="$2"; FRAME="$3"; DUR="$4"; OUT="$5"; CX="${6:-160}"
A=assets/audio
AF="aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo"
ffmpeg -hide_banner -loglevel error -y \
  -framerate 30 -i "$FR/vs_%04d.jpg" -i "$CLIP" -i "$FRAME" -framerate 30 -i "$FR/fin_%04d.jpg" \
  -i $A/sfx/super_start.mp3 -i $A/sfx/clash.mp3 -i $A/sfx/crowd.mp3 -i $A/sfx/finisher.mp3 -filter_complex "
[0:v]fps=30,setsar=1,format=yuv420p[v0];
[1:v]trim=0:$DUR,setpts=PTS-STARTPTS,fps=30,scale=1280:720,crop=960:720:${CX}:0,scale=1080:810:flags=neighbor[g];
color=c=black:s=1080x1920:r=30:d=$DUR[bg];[bg][g]overlay=0:600:shortest=1[gv];[gv][2:v]overlay=0:0,setsar=1,format=yuv420p[v1];
[3:v]fps=30,setsar=1,format=yuv420p[v2];
[4:a]$AF,volume=0.9[s1];[5:a]$AF,adelay=750|750[s2];[s1][s2]amix=inputs=2:normalize=0,apad,atrim=0:2.5,asetpts=PTS-STARTPTS[a0];
[1:a]$AF,atrim=0:$DUR,asetpts=PTS-STARTPTS,apad,atrim=0:$DUR[a1];
[6:a]$AF,volume=0.8[s3];[7:a]$AF,adelay=100|100[s4];[s3][s4]amix=inputs=2:normalize=0,apad,atrim=0:3,afade=out:st=2.3:d=0.7,asetpts=PTS-STARTPTS[a2];
[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][am];[am]loudnorm=I=-14:TP=-1[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 192k -movflags +faststart "$OUT"
echo "listo: $OUT"
