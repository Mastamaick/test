# Pone a todos los personajes en fila, a la MISMA altura (como en el juego), con su nombre debajo.
# Sirve para el "control de parecido": antes de aprobar a un rapero nuevo, ver si su silueta y colores se confunden con otro.
# Uso: powershell -File tools/sprites/lineup.ps1 -Root . -Out revision/lineup.png [-Extra ruta\cabeza_o_ficha.png -ExtraName NUEVO]
param([string]$Root = '.', [string]$Out = 'revision/lineup.png', [int]$H = 300, [string]$Extra = '', [string]$ExtraName = 'NUEVO')
Add-Type -AssemblyName System.Drawing
$ids = @('jonas','chystemc','macrodee','ceaese','granrah','veiderr','claudio','creabeatbox','mastamaick','omega','jackdee','bruto')
$items = New-Object System.Collections.ArrayList
foreach ($id in $ids) { $p = Join-Path $Root "assets/fighters/$id/idle.png"; if (Test-Path $p) { [void]$items.Add(@{ img = [System.Drawing.Image]::FromFile((Resolve-Path $p).Path); name = $id.ToUpper() }) } }
if ($Extra -and (Test-Path $Extra)) { [void]$items.Add(@{ img = [System.Drawing.Image]::FromFile((Resolve-Path $Extra).Path); name = $ExtraName; extra = $true }) }
$gap = 24; $W = $gap; foreach ($it in $items) { $it.w = [int]($it.img.Width * $H / $it.img.Height); $W += $it.w + $gap }
$TH = 44; $Ht = $H + $TH + 2 * $gap
$b = New-Object System.Drawing.Bitmap $W, $Ht
$g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::FromArgb(54, 60, 78))
$g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'; $g.TextRenderingHint = 'AntiAlias'
$font = New-Object System.Drawing.Font('Arial', 13, [System.Drawing.FontStyle]::Bold)
$fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = 'Center'
$x = $gap
foreach ($it in $items) {
  if ($it.extra) { $g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 255, 210, 63))), $x - 8, $gap - 8, $it.w + 16, $H + 16) }
  $g.DrawImage($it.img, $x, $gap, $it.w, $H)
  $g.DrawString($it.name, $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(($x - $gap / 2), ($gap + $H + 10), ($it.w + $gap), $TH)), $fmt)
  $x += $it.w + $gap
}
$g.Dispose(); $b.Save($Out); $b.Dispose(); foreach ($it in $items) { $it.img.Dispose() }
"$Out ${W}x${Ht}"
