# Arma una hoja 16:9 (1376x768) en cuadrícula 2x2 con 4 dibujos, cada uno pegado a la izquierda de su celda
# y con los pies en el piso de la celda: deja espacio a la derecha para un puño o una pierna estirada.
# Así Gemini no encima las figuras y después sheet.ps1 -Cols 2 -Rows 2 las corta limpias.
# Uso: grid2.ps1 -Out hoja.png -Files a.png,b.png,c.png,d.png
param([string]$Out, [string]$FileList)
Add-Type -AssemblyName System.Drawing
$files = $FileList.Split(',')
$CW = 688; $CH = 384; $FH = 290
$bmp = New-Object System.Drawing.Bitmap 1376, 768
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
for ($k = 0; $k -lt $files.Count; $k++) {
  $im = [System.Drawing.Image]::FromFile((Resolve-Path $files[$k]).Path)
  # una pose ancha (caída) se achica para caber en la celda
  $sc = [Math]::Min($FH / $im.Height, ($CW - 100) / $im.Width); $iw = [int]($im.Width * $sc); $ih = [int]($im.Height * $sc)
  $cx = ($k % 2) * $CW; $cy = [Math]::Floor($k / 2) * $CH
  $g.DrawImage($im, $cx + 60, $cy + $CH - 30 - $ih, $iw, $ih); $im.Dispose()
}
$g.Dispose(); $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
"ok $Out"
