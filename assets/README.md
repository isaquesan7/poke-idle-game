# Assets do Poke Idle Game

Esta pasta é o local reservado para **ativos visuais e de interface** do projeto, quando forem criados ou licenciados. Exemplos futuros: `branding/`, `icons/`, `backgrounds/`, `ui/`, `effects/`.

**Estado atual:** nenhum novo arquivo de imagem foi adicionado nesta entrega. O protótipo v0.1 usa sprites remotos e a interface em CSS dentro de `index.html`. Não converter ou redistribuir automaticamente sprites de Pokémon apenas por estarem acessíveis via PokéAPI.

## Ao adicionar um asset
1. Registrar origem, autor/titular, licença e permissão de uso.
2. Nomear de forma estável e descritiva (`kebab-case`).
3. Preferir formatos leves (SVG para ícones próprios, WebP/PNG para imagens com atribuição/licença).
4. Não inserir fontes, credenciais, material privado ou propriedade intelectual sem autorização.
5. Anotar o novo asset e seu uso em `CHANGELOG.md`, e atualizar `docs/PROJECT_STATE.md` se afetar a UI.


## GIFs Kanto em preparação (2026-11-16)
- Pasta de destino: \`assets/pokemon-gifs/poke_1.gif\` até \`poke_151.gif\`.
- Fonte apenas para leitura: \`isaquesan7/pokedex/config/img/pokemons\` no commit
  \`d86ba82e1f6b2b0da708ff6c304b71e1f70aa139\`.
- Script de importação reprodutível: \`scripts/sync-pokemon-gifs.mjs\`.
- Verificação: \`scripts/verify-pokemon-gifs.mjs\`.
- Os **arquivos binários só estarão presentes quando o workflow de importação
  concluir e registrar os arquivos** na branch. Não confundir código em PR
  com publicação em produção.
- Origem no GitHub **não equivale a licença de redistribuição comercial**.
  Os direitos de personagens, sprites e marcas pertencem aos titulares.
