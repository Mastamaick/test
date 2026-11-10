// Servidor local del juego para grabar videos: sirve los archivos y además guarda lo que la página
// mande por POST a /__upload/<nombre> en revision/videos/ (carpeta ignorada por git).
// Uso: node tools/video/serve.js . 5173
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2] || '.'), port = +process.argv[3] || 5173;
const outDir = path.join(root, 'revision', 'videos');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.json': 'application/json', '.webp': 'image/webp' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST' && p.startsWith('/__upload/')) {
    fs.mkdirSync(outDir, { recursive: true });
    const out = fs.createWriteStream(path.join(outDir, path.basename(p)));
    req.pipe(out); out.on('finish', () => res.end('ok'));
    return;
  }
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log('Sirviendo ' + root + ' en http://localhost:' + port));
