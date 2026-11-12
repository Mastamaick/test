# Deja solo la figura más grande de una pose (borra manchas sueltas y restos de figuras vecinas). Uso: solofigura.ps1 -In pose.png [-Top 0]
# -Top N: además borra las N filas de arriba.
param([string]$In, [int]$Top = 0)
Add-Type -AssemblyName System.Drawing
$p = (Resolve-Path $In).Path; $b0 = [System.Drawing.Bitmap]::FromFile($p); $b = New-Object System.Drawing.Bitmap $b0; $b0.Dispose()
$W = $b.Width; $H = $b.Height
for ($y = 0; $y -lt [Math]::Min($Top, $H); $y++) { for ($x = 0; $x -lt $W; $x++) { $b.SetPixel($x, $y, [System.Drawing.Color]::Transparent) } }
$lab = New-Object int[] ($W * $H); $sizes = @{}; $id = 0
for ($s = 0; $s -lt $W * $H; $s++) {
  if ($lab[$s] -or $b.GetPixel($s % $W, [Math]::Floor($s / $W)).A -le 40) { continue }
  $id++; $n = 0; $q = New-Object System.Collections.Generic.Queue[int]; $q.Enqueue($s); $lab[$s] = $id
  while ($q.Count) { $c = $q.Dequeue(); $n++; $cx = $c % $W; $cy = [Math]::Floor($c / $W)
    foreach ($d in @(@(-1, 0), @(1, 0), @(0, -1), @(0, 1))) { $nx = $cx + $d[0]; $ny = $cy + $d[1]
      if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $W -or $ny -ge $H) { continue }; $np = $ny * $W + $nx
      if (-not $lab[$np] -and $b.GetPixel($nx, $ny).A -gt 40) { $lab[$np] = $id; $q.Enqueue($np) } } }
  $sizes[$id] = $n }
$big = ($sizes.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1).Key
$gone = 0
for ($s = 0; $s -lt $W * $H; $s++) { if ($lab[$s] -and $lab[$s] -ne $big) { $b.SetPixel($s % $W, [Math]::Floor($s / $W), [System.Drawing.Color]::Transparent); $gone++ } }
$b.Save($p); $b.Dispose(); "$In : $gone píxeles sueltos"
