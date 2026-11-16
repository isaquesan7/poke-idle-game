import { createServer } from 'node:http';
import { createReadStream, readFileSync } from 'node:fs';

/**
 * Servidor mínimo do laboratório: expõe apenas as rotas públicas conhecidas.
 * CSS é estático e não altera os dados ou regras do jogo.
 */
const port = Number(process.env.PORT || 3000);
const routes = new Map([
  ['/', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/index.html', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/styles/tokens.css', { file: 'styles/tokens.css', type: 'text/css; charset=utf-8' }],
  ['/styles/app.css', { file: 'styles/app.css', type: 'text/css; charset=utf-8' }],
  ['/scripts/pokemon-sprites.js', { file: 'scripts/pokemon-sprites.js', type: 'text/javascript; charset=utf-8' }]
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
  // GIFs Kanto: somente IDs inteiros entre 1 e 151, sem acesso livre ao filesystem.
  const spriteMatch = /^\/assets\/pokemon-gifs\/poke_([1-9]\d{0,2})\.gif$/.exec(url.pathname);
  if (spriteMatch && Number(spriteMatch[1]) <= 151) {
    const file = new URL('./assets/pokemon-gifs/poke_' + spriteMatch[1] + '.gif', import.meta.url);
    const sprite = createReadStream(file);
    sprite.once('open', () => {
      res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff'
      });
      sprite.pipe(res);
    });
    sprite.once('error', () => {
      if (!res.headersSent) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Imagem não encontrada');
      } else {
        res.destroy();
      }
    });
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
