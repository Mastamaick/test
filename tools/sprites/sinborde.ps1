# Quita el borde blanco de "sticker" que deja la IA alrededor de la figura: borra (vuelve transparente)
# los píxeles claros conectados al fondo transparente, capa por capa, hasta -Max píxeles hacia adentro.
# Uso: sinborde.ps1 -In pose.png [-Max 6] [-Min 200] [-Solo]   (-Solo: solo cuenta, no guarda)
param([string]$In, [int]$Max = 6, [int]$Min = 200, [switch]$Solo)
Add-Type -AssemblyName System.Drawing
$p = (Resolve-Path $In).Path; $b0 = [System.Drawing.Bitmap]::FromFile($p); $b = New-Object System.Drawing.Bitmap $b0; $b0.Dispose()
$W = $b.Width; $H = $b.Height
$a = New-Object byte[] ($W * $H); $lt = New-Object bool[] ($W * $H)
for ($y = 0; $y -lt $H; $y++) { for ($x = 0; $x -lt $W; $x++) { $c = $b.GetPixel($x, $y); $i = $y * $W + $x; $a[$i] = $c.A
  # claro y poco saturado (blanco / gris muy claro del sticker)
  $mx = [Math]::Max($c.R, [Math]::Max($c.G, $c.B)); $mn = [Math]::Min($c.R, [Math]::Min($c.G, $c.B))
  $lt[$i] = $c.A -gt 40 -and $mn -ge $Min -and ($mx - $mn) -lt 40 } }
$gone = 0
for ($r = 0; $r -lt $Max; $r++) {
  $kill = New-Object System.Collections.Generic.List[int]
  for ($y = 0; $y -lt $H; $y++) { for ($x = 0; $x -lt $W; $x++) { $i = $y * $W + $x; if (-not $lt[$i] -or $a[$i] -le 40) { continue }
    $edge = $x -eq 0 -or $y -eq 0 -or $x -eq $W - 1 -or $y -eq $H - 1 -or $a[$i - 1] -le 40 -or $a[$i + 1] -le 40 -or $a[$i - $W] -le 40 -or $a[$i + $W] -le 40
    if ($edge) { $kill.Add($i) } } }
  if ($kill.Count -eq 0) { break }
  foreach ($i in $kill) { $a[$i] = 0; $gone++; if (-not $Solo) { $b.SetPixel($i % $W, [Math]::Floor($i / $W), [System.Drawing.Color]::Transparent) } }
}
if (-not $Solo) { $b.Save($p) }; $b.Dispose(); "{0} : {1} px de borde blanco" -f (Split-Path $In -Leaf), $gone
