# Borra manchas blancas cerradas que quedaron atrapadas dentro de un dibujo (por ejemplo entre un chorro y una pierna),
# solo las de más de -Min píxeles y dentro de la zona -X0..1 / -Y0..1 (fracciones), para no tocar la polera ni las zapatillas.
# Uso: holes.ps1 -In pose.png [-Min 300] [-X0 0.4] [-Y0 0.45] [-X1 1] [-Y1 1] [-Thr 222]  (la mancha tiene que caer entera dentro de X0..X1 / Y0..Y1)
param([string]$In, [int]$Min = 300, [double]$X0 = 0.4, [double]$Y0 = 0.45, [double]$X1 = 1, [double]$Y1 = 1, [int]$Thr = 222)
Add-Type -AssemblyName System.Drawing
if (-not ('Holes2' -as [type])) {
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class Holes2 {
  public static string Run(string f, int min, double x0, double y0, double x1, double y1, int thr) {
    Bitmap b; using (var s = new Bitmap(f)) { b = new Bitmap(s.Width, s.Height, PixelFormat.Format32bppArgb); using (var g = Graphics.FromImage(b)) g.DrawImage(s, 0, 0, s.Width, s.Height); }
    int W = b.Width, H = b.Height; var d = b.LockBits(new Rectangle(0,0,W,H), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb); var p = new byte[W*H*4]; Marshal.Copy(d.Scan0, p, 0, p.Length);
    Func<int,bool> wh = i => p[i*4+3] > 0 && p[i*4] > thr && p[i*4+1] > thr && p[i*4+2] > thr;
    var seen = new bool[W*H]; int cleared = 0;
    for (int y = (int)(H*y0); y < (int)(H*y1); y++) for (int x = (int)(W*x0); x < (int)(W*x1); x++) {
      int i0 = y*W+x; if (seen[i0] || !wh(i0)) continue;
      var list = new List<int>(); var st = new Stack<int>(); st.Push(i0); seen[i0] = true;
      while (st.Count > 0) { int i = st.Pop(); list.Add(i); int cx = i%W, cy = i/W;
        foreach (int j in new[]{ cx>0?i-1:-1, cx<W-1?i+1:-1, cy>0?i-W:-1, cy<H-1?i+W:-1 }) if (j >= 0 && !seen[j] && wh(j)) { seen[j] = true; st.Push(j); } }
      bool inside = true; foreach (int i in list) { int px = i % W, py = i / W; if (px < W*x0 || px >= W*x1 || py < H*y0 || py >= H*y1) { inside = false; break; } }
      if (inside && list.Count >= min) { foreach (int i in list) p[i*4+3] = 0; cleared += list.Count; }
    }
    Marshal.Copy(p, 0, d.Scan0, p.Length); b.UnlockBits(d); b.Save(f + ".tmp.png", ImageFormat.Png); b.Dispose();
    System.IO.File.Delete(f); System.IO.File.Move(f + ".tmp.png", f);
    return "borrados " + cleared;
  }
}
'@
}
[Holes2]::Run((Resolve-Path $In).Path, $Min, $X0, $Y0, $X1, $Y1, $Thr)
