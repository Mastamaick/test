# Busca manchas blancas (restos del fondo del sticker atrapados entre brazos, piernas, etc.)
# Una mancha = grupo de píxeles casi blancos de al menos -Area píxeles. Se borran (transparentes).
# Uso: manchablanca.ps1 -In pose.png [-Area 40] [-Min 215] [-Marca salida.png]   (-Marca: no borra, pinta en rojo lo que borraría)
param([string]$In, [int]$Area = 40, [int]$Min = 215, [string]$Marca = '')
Add-Type -AssemblyName System.Drawing
$p = (Resolve-Path $In).Path; $b0 = [System.Drawing.Bitmap]::FromFile($p); $b = New-Object System.Drawing.Bitmap $b0; $b0.Dispose()
$W = $b.Width; $H = $b.Height; $wh = New-Object bool[] ($W * $H)
for ($y = 0; $y -lt $H; $y++) { for ($x = 0; $x -lt $W; $x++) { $c = $b.GetPixel($x, $y)
  $mx = [Math]::Max($c.R, [Math]::Max($c.G, $c.B)); $mn = [Math]::Min($c.R, [Math]::Min($c.G, $c.B))
  $wh[$y * $W + $x] = $c.A -gt 40 -and $mn -ge $Min -and ($mx - $mn) -lt 30 } }
$seen = New-Object bool[] ($W * $H); $gone = 0; $n = 0
for ($s = 0; $s -lt $W * $H; $s++) {
  if (-not $wh[$s] -or $seen[$s]) { continue }
  $grp = New-Object System.Collections.Generic.List[int]; $q = New-Object System.Collections.Generic.Queue[int]; $q.Enqueue($s); $seen[$s] = $true
  while ($q.Count) { $c = $q.Dequeue(); $grp.Add($c); $cx = $c % $W; $cy = [Math]::Floor($c / $W)
    foreach ($d in @(@(-1, 0), @(1, 0), @(0, -1), @(0, 1))) { $nx = $cx + $d[0]; $ny = $cy + $d[1]
      if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $W -or $ny -ge $H) { continue }; $np = $ny * $W + $nx
      if ($wh[$np] -and -not $seen[$np]) { $seen[$np] = $true; $q.Enqueue($np) } } }
  if ($grp.Count -lt $Area) { continue }
  # dientes: la mancha está rodeada de boca (rojo); esas se dejan
  $red = 0; $tot = 0
  foreach ($i in $grp) { $cx = $i % $W; $cy = [Math]::Floor($i / $W)
    foreach ($d in @(@(-2, 0), @(2, 0), @(0, -2), @(0, 2))) { $nx = $cx + $d[0]; $ny = $cy + $d[1]
      if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $W -or $ny -ge $H -or $wh[$ny * $W + $nx]) { continue }
      $q2 = $b.GetPixel($nx, $ny); $tot++; if ($q2.A -gt 40 -and $q2.R -gt 110 -and $q2.R -gt 1.6 * $q2.G) { $red++ } } }
  if ($tot -and $red / $tot -gt 0.12) { continue }
  $n++; $col = if ($Marca) { [System.Drawing.Color]::Red } else { [System.Drawing.Color]::Transparent }
  foreach ($i in $grp) { $b.SetPixel($i % $W, [Math]::Floor($i / $W), $col); $gone++ } }
if ($Marca) { $b.Save($Marca) } else { $b.Save($p) }; $b.Dispose(); "{0} : {1} manchas, {2} px" -f (Split-Path $In -Leaf), $n, $gone
