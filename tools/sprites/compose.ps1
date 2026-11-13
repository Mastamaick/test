# Junta varias poses en fila sobre fondo blanco 16:9 (1376x768), todas a la misma escala y con los pies en la misma línea,
# para pedirle a Gemini que corrija algo en todas a la vez. Luego sheet.ps1 -Rows 1 las vuelve a cortar.
param([string]$Out, [string[]]$Files, [switch]$Green)
Add-Type -AssemblyName System.Drawing
$imgs = New-Object System.Collections.ArrayList
foreach ($f in $Files) { [void]$imgs.Add([System.Drawing.Image]::FromFile((Resolve-Path $f).Path)) }
$CW = 1376; $CH = 768; $gap = 40; $sumW = 0; $maxH = 0
foreach ($i in $imgs) { $sumW += $i.Width; if ($i.Height -gt $maxH) { $maxH = $i.Height } }
$k = [Math]::Min(($CW - $gap * ($imgs.Count + 1)) / $sumW, ($CH - 120) / $maxH)
$b = New-Object System.Drawing.Bitmap $CW, $CH
$g = [System.Drawing.Graphics]::FromImage($b); $g.Clear($(if ($Green) { [System.Drawing.Color]::FromArgb(0,255,0) } else { [System.Drawing.Color]::White })); $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
$total = 0; foreach ($i in $imgs) { $total += [int]($i.Width * $k) }
$x = [int](($CW - $total - $gap * ($imgs.Count - 1)) / 2); $base = $CH - 60
foreach ($i in $imgs) { $iw = [int]($i.Width * $k); $ih = [int]($i.Height * $k); $g.DrawImage($i, $x, $base - $ih, $iw, $ih); $x += $iw + $gap }
$g.Dispose(); $b.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose(); foreach ($i in $imgs) { $i.Dispose() }
"$Out escala $([Math]::Round($k,3))"

