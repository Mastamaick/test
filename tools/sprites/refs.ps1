# Referencias para Gemini: idle sobre fondo blanco (x2) y primer plano de la cabeza (x4), pixel art sin suavizar.
param([string]$Root, [string]$OutDir, [string[]]$Ids)
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force $OutDir | Out-Null
if (-not $Ids) { $Ids = 'jonas','chystemc','macrodee','ceaese','granrah','veiderr','claudio','creabeatbox','mastamaick','jackdee','bruto' }
foreach ($id in $Ids) {
  $src = [System.Drawing.Bitmap]::FromFile("$Root\assets\fighters\$id\idle.png")
  # caja de pixeles opacos
  $x0 = $src.Width; $y0 = $src.Height; $x1 = 0; $y1 = 0
  for ($y = 0; $y -lt $src.Height; $y += 1) { for ($x = 0; $x -lt $src.Width; $x += 1) { if ($src.GetPixel($x, $y).A -gt 100) { if ($x -lt $x0) { $x0 = $x }; if ($x -gt $x1) { $x1 = $x }; if ($y -lt $y0) { $y0 = $y }; if ($y -gt $y1) { $y1 = $y } } } }
  $w = $x1 - $x0 + 1; $h = $y1 - $y0 + 1
  $k = 2; $pad = 40
  $full = New-Object System.Drawing.Bitmap ($w * $k + 2 * $pad), ($h * $k + 2 * $pad)
  $g = [System.Drawing.Graphics]::FromImage($full); $g.Clear([System.Drawing.Color]::White)
  $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle $pad, $pad, ($w * $k), ($h * $k)), $x0, $y0, $w, $h, 'Pixel'); $g.Dispose()
  $full.Save("$OutDir\$id-idle.png", [System.Drawing.Imaging.ImageFormat]::Png); $full.Dispose()
  # cabeza: el 38 % de arriba de la figura, centrado en sus pixeles
  $hh = [int]($h * 0.38); $hx0 = $src.Width; $hx1 = 0
  for ($y = $y0; $y -lt $y0 + $hh; $y++) { for ($x = $x0; $x -le $x1; $x++) { if ($src.GetPixel($x, $y).A -gt 100) { if ($x -lt $hx0) { $hx0 = $x }; if ($x -gt $hx1) { $hx1 = $x } } } }
  $hw = $hx1 - $hx0 + 1; $k2 = 4
  $face = New-Object System.Drawing.Bitmap ($hw * $k2 + 40), ($hh * $k2 + 40)
  $g = [System.Drawing.Graphics]::FromImage($face); $g.Clear([System.Drawing.Color]::White)
  $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 20, 20, ($hw * $k2), ($hh * $k2)), $hx0, $y0, $hw, $hh, 'Pixel'); $g.Dispose()
  $face.Save("$OutDir\$id-face.png", [System.Drawing.Imaging.ImageFormat]::Png); $face.Dispose()
  "$id idle ${w}x${h} cara ${hw}x${hh}"
  $src.Dispose()
}
