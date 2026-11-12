# Pone cada pose de varios raperos lado a lado, a la escala del juego (todas las poses con la escala de su idle) y con los pies en la misma línea.
# Uso: comparar.ps1 -Dirs 'assets\fighters\jonas,privado\fighters\hordatoj' -Out revision\comparar.png
param([string]$Dirs, [string]$Out, [string]$Poses = 'idle,punch,punchH,kick,kickH,jumpUp,airkick,block,hit,dizzy,crouch,crouchDodge,crouchPunch,crouchKick,walk1,dashFwd,dashBack,taunt,winRound,winMatch')
Add-Type -AssemblyName System.Drawing
$ds = $Dirs.Split(','); $ps = $Poses.Split(','); $H0 = 160; $colW = 130 * $ds.Count + 20; $rowH = 190
$cols = 5; $rows = [Math]::Ceiling($ps.Count / $cols)
$b = New-Object System.Drawing.Bitmap ($cols * $colW), ($rows * $rowH); $g = [System.Drawing.Graphics]::FromImage($b)
$g.Clear([System.Drawing.Color]::FromArgb(70, 80, 100)); $g.InterpolationMode = 'NearestNeighbor'; $f = New-Object System.Drawing.Font('Arial', 10, [System.Drawing.FontStyle]::Bold)
$i = 0
foreach ($p in $ps) {
  $cx = ($i % $cols) * $colW; $cy = [Math]::Floor($i / $cols) * $rowH; $base = $cy + 172
  $g.DrawLine([System.Drawing.Pens]::Gray, $cx, $base, $cx + $colW - 10, $base)
  $j = 0
  foreach ($d in $ds) {
    $idle = [System.Drawing.Image]::FromFile((Resolve-Path "$d\idle.png").Path); $k = $H0 / $idle.Height; $idle.Dispose()
    if (Test-Path "$d\$p.png") { $im = [System.Drawing.Image]::FromFile((Resolve-Path "$d\$p.png").Path); $w = $im.Width * $k; $h = $im.Height * $k
      $g.DrawImage($im, [float]($cx + 10 + $j * 130 + (125 - $w) / 2), [float]($base - $h), [float]$w, [float]$h); $im.Dispose() }
    $j++
  }
  $g.DrawString($p, $f, [System.Drawing.Brushes]::White, $cx + 4, $base + 2); $i++
}
$g.Dispose(); $b.Save($Out); $b.Dispose(); $Out
