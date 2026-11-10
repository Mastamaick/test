#!/bin/sh
# Arma un video vertical 9:16 (1080x1920) para Reels/TikTok/Shorts:
# la grabación del juego (1280x720, recortada al centro) va en la franja del medio y encima el marco PNG
# (logo, nombre del rapero, poderes y el llamado a jugar) que tiene un hueco transparente en y=600..1410.
# Uso: sh tools/video/vertical.sh grabacion.webm marco.png salida.mp4 [recorte_x=160]
IN="$1"; FRAME="$2"; OUT="$3"; CX="${4:-160}"
ffmpeg -hide_banner -loglevel error -y -i "$IN" -i "$FRAME" -filter_complex \
  "[0:v]fps=30,crop=960:720:${CX}:0,scale=1080:810:flags=neighbor[g];color=c=black:s=1080x1920:r=30[bg];[bg][g]overlay=0:600:shortest=1[v];[v][1:v]overlay=0:0,format=yuv420p[out]" \
  -map "[out]" -map 0:a? -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 192k -af "loudnorm=I=-14:TP=-1" -movflags +faststart "$OUT"
echo "listo: $OUT"
