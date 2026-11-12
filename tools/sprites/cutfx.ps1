# Recorta un efecto de una hoja generada por IA.
# Uso: cutfx.ps1 -In hoja.png -Out efecto.png -X 0 -Y 0 -W 300 -H 300 [-Mode glow|black|white] [-Thr 22]
#   glow : fondo negro que se queda (el juego lo dibuja sumando luz, el negro no se ve); borra líneas de grilla grises
#   black: el fondo negro se vuelve transparente (relleno desde el borde), para objetos oscuros como tinta
#   white: el fondo blanco se vuelve transparente (relleno desde el borde)
param([string]$In, [string]$Out, [int]$X, [int]$Y, [int]$W, [int]$H, [string]$Mode = 'glow', [int]$Thr = 22)
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $In).Path)
$bmp = New-Object System.Drawing.Bitmap $W, $H, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $W, $H), (New-Object System.Drawing.Rectangle $X, $Y, $W, $H), 'Pixel'); $g.Dispose(); $src.Dispose()
$rect = New-Object System.Drawing.Rectangle 0, 0, $W, $H
$data = $bmp.LockBits($rect, 'ReadWrite', [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$n = $W * $H * 4; $px = New-Object byte[] $n
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $px, 0, $n)
function isBg([int]$i) {
  $b = $px[$i]; $gg = $px[$i + 1]; $r = $px[$i + 2]
  if ($Mode -eq 'white') { return ([Math]::Min($r, [Math]::Min($gg, $b)) -gt (255 - $Thr - 10)) }
  return ([Math]::Max($r, [Math]::Max($gg, $b)) -lt $Thr)
}
if ($Mode -eq 'glow') {
  # líneas de grilla: grises sin color en un fondo negro -> negro
  for ($i = 0; $i -lt $n; $i += 4) {
    $b = $px[$i]; $gg = $px[$i + 1]; $r = $px[$i + 2]
    $mx = [Math]::Max($r, [Math]::Max($gg, $b)); $mn = [Math]::Min($r, [Math]::Min($gg, $b))
    if ($mx -lt 110 -and ($mx - $mn) -lt 12) { $px[$i] = 0; $px[$i + 1] = 0; $px[$i + 2] = 0 }
  }
} else {
  # relleno desde el borde: el fondo conectado al borde queda transparente
  $seen = New-Object bool[] ($W * $H); $q = New-Object System.Collections.Generic.Queue[int]
  for ($x = 0; $x -lt $W; $x++) { $q.Enqueue($x); $q.Enqueue(($H - 1) * $W + $x) }
  for ($y = 0; $y -lt $H; $y++) { $q.Enqueue($y * $W); $q.Enqueue($y * $W + $W - 1) }
  while ($q.Count) {
    $p = $q.Dequeue(); if ($seen[$p]) { continue }; $seen[$p] = $true
    if (-not (isBg ($p * 4))) { continue }
    $px[$p * 4 + 3] = 0
    $x = $p % $W; $y = [Math]::Floor($p / $W)
    if ($x -gt 0) { $q.Enqueue($p - 1) }; if ($x -lt $W - 1) { $q.Enqueue($p + 1) }
    if ($y -gt 0) { $q.Enqueue($p - $W) }; if ($y -lt $H - 1) { $q.Enqueue($p + $W) }
  }
}
[System.Runtime.InteropServices.Marshal]::Copy($px, 0, $data.Scan0, $n)
$bmp.UnlockBits($data)
$bmp.Save($Out); $bmp.Dispose()
"$Out ${W}x${H} ($Mode)"
