/**
 * Imagens da Season 1: GIF do repositório local do jogo, PNG da PokéAPI como
 * fallback quando um arquivo GIF estiver ausente. Não altera progresso salvo.
 */
(function initKantoSprites(win, doc) {
  'use strict';

  const LOCAL_PATH = 'assets/pokemon-gifs/poke_';
  const FALLBACK_PATH = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';

  function fallbackFor(id) {
    return FALLBACK_PATH + Number(id) + '.png';
  }

  function sourceFor(id) {
    const number = Number(id);
    return Number.isInteger(number) && number >= 1 && number <= 151
      ? LOCAL_PATH + number + '.gif'
      : fallbackFor(id);
  }

  // Captura erros também em imagens inseridas dinamicamente na Pokédex/Arena.
  function handleImageError(event) {
    const image = event.target;
    if (!image || image.tagName !== 'IMG' || !image.dataset) return;
    const source = image.getAttribute('src') || '';
    const match = /^assets\/pokemon-gifs\/poke_([1-9]\d{0,2})\.gif$/.exec(source);
    if (!match || image.dataset.spriteFallback === '1') return;
    image.dataset.spriteFallback = '1'; // Evita loop se a imagem de fallback falhar.
    image.src = fallbackFor(match[1]);
  }

  win.KantoSprites = Object.freeze({ sourceFor, fallbackFor });
  doc.addEventListener('error', handleImageError, true);
})(window, document);
