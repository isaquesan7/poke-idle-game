import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

/**
 * Servidor mínimo do laboratório: expõe apenas as rotas públicas conhecidas.
 * CSS é estático e não altera os dados ou regras do jogo.
 */
const port = Number(process.env.PORT || 3000);
const routes = new Map([
  ['/', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/index.html', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/styles/tokens.css', { file: 'styles/tokens.css', type: 'text/css; charset=utf-8' }],
  ['/styles/app.css', { file: 'styles/app.css', type: 'text/css; charset=utf-8' }]
]);
const assets = new Map(Array.from(routes, ([route, asset]) => [
  route,
  { body: readFileSync(new URL('./' + asset.file, import.meta.url)), type: asset.type }
]));

createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }
  const asset = assets.get(url.pathname);
  if (!asset) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Não encontrado');
    return;
  }
  res.writeHead(200, {
    'Content-Type': asset.type,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(asset.body);
}).listen(port, '0.0.0.0', () => {
  console.log(`Kanto Idle LAB ouvindo na porta ${port}`);
});
