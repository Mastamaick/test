# Copia una captura de la imagen de Gemini al proyecto, pintando de blanco un borde de 4 px (la captura trae una línea oscura arriba).
param([string]$Src, [string]$Out)
Add-Type -AssemblyName System.Drawing
$i = [System.Drawing.Bitmap]::FromFile($Src)
$b = New-Object System.Drawing.Bitmap $i.Width, $i.Height
$g = [System.Drawing.Graphics]::FromImage($b); $g.DrawImage($i, 0, 0, $i.Width, $i.Height)
$wb = [System.Drawing.Brushes]::White
$g.FillRectangle($wb, 0, 0, $i.Width, 4); $g.FillRectangle($wb, 0, $i.Height - 4, $i.Width, 4)
$g.FillRectangle($wb, 0, 0, 4, $i.Height); $g.FillRectangle($wb, $i.Width - 4, 0, 4, $i.Height)
$g.Dispose(); $i.Dispose()
$b.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()
"ok $Out"
