# Escala una pose recortada (vecino más cercano) para que mida lo mismo de alto que la pose original del personaje.
# Así una pose redibujada no cambia de tamaño en el juego.
# Uso: fitheight.ps1 -In nueva.png -Ref original.png -Out salida.png
param([string]$In, [string]$Ref, [string]$Out)
Add-Type -AssemblyName System.Drawing
$r = [System.Drawing.Image]::FromFile((Resolve-Path $Ref).Path); $H = $r.Height; $r.Dispose()
$s = [System.Drawing.Image]::FromFile((Resolve-Path $In).Path)
$W = [int][Math]::Round($s.Width * $H / $s.Height)
$b = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($b); $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
$g.DrawImage($s, 0, 0, $W, $H); $g.Dispose(); $s.Dispose()
$b.Save([IO.Path]::GetFullPath($Out), [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()
"$([IO.Path]::GetFileName($Out)) ${W}x$H"
