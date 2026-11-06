# Corta una hoja de poses de Gemini (grilla Cols x Rows sobre fondo blanco) en PNG transparentes.
# Las figuras se numeran en orden de lectura (fila, luego izquierda a derecha); Names las nombra en ese orden ("-" salta una). Todas se escalan con el mismo factor, calculado para que la figura
# RefIndex (la primera, de pie) mida RefH px de alto (el alto de la idle del personaje). Pixel art: vecino más cercano.
param([string]$In, [string]$OutDir, [string]$Names, [int]$RefH, [int]$Cols = 3, [int]$Rows = 2, [int]$RefIndex = 0, [double]$RefFrac = 0.98, [int]$Thr = 228, [switch]$Magenta)
Add-Type -AssemblyName System.Drawing
if (-not ('Sheet5' -as [type])) {
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Imaging; using System.Drawing.Drawing2D; using System.Runtime.InteropServices;
public static class Sheet5 {
  public static string Run(string inp, string outDir, string[] names, int refH, int cols, int rows, int refIdx, double refFrac, int thr, bool magenta) {
    var src = new Bitmap(inp); int W = src.Width, H = src.Height;
    var bmp = new Bitmap(W, H, PixelFormat.Format32bppArgb); using (var g = Graphics.FromImage(bmp)) g.DrawImage(src, 0, 0, W, H); src.Dispose();
    var d = bmp.LockBits(new Rectangle(0,0,W,H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    var px = new byte[W*H*4]; Marshal.Copy(d.Scan0, px, 0, px.Length); bmp.UnlockBits(d); bmp.Dispose();
    if (magenta) { Func<int,bool> mg = i => { int b0 = px[i*4], g0 = px[i*4+1], r0 = px[i*4+2]; return r0 > 150 && b0 > 150 && r0 - g0 > 45 && b0 - g0 > 45; };
      var m = new bool[W*H]; for (int i = 0; i < W*H; i++) m[i] = mg(i);
      // dilatar 1 px para llevarse el borde suavizado de la línea
      var m2 = (bool[])m.Clone(); for (int i = 0; i < W*H; i++) if (m[i]) { int x = i % W, y = i / W; for (int dy = -2; dy <= 2; dy++) { int yy = y + dy; if (yy >= 0 && yy < H) m2[yy*W + x] = true; } }
      for (int x = 0; x < W; x++) for (int y = 0; y < H; y++) { int i = y*W + x; if (!m2[i]) continue;
        int up = y, dn = y; while (up > 0 && m2[up*W + x]) up--; while (dn < H-1 && m2[dn*W + x]) dn++;
        int sp = (y - up <= dn - y) ? up*W + x : dn*W + x; px[i*4] = px[sp*4]; px[i*4+1] = px[sp*4+1]; px[i*4+2] = px[sp*4+2]; } }
    Func<int,bool> white = i => px[i*4] >= thr && px[i*4+1] >= thr && px[i*4+2] >= thr;
    // fondo = blanco conectado al borde
    var bg = new bool[W*H]; var st = new Stack<int>();
    for (int x = 0; x < W; x++) { st.Push(x); st.Push((H-1)*W + x); }
    for (int y = 0; y < H; y++) { st.Push(y*W); st.Push(y*W + W-1); }
    while (st.Count > 0) { int c = st.Pop(); if (bg[c] || !white(c)) continue; bg[c] = true; int x = c % W, y = c / W;
      if (x > 0) st.Push(c-1); if (x < W-1) st.Push(c+1); if (y > 0) st.Push(c-W); if (y < H-1) st.Push(c+W); }
    // halo de la compresión: pixeles casi blancos pegados al fondo también son fondo (2 pasadas)
    for (int pass = 0; pass < 2; pass++) { var add = new List<int>();
      for (int c = 0; c < W*H; c++) { if (bg[c]) continue; int x = c % W, y = c / W; int mn = Math.Min(px[c*4], Math.Min(px[c*4+1], px[c*4+2]));
        if (mn < 200) continue; bool nb = (x > 0 && bg[c-1]) || (x < W-1 && bg[c+1]) || (y > 0 && bg[c-W]) || (y < H-1 && bg[c+W]); if (nb) add.Add(c); }
      foreach (int c in add) bg[c] = true; }
    // componentes
    var lab = new int[W*H]; var sizes = new List<int>{0}; var cxs = new List<double>{0}; var cys = new List<double>{0}; int n = 0;
    for (int s = 0; s < W*H; s++) { if (bg[s] || lab[s] != 0) continue; n++; int cnt = 0; long sx = 0, sy = 0; lab[s] = n; st.Push(s);
      while (st.Count > 0) { int c = st.Pop(); cnt++; int x = c % W, y = c / W; sx += x; sy += y;
        for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) { int xx = x+dx, yy = y+dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; int q = yy*W+xx; if (!bg[q] && lab[q] == 0) { lab[q] = n; st.Push(q); } } }
      sizes.Add(cnt); cxs.Add((double)sx/cnt); cys.Add((double)sy/cnt); }
    int big = 0; for (int i = 1; i <= n; i++) big = Math.Max(big, sizes[i]);
    // figuras: componentes grandes unidos si sus cajas casi se tocan (un zapato suelto, etc.);
    // se numeran en orden de lectura: fila (seg�n Rows) y luego de izquierda a derecha
    var cb = new int[n+1,4]; for (int i = 1; i <= n; i++) { cb[i,0] = W; cb[i,1] = H; cb[i,2] = -1; cb[i,3] = -1; }
    for (int i = 0; i < W*H; i++) { int l = lab[i]; if (l == 0) continue; int x = i % W, y = i / W;
      if (x < cb[l,0]) cb[l,0] = x; if (y < cb[l,1]) cb[l,1] = y; if (x > cb[l,2]) cb[l,2] = x; if (y > cb[l,3]) cb[l,3] = y; }
    var par = new int[n+1]; for (int i = 0; i <= n; i++) par[i] = i;
    Func<int,int> root = null; root = k => par[k] == k ? k : (par[k] = root(par[k]));
    var keep = new List<int>(); for (int i = 1; i <= n; i++) if (sizes[i] >= big * 0.004) keep.Add(i);
    foreach (int a in keep) foreach (int b in keep) { if (a >= b) continue;
      int gx = Math.Max(cb[a,0] - cb[b,2], cb[b,0] - cb[a,2]), gy = Math.Max(cb[a,1] - cb[b,3], cb[b,1] - cb[a,3]);
      if (gx < 12 && gy < 12) par[root(a)] = root(b); }
    var groups = new Dictionary<int,int[]>();
    foreach (int a in keep) { int r = root(a); if (!groups.ContainsKey(r)) groups[r] = new int[]{ W, H, -1, -1 }; var g = groups[r];
      g[0] = Math.Min(g[0], cb[a,0]); g[1] = Math.Min(g[1], cb[a,1]); g[2] = Math.Max(g[2], cb[a,2]); g[3] = Math.Max(g[3], cb[a,3]); }
    var order = new List<int>(groups.Keys);
    order.RemoveAll(r => (groups[r][3] - groups[r][1]) < H * 0.12); // motas
    Func<int,int> rowOf = r => Math.Min(rows-1, (int)((groups[r][1] + groups[r][3]) / 2.0 * rows / H));
    order.Sort((p, q) => rowOf(p) != rowOf(q) ? rowOf(p).CompareTo(rowOf(q)) : groups[p][0].CompareTo(groups[q][0]));
    var idxOf = new Dictionary<int,int>(); for (int k = 0; k < order.Count; k++) idxOf[order[k]] = k;
    var cell = new int[n+1];
    for (int i = 1; i <= n; i++) { int r = root(i); cell[i] = (sizes[i] >= big * 0.004 && idxOf.ContainsKey(r)) ? idxOf[r] : -1; }
    int N = order.Count; var box = new int[N,4]; for (int k = 0; k < N; k++) { box[k,0] = W; box[k,1] = H; box[k,2] = -1; box[k,3] = -1; }
    for (int i = 0; i < W*H; i++) { int l = lab[i]; if (l == 0 || cell[l] < 0) continue; int k = cell[l], x = i % W, y = i / W;
      if (x < box[k,0]) box[k,0] = x; if (y < box[k,1]) box[k,1] = y; if (x > box[k,2]) box[k,2] = x; if (y > box[k,3]) box[k,3] = y; }
    if (box[refIdx,2] < 0) return "sin figura de referencia";
    double scale = refH * refFrac / (box[refIdx,3] - box[refIdx,1] + 1);
    string res = "escala " + scale.ToString("0.000");
    for (int k = 0; k < N && k < names.Length; k++) {
      if (box[k,2] < 0 || names[k] == "-") { res += " | " + names[k] + ":salta"; continue; }
      int x0 = box[k,0], y0 = box[k,1], cw = box[k,2]-x0+1, ch = box[k,3]-y0+1;
      var crop = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
      var cd = crop.LockBits(new Rectangle(0,0,cw,ch), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb); var cp = new byte[cw*ch*4];
      for (int y = 0; y < ch; y++) for (int x = 0; x < cw; x++) { int i = (y+y0)*W + x+x0, j = (y*cw + x)*4; int l = lab[i];
        if (l > 0 && cell[l] == k) { cp[j] = px[i*4]; cp[j+1] = px[i*4+1]; cp[j+2] = px[i*4+2]; cp[j+3] = 255; } }
      Marshal.Copy(cp, 0, cd.Scan0, cp.Length); crop.UnlockBits(cd);
      int ow = Math.Max(1, (int)Math.Round(cw * scale)), oh = Math.Max(1, (int)Math.Round(ch * scale));
      var outb = new Bitmap(ow, oh, PixelFormat.Format32bppArgb);
      using (var g = Graphics.FromImage(outb)) { g.InterpolationMode = scale < 1 ? InterpolationMode.HighQualityBicubic : InterpolationMode.NearestNeighbor; g.PixelOffsetMode = PixelOffsetMode.Half; g.DrawImage(crop, 0, 0, ow, oh); }
      outb.Save(System.IO.Path.Combine(outDir, names[k] + ".png"), ImageFormat.Png); res += " | " + names[k] + ":" + ow + "x" + oh; crop.Dispose(); outb.Dispose();
    }
    return res;
  }
}
'@
}
New-Item -ItemType Directory -Force $OutDir | Out-Null
[Sheet5]::Run((Resolve-Path $In).Path, (Resolve-Path $OutDir).Path, $Names.Split(','), $RefH, $Cols, $Rows, $RefIndex, $RefFrac, $Thr, [bool]$Magenta)


