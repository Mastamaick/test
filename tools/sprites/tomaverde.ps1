# Copia una captura de una hoja de Gemini con fondo verde al proyecto, recortando los bordes de la captura
# que no son la imagen (franjas oscuras a la derecha o abajo): se queda con el rectángulo donde está el verde.
# Uso: tomaverde.ps1 -Src captura.png -Out hoja.png
param([string]$Src, [string]$Out)
Add-Type -AssemblyName System.Drawing
$b = [System.Drawing.Bitmap]::FromFile($Src); $W = $b.Width; $H = $b.Height
$isG = { param($c) $c.G -gt 90 -and ($c.G - $c.R) -gt 45 -and ($c.G - $c.B) -gt 45 }
# columnas y filas con algo de verde
$x0 = 0; while ($x0 -lt $W -and -not ((0..19 | ? { & $isG $b.GetPixel($x0, [int]($H * ($_ + 0.5) / 20)) }).Count)) { $x0++ }
$x1 = $W - 1; while ($x1 -gt 0 -and -not ((0..19 | ? { & $isG $b.GetPixel($x1, [int]($H * ($_ + 0.5) / 20)) }).Count)) { $x1-- }
$y0 = 0; while ($y0 -lt $H -and -not ((0..29 | ? { & $isG $b.GetPixel([int]($W * ($_ + 0.5) / 30), $y0) }).Count)) { $y0++ }
$y1 = $H - 1; while ($y1 -gt 0 -and -not ((0..29 | ? { & $isG $b.GetPixel([int]($W * ($_ + 0.5) / 30), $y1) }).Count)) { $y1-- }
$x0 += 2; $y0 += 2; $x1 -= 2; $y1 -= 2  # fuera el borde suavizado
$cw = $x1 - $x0 + 1; $ch = $y1 - $y0 + 1
$o = New-Object System.Drawing.Bitmap $cw, $ch; $g = [System.Drawing.Graphics]::FromImage($o)
$g.DrawImage($b, (New-Object System.Drawing.Rectangle 0, 0, $cw, $ch), (New-Object System.Drawing.Rectangle $x0, $y0, $cw, $ch), 'Pixel'); $g.Dispose(); $b.Dispose()
$o.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png); $o.Dispose(); "$Out ${cw}x${ch}"
