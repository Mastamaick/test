# Recorta UNA pose de una hoja (región a mano), quita el fondo blanco (y las líneas magenta de la guía),
# la ajusta al contenido y la escala con un factor fijo (el mismo para todas las poses de esa hoja).
# Uso: cutpose.ps1 -In hoja.png -Out pose.png -X 0 -Y 0 -W 300 -H 400 -Scale 1.4
# -Holes: también borra el blanco puro encerrado (entre piernas o brazos). No usar si el personaje tiene ropa blanca lisa.
param([string]$In, [string]$Out, [int]$X, [int]$Y, [int]$W, [int]$H, [double]$Scale = 1, [switch]$Holes)
Add-Type -AssemblyName System.Drawing
$tmp = [System.IO.Path]::GetTempFileName() + '.png'
# líneas magenta -> blanco antes de recortar
$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $In).Path)
$c = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($c); $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $W, $H), (New-Object System.Drawing.Rectangle $X, $Y, $W, $H), 'Pixel'); $g.Dispose(); $src.Dispose()
# (la línea se rellena con lo que hay justo arriba o abajo, así no corta al personaje en dos)
$isMag = { param($p) $p.R -gt 140 -and $p.B -gt 110 -and ($p.R - $p.G) -gt 50 -and ($p.B - $p.G) -gt 30 }
for ($yy = 0; $yy -lt $H; $yy++) { for ($xx = 0; $xx -lt $W; $xx++) { $p = $c.GetPixel($xx, $yy); if (& $isMag $p) {
  $rep = [System.Drawing.Color]::White
  foreach ($dy in @(-5, 5, -7, 7, -9, 9)) { $ny = $yy + $dy; if ($ny -ge 0 -and $ny -lt $H) { $q = $c.GetPixel($xx, $ny); if (-not (& $isMag $q)) { $rep = $q; break } } }
  $c.SetPixel($xx, $yy, $rep) } } }
$c.Save($tmp); $c.Dispose()
& (Join-Path $PSScriptRoot 'cutfx.ps1') -In $tmp -Out $tmp -X 0 -Y 0 -W $W -H $H -Mode white | Out-Null
$b0 = [System.Drawing.Bitmap]::FromFile($tmp); $b = New-Object System.Drawing.Bitmap $b0; $b0.Dispose()
if ($Holes) { for ($yy = 0; $yy -lt $H; $yy++) { for ($xx = 0; $xx -lt $W; $xx++) { $p = $b.GetPixel($xx, $yy); if ($p.A -gt 0 -and $p.R -ge 246 -and $p.G -ge 246 -and $p.B -ge 246) { $b.SetPixel($xx, $yy, [System.Drawing.Color]::Transparent) } } } }
# solo la figura más grande: borra restos de las figuras vecinas que quedaron dentro de la región
$lab = New-Object int[] ($W * $H); $sizes = @{ }; $id = 0
for ($s = 0; $s -lt $W * $H; $s++) {
  if ($lab[$s] -or $b.GetPixel($s % $W, [Math]::Floor($s / $W)).A -le 40) { continue }
  $id++; $n = 0; $q = New-Object System.Collections.Generic.Queue[int]; $q.Enqueue($s); $lab[$s] = $id
  while ($q.Count) { $p = $q.Dequeue(); $n++; $px = $p % $W; $py = [Math]::Floor($p / $W)
    foreach ($d in @(@(-1, 0), @(1, 0), @(0, -1), @(0, 1))) { $nx = $px + $d[0]; $ny = $py + $d[1]
      if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $W -or $ny -ge $H) { continue }; $np = $ny * $W + $nx
      if (-not $lab[$np] -and $b.GetPixel($nx, $ny).A -gt 40) { $lab[$np] = $id; $q.Enqueue($np) } } }
  $sizes[$id] = $n }
$big = ($sizes.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1).Key
for ($s = 0; $s -lt $W * $H; $s++) { if ($lab[$s] -and $lab[$s] -ne $big) { $b.SetPixel($s % $W, [Math]::Floor($s / $W), [System.Drawing.Color]::Transparent) } }
$x0 = $W; $y0 = $H; $x1 = 0; $y1 = 0
for ($yy = 0; $yy -lt $H; $yy++) { for ($xx = 0; $xx -lt $W; $xx++) { if ($b.GetPixel($xx, $yy).A -gt 40) { if ($xx -lt $x0) { $x0 = $xx }; if ($xx -gt $x1) { $x1 = $xx }; if ($yy -lt $y0) { $y0 = $yy }; if ($yy -gt $y1) { $y1 = $yy } } } }
$cw = $x1 - $x0 + 1; $ch = $y1 - $y0 + 1; $OW = [int]($cw * $Scale); $OH = [int]($ch * $Scale)
$o = New-Object System.Drawing.Bitmap $OW, $OH
$g = [System.Drawing.Graphics]::FromImage($o); $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
$g.DrawImage($b, (New-Object System.Drawing.Rectangle 0, 0, $OW, $OH), (New-Object System.Drawing.Rectangle $x0, $y0, $cw, $ch), 'Pixel'); $g.Dispose(); $b.Dispose()
$o.Save($Out); $o.Dispose(); Remove-Item $tmp -ErrorAction SilentlyContinue
"$Out ${OW}x${OH}"
