import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const port = Number(process.env.PORT || 3000);
const html = readFileSync(new URL('./index.html', import.meta.url));
createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(html);
    return;
  }
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Não encontrado');
}).listen(port, '0.0.0.0', () => console.log(`Kanto Idle LAB ouvindo na porta ${port}`));
