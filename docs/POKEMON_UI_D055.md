# D-055 — Primeira rodada visual do Perfil do Pokémon

## Escopo implementado
- Nova apresentação da aba `Pokémon` em `apps/web/src/play/PlayApp.tsx`, preservando integralmente os comandos do domínio. **Nenhuma alteração no writer, no combate, nos itens, na evolução ou na distribuição atual dos pontos**.
- Cabeçalho próprio e navegação por âncoras de teclado/mouse para **Atributos**, **Evolução** e **Golpes**.
- Hero responsivo com GIF local `/assets/pokemon-gifs/poke_<id>.gif` original, halo ciano/violeta, base luminosa, número da espécie, UID imutável, nível, afinidade, condição de líder/equipe/coleção e taxa calculada por `affinityRate`.
- Painéis de treinamento e evolução mantidos com todos os requisitos e botões atuais; barra visual dos atributos com os totais **já calculados pelo core**. A escala da barra (0..400) é **apenas apresentação**, não alterou nem criou limite de status.
- Seção de golpes preserva categorias de dano/suporte, SP, PP, ranks, limites, ações de equipar/remover/tornar principal, e textos operacionais, com layout em cards 2 colunas (desktop) / 1 coluna (mobile).
- CSS exclusivamente com design tokens Kanto Dark no `styles/tokens.css`, sem alterar `:root` nem inventar paleta. Font Awesome já integrado na D051 e padrão de brilho da tela Treinador reaproveitado.
- E2E verifica o novo cabeçalho, GIF original carregado, barra de afinidade, três âncoras e continuidade do comando existente de +1 DEF com revisão de save; capturas `pokemon-profile-desktop.png` e `pokemon-profile-mobile.png`.

## Limites deste passe
- Este é o **primeiro esboço visual** da tela Pokémon, para avaliação do layout. Ainda **não** introduz a prévia/confirmar dos atributos do Pokémon; a ação de +1 continua como antes até projetarmos o writer batch da instância por UID, com limite e atomicidade e testes específicos.
- Itens/equipamentos/loja/raridades/drop/crafting continuam **pendentes**, inclusive a D054 PR #78 separada. Não copiar nem integrar mudanças de economia nesta branch.
- Proteger a chave `kanto-idle-play-v02`, schema2, a rota legada `/`, 151 GIFs, artes originais, motor de combate, TM09 ainda bloqueada, e repositório de assets `isaquesan7/pokedex`.

## Gates antes do merge
TypeScript/Vitest/Node, regressão Playwright desktop e mobile, imagem Docker, revisão das capturas, merge via PR e verificação do Railway no SHA publicado somente mediante autorização de publicação.
