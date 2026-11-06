# Pega SOLO las zapatillas nuevas de una pose editada por Gemini sobre la pose original, sin tocar cara ni ropa.
# 1) escala la figura de Gemini al alto de la original y la alinea buscando el mejor calce de siluetas;
# 2) marca los pixeles que en Gemini son blancos (zapatilla nueva) y en la original eran oscuros (zapatilla negra o pantalón);
# 3) borra marcas finas (desajustes en bordes) y agranda un poco la zona para traer también el contorno y las franjas;
# 4) copia los pixeles de Gemini solo dentro de esa zona.
# Uso: shoes.ps1 -Orig assets\fighters\x\kick.png -Gem cortes\kick.png -Out salida.png [-Open 2] [-Grow 4]
param([string]$Orig, [string]$Gem, [string]$Out, [int]$Open = 2, [int]$Grow = 4, [int]$MinY = 0)
Add-Type -AssemblyName System.Drawing
if (-not ('Shoes1' -as [type])) {
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Drawing.Drawing2D; using System.Runtime.InteropServices;
public static class Shoes1 {
  static byte[] Px(Bitmap b) { var d = b.LockBits(new Rectangle(0,0,b.Width,b.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb); var p = new byte[b.Width*b.Height*4]; Marshal.Copy(d.Scan0, p, 0, p.Length); b.UnlockBits(d); return p; }
  static Bitmap Argb(string f) { using (var s = new Bitmap(f)) { var b = new Bitmap(s.Width, s.Height, PixelFormat.Format32bppArgb); using (var g = Graphics.FromImage(b)) g.DrawImage(s, 0, 0, s.Width, s.Height); return b; } }
  static int[] Box(byte[] p, int W, int H) { int x0=W,y0=H,x1=-1,y1=-1; for (int y=0;y<H;y++) for (int x=0;x<W;x++) if (p[(y*W+x)*4+3]>100){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } return new[]{x0,y0,x1,y1}; }
  static bool[] Morph(bool[] m, int W, int H, int r, bool erode) { var o = new bool[W*H]; for (int y=0;y<H;y++) for (int x=0;x<W;x++){ bool v = erode; for (int dy=-r;dy<=r && v==erode;dy++) for (int dx=-r;dx<=r;dx++){ int xx=x+dx,yy=y+dy; bool s = xx>=0&&yy>=0&&xx<W&&yy<H && m[yy*W+xx]; if (erode && !s){v=false;break;} if(!erode && s){v=true;break;} } o[y*W+x]=v; } return o; }
  public static string Run(string orig, string gem, string outp, int open, int grow, int minY) {
    var O = Argb(orig); int W = O.Width, H = O.Height; var op = Px(O); var ob = Box(op, W, H);
    var G0 = Argb(gem); var g0 = Px(G0); var gb = Box(g0, G0.Width, G0.Height);
    double k = (double)(ob[3]-ob[1]+1) / (gb[3]-gb[1]+1);
    int gw = (int)Math.Round((gb[2]-gb[0]+1)*k), gh = ob[3]-ob[1]+1;
    var G = new Bitmap(W, H, PixelFormat.Format32bppArgb);
    int bestDx = 0, bestDy = 0; double best = -1; byte[] gp = null;
    // calce: la figura escalada se corre hasta 14 px para que las siluetas coincidan lo más posible
    var Gs = new Bitmap(gw, gh, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(Gs)) { g.InterpolationMode = InterpolationMode.NearestNeighbor; g.PixelOffsetMode = PixelOffsetMode.Half; g.DrawImage(G0, new Rectangle(0,0,gw,gh), gb[0], gb[1], gb[2]-gb[0]+1, gb[3]-gb[1]+1, GraphicsUnit.Pixel); }
    var sp = Px(Gs); int baseX = ob[0] + ((ob[2]-ob[0]+1) - gw) / 2, baseY = ob[1];
    for (int dy=-6; dy<=6; dy+=2) for (int dx=-14; dx<=14; dx+=2) {
      long inter=0, uni=0;
      for (int y=0;y<gh;y+=2) for (int x=0;x<gw;x+=2) { int X=baseX+dx+x, Y=baseY+dy+y; bool a = sp[(y*gw+x)*4+3]>100; bool b = X>=0&&Y>=0&&X<W&&Y<H && op[(Y*W+X)*4+3]>100; if(a&&b) inter++; if(a||b) uni++; }
      double s = (double)inter/Math.Max(1,uni); if (s>best){best=s;bestDx=dx;bestDy=dy;}
    }
    using (var g = Graphics.FromImage(G)) g.DrawImage(Gs, baseX+bestDx, baseY+bestDy, gw, gh);
    gp = Px(G);
    Func<byte[],int,int> L = (p,i) => (p[i+2]*3 + p[i+1]*6 + p[i]) / 10;
    Func<byte[],int,int> Sat = (p,i) => Math.Max(p[i+2],Math.Max(p[i+1],p[i])) - Math.Min(p[i+2],Math.Min(p[i+1],p[i]));
    var m = new bool[W*H];
    for (int y=minY;y<H;y++) for (int x=0;x<W;x++){ int i=(y*W+x)*4; bool gw2 = gp[i+3]>100 && L(gp,i)>165 && Sat(gp,i)<45; bool od = op[i+3]>100 && L(op,i)<95; m[y*W+x] = gw2 && od; }
    if (open>0) m = Morph(Morph(m,W,H,open,true),W,H,open+1,false);
    var zone = Morph(m,W,H,grow,false);
    int n=0;
    for (int i=0;i<W*H;i++) if (zone[i] && gp[i*4+3]>100) { for (int c=0;c<4;c++) op[i*4+c]=gp[i*4+c]; n++; }
    var d2 = O.LockBits(new Rectangle(0,0,W,H), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb); Marshal.Copy(op,0,d2.Scan0,op.Length); O.UnlockBits(d2);
    O.Save(outp, ImageFormat.Png); O.Dispose(); G.Dispose(); G0.Dispose(); Gs.Dispose();
    return string.Format("calce {0:0.00} dx{1} dy{2} pixeles {3}", best, bestDx, bestDy, n);
  }
}
'@
}
"$([IO.Path]::GetFileName($Out)): " + [Shoes1]::Run((Resolve-Path $Orig).Path, (Resolve-Path $Gem).Path, [IO.Path]::GetFullPath($Out), $Open, $Grow, $MinY)
