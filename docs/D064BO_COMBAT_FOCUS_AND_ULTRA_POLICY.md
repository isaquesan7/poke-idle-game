# D064BO — correção da Ultra Ball de combate e UX do campo de batalha (22/11/2026)

**Status:** alteração em branch, aguarda testes CI, integração e Railway. Registro de decisão explícita do usuário que prevalece sobre a interpretação errada da D064BN. Nenhum preço ou writer de loja foi habilitado.

## Uma regra diferente para cada modo

| Fonte de Ultra Ball | Onde pode ganhar | Como ganha |
|---|---|---|
| **Batalha regional** | **Regiões 7, 8, 9 e 10** | **1 Ultra Ball a cada 15 vitórias válidas na respectiva região** |
| **Expedição idle** | **Somente regiões 9 e 10** | **1 Ultra Ball a cada 8.640 ciclos elegíveis acumulados (=24h)** |
| Outras regiões de expedição | Regiões 1 a 8 | **Nenhuma Ultra Ball** |

A regra restrita às últimas regiões diz respeito **exclusivamente ao modo expedição**. Revertido o trecho da D064BN que indevidamente zerou os drops de Ultra Ball por combate: `d064DraftBallDrop(regionId, regionWinNumber)` e `d064DraftBallSupply` devolvem Ultra a partir da **R7** novamente. São recompensas do writer real, não plano hipotético. `regionWins[i]` permanece saturado em 100.000; ao atingir teto não repete drops. Poké Ball por 3 vitórias R1–R6, Great Ball por 7 vitórias R4–R10, XP, afinidade, capturas, IA, odds lendárias e estoque existente permanecem iguais. Master Ball continua reservada.

## UX: fixação de tela no combate ou captura

A causa raiz de voltar ao início da página era um `window.scrollTo(0,0)` em `useLayoutEffect` dependente da revisão do save, além de outros `scrollTo` ao entrar/iniciar combate. Toda atualização pós-vitória ou tentativa de captura acionava esse efeito e teleportava o usuário ao topo.

Novo comportamento em `PlayApp.tsx`:
- Ao entrar no modo batalha, começar novo encontro, retomar um duelo pendente ou reassistir, o foco acessível e a área visível vão **para o palco de Pokémon** (`[data-testid="battle-stage"]`).
- Depois de finalizar um combate com vitória, quando `captureStatus='available'`, o foco e a rolagem vão **para a decisão de captura** (`[data-testid="battle-capture-area"]`) na mesma coluna do palco.
- Ao capturar, falhar (`escaped`) ou pular (`skipped`), o foco permanece no bloco de captura e no resultado. O elemento existe antes/depois da alteração do status e é focável via `tabIndex=-1`, sem abrir teclado virtual.
- Não há mais `scrollTo(0,0)` na experiência do combate. Usa `element.focus({preventScroll:true})` e `element.scrollIntoView({block:'center',behavior:'auto',inline:'nearest'})` **somente quando muda o identificador/status da batalha ou a aba**, não a cada segundo do cronômetro, linha do log ou mudança irrelevante de save.
- Fora da navegação para combate/captura, não há rolagem forçada. Mantido suporte a telas estreitas e ao navegador desktop.

## LEVEL UP! flutuante, sem caixa

- O writer continua concedendo XP apenas ao fechar o replay e detectando `currentPokemon.level > initialLevel`, sem adivinhar nível por animação.
- O antigo cartão de anúncio `battleLevelUp` abaixo da arena foi excluído da interface. Novo `BattleStage` recebe `levelUp` e renderiza somente **LEVEL UP!** por cima do sprite do parceiro, exatamente na área dos efeitos de dano/cura.
- CSS anima o texto por ~2,25s e o React remove o estado após 2,3s. `prefers-reduced-motion` exibe texto estático pelo mesmo tempo, sem movimento; `role=status` anuncia via tecnologia assistiva. Não há concessão de XP, efeito repetido ao reassistir ou alteração do GIF.
- O nível exibido no palco após o settlement é o novo nível salvo; durante replay, continua mostrando o nível original do registro da batalha.

## Testes

- `d064bn-ball-supply-provenance.test.ts`: 10 regiões × vitórias 1–105, com Ultra de combate a cada 15 na R7+, checagem do cap e **expedição** Ultra exclusivamente em R9/R10 após 3×8h elegíveis.
- `d064bn-ultra-battle-writer.test.ts`: 15ª vitória real na R7 credita **1 Ultra Ball** e um único receipt; duas vitórias no cap 100k não fabricam mais drops.
- `apps/web/tests/e2e/regional-writer-bridge.mjs`: viewport 1440×900 e 390×844, novo combate foca palco; vitória foca captura; tentativa terminada (sucesso/fracasso) permanece em captura; fixture de Pokémon prestes a subir de nível valida efeito flutuante **no sprite** após um combate real, ausência do cartão antigo e remoção do efeito após ~2,3s.

**Gate de release:** regressão geral TypeScript/Vitest/web, Playwright isolado desktop/mobile, Docker, merge por squash e Railway deploy SUCCESS no SHA exato com `/health` interno. Não confundir com GET público externo verificado.

## D064BO — próxima implementação de loja

Esta entrega aplica **somente as três correções pedidas**. A futura loja continua sem preços oficiais ou compra implementada. A fase de implementação de compras deverá definir preços, limites por item/região e gastos sustentáveis comparando emissão de moedas/bolas em combate e expedição, agora incluindo **Ultra Ball por batalha R7+**. Só então implementar compras idempotentes com saldo e item em uma única revisão do writer, rollback em falta de fundos/estoque/cap, proteção de duas abas e testes E2E. Não conceder Master Ball automaticamente nem migrar saves de forma destrutiva.

Nenhuma alteração permitida em `isaquesan7/pokedex`.
