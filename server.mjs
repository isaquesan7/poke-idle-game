import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';

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
    // D-044: readiness real da rota React. A ausência do dist NÃO pode
    // passar no healthcheck e publicar apenas a home v0.1 por engano.
    const ready = existsSync(new URL('./apps/web/dist/index.html', import.meta.url));
    res.writeHead(ready ? 200 : 503, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(ready ? 'ok' : 'build indisponível');
    return;
  }
  // Novo loop jogável React: HTML compilado pela etapa npm prestart.
  // A raiz legada v0.1 continua ativa até termos paridade de combate e Pokedex.
  // D-064AE: catálogo regional somente leitura usa o mesmo bundle React.
  if (url.pathname === '/play' || url.pathname === '/play/'
    || url.pathname === '/regions' || url.pathname === '/regions/') {
    const html = new URL('./apps/web/dist/index.html', import.meta.url);
    if (!existsSync(html)) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Build React indisponível');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    createReadStream(html).pipe(res);
    return;
  }
  // Assets do Vite: apenas nomes de arquivo sem subdiretórios, extensões conhecidas.
  // Nunca servir código-fonte, configs, saves, node_modules ou arquivos arbitrários.
  const built = /^\/assets\/([A-Za-z0-9_.-]+\.(?:js|css|svg|png|webp|woff2?))$/.exec(url.pathname);
  if (built) {
    const file = new URL('./apps/web/dist/assets/' + built[1], import.meta.url);
    const stream = createReadStream(file);
    stream.once('open', () => {
      res.writeHead(200, {
        'Content-Type': built[1].endsWith('.js') ? 'text/javascript; charset=utf-8'
          : built[1].endsWith('.css') ? 'text/css; charset=utf-8'
          : built[1].endsWith('.svg') ? 'image/svg+xml'
          : built[1].endsWith('.png') ? 'image/png'
          : built[1].endsWith('.webp') ? 'image/webp'
          : 'font/woff2',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff'
      });
      stream.pipe(res);
    });
    stream.once('error', () => {
      if (!res.headersSent) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Asset não encontrado');
      } else res.destroy();
    });
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
