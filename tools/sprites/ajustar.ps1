# Recorta una pose a su contenido y la escala para que su alto sea Frac × el alto de la idle del mismo rapero.
# Uso: ajustar.ps1 -Dir privado\fighters\djtranse -Pose crouchDodge -Frac 0.62
param([string]$Dir, [string]$Pose, [double]$Frac)
Add-Type -AssemblyName System.Drawing
$idle = [System.Drawing.Image]::FromFile((Resolve-Path "$Dir\idle.png").Path); $H0 = $idle.Height; $idle.Dispose()
$p = (Resolve-Path "$Dir\$Pose.png").Path; $b0 = [System.Drawing.Bitmap]::FromFile($p); $b = New-Object System.Drawing.Bitmap $b0; $b0.Dispose()
$x0 = $b.Width; $y0 = $b.Height; $x1 = 0; $y1 = 0
for ($y = 0; $y -lt $b.Height; $y++) { for ($x = 0; $x -lt $b.Width; $x++) { if ($b.GetPixel($x, $y).A -gt 40) { if ($x -lt $x0) { $x0 = $x }; if ($x -gt $x1) { $x1 = $x }; if ($y -lt $y0) { $y0 = $y }; if ($y -gt $y1) { $y1 = $y } } } }
$cw = $x1 - $x0 + 1; $ch = $y1 - $y0 + 1; $k = $Frac * $H0 / $ch; $W = [int]($cw * $k); $H = [int]($ch * $k)
$o = New-Object System.Drawing.Bitmap $W, $H; $g = [System.Drawing.Graphics]::FromImage($o); $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
$g.DrawImage($b, (New-Object System.Drawing.Rectangle 0, 0, $W, $H), (New-Object System.Drawing.Rectangle $x0, $y0, $cw, $ch), [System.Drawing.GraphicsUnit]::Pixel); $g.Dispose(); $b.Dispose()
$o.Save($p); $o.Dispose(); "$Pose : contenido ${cw}x${ch} -> ${W}x${H} ({0:N2} de la idle)" -f ($ch / $H0)
