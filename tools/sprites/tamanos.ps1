# Revisa que todas las poses de un rapero se vean del mismo tamaño en el juego.
# El juego escala todas las poses con el factor de la idle, así que si una pose se recortó/escaló distinto
# el personaje "crece" o "se encoge". Se mide el ancho de la cabeza (franja de arriba del dibujo) de cada pose,
# a escala de juego, y se compara con el de la idle. Marca las que se salen más de ±Tol %.
# Uso: tamanos.ps1 -Dirs 'privado\fighters\djtranse,assets\fighters\jonas' [-Tol 12]
param([string]$Dirs, [double]$Tol = 12)
Add-Type -AssemblyName System.Drawing
if (-not ('Tam1' -as [type])) {
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class Tam1 {
  // ancho medio de la cabeza: filas desde el tope del dibujo hasta band px, promedio del ancho opaco de las filas más anchas
  public static double Head(string path, int band, out int h) {
    var s = new Bitmap(path); int W = s.Width, H = s.Height; h = H;
    var b = new Bitmap(W, H, PixelFormat.Format32bppArgb); using (var g = Graphics.FromImage(b)) g.DrawImage(s, 0, 0, W, H); s.Dispose();
    var d = b.LockBits(new Rectangle(0,0,W,H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb); var p = new byte[W*H*4]; Marshal.Copy(d.Scan0, p, 0, p.Length); b.UnlockBits(d); b.Dispose();
    int top = -1; for (int y = 0; y < H && top < 0; y++) for (int x = 0; x < W; x++) if (p[(y*W+x)*4+3] > 60) { top = y; break; }
    if (top < 0) return 0;
    var widths = new System.Collections.Generic.List<int>();
    for (int y = top; y < Math.Min(H, top + band); y++) { int l = -1, r = -1; for (int x = 0; x < W; x++) if (p[(y*W+x)*4+3] > 60) { if (l < 0) l = x; r = x; } if (l >= 0) widths.Add(r - l + 1); }
    widths.Sort(); widths.Reverse(); int n = Math.Max(1, widths.Count / 3); double sum = 0; for (int i = 0; i < n; i++) sum += widths[i]; return sum / n;
  } }
'@ }
foreach ($dir in $Dirs.Split(',')) {
  $idleP = (Resolve-Path "$dir\idle.png").Path; $ih = 0
  $tmp = [System.Drawing.Image]::FromFile($idleP); $H0 = $tmp.Height; $tmp.Dispose()
  $band = [int]($H0 * 0.16)
  $ref = [Tam1]::Head($idleP, $band, [ref]$ih)
  "== $dir (cabeza idle $([Math]::Round($ref)) px)"
  foreach ($f in Get-ChildItem "$dir\*.png") {
    $h = 0; $w = [Tam1]::Head($f.FullName, $band, [ref]$h)
    $pct = [Math]::Round(($w / $ref - 1) * 100)
    $flag = if ([Math]::Abs($pct) -gt $Tol) { '  <-- REVISAR' } else { '' }
    if ($flag -or $f.BaseName -eq 'idle') { "{0,-14} {1,4}%  (alto {2})$flag" -f $f.BaseName, $pct, $h }
  }
}
