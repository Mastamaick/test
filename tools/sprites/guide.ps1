# Guía de altura para las poses agachadas: la idle a la izquierda y una línea magenta al Frac del alto, sobre fondo blanco 16:9.
param([string]$Idle, [string]$Out, [double]$Frac = 0.58)
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Bitmap]::FromFile($Idle)
$W = 1376; $H = 768; $figH = 600; $base = 700
$k = $figH / $src.Height; $fw = [int]($src.Width * $k)
$b = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
$g.DrawImage($src, 80, $base - $figH, $fw, $figH)
$ly = [int]($base - $figH * $Frac)
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 0, 255)), 6
$g.DrawLine($pen, 20, $ly, $W - 20, $ly)
$g.DrawLine($pen, 20, $base, $W - 20, $base)
$g.Dispose(); $b.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose(); $src.Dispose()
"guia $Out linea en y=$ly"
