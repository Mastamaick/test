# Pone en fila varias poses (alineadas por los pies) sobre fondo gris para revisarlas. Escala 0.5.
param([string]$Out, [string[]]$Files)
Add-Type -AssemblyName System.Drawing
$imgs = New-Object System.Collections.ArrayList; foreach ($f in $Files) { [void]$imgs.Add([System.Drawing.Image]::FromFile((Resolve-Path $f).Path)) }; "n=$($imgs.Count) files=$($Files.Count)"
$k = 0.5; $W = 10; $Hm = 0
foreach ($i in $imgs) { $W += [int]($i.Width * $k) + 10; if ($i.Height -gt $Hm) { $Hm = $i.Height } }
$H = [int]($Hm * $k) + 20
$b = New-Object System.Drawing.Bitmap ([int]$W), ([int]$H)
$g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::FromArgb(70, 80, 100)); $g.InterpolationMode = 'NearestNeighbor'
$x = 10
foreach ($i in $imgs) { $iw = [int]($i.Width * $k); $ih = [int]($i.Height * $k); $g.DrawImage($i, $x, $H - 10 - $ih, $iw, $ih); $x += $iw + 10 }
$g.DrawLine([System.Drawing.Pens]::Red, 0, $H - 10, $W, $H - 10)
$g.Dispose(); $b.Save($Out); $b.Dispose(); foreach ($i in $imgs) { $i.Dispose() }
"$Out ${W}x${H}"


