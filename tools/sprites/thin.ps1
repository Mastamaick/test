# Borra trazos finos y oscuros sueltos (líneas de movimiento que Gemini dibuja junto a un golpe).
# Un píxel oscuro se borra si al "abrir" la silueta (erosionar R px y volver a dilatar R+1) no queda cuerpo cerca.
# Uso: thin.ps1 -In pose.png [-Out salida.png] [-R 3] [-Dark 80]
param([string]$In, [string]$Out, [int]$R = 3, [int]$Dark = 80)
if (-not $Out) { $Out = $In }
Add-Type -AssemblyName System.Drawing
if (-not ('Thin1' -as [type])) {
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class Thin1 {
  public static string Run(string inp, string outp, int r, int dark) {
    Bitmap bmp; using (var b0 = new Bitmap(inp)) { bmp = new Bitmap(b0.Width, b0.Height, PixelFormat.Format32bppArgb); using (var g = Graphics.FromImage(bmp)) g.DrawImage(b0, 0, 0, b0.Width, b0.Height); }
    int W = bmp.Width, H = bmp.Height; var d = bmp.LockBits(new Rectangle(0,0,W,H), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    var px = new byte[W*H*4]; Marshal.Copy(d.Scan0, px, 0, px.Length);
    var op = new bool[W*H]; for (int i = 0; i < W*H; i++) op[i] = px[i*4+3] > 100;
    var er = new bool[W*H];
    for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) { bool all = true;
      for (int dy = -r; dy <= r && all; dy++) for (int dx = -r; dx <= r; dx++) { int xx = x+dx, yy = y+dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H || !op[yy*W+xx]) { all = false; break; } }
      er[y*W+x] = all; }
    var opened = new bool[W*H]; int R2 = r + 1;
    for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) { if (!er[y*W+x]) continue;
      for (int dy = -R2; dy <= R2; dy++) for (int dx = -R2; dx <= R2; dx++) { int xx = x+dx, yy = y+dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) opened[yy*W+xx] = true; } }
    int n = 0;
    for (int i = 0; i < W*H; i++) { if (!op[i] || opened[i]) continue; int l = (px[i*4+2]*3 + px[i*4+1]*6 + px[i*4]) / 10; if (l < dark) { px[i*4+3] = 0; n++; } }
    Marshal.Copy(px, 0, d.Scan0, px.Length); bmp.UnlockBits(d); bmp.Save(outp, ImageFormat.Png); bmp.Dispose();
    return "borrados " + n;
  }
}
'@
}
[Thin1]::Run((Resolve-Path $In).Path, $Out, $R, $Dark)
