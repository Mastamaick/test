# Revisión de caras: la cabeza de cada pose (zona más alta del dibujo), ampliada, sobre fondo magenta
# (así se ven los huecos transparentes en ojos o barba).
# Uso: caras.ps1 -Dir carpeta_de_poses -Out revision.png [-Names 'punch,kick']
param([string]$Dir, [string]$Out, [string]$Names = '')
Add-Type -AssemblyName System.Drawing
$files = @(Get-ChildItem "$Dir\*.png"); if ($Names) { $want = $Names.Split(','); $files = @($files | Where-Object { $want -contains $_.BaseName }) }
$cell = 300; $cols = 5; $rows = [Math]::Ceiling($files.Count / $cols)
$b = New-Object System.Drawing.Bitmap ($cols * $cell), ($rows * $cell)
$g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::FromArgb(255, 0, 255)); $g.InterpolationMode = 'NearestNeighbor'
$f = New-Object System.Drawing.Font('Arial', 12, [System.Drawing.FontStyle]::Bold)
$i = 0
foreach ($fi in $files) {
  $im = [System.Drawing.Bitmap]::FromFile($fi.FullName)
  # la cabeza: buscar el píxel opaco más alto y tomar un cuadro de 200x200 alrededor
  $top = 0; $cx = [int]($im.Width / 2)
  :o for ($y = 0; $y -lt $im.Height; $y += 2) { for ($x = 0; $x -lt $im.Width; $x += 2) { if ($im.GetPixel($x, $y).A -gt 100) { $top = $y; $cx = $x; break o } } }
  $sz = [Math]::Min(210, [Math]::Min($im.Width, $im.Height)); $sx = [Math]::Max(0, [Math]::Min($im.Width - $sz, $cx - $sz / 2)); $sy = [Math]::Max(0, [Math]::Min($im.Height - $sz, $top))
  $x0 = ($i % $cols) * $cell; $y0 = [Math]::Floor($i / $cols) * $cell
  $g.DrawImage($im, (New-Object System.Drawing.Rectangle ($x0 + 5), ($y0 + 5), 270, 270), (New-Object System.Drawing.Rectangle $sx, $sy, $sz, $sz), [System.Drawing.GraphicsUnit]::Pixel)
  $g.DrawString($fi.BaseName, $f, [System.Drawing.Brushes]::Black, ($x0 + 4), ($y0 + 278))
  $im.Dispose(); $i++
}
$g.Dispose(); $b.Save($Out); $b.Dispose(); $Out
