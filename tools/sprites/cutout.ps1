# Recorta una zona de una imagen con fondo blanco, vuelve transparente el blanco conectado al borde
# (relleno desde las orillas, así no se borran los blancos de adentro como franjas o zapatillas) y la escala.
# Uso: cutout.ps1 -In img.png -Out pose.png -X 0 -Y 0 -W 100 -H 100 [-Scale 1.5] [-Thr 232] [-Largest] [-Green (fondo verde)]
param([string]$In, [string]$Out, [int]$X, [int]$Y, [int]$W, [int]$H, [double]$Scale = 1, [int]$Thr = 232, [switch]$Largest, [switch]$Green)
Add-Type -AssemblyName System.Drawing
if (-not ('Cut3' -as [type])) {
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Imaging; using System.Drawing.Drawing2D; using System.Runtime.InteropServices;
public static class Cut3 {
  public static string Run(string inp, string outp, int X, int Y, int W, int H, double k, int thr, bool largest, bool green) {
    var b = new Bitmap(W, H, PixelFormat.Format32bppArgb);
    using (var s = new Bitmap(inp)) using (var g = Graphics.FromImage(b)) g.DrawImage(s, new Rectangle(0,0,W,H), X, Y, W, H, GraphicsUnit.Pixel);
    var d = b.LockBits(new Rectangle(0,0,W,H), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb); var p = new byte[W*H*4]; Marshal.Copy(d.Scan0, p, 0, p.Length);
    var seen = new bool[W*H]; var q = new Queue<int>();
    Func<int,bool> white = i => p[i*4] >= thr && p[i*4+1] >= thr && p[i*4+2] >= thr;
    for (int x=0;x<W;x++){ q.Enqueue(x); q.Enqueue((H-1)*W+x); } for (int y=0;y<H;y++){ q.Enqueue(y*W); q.Enqueue(y*W+W-1); }
    while (q.Count>0) { int i=q.Dequeue(); if (seen[i] || !white(i)) continue; seen[i]=true; p[i*4+3]=0; int x=i%W, y=i/W;
      if (x>0) q.Enqueue(i-1); if (x<W-1) q.Enqueue(i+1); if (y>0) q.Enqueue(i-W); if (y<H-1) q.Enqueue(i+W); }
    if (green) { // fondo verde (#00FF00): se borra todo el verde aunque esté encerrado, y se le quita el tinte verde a los bordes
      for (int i=0;i<W*H;i++) { int r=p[i*4+2], gg=p[i*4+1], bl=p[i*4]; if (gg > r+50 && gg > bl+50) { p[i*4+3]=0; continue; } int m=Math.Max(r,bl); if (gg > m+18) p[i*4+1]=(byte)m; }
    }
    if (largest) { // deja solo la mancha más grande (la figura), borra lo que flota suelto alrededor
      var lab = new int[W*H]; int best=0, bestN=0, cur=0; var st = new Stack<int>();
      for (int i0=0;i0<W*H;i0++) { if (p[i0*4+3]==0 || lab[i0]!=0) continue; cur++; int n=0; st.Push(i0); lab[i0]=cur;
        while (st.Count>0) { int i=st.Pop(); n++; int x=i%W, y=i/W;
          foreach (int j in new[]{ x>0?i-1:-1, x<W-1?i+1:-1, y>0?i-W:-1, y<H-1?i+W:-1 }) if (j>=0 && lab[j]==0 && p[j*4+3]!=0) { lab[j]=cur; st.Push(j); } }
        if (n>bestN){bestN=n;best=cur;} }
      for (int i=0;i<W*H;i++) if (lab[i]!=best) p[i*4+3]=0;
    }
    Marshal.Copy(p,0,d.Scan0,p.Length); b.UnlockBits(d);
    // recorte a lo visible
    int x0=W,y0=H,x1=-1,y1=-1; for (int y=0;y<H;y++) for (int x=0;x<W;x++) if (p[(y*W+x)*4+3]>0){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
    int cw=x1-x0+1, ch=y1-y0+1, ow=(int)Math.Round(cw*k), oh=(int)Math.Round(ch*k);
    var o = new Bitmap(ow, oh, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(o)) { g.InterpolationMode = InterpolationMode.NearestNeighbor; g.PixelOffsetMode = PixelOffsetMode.Half; g.DrawImage(b, new Rectangle(0,0,ow,oh), x0, y0, cw, ch, GraphicsUnit.Pixel); }
    o.Save(outp, ImageFormat.Png); o.Dispose(); b.Dispose();
    return outp + " " + ow + "x" + oh;
  }
}
'@
}
[Cut3]::Run((Resolve-Path $In).Path, [IO.Path]::GetFullPath($Out), $X, $Y, $W, $H, $Scale, $Thr, [bool]$Largest, [bool]$Green)
