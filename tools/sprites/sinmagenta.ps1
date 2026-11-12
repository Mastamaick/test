# Borra restos de la línea guía magenta/violeta de una pose ya recortada: cada píxel de ese color se rellena
# con el píxel más cercano de arriba o abajo que no lo sea (o se vuelve transparente si no hay).
# Uso: sinmagenta.ps1 -In pose.png
param([string]$In)
Add-Type -AssemblyName System.Drawing
$p = (Resolve-Path $In).Path; $b0 = [System.Drawing.Bitmap]::FromFile($p); $b = New-Object System.Drawing.Bitmap $b0; $b0.Dispose()
$isMag = { param($c) $c.A -gt 0 -and $c.R -gt 45 -and $c.B -gt 45 -and ($c.R - $c.G) -gt 22 -and ($c.B - $c.G) -gt 18 }  # incluye el borde oscuro de la línea
$n = 0
for ($y = 0; $y -lt $b.Height; $y++) { for ($x = 0; $x -lt $b.Width; $x++) { $c = $b.GetPixel($x, $y); if (& $isMag $c) {
  $rep = [System.Drawing.Color]::Transparent
  foreach ($d in 1..14) { foreach ($s in @(-1, 1)) { $ny = $y + $s * $d; if ($ny -ge 0 -and $ny -lt $b.Height) { $q = $b.GetPixel($x, $ny); if (-not (& $isMag $q)) { $rep = $q; break } } }; if ($rep.A -gt 0) { break } }
  $b.SetPixel($x, $y, $rep); $n++ } } }
$b.Save($p); $b.Dispose(); "$In : $n píxeles"
