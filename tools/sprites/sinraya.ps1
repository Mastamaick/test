# Borra la raya horizontal que deja la línea guía: busca las filas con muchos píxeles violáceos
# y las reemplaza por la fila sana de arriba (en espejo). Uso: sinraya.ps1 -In pose.png
param([string]$In)
Add-Type -AssemblyName System.Drawing
$p = (Resolve-Path $In).Path; $b0 = [System.Drawing.Bitmap]::FromFile($p); $b = New-Object System.Drawing.Bitmap $b0; $b0.Dispose()
$W = $b.Width; $H = $b.Height; $bad = New-Object bool[] $H
for ($y = 0; $y -lt $H; $y++) {
  $op = 0; $pu = 0
  for ($x = 0; $x -lt $W; $x++) { $c = $b.GetPixel($x, $y); if ($c.A -lt 60) { continue }; $op++; if ($c.B -gt 20 -and ($c.B - $c.G) -gt 8) { $pu++ } }  # violeta o gris azulado (borde de la línea); el verde, la piel y el negro no cuentan
  if ($op -gt 8 -and $pu / $op -gt 0.18) { $bad[$y] = $true }
}
# ensanchar 1 fila a cada lado (borde suavizado)
$bad2 = $bad.Clone(); for ($y = 1; $y -lt $H - 1; $y++) { if ($bad[$y - 1] -or $bad[$y + 1]) { $bad2[$y] = $true } }
$fixed = 0
for ($y = 0; $y -lt $H; $y++) {
  if (-not $bad2[$y]) { continue }
  $t = $y; while ($t -ge 0 -and $bad2[$t]) { $t-- }   # fila sana de arriba
  $e = $y; while ($e -lt $H -and $bad2[$e]) { $e++ }  # fila sana de abajo
  $src = if ($t -ge 0 -and ($y - $t) -le ($e - $y) -or $e -ge $H) { $t } else { $e }
  if ($src -lt 0) { $src = $e }
  for ($x = 0; $x -lt $W; $x++) { $b.SetPixel($x, $y, $b.GetPixel($x, $src)) }
  $fixed++
}
$b.Save($p); $b.Dispose(); "$In : $fixed filas"
