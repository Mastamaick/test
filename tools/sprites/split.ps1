# Corta una hoja de N figuras en fila que se tocan entre sí: busca, cerca de cada borde esperado, la columna con menos dibujo
# y corta ahí. Cada franja se guarda como PNG con fondo blanco (después se recorta con cutout.ps1 -Largest).
# Uso: split.ps1 -In hoja.png -OutDir carpeta -NameList a,b,c [-Thr 235] [-Window 0.12]
param([string]$In, [string]$OutDir, [string]$NameList, [int]$Thr = 235, [double]$Window = 0.12)
Add-Type -AssemblyName System.Drawing
$Names = $NameList.Split(","); $b = New-Object System.Drawing.Bitmap (Resolve-Path $In).Path
$W = $b.Width; $H = $b.Height; $N = $Names.Count
$d = $b.LockBits((New-Object System.Drawing.Rectangle 0, 0, $W, $H), 'ReadOnly', 'Format32bppArgb')
$px = New-Object byte[] ($W * $H * 4); [Runtime.InteropServices.Marshal]::Copy($d.Scan0, $px, 0, $px.Length); $b.UnlockBits($d)
$ink = New-Object int[] $W
for ($x = 0; $x -lt $W; $x++) { $cnt = 0; for ($y = 0; $y -lt $H; $y += 2) { $i = ($y * $W + $x) * 4; if ($px[$i] -lt $Thr -or $px[$i+1] -lt $Thr -or $px[$i+2] -lt $Thr) { $cnt++ } }; $ink[$x] = $cnt }
# extremos del dibujo
$L = 0; while ($L -lt $W -and $ink[$L] -eq 0) { $L++ }; $R = $W - 1; while ($R -gt 0 -and $ink[$R] -eq 0) { $R-- }
$cuts = @($L)
for ($k = 1; $k -lt $N; $k++) {
  $e = [int]($L + ($R - $L) * $k / $N); $win = [int](($R - $L) * $Window)
  $best = $e; $bv = 1e9
  for ($x = [Math]::Max($L, $e - $win); $x -le [Math]::Min($R, $e + $win); $x++) { if ($ink[$x] -lt $bv) { $bv = $ink[$x]; $best = $x } }
  $cuts += $best
}
$cuts += $R + 1
New-Item -ItemType Directory -Force $OutDir | Out-Null
for ($k = 0; $k -lt $N; $k++) {
  if ($Names[$k] -eq '-') { continue }
  $x0 = $cuts[$k]; $cw = $cuts[$k+1] - $x0
  $o = New-Object System.Drawing.Bitmap ($cw + 20), $H
  $g = [System.Drawing.Graphics]::FromImage($o); $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($b, (New-Object System.Drawing.Rectangle 10, 0, $cw, $H), (New-Object System.Drawing.Rectangle $x0, 0, $cw, $H), 'Pixel'); $g.Dispose()
  $o.Save((Join-Path (Resolve-Path $OutDir).Path ($Names[$k] + '.png'))); $o.Dispose()
}
$b.Dispose()
"cortes: " + ($cuts -join ' ')
